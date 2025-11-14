<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ForceLogoutUsers extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'users:force-logout
                            {--dry-run : Show what would be done without making changes}';

    /**
     * The console command description.
     */
    protected $description = 'Force logout users who forgot to logout after their shift ended';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Checking for users who need force logout...');

        try {
            $now = now();
            $isDryRun = $this->option('dry-run');

            // Get users who are currently logged in (dt_stamp_end is NULL)
            // and their shift has ended (based on shift times in fjp_users table)
            $loggedInUsers = DB::table('fjp_users')
                ->whereNull('dt_stamp_end')
                ->whereNotNull('dt_stamp_start')
                ->get();

            if ($loggedInUsers->isEmpty()) {
                $this->info("No users currently logged in.");
                return Command::SUCCESS;
            }

            $this->info("Found " . $loggedInUsers->count() . " logged-in user(s)");

            $forcedLogoutCount = 0;

            foreach ($loggedInUsers as $user) {
                // Parse login time
                $loginTime = Carbon::parse($user->dt_stamp_start);
                
                // Determine shift hours (default: 8 hours if not specified)
                $shiftHours = 8;
                
                // Calculate expected logout time
                $expectedLogoutTime = $loginTime->copy()->addHours($shiftHours);

                // Check if current time is past expected logout time
                if ($now->greaterThan($expectedLogoutTime)) {
                    $hoursOverdue = $now->diffInHours($expectedLogoutTime);

                    if ($isDryRun) {
                        $this->line("  [DRY RUN] Would force logout: {$user->username} (overdue by {$hoursOverdue}h)");
                    } else {
                        // Force logout by setting dt_stamp_end to expected logout time
                        DB::table('fjp_users')
                            ->where('user_id', $user->user_id)
                            ->update([
                                'dt_stamp_end' => $expectedLogoutTime,
                            ]);

                        $this->line("  ✓ Forced logout: {$user->username} (overdue by {$hoursOverdue}h)");

                        // Log the force logout action
                        Log::channel('daily')->warning('Force logout executed', [
                            'user_id' => $user->user_id,
                            'username' => $user->username,
                            'login_time' => $loginTime->toDateTimeString(),
                            'expected_logout' => $expectedLogoutTime->toDateTimeString(),
                            'actual_logout' => $now->toDateTimeString(),
                            'hours_overdue' => $hoursOverdue,
                        ]);

                        // Create audit log entry
                        DB::table('fjp_audit_logs')->insert([
                            'user_id' => $user->user_id,
                            'action' => 'Force Logout',
                            'table_name' => 'fjp_users',
                            'record_id' => $user->user_id,
                            'changes' => json_encode([
                                'reason' => 'Automatic force logout - user did not logout after shift',
                                'hours_overdue' => $hoursOverdue,
                            ]),
                            'ip_address' => '127.0.0.1',
                            'user_agent' => 'System Background Job',
                            'date_added' => $now,
                        ]);

                        $forcedLogoutCount++;
                    }
                }
            }

            if ($isDryRun) {
                $this->info("Dry run complete. Would have forced logout {$forcedLogoutCount} user(s)");
            } else {
                if ($forcedLogoutCount > 0) {
                    $this->info("Successfully forced logout {$forcedLogoutCount} user(s)");
                } else {
                    $this->info('No users needed force logout');
                }
            }

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->error('Error during force logout process: ' . $e->getMessage());
            Log::error('Force logout error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return Command::FAILURE;
        }
    }
}
