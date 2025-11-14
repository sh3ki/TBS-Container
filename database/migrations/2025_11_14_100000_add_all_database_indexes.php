<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Helper method to drop index if it exists
     */
    private function dropIndexIfExists(string $table, string $indexName): void
    {
        $prefix = DB::getTablePrefix();
        $fullTable = $prefix . $table;
        
        // Check if index exists
        $indexExists = DB::select("SHOW INDEX FROM `{$fullTable}` WHERE Key_name = ?", [$indexName]);
        
        if (!empty($indexExists)) {
            Schema::table($table, function (Blueprint $t) use ($indexName) {
                $t->dropIndex($indexName);
            });
        }
    }

    /**
     * Drop all existing indexes from all tables
     */
    private function dropAllExistingIndexes(): void
    {
        $prefix = DB::getTablePrefix();
        
        // Get all tables with indexes
        $tables = [
            'inventory', 'audit_logs', 'pre_inventory', 'bookings', 'clients',
            'storage_rate', 'handling_rate', 'hold_containers', 'ban_containers',
            'privileges', 'users', 'pages_access', 'client_reg_hours', 'container_size_type'
        ];
        
        foreach ($tables as $table) {
            $fullTable = $prefix . $table;
            
            // Get all indexes for this table
            $indexes = DB::select("SHOW INDEX FROM `{$fullTable}`");
            
            // Group indexes by name and drop non-primary ones
            $indexNames = [];
            foreach ($indexes as $index) {
                if ($index->Key_name !== 'PRIMARY' && !in_array($index->Key_name, $indexNames)) {
                    $indexNames[] = $index->Key_name;
                }
            }
            
            // Drop each index using raw SQL
            foreach ($indexNames as $indexName) {
                try {
                    DB::statement("ALTER TABLE `{$fullTable}` DROP INDEX `{$indexName}`");
                } catch (\Exception $e) {
                    // Index might not exist or already dropped, continue
                }
            }
        }
    }

    /**
     * Run the migrations.
     * 
     * Comprehensive index migration for all tables in the database.
     * This migration creates all necessary indexes for optimal query performance.
     * Drops existing indexes first to avoid conflicts.
     */
    public function up(): void
    {
        // Drop ALL existing indexes first to avoid conflicts
        $this->dropAllExistingIndexes();
        
        // ========================================
        // fjp_inventory - Main inventory table
        // ========================================
        
        Schema::table('inventory', function (Blueprint $table) {
            // Single column indexes
            $table->index('container_no', 'container_no');
            $table->index('complete', 'idx_complete');
            $table->index('date_added', 'idx_date_added');
            $table->index('out_id', 'idx_inventory_out_id');
            
            // Composite indexes for dashboard and reporting
            $table->index(['client_id', 'complete'], 'dmr_aging');
            $table->index(['client_id', 'complete', 'class'], 'dmr_inv');
            $table->index(['client_id', 'complete', 'date_added'], 'dmr_outgoing');
            $table->index(['client_id', 'date_added'], 'dmr_size');
            $table->index(['complete', 'date_added'], 'idx_complete_date');
            
            // Dashboard statistics index
            $table->index(['gate_status', 'complete', 'container_status', 'date_added'], 'idx_dashboard_stats');
            
            // Billing and client queries
            $table->index(['gate_status', 'date_added'], 'idx_inventory_billing_date');
            $table->index(['client_id', 'gate_status'], 'idx_inventory_client_status');
            $table->index(['container_no', 'complete'], 'idx_inventory_container_complete');
            
            // Large composite index for various queries
            $table->index([
                'container_no', 'client_id', 'container_status', 'size_type', 'class', 
                'vessel', 'voyage', 'origin', 'ex_consignee', 'plate_no', 'hauler', 
                'hauler_driver', 'chasis', 'gate_status', 'complete', 'out_id'
            ], 'inv_i');
        });

        // ========================================
        // fjp_audit_logs - Audit trail
        // ========================================
        Schema::table('audit_logs', function (Blueprint $table) {
            // Single column indexes
            $table->index('user_id', 'idx_audit_logs_user_id');
            $table->index('date_added', 'idx_audit_logs_date_added');
            $table->index('action', 'idx_audit_logs_action');
            $table->index('ip_address', 'idx_audit_logs_ip_address');
            
            // Composite indexes for common query patterns
            $table->index(['user_id', 'date_added'], 'idx_audit_logs_user_date');
            $table->index(['action', 'date_added'], 'idx_audit_logs_action_date');
        });

        // ========================================
        // fjp_pre_inventory - Pre-registration
        // ========================================
        Schema::table('pre_inventory', function (Blueprint $table) {
            // Single column indexes
            $table->index('date_added', 'date_added');
            $table->index('inv_id', 'inv_id');
            $table->index('client_id', 'idx_client_id');
            $table->index('gate_status', 'idx_gate_status');
            $table->index('status', 'idx_status');
            
            // Composite indexes
            $table->index(['gate_status', 'status'], 'idx_preinv_gate_status');
            $table->index(['status', 'date_added'], 'idx_status_date');
        });

        // ========================================
        // fjp_bookings - Container bookings
        // ========================================
        Schema::table('bookings', function (Blueprint $table) {
            // Single column indexes
            $table->index('expiration_date', 'expiration_date');
            $table->index('date_added', 'idx_date_added');
            
            // Composite indexes for size tracking
            $table->index(['twenty', 'fourty', 'fourty_five'], 'where_size');
            $table->index(['twenty_rem', 'fourty_rem', 'fourty_five_rem'], 'where_rem');
        });

        // ========================================
        // fjp_clients - Client information
        // ========================================
        Schema::table('clients', function (Blueprint $table) {
            $table->index('archived', 'idx_archived');
        });

        // ========================================
        // fjp_storage_rate - Storage rates
        // ========================================
        Schema::table('storage_rate', function (Blueprint $table) {
            $table->index(['client_id', 'size'], 'idx_storage_rate_lookup');
        });

        // ========================================
        // fjp_handling_rate - Handling rates
        // ========================================
        Schema::table('handling_rate', function (Blueprint $table) {
            $table->index(['client_id', 'size'], 'idx_handling_rate_lookup');
        });

        // ========================================
        // fjp_hold_containers - Containers on hold
        // ========================================
        Schema::table('hold_containers', function (Blueprint $table) {
            $table->index('container_no', 'cno');
        });

        // ========================================
        // fjp_ban_containers - Banned containers
        // ========================================
        Schema::table('ban_containers', function (Blueprint $table) {
            $table->index('container_no', 'idx_ban_container_no');
            $table->index('date_added', 'idx_ban_date_added');
        });

        // ========================================
        // fjp_privileges - User privileges
        // ========================================
        Schema::table('privileges', function (Blueprint $table) {
            $table->index(['p_code', 'description', 'access'], 'privilegeindex');
        });

        // ========================================
        // fjp_users - System users
        // ========================================
        Schema::table('users', function (Blueprint $table) {
            $table->index('username', 'idx_username');
            $table->index('email', 'idx_email');
            $table->index('priv_id', 'idx_priv_id');
            $table->index('archived', 'idx_users_archived');
        });

        // ========================================
        // fjp_pages_access - Page permissions
        // ========================================
        Schema::table('pages_access', function (Blueprint $table) {
            $table->index('privilege', 'idx_privilege');
            $table->index('page_id', 'idx_page_id');
            $table->index(['privilege', 'page_id'], 'idx_privilege_page');
        });

        // ========================================
        // fjp_client_reg_hours - Client registration hours
        // ========================================
        Schema::table('client_reg_hours', function (Blueprint $table) {
            $table->index('client_id', 'idx_client_reg_client_id');
            $table->index('date_added', 'idx_client_reg_date_added');
        });

        // ========================================
        // fjp_container_size_type - Size types
        // ========================================
        Schema::table('container_size_type', function (Blueprint $table) {
            $table->index('archived', 'idx_size_type_archived');
            $table->index(['size', 'type'], 'idx_size_type_lookup');
        });

        // ========================================
        // fjp_personal_access_tokens - Already has indexes from migration
        // ========================================
        // Indexes already exist:
        // - fjp_personal_access_tokens_token_unique (unique)
        // - fjp_personal_access_tokens_tokenable_type_tokenable_id_index
        // - fjp_personal_access_tokens_expires_at_index

        // ========================================
        // fjp_user_privileges - Already has indexes from migration
        // ========================================
        // Indexes already exist:
        // - fjp_user_privileges_user_id_index
        // - user_module_unique (unique)

        // ========================================
        // fjp_user_schedules - Already has indexes from migration
        // ========================================
        // Indexes already exist:
        // - fjp_user_schedules_user_id_index
        // - fjp_user_schedules_user_id_day_of_week_index

        // ========================================
        // fjp_login_history - Already has indexes from migration
        // ========================================
        // Indexes already exist:
        // - fjp_login_history_user_id_index
        // - fjp_login_history_login_time_index
        // - fjp_login_history_status_index

        // ========================================
        // fjp_fjp_scheduled_notifications - Already has indexes from migration
        // ========================================
        // Indexes already exist:
        // - fjp_fjp_scheduled_notifications_to_user_delivered_index
        // - fjp_fjp_scheduled_notifications_trigger_date_delivered_index
        // - fjp_fjp_scheduled_notifications_type_trigger_date_index
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop fjp_inventory indexes
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropIndex('container_no');
            $table->dropIndex('idx_complete');
            $table->dropIndex('idx_date_added');
            $table->dropIndex('idx_inventory_out_id');
            $table->dropIndex('dmr_aging');
            $table->dropIndex('dmr_inv');
            $table->dropIndex('dmr_outgoing');
            $table->dropIndex('dmr_size');
            $table->dropIndex('idx_complete_date');
            $table->dropIndex('idx_dashboard_stats');
            $table->dropIndex('idx_inventory_billing_date');
            $table->dropIndex('idx_inventory_client_status');
            $table->dropIndex('idx_inventory_container_complete');
            $table->dropIndex('inv_i');
        });

        // Drop fjp_audit_logs indexes
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('idx_audit_logs_user_id');
            $table->dropIndex('idx_audit_logs_date_added');
            $table->dropIndex('idx_audit_logs_action');
            $table->dropIndex('idx_audit_logs_ip_address');
            $table->dropIndex('idx_audit_logs_user_date');
            $table->dropIndex('idx_audit_logs_action_date');
        });

        // Drop fjp_pre_inventory indexes
        Schema::table('pre_inventory', function (Blueprint $table) {
            $table->dropIndex('date_added');
            $table->dropIndex('inv_id');
            $table->dropIndex('idx_client_id');
            $table->dropIndex('idx_gate_status');
            $table->dropIndex('idx_status');
            $table->dropIndex('idx_preinv_gate_status');
            $table->dropIndex('idx_status_date');
        });

        // Drop fjp_bookings indexes
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('expiration_date');
            $table->dropIndex('idx_date_added');
            $table->dropIndex('where_size');
            $table->dropIndex('where_rem');
        });

        // Drop fjp_clients indexes
        Schema::table('clients', function (Blueprint $table) {
            $table->dropIndex('idx_archived');
        });

        // Drop fjp_storage_rate indexes
        Schema::table('storage_rate', function (Blueprint $table) {
            $table->dropIndex('idx_storage_rate_lookup');
        });

        // Drop fjp_handling_rate indexes
        Schema::table('handling_rate', function (Blueprint $table) {
            $table->dropIndex('idx_handling_rate_lookup');
        });

        // Drop fjp_hold_containers indexes
        Schema::table('hold_containers', function (Blueprint $table) {
            $table->dropIndex('cno');
        });

        // Drop fjp_ban_containers indexes
        Schema::table('ban_containers', function (Blueprint $table) {
            $table->dropIndex('idx_ban_container_no');
            $table->dropIndex('idx_ban_date_added');
        });

        // Drop fjp_privileges indexes
        Schema::table('privileges', function (Blueprint $table) {
            $table->dropIndex('privilegeindex');
        });

        // Drop fjp_users indexes
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_username');
            $table->dropIndex('idx_email');
            $table->dropIndex('idx_priv_id');
            $table->dropIndex('idx_users_archived');
        });

        // Drop fjp_pages_access indexes
        Schema::table('pages_access', function (Blueprint $table) {
            $table->dropIndex('idx_privilege');
            $table->dropIndex('idx_page_id');
            $table->dropIndex('idx_privilege_page');
        });

        // Drop fjp_client_reg_hours indexes
        Schema::table('client_reg_hours', function (Blueprint $table) {
            $table->dropIndex('idx_client_reg_client_id');
            $table->dropIndex('idx_client_reg_date_added');
        });

        // Drop fjp_container_size_type indexes
        Schema::table('container_size_type', function (Blueprint $table) {
            $table->dropIndex('idx_size_type_archived');
            $table->dropIndex('idx_size_type_lookup');
        });
    }
};
