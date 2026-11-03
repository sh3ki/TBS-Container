<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobile_settings', function (Blueprint $table): void {
            $table->unsignedBigInteger('setting_id')->primary();
            $table->string('app_version', 50);
            $table->boolean('update_app_modal')->default(false);
            $table->timestamps();
        });

        DB::table('mobile_settings')->insert([
            'setting_id' => 1,
            'app_version' => '2.6.0',
            'update_app_modal' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_settings');
    }
};
