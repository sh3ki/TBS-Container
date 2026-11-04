<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $appSettingsId = DB::table('pages')->where('page', 'app-settings')->value('p_id');

            if ($appSettingsId === null) {
                $appSettingsId = DB::table('pages')->insertGetId([
                    'page' => 'app-settings',
                    'page_name' => 'App Settings',
                    'page_icon' => 'settings',
                    'category' => 'Administration',
                    'arrange_no' => 13,
                ], 'p_id');
            }

            // Reserve positions 13 and 14 for App Settings and Audit Logs.
            DB::table('pages')
                ->where('p_id', '<>', $appSettingsId)
                ->where('arrange_no', '>=', 13)
                ->update(['arrange_no' => DB::raw('arrange_no + 2')]);

            DB::table('pages')
                ->where('p_id', $appSettingsId)
                ->update([
                    'page_name' => 'App Settings',
                    'page_icon' => 'settings',
                    'category' => 'Administration',
                    'arrange_no' => 13,
                ]);

            DB::table('pages')
                ->where('page', 'audit')
                ->update([
                    'page_name' => 'Audit Logs',
                    'category' => 'Administration',
                    'arrange_no' => 14,
                ]);

            DB::table('pages_access')->updateOrInsert(
                ['page_id' => $appSettingsId, 'privilege' => 1],
                ['acs_edit' => 1, 'acs_delete' => 1],
            );
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $appSettingsId = DB::table('pages')->where('page', 'app-settings')->value('p_id');

            if ($appSettingsId === null) {
                return;
            }

            DB::table('pages_access')->where('page_id', $appSettingsId)->delete();
            DB::table('pages')->where('p_id', $appSettingsId)->delete();

            DB::table('pages')
                ->where('arrange_no', '>', 14)
                ->update(['arrange_no' => DB::raw('arrange_no - 2')]);

            DB::table('pages')
                ->where('page', 'audit')
                ->update(['arrange_no' => 12]);
        });
    }
};
