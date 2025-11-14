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
        Schema::table('audit_logs', function (Blueprint $table) {
            // Add indexes for frequently queried columns
            $table->index('user_id', 'idx_audit_logs_user_id');
            $table->index('date_added', 'idx_audit_logs_date_added');
            $table->index('action', 'idx_audit_logs_action');
            $table->index('ip_address', 'idx_audit_logs_ip_address');
            
            // Composite index for common query patterns (user + date range)
            $table->index(['user_id', 'date_added'], 'idx_audit_logs_user_date');
            
            // Composite index for action + date
            $table->index(['action', 'date_added'], 'idx_audit_logs_action_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('idx_audit_logs_user_id');
            $table->dropIndex('idx_audit_logs_date_added');
            $table->dropIndex('idx_audit_logs_action');
            $table->dropIndex('idx_audit_logs_ip_address');
            $table->dropIndex('idx_audit_logs_user_date');
            $table->dropIndex('idx_audit_logs_action_date');
        });
    }
};
