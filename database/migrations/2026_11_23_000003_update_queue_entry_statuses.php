<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['calling_at', 'floating_at', 'forfeited_at'] as $column) {
            if (! Schema::hasColumn('queue_entries', $column)) {
                Schema::table('queue_entries', function (Blueprint $table) use ($column): void {
                    $table->timestamp($column)->nullable();
                });
            }
        }

        $table = DB::getTablePrefix() . 'queue_entries';

        // Temporarily allow both legacy and replacement values so existing
        // cancelled rows can be converted safely.
        DB::statement("ALTER TABLE `{$table}` MODIFY COLUMN `status` ENUM('waiting','calling','floating','serving','completed','cancelled','forfeited') NOT NULL DEFAULT 'waiting'");

        // Preserve existing data while replacing the old cancelled state.
        DB::table('queue_entries')
            ->where('status', 'cancelled')
            ->update(['status' => 'forfeited', 'forfeited_at' => DB::raw('COALESCE(forfeited_at, updated_at)')]);

        DB::statement("ALTER TABLE `{$table}` MODIFY COLUMN `status` ENUM('waiting','calling','floating','serving','completed','forfeited') NOT NULL DEFAULT 'waiting'");
    }

    public function down(): void
    {
        $table = DB::getTablePrefix() . 'queue_entries';

        DB::statement("ALTER TABLE `{$table}` MODIFY COLUMN `status` ENUM('waiting','calling','floating','serving','completed','cancelled','forfeited') NOT NULL DEFAULT 'waiting'");

        DB::table('queue_entries')
            ->where('status', 'forfeited')
            ->update(['status' => 'cancelled']);

        DB::statement("ALTER TABLE `{$table}` MODIFY COLUMN `status` ENUM('waiting','serving','completed','cancelled') NOT NULL DEFAULT 'waiting'");

        foreach (['calling_at', 'floating_at', 'forfeited_at'] as $column) {
            if (Schema::hasColumn('queue_entries', $column)) {
                Schema::table('queue_entries', function (Blueprint $table) use ($column): void {
                    $table->dropColumn($column);
                });
            }
        }
    }
};
