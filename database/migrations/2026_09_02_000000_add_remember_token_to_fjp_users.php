<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (Schema::hasTable('fjp_users')) {
            Schema::table('fjp_users', function (Blueprint $table) {
                if (!Schema::hasColumn('fjp_users', 'remember_token')) {
                    $table->string('remember_token', 100)->nullable()->after('salt');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        if (Schema::hasTable('fjp_users')) {
            Schema::table('fjp_users', function (Blueprint $table) {
                if (Schema::hasColumn('fjp_users', 'remember_token')) {
                    $table->dropColumn('remember_token');
                }
            });
        }
    }
};
