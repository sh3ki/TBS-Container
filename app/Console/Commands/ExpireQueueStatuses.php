<?php

namespace App\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpireQueueStatuses extends Command
{
    protected $signature = 'queue:expire-statuses';
    protected $description = 'Automatically move expired calling and floating queue entries';

    public function handle(): int
    {
        $settings = DB::table('app_settings')->where('setting_id', 1)->first([
            'calling_expiration_minutes',
            'floating_expiration_minutes',
        ]);
        $now = Carbon::now('Asia/Manila');
        $callingCount = $this->expireCalling((int) ($settings?->calling_expiration_minutes ?? 0), $now);
        $floatingCount = $this->expireFloating((int) ($settings?->floating_expiration_minutes ?? 0), $now);

        if ($callingCount || $floatingCount) {
            $this->info("Queue expiration completed. Calling: {$callingCount}; Floating: {$floatingCount}.");
        }

        return self::SUCCESS;
    }

    private function expireCalling(int $minutes, Carbon $now): int
    {
        if ($minutes < 1) return 0;

        $threshold = $now->copy()->subMinutes($minutes);
        $ids = DB::table('queue_entries')
            ->where('status', 'calling')
            ->whereNull('completed_at')
            ->whereNotNull('calling_at')
            ->where('calling_at', '<=', $threshold)
            ->pluck('id');
        $changed = 0;

        foreach ($ids as $id) {
            $didChange = DB::transaction(function () use ($id, $threshold, $now): bool {
                $entry = DB::table('queue_entries')->where('id', $id)->lockForUpdate()->first();
                if (!$entry || $entry->status !== 'calling' || !$entry->calling_at || Carbon::parse($entry->calling_at)->greaterThan($threshold)) return false;

                DB::table('queue_entries')->where('id', $entry->id)->update([
                    'status' => 'floating',
                    'floating_at' => $now,
                    'updated_at' => $now,
                ]);
                $this->logAutomaticTransition($entry->plate_no, 'calling', 'floating', $now);
                return true;
            });
            if ($didChange) {
                $changed++;
                app(\App\Services\SmsService::class)->sendQueueStatusForEntry((int) $id, 'floating');
            }
        }

        return $changed;
    }

    private function expireFloating(int $minutes, Carbon $now): int
    {
        if ($minutes < 1) return 0;

        $threshold = $now->copy()->subMinutes($minutes);
        $ids = DB::table('queue_entries')
            ->where('status', 'floating')
            ->whereNull('completed_at')
            ->whereNotNull('floating_at')
            ->where('floating_at', '<=', $threshold)
            ->pluck('id');
        $changed = 0;

        foreach ($ids as $id) {
            $didChange = DB::transaction(function () use ($id, $threshold, $now): bool {
                $entry = DB::table('queue_entries')->where('id', $id)->lockForUpdate()->first();
                if (!$entry || $entry->status !== 'floating' || !$entry->floating_at || Carbon::parse($entry->floating_at)->greaterThan($threshold)) return false;

                DB::table('queue_entries')->where('id', $entry->id)->update([
                    'status' => 'forfeited',
                    'forfeited_at' => $now,
                    'updated_at' => $now,
                ]);
                $waiting = DB::table('queue_entries')
                    ->where('direction', $entry->direction)
                    ->whereIn('status', ['waiting', 'calling', 'floating'])
                    ->whereNull('completed_at')
                    ->orderBy('waiting_number')->orderBy('id')
                    ->lockForUpdate()->get(['id']);
                foreach ($waiting as $index => $waitingEntry) {
                    DB::table('queue_entries')->where('id', $waitingEntry->id)->update([
                        'waiting_number' => $index + 1,
                        'updated_at' => $now,
                    ]);
                }
                $this->logAutomaticTransition($entry->plate_no, 'floating', 'forfeited', $now);
                return true;
            });
            if ($didChange) {
                $changed++;
                app(\App\Services\SmsService::class)->sendQueueStatusForEntry((int) $id, 'forfeited');
            }
        }

        return $changed;
    }

    private function logAutomaticTransition(string $plateNo, string $from, string $to, Carbon $now): void
    {
        DB::table('audit_logs')->insert([
            'action' => 'EDIT',
            'description' => sprintf('[QUEUE] Auto change plate number "%s" status from %s to %s.', $plateNo, $from, $to),
            'user_id' => 0,
            'date_added' => $now,
            'ip_address' => '0.0.0.0',
        ]);
    }
}
