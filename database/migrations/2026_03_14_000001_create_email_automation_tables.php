<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_reply_queue', function (Blueprint $table) {
            $table->id();
            $table->string('to_email', 255);
            $table->string('reply_type', 8)->default('OK'); // OK|ERR
            $table->string('subject', 255);
            $table->text('body')->nullable();
            $table->string('attachment_path', 500)->nullable();
            $table->string('status', 20)->default('pending'); // pending|sent|failed
            $table->unsignedInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->string('source_message_id', 255)->nullable();
            $table->string('source_subject', 255)->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['to_email', 'status']);
            $table->index('source_message_id');
        });

        Schema::create('email_automation_logs', function (Blueprint $table) {
            $table->id();
            $table->string('direction', 30); // incoming|scheduled|reply
            $table->string('status', 20); // ok|error|skipped
            $table->string('from_email', 255)->nullable();
            $table->string('to_email', 255)->nullable();
            $table->string('subject', 255)->nullable();
            $table->string('message_id', 255)->nullable();
            $table->string('attachment_path', 500)->nullable();
            $table->text('details')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['direction', 'status', 'created_at']);
            $table->index('message_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_automation_logs');
        Schema::dropIfExists('email_reply_queue');
    }
};
