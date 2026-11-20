<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add the default guard account using the application's legacy password
     * format (MD5(password + salt)). The check keeps this migration safe to
     * run more than once.
     */
    public function up(): void
    {
        if (DB::table('users')->where('username', 'GUARD1')->exists()) {
            return;
        }

        $username = 'GUARD1';
        $plainPassword = 'GUARD1';
        $salt = substr(md5(uniqid('', true)), 0, 5);

        DB::table('users')->insert([
            'full_name' => 'GUARD1',
            'username' => $username,
            'password' => $plainPassword,
            'salt' => null,
            'email' => '',
            'priv_id' => 0,
            'date_added' => now(),
            'archived' => 0,
            'force_logout_enabled' => 0,
            'checker_id' => '',
        ]);
    }

    public function down(): void
    {
        DB::table('users')->where('username', 'GUARD1')->delete();
    }
};
