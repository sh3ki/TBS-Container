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
        Schema::create('user_schedules', function (Blueprint $table) {
            $table->id('schedule_id');
            $table->integer('user_id'); // Changed from unsignedInteger to integer to match fjp_users.user_id
            $table->string('day_of_week', 10); // Monday-Sunday
            $table->time('shift_start')->nullable();
            $table->time('shift_end')->nullable();
            $table->tinyInteger('is_active')->default(1);
            
            // Indexes
            $table->index('user_id');
            $table->index(['user_id', 'day_of_week']);
            
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
        Schema::dropIfExists('user_schedules');
    }
};
