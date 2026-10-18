<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('codeco', function (Blueprint $table) {
            $table->id();
            $table->string('message_code', 20)->default('CODECO');
            $table->string('release', 10)->default('D95B');
            $table->enum('record_type', ['segment', 'element', 'code'])->default('segment');
            $table->string('segment_code', 10)->nullable();
            $table->string('element_code', 20)->nullable();
            $table->string('value_code', 30)->nullable();
            $table->string('name')->nullable();
            $table->text('meaning')->nullable();
            $table->string('usage', 5)->nullable();
            $table->string('repetition', 20)->nullable();
            $table->unsignedInteger('sequence')->default(0);
            $table->string('source_url', 500)->nullable();
            $table->timestamps();

            $table->unique(
                ['message_code', 'release', 'record_type', 'segment_code', 'element_code', 'value_code'],
                'codeco_catalog_identity_unique'
            );
            $table->index(['record_type', 'segment_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('codeco');
    }
};
