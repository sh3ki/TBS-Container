<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $queuePageId = DB::table('pages')->where('page', 'queue')->value('p_id');

            if ($queuePageId === null) {
                DB::table('pages')
                    ->where('arrange_no', '>=', 5)
                    ->update(['arrange_no' => DB::raw('arrange_no + 1')]);

                $queuePageId = DB::table('pages')->insertGetId([
                    'page' => 'queue',
                    'page_name' => 'Queue',
                    'page_icon' => 'list',
                    'category' => 'Container Operations',
                    'arrange_no' => 5,
                ], 'p_id');
            } else {
                DB::table('pages')->where('p_id', $queuePageId)->update([
                    'page_name' => 'Queue',
                    'page_icon' => 'list',
                    'category' => 'Container Operations',
                    'arrange_no' => 5,
                ]);
            }

            DB::table('pages_access')->updateOrInsert(
                ['page_id' => $queuePageId, 'privilege' => 1],
                ['acs_edit' => 1, 'acs_delete' => 1],
            );
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $queuePageId = DB::table('pages')->where('page', 'queue')->value('p_id');
            if ($queuePageId === null) {
                return;
            }

            DB::table('pages_access')->where('page_id', $queuePageId)->delete();
            DB::table('pages')->where('p_id', $queuePageId)->delete();
            DB::table('pages')
                ->where('arrange_no', '>', 5)
                ->update(['arrange_no' => DB::raw('arrange_no - 1')]);
        });
    }
};
