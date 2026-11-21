<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('pages')->where('page', 'queue')->update(['page' => 'queuelist']);
    }

    public function down(): void
    {
        DB::table('pages')->where('page', 'queuelist')->update(['page' => 'queue']);
    }
};
