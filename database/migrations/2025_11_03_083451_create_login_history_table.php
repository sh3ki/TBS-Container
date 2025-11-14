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
        Schema::create('login_history', function (Blueprint $table) {
            $table->id('log_id');
            $table->integer('user_id'); // Changed from unsignedInteger to integer to match fjp_users.user_id
            $table->string('username', 50);
            $table->string('ip_address', 45)->nullable();
            $table->dateTime('login_time');
            $table->dateTime('logout_time')->nullable();
            $table->string('status', 20); // Success, Failed, Forced
            $table->text('remarks')->nullable();
            
            // Indexes for better query performance
            $table->index('user_id');
            $table->index('login_time');
            $table->index('status');
            
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
        Schema::dropIfExists('login_history');
    }
};
