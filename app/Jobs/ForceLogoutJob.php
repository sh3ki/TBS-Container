<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ForceLogoutJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     * 
     * This job runs every minute to check active user sessions and automatically
     * log out users who have exceeded their scheduled shift end time.
     */
    public function handle(): void
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        $now = Carbon::now();
        $currentDay = $now->format('l'); // Monday, Tuesday, etc.
        $currentTime = $now->format('H:i:s');
        
        try {
            // Get all users with force logout enabled
            $usersWithForceLogout = DB::table($prefix . 'users')
                ->where('force_logout_enabled', 1)
                ->where('archived', 0) // Only active users
                ->get();

            foreach ($usersWithForceLogout as $user) {
                // Check if user has an active session
                $activeSessions = DB::table($prefix . 'sessions')
                    ->where('u_id', $user->user_id)
                    ->whereNull('dt_stamp_end')
                    ->get();

                if ($activeSessions->isEmpty()) {
                    continue; // No active sessions, skip
                }

                // Get user's schedule for today
                $todaySchedule = DB::table($prefix . 'user_schedules')
                    ->where('user_id', $user->user_id)
                    ->where('day_of_week', $currentDay)
                    ->where('is_active', 1)
                    ->first();

                if (!$todaySchedule) {
                    continue; // No schedule for today or schedule is off
                }

                // Check if current time is past shift end time
                if ($todaySchedule->shift_end && $currentTime >= $todaySchedule->shift_end) {
                    // Force logout all active sessions for this user
                    foreach ($activeSessions as $session) {
                        // Update session end time
                        DB::table($prefix . 'sessions')
                            ->where('session_id', $session->session_id)
                            ->update(['dt_stamp_end' => $now]);

                        // Log to login history
                        DB::table($prefix . 'login_history')->insert([
                            'user_id' => $user->user_id,
                            'username' => $user->username,
                            'ip_address' => $session->ip_address ?? null,
                            'login_time' => $session->dt_stamp_start,
                            'logout_time' => $now,
                            'status' => 'Forced',
                            'remarks' => sprintf(
                                'Automatic force logout: Shift ended at %s (Current time: %s)',
                                $todaySchedule->shift_end,
                                $currentTime
                            ),
                        ]);

                        Log::info('Force logout executed', [
                            'user_id' => $user->user_id,
                            'username' => $user->username,
                            'shift_end' => $todaySchedule->shift_end,
                            'current_time' => $currentTime,
                            'session_id' => $session->session_id,
                        ]);
                    }
                }
            }

        } catch (\Exception $e) {
            Log::error('Force logout job failed: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
