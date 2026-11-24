<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UtilizationSnapshotService
{
    public function capture(Carbon $capturedAt): int
    {
        $settings = DB::table('app_settings')->where('setting_id', 1)->first();
        $capacityTeus = (float) ($settings?->utilization_capacity_teus ?? 0);

        if ($capacityTeus < 1) {
            throw new \RuntimeException('Utilization capacity TEUS must be at least 1.');
        }

        $prefix = DB::getTablePrefix();
        $rows = DB::select(
            "SELECT i.client_id, COALESCE(c.client_code, c.client_name) AS client_name,
                    CONCAT(st.size, st.type) AS size_type, COUNT(*) AS container_count
             FROM {$prefix}inventory i
             LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
             LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
             WHERE c.archived = 0
               AND i.gate_status = 'IN'
               AND i.complete = 0
               AND (i.out_id IS NULL OR i.out_id = 0)
             GROUP BY i.client_id, client_name, size_type
             ORDER BY client_name, size_type"
        );

        $clientTotals = [];
        $sizeTotals = [];
        $totalContainerCount = 0;
        $totalTeus = 0.0;

        foreach ($rows as $row) {
            $count = (int) $row->container_count;
            $teus = $count * $this->teusPerContainer((string) $row->size_type);
            $clientKey = (string) ($row->client_id ?? $row->client_name);
            $sizeKey = (string) $row->size_type;

            $clientTotals[$clientKey] ??= [
                'client_id' => $row->client_id ? (int) $row->client_id : null,
                'client_name' => (string) $row->client_name,
                'total_container_count' => 0,
                'total_teus' => 0.0,
            ];
            $clientTotals[$clientKey]['total_container_count'] += $count;
            $clientTotals[$clientKey]['total_teus'] += $teus;

            $sizeTotals[$sizeKey] ??= ['size_type' => $sizeKey, 'total_container_count' => 0, 'total_teus' => 0.0];
            $sizeTotals[$sizeKey]['total_container_count'] += $count;
            $sizeTotals[$sizeKey]['total_teus'] += $teus;
            $totalContainerCount += $count;
            $totalTeus += $teus;
        }

        return DB::transaction(function () use ($capturedAt, $capacityTeus, $rows, $clientTotals, $sizeTotals, $totalContainerCount, $totalTeus): int {
            $date = $capturedAt->toDateString();
            $utilization = DB::table('utilizations')->where('utilization_date', $date)->first();
            $values = [
                'captured_at' => $capturedAt->format('Y-m-d H:i:s'),
                'total_container_count' => $totalContainerCount,
                'total_teus' => $totalTeus,
                'capacity_teus' => $capacityTeus,
                'utilization_percentage' => round(($totalTeus / $capacityTeus) * 100, 2),
                'updated_at' => now(),
            ];

            if ($utilization) {
                DB::table('utilizations')->where('id', $utilization->id)->update($values);
                $utilizationId = (int) $utilization->id;
                DB::table('utilization_client_size_rows')->where('utilization_id', $utilizationId)->delete();
                DB::table('utilization_client_totals')->where('utilization_id', $utilizationId)->delete();
                DB::table('utilization_size_totals')->where('utilization_id', $utilizationId)->delete();
            } else {
                $utilizationId = (int) DB::table('utilizations')->insertGetId($values + [
                    'utilization_date' => $date,
                    'created_at' => now(),
                ]);
            }

            $now = now();
            foreach ($rows as $row) {
                $count = (int) $row->container_count;
                DB::table('utilization_client_size_rows')->insert([
                    'utilization_id' => $utilizationId,
                    'client_id' => $row->client_id ? (int) $row->client_id : null,
                    'client_name' => (string) $row->client_name,
                    'size_type' => (string) $row->size_type,
                    'container_count' => $count,
                    'teus' => $count * $this->teusPerContainer((string) $row->size_type),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
            foreach ($clientTotals as $row) DB::table('utilization_client_totals')->insert($row + ['utilization_id' => $utilizationId, 'created_at' => $now, 'updated_at' => $now]);
            foreach ($sizeTotals as $row) DB::table('utilization_size_totals')->insert($row + ['utilization_id' => $utilizationId, 'created_at' => $now, 'updated_at' => $now]);

            return $utilizationId;
        });
    }

    private function teusPerContainer(string $sizeType): float
    {
        return in_array(substr($sizeType, 0, 2), ['40', '45'], true) ? 2.0 : (substr($sizeType, 0, 2) === '20' ? 1.0 : 0.0);
    }
}
