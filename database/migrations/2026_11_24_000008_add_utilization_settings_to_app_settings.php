<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->string('utilization_time', 5)->nullable();
            $table->text('utilization_day_exceptions')->nullable();
            $table->decimal('utilization_capacity_teus', 14, 2)->default(1.00);
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->dropColumn(['utilization_time', 'utilization_day_exceptions', 'utilization_capacity_teus']);
        });
    }
};
