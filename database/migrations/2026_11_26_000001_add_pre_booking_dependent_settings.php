<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->boolean('prein_booking_dependent')->default(true)->after('booking_scraping_enabled');
            $table->boolean('preout_booking_dependent')->default(true)->after('prein_booking_dependent');
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->dropColumn(['prein_booking_dependent', 'preout_booking_dependent']);
        });
    }
};
