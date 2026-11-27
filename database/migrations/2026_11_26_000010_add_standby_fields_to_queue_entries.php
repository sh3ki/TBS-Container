<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_entries', function (Blueprint $table): void {
            $table->enum('status', [
                'waiting',
                'standby',
                'calling',
                'floating',
                'serving',
                'completed',
                'forfeited',
            ])->default('waiting')->change();

            $table->timestamp('standby_at')->nullable()->after('created_at');
            $table->foreignId('standby_id')
                ->nullable()
                ->after('standby_at')
                ->constrained('queue_standby_status')
                ->nullOnDelete();
        });

    }

    public function down(): void
    {
        Schema::table('queue_entries', function (Blueprint $table): void {
            $table->dropForeign(['standby_id']);
            $table->dropColumn(['standby_id', 'standby_at']);
            $table->enum('status', [
                'waiting',
                'calling',
                'floating',
                'serving',
                'completed',
                'forfeited',
            ])->default('waiting')->change();
        });
    }
};
