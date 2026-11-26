<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->string('sms_driver', 30)->default('philsms');
            $table->string('philsms_api_url', 2048)->nullable();
            $table->text('philsms_api_token')->nullable();
            $table->string('philsms_sender_id', 11)->nullable();
            $table->unsignedInteger('philsms_timeout')->default(20);
        });

        DB::table('app_settings')->where('setting_id', 1)->update([
            'sms_driver' => env('SMS_DRIVER', 'philsms'),
            'philsms_api_url' => env('PHILSMS_API_URL', 'https://app.philsms.com/api/v3/sms/send'),
            'philsms_api_token' => env('PHILSMS_API_TOKEN') ? encrypt(env('PHILSMS_API_TOKEN')) : null,
            'philsms_sender_id' => env('PHILSMS_SENDER_ID', 'TBSYARD'),
            'philsms_timeout' => (int) env('PHILSMS_TIMEOUT', 20),
        ]);
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'sms_driver',
                'philsms_api_url',
                'philsms_api_token',
                'philsms_sender_id',
                'philsms_timeout',
            ]);
        });
    }
};
