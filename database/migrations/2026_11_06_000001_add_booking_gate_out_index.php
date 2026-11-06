<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table): void {
            // The booking containers modal filters by booking, gate status and
            // completion, then reads rows in date order. Put the equality
            // predicates first so MySQL can avoid scanning historical inventory.
            $table->index(
                ['booking', 'gate_status', 'complete', 'date_added'],
                'idx_inventory_booking_gate_out'
            );
        });
    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table): void {
            $table->dropIndex('idx_inventory_booking_gate_out');
        });
    }
};
