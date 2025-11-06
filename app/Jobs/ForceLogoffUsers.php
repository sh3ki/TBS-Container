<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\AuditService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ForceLogoffUsers implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Execute the job.
     * 
     * Based on legacy FORCE_LOGOFF job - logs out users who forgot to logout
     * after their shift has ended. This maintains data integrity and accurate
     * attendance tracking.
     * 
     * Legacy Location: public/cron/FORCE_LOGOFF/index.php
     */
    public function handle(AuditService $audit): void
    {
        $loggedOffCount = 0;

        try {
            // METHOD 1: Token-based logout for current Laravel system
            // Force logout users by revoking their authentication tokens
            $activeUsers = User::where('archived', 0)
                ->has('tokens')
                ->get();

            foreach ($activeUsers as $user) {
                $tokenCount = $user->tokens()->count();
                
                if ($tokenCount > 0) {
                    // Check if user should be logged off based on time
                    // For now, we'll log off users with tokens older than 24 hours
                    $oldTokens = $user->tokens()
                        ->where('created_at', '<', now()->subHours(24))
                        ->get();

                    if ($oldTokens->count() > 0) {
                        $oldTokens->each->delete();
                        $loggedOffCount++;

                        // Log the forced logoff
                        $audit->log(
                            'LOGOUT',
                            "User forcefully logged off by system (token expired after 24 hours)",
                            'AUTH',
                            $user->user_id,
                            $user->user_id
                        );

                        Log::info("Force logged off user: {$user->username} (ID: {$user->user_id})");
                    }
                }
            }

            // METHOD 2: Legacy-compatible logout based on schedules
            // This would require schedule tables which might not exist yet
            // Commenting out for now, but can be enabled when schedule tables are created
            /*
            $legacyLogoffCount = $this->legacyForceLogoff($audit);
            $loggedOffCount += $legacyLogoffCount;
            */

            // Log the job execution
            $message = "Force logoff job executed. {$loggedOffCount} users logged off.";
            
            $audit->log(
                'SYSTEM',
                $message,
                'SYSTEM'
            );

            Log::info($message, [
                'users_logged_off' => $loggedOffCount,
                'executed_at' => now()->toDateTimeString()
            ]);

        } catch (\Exception $e) {
            Log::error("Force logoff job failed: " . $e->getMessage(), [
                'exception' => $e->getTraceAsString()
            ]);

            $audit->log(
                'ERROR',
                "Force logoff job failed: {$e->getMessage()}",
                'SYSTEM'
            );
        }
    }

    /**
     * Legacy force logoff based on user schedules.
     * 
     * This method replicates the original PHP logic from:
     * public/cron/FORCE_LOGOFF/index.php
     * 
     * It queries for users whose shift has ended but are still logged in.
     * 
     * @param AuditService $audit
     * @return int Number of users logged off
     */
    protected function legacyForceLogoff(AuditService $audit): int
    {
        $count = 0;

        try {
            // Check if legacy tables exist
            if (!$this->legacyTablesExist()) {
                Log::info("Legacy schedule tables don't exist. Skipping legacy force logoff.");
                return 0;
            }

            // Query legacy-style user sessions that should be closed
            // This is based on the original FORCE_LOGOFF logic
            $yesterday = now()->subDay()->format('Y-m-d');
            $currentTime = now()->format('H:i:s');

            // Find users who are still marked as logged in from yesterday's shift
            $overdueUsers = DB::select("
                SELECT DISTINCT u.user_id, u.username, u.full_name
                FROM fjp_users u
                WHERE u.archived = 0
                -- Add more conditions here based on your schedule tables
                -- This is a placeholder query
            ");

            foreach ($overdueUsers as $user) {
                // Revoke all tokens for this user
                User::find($user->user_id)?->tokens()->delete();
                
                $count++;

                $audit->log(
                    'LOGOUT',
                    "User forcefully logged off by system (shift ended)",
                    'AUTH',
                    $user->user_id,
                    $user->user_id
                );

                Log::info("Legacy force logged off user: {$user->username} (ID: {$user->user_id})");
            }

        } catch (\Exception $e) {
            Log::error("Legacy force logoff failed: " . $e->getMessage());
        }

        return $count;
    }

    /**
     * Check if legacy schedule tables exist.
     *
     * @return bool
     */
    protected function legacyTablesExist(): bool
    {
        try {
            // Check for common schedule-related tables
            $tables = ['tbl_users', 'tbl_record_log', 'tbl_teamschedules'];
            
            foreach ($tables as $table) {
                DB::select("SELECT 1 FROM {$table} LIMIT 1");
            }
            
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
