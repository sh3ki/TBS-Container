<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $queuePageId = DB::table('pages')->where('page', 'queue-admin')->value('p_id');
            $legacyQueuePageId = DB::table('pages')->whereIn('page', ['queuelist', 'queue'])->value('p_id');

            // Keep access rows from installations that still use the old page key.
            if ($queuePageId === null && $legacyQueuePageId !== null) {
                DB::table('pages')->where('p_id', $legacyQueuePageId)->update(['page' => 'queue-admin']);
                $queuePageId = $legacyQueuePageId;
            } elseif ($queuePageId !== null && $legacyQueuePageId !== null && $queuePageId !== $legacyQueuePageId) {
                $legacyAccess = DB::table('pages_access')
                    ->where('page_id', $legacyQueuePageId)
                    ->get(['privilege', 'acs_edit', 'acs_delete']);

                foreach ($legacyAccess as $access) {
                    DB::table('pages_access')->updateOrInsert(
                        ['page_id' => $queuePageId, 'privilege' => $access->privilege],
                        ['acs_edit' => $access->acs_edit, 'acs_delete' => $access->acs_delete],
                    );
                }

                DB::table('pages_access')->where('page_id', $legacyQueuePageId)->delete();
                DB::table('pages')->where('p_id', $legacyQueuePageId)->delete();
            }

            if ($queuePageId === null) {
                return;
            }

            DB::table('pages')
                ->where('p_id', '<>', $queuePageId)
                ->where('arrange_no', '>=', 11)
                ->update(['arrange_no' => DB::raw('arrange_no + 1')]);

            DB::table('pages')->where('p_id', $queuePageId)->update([
                'page_name' => 'Queue Admin',
                'category' => 'Administration',
                'arrange_no' => 11,
            ]);
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $queuePageId = DB::table('pages')->where('page', 'queue-admin')->value('p_id');

            if ($queuePageId === null) {
                return;
            }

            DB::table('pages')->where('p_id', $queuePageId)->update([
                'page' => 'queuelist',
                'page_name' => 'Queue',
                'category' => 'Container Operations',
                'arrange_no' => 5,
            ]);

            DB::table('pages')
                ->where('p_id', '<>', $queuePageId)
                ->where('arrange_no', '>=', 12)
                ->update(['arrange_no' => DB::raw('arrange_no - 1')]);
        });
    }
};
