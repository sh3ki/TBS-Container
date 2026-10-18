<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('edi_profile_directions', function (Blueprint $table) {
            $table->json('structure_analysis')->nullable()->after('mappings');
        });
    }

    public function down(): void
    {
        Schema::table('edi_profile_directions', function (Blueprint $table) {
            $table->dropColumn('structure_analysis');
        });
    }
};
