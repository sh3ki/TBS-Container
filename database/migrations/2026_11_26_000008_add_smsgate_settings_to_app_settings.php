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
            $table->string('smsgate_api_url', 2048)->nullable();
            $table->string('smsgate_username')->nullable();
            $table->text('smsgate_password')->nullable();
            $table->string('smsgate_device_id')->nullable();
            $table->unsignedTinyInteger('smsgate_sim_number')->nullable();
            $table->unsignedInteger('smsgate_timeout')->default(20);
        });

        DB::table('app_settings')->where('setting_id', 1)->update([
            'sms_driver' => 'smsgate',
            'smsgate_api_url' => env('SMSGATE_API_URL', 'https://api.sms-gate.app/3rdparty/v1/messages'),
            'smsgate_username' => env('SMSGATE_USERNAME'),
            'smsgate_password' => env('SMSGATE_PASSWORD') ? encrypt(env('SMSGATE_PASSWORD')) : null,
            'smsgate_device_id' => env('SMSGATE_DEVICE_ID'),
            'smsgate_sim_number' => env('SMSGATE_SIM_NUMBER') !== null && env('SMSGATE_SIM_NUMBER') !== ''
                ? (int) env('SMSGATE_SIM_NUMBER')
                : null,
            'smsgate_timeout' => (int) env('SMSGATE_TIMEOUT', 20),
        ]);
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'smsgate_api_url',
                'smsgate_username',
                'smsgate_password',
                'smsgate_device_id',
                'smsgate_sim_number',
                'smsgate_timeout',
            ]);
        });
    }
};
