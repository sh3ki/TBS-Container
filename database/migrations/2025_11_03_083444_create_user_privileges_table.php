<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_privileges', function (Blueprint $table) {
            $table->id('priv_id');
            $table->integer('user_id'); // Changed from unsignedInteger to integer to match fjp_users.user_id
            $table->string('module_name', 50);
            $table->tinyInteger('can_view')->default(0);
            $table->tinyInteger('can_add')->default(0);
            $table->tinyInteger('can_edit')->default(0);
            $table->tinyInteger('can_delete')->default(0);
            $table->tinyInteger('can_export')->default(0);
            
            // Indexes
            $table->index('user_id');
            $table->unique(['user_id', 'module_name'], 'user_module_unique');
            
            // Foreign key
            $table->foreign('user_id')
                  ->references('user_id')
                  ->on('users')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_privileges');
    }
};
