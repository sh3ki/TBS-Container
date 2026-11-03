<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $pageId = DB::table('pages')->where('page', 'mobile-settings')->value('p_id');

            if ($pageId === null) {
                $pageId = DB::table('pages')->insertGetId([
                    'page' => 'mobile-settings',
                    'page_name' => 'Mobile Settings',
                    'page_icon' => 'smartphone',
                    'category' => 'Administration',
                    'arrange_no' => (int) DB::table('pages')->max('arrange_no') + 1,
                ], 'p_id');
            }

            DB::table('pages')
                ->where('p_id', $pageId)
                ->update([
                    'category' => 'Administration',
                    'page_icon' => 'smartphone',
                ]);

            $alreadyGranted = DB::table('pages_access')
                ->where('page_id', $pageId)
                ->where('privilege', 1)
                ->exists();

            if (!$alreadyGranted) {
                DB::table('pages_access')->insert([
                    'page_id' => $pageId,
                    'privilege' => 1,
                    'acs_edit' => 1,
                    'acs_delete' => 1,
                ]);
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $pageId = DB::table('pages')->where('page', 'mobile-settings')->value('p_id');

            if ($pageId === null) {
                return;
            }

            DB::table('pages_access')->where('page_id', $pageId)->delete();
            DB::table('pages')->where('p_id', $pageId)->delete();
        });
    }
};
