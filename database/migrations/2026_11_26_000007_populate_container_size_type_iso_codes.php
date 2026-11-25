<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $isoByKey = [
            '20DC' => '22G1',
            '20STANDARDDRYCONTAINER' => '22G1',
            '20FR' => '22P1',
            '20FLATRACK' => '22P1',
            '20OT' => '22U1',
            '20OPENTOP' => '22U1',
            '20RF' => '22R1',
            '20STANDARDREEFERCONTAINER' => '22R1',
            '20RH' => '25R1',
            '40DC' => '42G1',
            '40STANDARDDRYCONTAINER' => '42G1',
            '40FR' => '42P1',
            '40FLATRACK' => '42P1',
            '40HC' => '45G1',
            '40HIGHCUBEDRYCONTAINER' => '45G1',
            '40RF' => '42R1',
            '40STANDARDREEFERCONTAINER' => '42R1',
            '40OT' => '42U1',
            '40OPENTOP' => '42U1',
            '40RH' => '45R1',
            '40HIGHCUBEREEFERCONTAINER' => '45R1',
            '45HC' => 'L5G1',
            '45HIGHCUBEDRYCONTAINER' => 'L5G1',
        ];

        foreach (DB::table('container_size_type')->get(['s_id', 'size', 'type']) as $row) {
            $key = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) $row->size . (string) $row->type));
            if (isset($isoByKey[$key])) {
                DB::table('container_size_type')->where('s_id', $row->s_id)->update([
                    'iso_code' => $isoByKey[$key],
                ]);
            }
        }
    }

    public function down(): void
    {
        // ISO values are reference data and are intentionally retained on rollback.
    }
};
