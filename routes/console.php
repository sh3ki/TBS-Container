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
// - Email/Notifications: Every 45 seconds (jPAM background job)
// - Booking checks: Daily at start of business day
//
// NOTE: Force logout is now handled by frontend inactivity monitor (30 min)
// ============================================================================

// 1. EMAIL AUTOMATION - POP3 incoming + scheduled SMTP + auto replies
// Legacy parity for working features from AutoMail/PAM
Schedule::command('email:automation --once')
    ->everyMinute()
    ->name('email-automation-cycle')
    ->withoutOverlapping()
    ->onOneServer();

// ============================================================================
// ADDITIONAL MAINTENANCE JOBS
// ============================================================================

// Cleanup old delivered notifications (keep last 90 days)
Schedule::call(function () {
    try {
        $table = \Illuminate\Support\Facades\Schema::hasTable('scheduled_notifications')
            ? 'scheduled_notifications'
            : 'fjp_scheduled_notifications';

        if (!\Illuminate\Support\Facades\Schema::hasTable($table)) {
            return;
        }

        \Illuminate\Support\Facades\DB::table($table)
            ->where('delivered', 1)
            ->where('trigger_date', '<', now()->subDays(90))
            ->delete();
        
        \Illuminate\Support\Facades\Log::info('Old notifications cleaned up');
    } catch (\Exception $e) {
        \Illuminate\Support\Facades\Log::error('Failed to cleanup old notifications: ' . $e->getMessage());
    }
})->weekly()->sundays()->at('02:00')->name('cleanup-old-notifications');

// Cleanup old email automation logs/replies
Schedule::call(function () {
    try {
        if (\Illuminate\Support\Facades\Schema::hasTable('email_automation_logs')) {
            \Illuminate\Support\Facades\DB::table('email_automation_logs')
                ->where('created_at', '<', now()->subDays(90))
                ->delete();
        }

        if (\Illuminate\Support\Facades\Schema::hasTable('email_reply_queue')) {
            \Illuminate\Support\Facades\DB::table('email_reply_queue')
                ->where('status', 'sent')
                ->where('sent_at', '<', now()->subDays(30))
                ->delete();
        }
    } catch (\Exception $e) {
        \Illuminate\Support\Facades\Log::error('Failed to cleanup email automation tables: ' . $e->getMessage());
    }
})->dailyAt('02:30')->name('cleanup-email-automation');

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
