<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->string('dmr_time', 20)->nullable();
            $table->string('dmr_sender_email')->nullable();
            $table->longText('dmr_signature')->nullable();
            $table->longText('dmr_groups')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->dropColumn(['dmr_time', 'dmr_sender_email', 'dmr_signature', 'dmr_groups']);
        });
    }
};
