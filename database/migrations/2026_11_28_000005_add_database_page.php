<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $pageId = DB::table('pages')->where('page', 'database')->value('p_id');
            if ($pageId === null) {
                DB::table('pages')->where('arrange_no', '>=', 19)->update(['arrange_no' => DB::raw('arrange_no + 1')]);
                $pageId = DB::table('pages')->insertGetId([
                    'page' => 'database', 'page_name' => 'Database', 'page_icon' => 'fa fa-fw fa-database',
                    'category' => 'Administration', 'arrange_no' => 19,
                ], 'p_id');
            } else {
                $currentArrangeNo = (int) DB::table('pages')->where('p_id', $pageId)->value('arrange_no');
                if ($currentArrangeNo !== 19) {
                    DB::table('pages')->where('p_id', '<>', $pageId)->where('arrange_no', '>=', 19)->update(['arrange_no' => DB::raw('arrange_no + 1')]);
                }
                DB::table('pages')->where('p_id', $pageId)->update([
                    'page_name' => 'Database', 'page_icon' => 'fa fa-fw fa-database',
                    'category' => 'Administration', 'arrange_no' => 19,
                ]);
            }
            DB::table('pages_access')->updateOrInsert(
                ['page_id' => $pageId, 'privilege' => 1], ['acs_edit' => 1, 'acs_delete' => 1]
            );
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $page = DB::table('pages')->where('page', 'database')->first(['p_id', 'arrange_no']);
            if (!$page) return;
            DB::table('pages_access')->where('page_id', $page->p_id)->delete();
            DB::table('pages')->where('p_id', $page->p_id)->delete();
            DB::table('pages')->where('arrange_no', '>', $page->arrange_no)->update(['arrange_no' => DB::raw('arrange_no - 1')]);
        });
    }
};
