<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        try {
            DB::statement('ALTER TABLE '.DB::getTablePrefix().'edi_interchange_counters DROP INDEX edi_interchange_counters_client_id_direction_unique');
        } catch (\Throwable) {
            // The migration may have failed after dropping this index; continue idempotently.
        }

        $rows = DB::table('edi_interchange_counters')->where('client_id', 67)->orderByDesc('next_number')->get();
        if ($rows->isNotEmpty()) {
            $keep = $rows->first();
            DB::table('edi_interchange_counters')->where('client_id', 67)->where('id', '!=', $keep->id)->delete();
            DB::table('edi_interchange_counters')->where('id', $keep->id)->update(['direction' => 'IN']);
        }

        Schema::table('edi_interchange_counters', function (Blueprint $table) {
            $table->unique('client_id', 'edi_interchange_counters_client_unique');
        });
    }

    public function down(): void
    {
        Schema::table('edi_interchange_counters', function (Blueprint $table) {
            $table->dropUnique('edi_interchange_counters_client_unique');
            $table->unique(['client_id', 'direction']);
        });
    }
};
