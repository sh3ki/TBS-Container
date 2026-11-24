<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Clean up partial tables if a deployment was interrupted during this
        // new migration before all tables and indexes were created.
        Schema::dropIfExists('utilization_size_totals');
        Schema::dropIfExists('utilization_client_totals');
        Schema::dropIfExists('utilization_client_size_rows');
        Schema::dropIfExists('utilizations');

        Schema::create('utilizations', function (Blueprint $table): void {
            $table->id();
            $table->date('utilization_date')->unique();
            $table->dateTime('captured_at');
            $table->unsignedInteger('total_container_count')->default(0);
            $table->decimal('total_teus', 14, 2)->default(0);
            $table->decimal('capacity_teus', 14, 2);
            $table->decimal('utilization_percentage', 8, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('utilization_client_size_rows', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('utilization_id')->constrained('utilizations')->cascadeOnDelete();
            $table->unsignedBigInteger('client_id')->nullable();
            $table->string('client_name', 255);
            $table->string('size_type', 50);
            $table->unsignedInteger('container_count')->default(0);
            $table->decimal('teus', 14, 2)->default(0);
            $table->timestamps();
            $table->index(['utilization_id', 'client_name'], 'ucr_client_idx');
            $table->index(['utilization_id', 'size_type'], 'ucr_size_idx');
        });

        Schema::create('utilization_client_totals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('utilization_id')->constrained('utilizations')->cascadeOnDelete();
            $table->unsignedBigInteger('client_id')->nullable();
            $table->string('client_name', 255);
            $table->unsignedInteger('total_container_count')->default(0);
            $table->decimal('total_teus', 14, 2)->default(0);
            $table->timestamps();
            $table->index(['utilization_id', 'client_name'], 'uct_client_idx');
        });

        Schema::create('utilization_size_totals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('utilization_id')->constrained('utilizations')->cascadeOnDelete();
            $table->string('size_type', 50);
            $table->unsignedInteger('total_container_count')->default(0);
            $table->decimal('total_teus', 14, 2)->default(0);
            $table->timestamps();
            $table->unique(['utilization_id', 'size_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('utilization_size_totals');
        Schema::dropIfExists('utilization_client_totals');
        Schema::dropIfExists('utilization_client_size_rows');
        Schema::dropIfExists('utilizations');
    }
};
