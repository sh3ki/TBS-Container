<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private string $table;

    public function __construct()
    {
        $this->table = 'queue_entries';
    }

    public function up(): void
    {
        Schema::table($this->table, function (Blueprint $table): void {
            $table->renameColumn('queued_at', 'booking_time');
            $table->date('queue_date')->useCurrent()->after('serving_number');
            $table->dropIndex('queue_waiting_order_idx');
            $table->dropIndex('queue_serving_order_idx');
            $table->index(['queue_date', 'status', 'direction', 'waiting_number'], 'queue_waiting_order_idx');
            $table->index(['queue_date', 'status', 'serving_number'], 'queue_serving_order_idx');
        });
    }

    public function down(): void
    {
        Schema::table($this->table, function (Blueprint $table): void {
            $table->dropIndex('queue_waiting_order_idx');
            $table->dropIndex('queue_serving_order_idx');
            $table->dropColumn('queue_date');
            $table->renameColumn('booking_time', 'queued_at');
            $table->index(['status', 'direction', 'waiting_number'], 'queue_waiting_order_idx');
            $table->index(['status', 'serving_number'], 'queue_serving_order_idx');
        });
    }
};
