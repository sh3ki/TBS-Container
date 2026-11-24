<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dmr_delivery_logs', function (Blueprint $table): void {
            $table->dropUnique('dmr_delivery_client_date_unique');
        });
    }

    public function down(): void
    {
        Schema::table('dmr_delivery_logs', function (Blueprint $table): void {
            $table->unique(['client_id', 'report_date'], 'dmr_delivery_client_date_unique');
        });
    }
};
