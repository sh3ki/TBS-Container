<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('edi_interchange_counters', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_id');
            $table->string('direction', 3);
            $table->unsignedInteger('next_number')->default(1);
            $table->timestamps();
            $table->unique(['client_id', 'direction']);
        });

        Schema::table('edi_delivery_logs', function (Blueprint $table) {
            $table->string('transaction_fingerprint', 64)->nullable()->after('sha256');
            $table->json('transaction_ids')->nullable()->after('transaction_fingerprint');
            $table->unique(['profile_id', 'direction', 'filename'], 'edi_delivery_profile_direction_filename_unique');
            $table->index(['profile_id', 'direction', 'transaction_fingerprint'], 'edi_delivery_fingerprint_index');
        });
    }

    public function down(): void
    {
        Schema::table('edi_delivery_logs', function (Blueprint $table) {
            $table->dropUnique('edi_delivery_profile_direction_filename_unique');
            $table->dropIndex('edi_delivery_fingerprint_index');
            $table->dropColumn('transaction_fingerprint');
        });
        Schema::dropIfExists('edi_interchange_counters');
    }
};
