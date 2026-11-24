<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dmr_delivery_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('client_id');
            $table->date('report_date');
            $table->dateTime('scheduled_at')->nullable();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('sent_at')->nullable();
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->string('message_id', 512)->nullable();
            $table->text('error_message')->nullable();
            $table->dateTime('last_error_at')->nullable();
            $table->timestamps();

            $table->unique(['client_id', 'report_date'], 'dmr_delivery_client_date_unique');
            $table->index('status', 'dmr_delivery_status_idx');
            $table->index('report_date', 'dmr_delivery_report_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dmr_delivery_logs');
    }
};
