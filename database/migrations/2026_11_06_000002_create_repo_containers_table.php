<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repo_containers', function (Blueprint $table): void {
            $table->bigIncrements('r_id');
            $table->string('container_no', 20);
            $table->dateTime('date_added')->useCurrent();
            $table->text('notes')->nullable();

            $table->index('container_no', 'idx_repo_containers_container_no');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repo_containers');
    }
};
