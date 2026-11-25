<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->unsignedInteger('calling_expiration_minutes')->nullable()->after('serving_capacity');
            $table->unsignedInteger('floating_expiration_minutes')->nullable()->after('calling_expiration_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table): void {
            $table->dropColumn(['calling_expiration_minutes', 'floating_expiration_minutes']);
        });
    }
};
