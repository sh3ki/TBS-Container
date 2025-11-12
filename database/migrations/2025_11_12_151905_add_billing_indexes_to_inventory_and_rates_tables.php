<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add indexes to fjp_inventory for billing performance
        Schema::table('inventory', function (Blueprint $table) {
            // Composite index for billing date range queries
            $table->index(['gate_status', 'date_added'], 'idx_inventory_billing_date');
            
            // Index for client filtering
            $table->index(['client_id', 'gate_status'], 'idx_inventory_client_status');
            
            // Index for container lookup
            $table->index(['container_no', 'complete'], 'idx_inventory_container_complete');
            
            // Index for OUT records join
            $table->index('out_id', 'idx_inventory_out_id');
        });

        // Add indexes to fjp_storage_rate for rate lookups
        Schema::table('storage_rate', function (Blueprint $table) {
            // Composite index for client and size lookup
            $table->index(['client_id', 'size'], 'idx_storage_rate_lookup');
        });

        // Add indexes to fjp_handling_rate for rate lookups
        Schema::table('handling_rate', function (Blueprint $table) {
            // Composite index for client and size lookup
            $table->index(['client_id', 'size'], 'idx_handling_rate_lookup');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop indexes from inventory
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropIndex('idx_inventory_billing_date');
            $table->dropIndex('idx_inventory_client_status');
            $table->dropIndex('idx_inventory_container_complete');
            $table->dropIndex('idx_inventory_out_id');
        });

        // Drop indexes from storage_rate
        Schema::table('storage_rate', function (Blueprint $table) {
            $table->dropIndex('idx_storage_rate_lookup');
        });

        // Drop indexes from handling_rate
        Schema::table('handling_rate', function (Blueprint $table) {
            $table->dropIndex('idx_handling_rate_lookup');
        });
    }
};
