<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_delivery_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('provider')->default('smsgate');
            $table->string('provider_message_id')->nullable()->index();
            $table->unsignedBigInteger('queue_entry_id')->nullable()->index();
            $table->string('queue_status')->nullable();
            $table->unsignedBigInteger('standby_status_id')->nullable();
            $table->string('recipient', 30);
            $table->text('message');
            $table->string('status')->default('pending')->index();
            $table->json('provider_response')->nullable();
            $table->json('webhook_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();
            $table->foreign('queue_entry_id')->references('id')->on('queue_entries')->nullOnDelete();
            $table->foreign('standby_status_id')->references('id')->on('queue_standby_status')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_delivery_logs');
    }
};
