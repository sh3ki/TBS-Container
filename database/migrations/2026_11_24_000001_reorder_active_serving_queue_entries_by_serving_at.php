<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('queue_entries')) {
            return;
        }

        foreach (['IN', 'OUT'] as $direction) {
            $entries = DB::table('queue_entries')
                ->where('direction', $direction)
                ->where('status', 'serving')
                ->whereNull('completed_at')
                // Older rows without serving_at are placed after timestamped
                // rows, with the queue record ID as their stable fallback.
                ->orderByRaw('CASE WHEN serving_at IS NULL THEN 1 ELSE 0 END')
                ->orderBy('serving_at')
                ->orderBy('id')
                ->pluck('id');

            foreach ($entries as $index => $id) {
                DB::table('queue_entries')
                    ->where('id', $id)
                    ->update(['serving_number' => $index + 1]);
            }
        }
    }

    public function down(): void
    {
        // Serving numbers are derived ordering data; there is no safe
        // historical ordering to restore after this migration.
    }
};
