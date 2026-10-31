<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $dashboardPageId = DB::table('pages')->where('page', 'dashboard')->value('p_id');

            if ($dashboardPageId === null) {
                $dashboardPageId = DB::table('pages')->insertGetId([
                    'page' => 'dashboard',
                    'page_name' => 'Dashboard',
                    'page_icon' => 'dashboard',
                    'arrange_no' => 0,
                ], 'p_id');
            }

            $userOnePrivilege = DB::table('users')->where('user_id', 1)->value('priv_id');

            if ($userOnePrivilege !== null) {
                $alreadyGranted = DB::table('pages_access')
                    ->where('page_id', $dashboardPageId)
                    ->where('privilege', $userOnePrivilege)
                    ->exists();

                if (!$alreadyGranted) {
                    DB::table('pages_access')->insert([
                        'page_id' => $dashboardPageId,
                        'privilege' => $userOnePrivilege,
                        'acs_edit' => 0,
                        'acs_delete' => 0,
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $dashboardPageId = DB::table('pages')->where('page', 'dashboard')->value('p_id');

            if ($dashboardPageId === null) {
                return;
            }

            DB::table('pages_access')->where('page_id', $dashboardPageId)->delete();
            DB::table('pages')->where('p_id', $dashboardPageId)->delete();
        });
    }
};
