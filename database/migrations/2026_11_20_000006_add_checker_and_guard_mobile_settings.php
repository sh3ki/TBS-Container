<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mobile_settings', function (Blueprint $table): void {
            $table->string('app_code', 20)->default('CHECKER')->after('setting_id');
            $table->unique('app_code', 'mobile_settings_app_code_unique');
        });

        DB::table('mobile_settings')->where('setting_id', 1)->update(['app_code' => 'CHECKER']);

        if (! DB::table('mobile_settings')->where('app_code', 'GUARD')->exists()) {
            DB::table('mobile_settings')->insert([
                'setting_id' => 2,
                'app_code' => 'GUARD',
                'app_version' => '1.0.0',
                'apk_url' => null,
                'update_app_modal' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('mobile_settings')->where('app_code', 'GUARD')->delete();
        Schema::table('mobile_settings', function (Blueprint $table): void {
            $table->dropUnique('mobile_settings_app_code_unique');
            $table->dropColumn('app_code');
        });
    }
};
