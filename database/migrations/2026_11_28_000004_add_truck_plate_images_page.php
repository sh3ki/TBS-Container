<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $pageId = DB::table('pages')->where('page', 'truckplateimages')->value('p_id');

            if ($pageId === null) {
                DB::table('pages')
                    ->where('arrange_no', '>=', 7)
                    ->update(['arrange_no' => DB::raw('arrange_no + 1')]);

                $pageId = DB::table('pages')->insertGetId([
                    'page' => 'truckplateimages',
                    'page_name' => 'Truck Plate Images',
                    'page_icon' => 'fa fa-fw fa-truck',
                    'category' => 'Container Operations',
                    'arrange_no' => 7,
                ], 'p_id');
            } elseif ((int) DB::table('pages')->where('p_id', $pageId)->value('arrange_no') !== 7) {
                DB::table('pages')
                    ->where('p_id', '<>', $pageId)
                    ->where('arrange_no', '>=', 7)
                    ->update(['arrange_no' => DB::raw('arrange_no + 1')]);

                DB::table('pages')->where('p_id', $pageId)->update([
                    'page_name' => 'Truck Plate Images',
                    'page_icon' => 'fa fa-fw fa-truck',
                    'category' => 'Container Operations',
                    'arrange_no' => 7,
                ]);
            } else {
                DB::table('pages')->where('p_id', $pageId)->update([
                    'page_name' => 'Truck Plate Images',
                    'page_icon' => 'fa fa-fw fa-truck',
                    'category' => 'Container Operations',
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
            $pageId = DB::table('pages')->where('page', 'truckplateimages')->value('p_id');
            if ($pageId === null) {
                return;
            }

            $arrangeNo = (int) DB::table('pages')->where('p_id', $pageId)->value('arrange_no');
            DB::table('pages_access')->where('page_id', $pageId)->delete();
            DB::table('pages')->where('p_id', $pageId)->delete();
            DB::table('pages')
                ->where('arrange_no', '>', $arrangeNo)
                ->update(['arrange_no' => DB::raw('arrange_no - 1')]);
        });
    }
};
