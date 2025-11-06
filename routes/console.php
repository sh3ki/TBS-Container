<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Jobs\ForceLogoffUsers;
use App\Jobs\ForceLogoutJob; // NEW: Updated force logout job
use App\Jobs\ProcessScheduledNotifications;
use App\Jobs\CheckExpiringBookings;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ============================================================================
// BACKGROUND JOBS SCHEDULE
// ============================================================================
// Based on legacy FJPWL background jobs documentation
//
// Legacy timings:
// - FORCE_LOGOFF: Hourly or daily at midnight
// - Email/Notifications: Every 45 seconds to 5 minutes
// - Booking checks: Daily at start of business day
// ============================================================================

// 1. FORCE LOGOFF - Automatic user logout after shift
// Legacy: public/cron/FORCE_LOGOFF/index.php
// Runs every minute to check for users who exceeded their shift end time
// Uses user_schedules table for per-day, per-user shift times
Schedule::job(new ForceLogoutJob())
    ->everyMinute()
    ->name('force-logout-users')
    ->withoutOverlapping()
    ->onOneServer();

// Legacy force logoff job (keeping for backward compatibility)
Schedule::job(new ForceLogoffUsers())
    ->hourly()
    ->name('force-logoff-users-legacy')
    ->withoutOverlapping()
    ->onOneServer();

// 2. PROCESS SCHEDULED NOTIFICATIONS - Multi-channel notification system
// Legacy: public/php/tbs/web/export.ro (jPAM routine)
// Processes pending notifications and sends via Email, SMS, Phone, Fax
// Legacy ran every 45 seconds, we'll use everyFiveMinutes for efficiency
Schedule::job(new ProcessScheduledNotifications())
    ->everyFiveMinutes()
    ->name('process-notifications')
    ->withoutOverlapping()
    ->onOneServer();

// Alternative: Run more frequently (every minute) for time-critical notifications
// Uncomment if needed:
// Schedule::job(new ProcessScheduledNotifications())
//     ->everyMinute()
//     ->name('process-notifications-frequent')
//     ->withoutOverlapping()
//     ->onOneServer();

// 3. CHECK EXPIRING BOOKINGS - Send expiration alerts to clients
// Legacy: Part of notification system
// Checks for bookings expiring in next 3 days and sends alerts
Schedule::job(new CheckExpiringBookings())
    ->dailyAt('08:00')
    ->name('check-expiring-bookings')
    ->withoutOverlapping()
    ->onOneServer();

// ============================================================================
// ADDITIONAL MAINTENANCE JOBS (Optional - can be enabled as needed)
// ============================================================================

// Cleanup old notifications (keep last 90 days)
Schedule::call(function () {
    try {
        \DB::table('fjp_scheduled_notifications')
            ->where('delivered', 1)
            ->where('trigger_date', '<', now()->subDays(90))
            ->delete();
        
        \Log::info('Old notifications cleaned up');
    } catch (\Exception $e) {
        \Log::error('Failed to cleanup old notifications: ' . $e->getMessage());
    }
})->weekly()->name('cleanup-old-notifications');

// Cleanup old audit logs (keep last 180 days)
Schedule::call(function () {
    try {
        \DB::table('fjp_audit_logs')
            ->where('date_added', '<', now()->subDays(180))
            ->delete();
        
        \Log::info('Old audit logs cleaned up');
    } catch (\Exception $e) {
        \Log::error('Failed to cleanup old audit logs: ' . $e->getMessage());
    }
})->monthly()->name('cleanup-old-audit-logs');
