<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table): void {
            $table->string('shipper', 75)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table): void {
            $table->string('shipper', 45)->nullable()->change();
        });
    }
};
