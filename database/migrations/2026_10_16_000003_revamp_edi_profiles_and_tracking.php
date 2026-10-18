<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('edi_profiles', function (Blueprint $table) {
            $table->timestamp('enabled_at')->nullable()->after('is_enabled');
            $table->enum('direction_mode', ['IN', 'OUT', 'BOTH'])->default('BOTH')->after('edi_type');
            $table->unsignedSmallInteger('schedule_minutes')->default(5)->after('interval_seconds');
            $table->unsignedSmallInteger('retry_delay_seconds')->default(120)->after('max_attempts');
            $table->unsignedInteger('profile_version')->default(1)->after('retry_delay_seconds');
        });

        Schema::create('edi_profile_directions', function (Blueprint $table) {
            $table->id('direction_id');
            $table->foreignId('profile_id')->constrained('edi_profiles', 'profile_id')->cascadeOnDelete();
            $table->enum('direction', ['IN', 'OUT']);
            $table->enum('file_type', ['EDI', 'TXT'])->default('EDI');
            $table->string('sample_filename', 255)->nullable();
            $table->longText('sample_content')->nullable();
            $table->json('mapping_suggestions')->nullable();
            $table->json('mappings')->nullable();
            $table->timestamps();
            $table->unique(['profile_id', 'direction']);
        });

        Schema::create('edi_transactions', function (Blueprint $table) {
            $table->id('transaction_id');
            $table->foreignId('profile_id')->constrained('edi_profiles', 'profile_id')->cascadeOnDelete();
            $table->enum('direction', ['IN', 'OUT']);
            $table->unsignedBigInteger('inventory_id');
            $table->unsignedInteger('profile_version');
            $table->enum('status', ['pending', 'generating', 'generated', 'sending', 'sent', 'failed', 'retry_pending'])->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('eligible_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('next_retry_at')->nullable();
            $table->text('last_error')->nullable();
            $table->json('snapshot')->nullable();
            $table->timestamps();
            $table->unique(['profile_id', 'direction', 'inventory_id'], 'edi_txn_profile_direction_inventory_unique');
            $table->index(['profile_id', 'direction', 'status']);
        });

        Schema::create('edi_delivery_logs', function (Blueprint $table) {
            $table->id('log_id');
            $table->foreignId('profile_id')->constrained('edi_profiles', 'profile_id')->cascadeOnDelete();
            $table->enum('direction', ['IN', 'OUT']);
            $table->string('filename', 255);
            $table->unsignedInteger('profile_version');
            $table->unsignedInteger('transaction_count')->default(0);
            $table->enum('status', ['pending', 'generating', 'generated', 'sending', 'sent', 'failed', 'retry_pending'])->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->string('artifact_path', 500)->nullable();
            $table->string('sha256', 64)->nullable();
            $table->text('error_message')->nullable();
            $table->json('response')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('next_retry_at')->nullable();
            $table->unsignedInteger('requested_by')->nullable();
            $table->timestamps();
            $table->index(['profile_id', 'status']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('edi_delivery_logs');
        Schema::dropIfExists('edi_transactions');
        Schema::dropIfExists('edi_profile_directions');
        Schema::table('edi_profiles', function (Blueprint $table) {
            $table->dropColumn(['enabled_at', 'direction_mode', 'schedule_minutes', 'retry_delay_seconds', 'profile_version']);
        });
    }
};
