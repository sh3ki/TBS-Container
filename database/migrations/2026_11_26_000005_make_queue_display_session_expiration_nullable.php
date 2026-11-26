<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_display_sessions', function (Blueprint $table): void {
            $table->timestamp('expires_at')->nullable()->change();
        });

        DB::table('queue_display_sessions')
            ->where('full_access', true)
            ->update(['expires_at' => null]);
    }

    public function down(): void
    {
        DB::table('queue_display_sessions')
            ->whereNull('expires_at')
            ->update(['expires_at' => now()]);

        Schema::table('queue_display_sessions', function (Blueprint $table): void {
            $table->timestamp('expires_at')->nullable(false)->change();
        });
    }
};
