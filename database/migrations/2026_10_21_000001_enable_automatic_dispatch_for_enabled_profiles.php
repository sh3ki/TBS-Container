<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('edi_profiles')) return;

        \DB::table('edi_profiles')
            ->where('is_enabled', true)
            ->update(['automatic_enabled' => true]);
    }

    public function down(): void
    {
        // Do not disable profiles during rollback.
    }
};
