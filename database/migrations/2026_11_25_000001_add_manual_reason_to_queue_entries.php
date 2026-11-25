<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_entries', function (Blueprint $table): void {
            $table->text('manual_reason')->nullable()->after('booking_time');
        });
    }

    public function down(): void
    {
        Schema::table('queue_entries', function (Blueprint $table): void {
            $table->dropColumn('manual_reason');
        });
    }
};
