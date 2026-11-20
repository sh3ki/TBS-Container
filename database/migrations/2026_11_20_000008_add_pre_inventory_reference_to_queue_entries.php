<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_entries', function (Blueprint $table): void {
            $table->unsignedBigInteger('pre_inventory_id')->nullable()->after('id');
            $table->index('pre_inventory_id', 'queue_entries_pre_inventory_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('queue_entries', function (Blueprint $table): void {
            $table->dropIndex('queue_entries_pre_inventory_id_index');
            $table->dropColumn('pre_inventory_id');
        });
    }
};
