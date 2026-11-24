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
                return;
            }

            DB::table('pages')->where('p_id', $pageId)->update(['arrange_no' => 0]);
            DB::table('pages')
                ->where('p_id', '<>', $pageId)
                ->where('arrange_no', '>=', 1)
                ->update(['arrange_no' => DB::raw('arrange_no + 1')]);
            DB::table('pages')->where('p_id', $pageId)->update(['arrange_no' => 1]);
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $pageId = DB::table('pages')->where('page', 'queue-planner')->value('p_id');
            if ($pageId === null) {
                return;
            }

            DB::table('pages')->where('p_id', $pageId)->update(['arrange_no' => 0]);
            DB::table('pages')
                ->where('p_id', '<>', $pageId)
                ->where('arrange_no', '>=', 2)
                ->update(['arrange_no' => DB::raw('arrange_no - 1')]);
            DB::table('pages')->where('p_id', $pageId)->update(['arrange_no' => 2]);
        });
    }
};
