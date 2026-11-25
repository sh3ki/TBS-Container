<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('queue_internal_sessions', function (Blueprint $table): void {
            $table->id();
            $table->string('token_hash', 64)->unique();
            $table->dateTime('expires_at');
            $table->dateTime('last_used_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
            $table->index('expires_at', 'queue_internal_sessions_expires_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('queue_internal_sessions');
    }
};
