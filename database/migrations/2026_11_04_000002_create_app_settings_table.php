<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table): void {
            $table->unsignedTinyInteger('setting_id')->primary();
            $table->decimal('incoming_rate', 12, 2)->default(0.00);
            $table->decimal('outgoing_rate', 12, 2)->default(0.00);
            $table->timestamps();
        });

        DB::table('app_settings')->insert([
            'setting_id' => 1,
            'incoming_rate' => 0.00,
            'outgoing_rate' => 0.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
