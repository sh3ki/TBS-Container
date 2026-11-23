<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'is_checker')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('is_checker')->default(false)->after('checker_id');
            });
        }

        if (! Schema::hasColumn('users', 'is_guard')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('is_guard')->default(false)->after('is_checker');
            });
        }

        // Keep the legacy salt nullable. GUARD1 intentionally has no salt.
        if (Schema::hasColumn('users', 'salt')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('salt')->nullable()->change();
            });
        }

        // Only legacy users without a salt are checker accounts. GUARD1 is guard-only.
        DB::table('users')
            ->whereNull('salt')
            ->update(['is_checker' => 1, 'is_guard' => 0]);

        DB::table('users')
            ->whereRaw('UPPER(username) = ?', ['GUARD1'])
            ->update(['is_checker' => 0, 'is_guard' => 1, 'salt' => null]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'is_guard')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('is_guard');
            });
        }

        if (Schema::hasColumn('users', 'is_checker')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('is_checker');
            });
        }
    }
};
