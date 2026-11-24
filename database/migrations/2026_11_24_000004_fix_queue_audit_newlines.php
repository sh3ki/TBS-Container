<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('audit_logs')
            ->where('description', 'like', '%\\n%')
            ->where('description', 'like', '[QUEUE] Rearranged%')
            ->get(['a_id', 'description'])
            ->each(function (object $log): void {
                DB::table('audit_logs')
                    ->where('a_id', $log->a_id)
                    ->update(['description' => str_replace('\\n', PHP_EOL, $log->description)]);
            });
    }

    public function down(): void
    {
        DB::table('audit_logs')
            ->where('description', 'like', '%[QUEUE] Rearranged%')
            ->get(['a_id', 'description'])
            ->each(function (object $log): void {
                DB::table('audit_logs')
                    ->where('a_id', $log->a_id)
                    ->update(['description' => str_replace(PHP_EOL, '\\n', $log->description)]);
            });
    }
};
