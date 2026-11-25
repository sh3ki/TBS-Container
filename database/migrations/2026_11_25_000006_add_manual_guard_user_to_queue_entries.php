<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_entries', function (Blueprint $table) {
            $table->unsignedBigInteger('manual_guard_user_id')->nullable()->after('manual_reason')->index();
        });
    }

    public function down(): void
    {
        Schema::table('queue_entries', function (Blueprint $table) {
            $table->dropIndex(['manual_guard_user_id']);
            $table->dropColumn('manual_guard_user_id');
        });
    }
};
