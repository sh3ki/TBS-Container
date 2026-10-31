-<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pages', function (Blueprint $table): void {
            $table->string('category', 100)->nullable();
        });

        DB::table('pages')->where('arrange_no', 0)->update(['category' => 'Dashboard']);
        DB::table('pages')->whereBetween('arrange_no', [1, 4])->update(['category' => 'Container Operations']);
        DB::table('pages')->whereBetween('arrange_no', [5, 6])->update(['category' => 'Finance & Analytics']);
        DB::table('pages')->whereBetween('arrange_no', [7, 10])->update(['category' => 'App Configuration']);
        DB::table('pages')->whereBetween('arrange_no', [11, 12])->update(['category' => 'Administration']);
    }

    public function down(): void
    {
        Schema::table('pages', function (Blueprint $table): void {
            $table->dropColumn('category');
        });
    }
};
