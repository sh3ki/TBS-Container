<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('queue_standby_status')->upsert([
            [
                'code' => 'S1',
                'name' => '40ft Container Entrance Hold',
                'message' => 'We apologize for the delay. Your truck has been placed on standby while we manage the entry of 40ft containers. Thank you for your patience.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'S2',
                'name' => '20ft Container Entrance Hold',
                'message' => 'We apologize for the delay. Your truck has been placed on standby while we manage the entry of 20ft containers. Thank you for your patience.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'S3',
                'name' => 'Container Extraction Delay',
                'message' => 'We apologize for the delay. Your truck has been placed on standby while we carefully extract your container from the yard. Thank you for your patience.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'S4',
                'name' => 'Yard Capacity Hold',
                'message' => 'We apologize for the delay. Your truck has been placed on standby as we temporarily prioritize gate-out operations before gate-in due to limited yard capacity. Thank you for your patience and understanding.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'S5',
                'name' => 'Crane Breakdown',
                'message' => 'We apologize for the inconvenience. Your truck has been placed on standby while our team addresses the crane equipment issue. Thank you for your understanding.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'S6',
                'name' => 'System Downtime',
                'message' => 'We apologize for the delay. Your truck has been placed on standby while we resolve a temporary system issue. Thank you for your patience and understanding.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'S7',
                'name' => 'Yard Power Outage',
                'message' => 'We sincerely apologize for the inconvenience. Your truck has been placed on standby while we address the yard power interruption. We appreciate your patience.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ], ['code'], ['name', 'message', 'updated_at']);
    }

    public function down(): void
    {
        DB::table('queue_standby_status')->whereIn('code', [
            'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
        ])->delete();
    }
};
