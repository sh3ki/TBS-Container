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
                'arrived',
                'floating',
                'serving',
                'completed',
                'forfeited',
            ])->default('waiting')->change();

            $table->timestamp('arrived_at')->nullable()->after('calling_at');
        });
    }

    public function down(): void
    {
        Schema::table('queue_entries', function (Blueprint $table): void {
            $table->dropColumn('arrived_at');
            $table->enum('status', [
                'waiting',
                'standby',
                'calling',
                'floating',
                'serving',
                'completed',
                'forfeited',
            ])->default('waiting')->change();
        });
    }
};
