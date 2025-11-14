<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ============================================================================
// BACKGROUND JOBS SCHEDULE
// ============================================================================
// Based on legacy FJPWL background jobs documentation
//
// Legacy timings:
// - FORCE_LOGOFF: Hourly at :05 past hour
// - Email/Notifications: Every 45 seconds (jPAM background job)
// - Booking checks: Daily at start of business day
// ============================================================================

// 1. PROCESS SCHEDULED NOTIFICATIONS - Multi-channel notification system
// Legacy: public/php/tbs/web/export.ro (jPAM routine)
// Processes pending notifications and dispatches email jobs to queue
// Legacy ran every 45 seconds in continuous loop
// NOTE: Run this command separately: php artisan notifications:process
// For production, use supervisor to keep it running 24/7
Schedule::command('notifications:process --once')
    ->everyMinute()
    ->name('process-notifications')
    ->withoutOverlapping()
    ->onOneServer();

// 2. FORCE LOGOUT - Automatic user logout after shift
// Legacy: public/cron/FORCE_LOGOFF/index.php
// Runs hourly to check for users who exceeded their shift end time
Schedule::command('users:force-logout')
    ->hourlyAt(5) // Run at :05 past every hour (like legacy)
    ->name('force-logout-users')
    ->withoutOverlapping()
    ->onOneServer();

// ============================================================================
// ADDITIONAL MAINTENANCE JOBS
// ============================================================================

// Cleanup old delivered notifications (keep last 90 days)
Schedule::call(function () {
    try {
        \Illuminate\Support\Facades\DB::table('fjp_scheduled_notifications')
            ->where('delivered', 1)
            ->where('trigger_date', '<', now()->subDays(90))
            ->delete();
        
        \Illuminate\Support\Facades\Log::info('Old notifications cleaned up');
    } catch (\Exception $e) {
        \Illuminate\Support\Facades\Log::error('Failed to cleanup old notifications: ' . $e->getMessage());
    }
})->weekly()->sundays()->at('02:00')->name('cleanup-old-notifications');

// Cleanup old audit logs (keep last 180 days)
Schedule::call(function () {
    try {
        \Illuminate\Support\Facades\DB::table('fjp_audit_logs')
            ->where('date_added', '<', now()->subDays(180))
            ->delete();
        
        \Illuminate\Support\Facades\Log::info('Old audit logs cleaned up');
    } catch (\Exception $e) {
        \Illuminate\Support\Facades\Log::error('Failed to cleanup old audit logs: ' . $e->getMessage());
    }
})->monthly()->name('cleanup-old-audit-logs');
