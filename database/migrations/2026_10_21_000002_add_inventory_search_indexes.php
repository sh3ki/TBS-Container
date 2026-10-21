<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            // Supports the default real-time inventory predicate and newest-first
            // retrieval without scanning the historical table first.
            $table->index(
                ['gate_status', 'complete', 'out_id', 'i_id'],
                'idx_inventory_realtime_order'
            );

            // Supports client/container filtering before the newest-first scan.
            $table->index(
                ['client_id', 'gate_status', 'i_id'],
                'idx_inventory_client_gate_order'
            );
        });
    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropIndex('idx_inventory_realtime_order');
            $table->dropIndex('idx_inventory_client_gate_order');
        });
    }
};
