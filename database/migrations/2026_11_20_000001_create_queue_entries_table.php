<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(env('DB_PREFIX', 'fjp_') . 'queue_entries', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('plate_no', 50);
            $table->enum('direction', ['IN', 'OUT']);
            $table->enum('status', ['waiting', 'serving', 'completed', 'cancelled'])->default('waiting');
            $table->unsignedInteger('waiting_number')->nullable();
            $table->unsignedInteger('serving_number')->nullable();
            $table->timestamp('queued_at')->useCurrent();
            $table->timestamp('serving_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'direction', 'waiting_number'], 'queue_waiting_order_idx');
            $table->index(['status', 'serving_number'], 'queue_serving_order_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(env('DB_PREFIX', 'fjp_') . 'queue_entries');
    }
};
