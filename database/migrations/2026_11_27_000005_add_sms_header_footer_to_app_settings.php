<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->text('sms_header_text')->nullable()->after('smsgate_timeout');
            $table->text('sms_footer_text')->nullable()->after('sms_header_text');
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->dropColumn(['sms_footer_text', 'sms_header_text']);
        });
    }
};
