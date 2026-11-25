<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_display_sessions', function (Blueprint $table): void {
            $table->boolean('full_access')->default(false)->after('plate_no');
        });
    }

    public function down(): void
    {
        Schema::table('queue_display_sessions', function (Blueprint $table): void {
            $table->dropColumn('full_access');
        });
    }
};
