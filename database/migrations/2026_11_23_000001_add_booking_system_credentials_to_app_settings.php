<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->string('booking_system_url', 2048)->nullable()->after('booking_scraping_enabled');
            $table->string('booking_system_login_url', 2048)->nullable()->after('booking_system_url');
            $table->string('booking_system_username')->nullable()->after('booking_system_login_url');
            $table->text('booking_system_password')->nullable()->after('booking_system_username');
            $table->unsignedInteger('booking_system_timeout')->default(20)->after('booking_system_password');
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'booking_system_url',
                'booking_system_login_url',
                'booking_system_username',
                'booking_system_password',
                'booking_system_timeout',
            ]);
        });
    }
};
