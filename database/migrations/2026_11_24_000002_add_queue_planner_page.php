<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $pageId = DB::table('pages')->where('page', 'queue-planner')->value('p_id');

            if ($pageId === null) {
                DB::table('pages')
                    ->where('arrange_no', '>=', 2)
                    ->update(['arrange_no' => DB::raw('arrange_no + 1')]);

                $pageId = DB::table('pages')->insertGetId([
                    'page' => 'queue-planner',
                    'page_name' => 'Queue Planner',
                    'page_icon' => 'list',
                    'category' => 'Container Operations',
                    'arrange_no' => 2,
                ], 'p_id');
            } else {
                DB::table('pages')
                    ->where('p_id', '<>', $pageId)
                    ->where('arrange_no', '>=', 2)
                    ->update(['arrange_no' => DB::raw('arrange_no + 1')]);

                DB::table('pages')->where('p_id', $pageId)->update([
                    'page_name' => 'Queue Planner',
                    'page_icon' => 'list',
                    'category' => 'Container Operations',
                    'arrange_no' => 2,
                ]);
            }

            DB::table('pages_access')->updateOrInsert(
                ['page_id' => $pageId, 'privilege' => 1],
                ['acs_edit' => 1, 'acs_delete' => 1],
            );
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $pageId = DB::table('pages')->where('page', 'queue-planner')->value('p_id');
            if ($pageId === null) {
                return;
            }

            DB::table('pages_access')->where('page_id', $pageId)->delete();
            DB::table('pages')->where('p_id', $pageId)->delete();
            DB::table('pages')
                ->where('arrange_no', '>', 2)
                ->update(['arrange_no' => DB::raw('arrange_no - 1')]);
        });
    }
};
