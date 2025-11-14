<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('container_size_type', function (Blueprint $table) {
            $table->string('description', 45)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('container_size_type', function (Blueprint $table) {
            $table->string('description', 45)->nullable(false)->change();
        });
    }
};
