<?php

namespace App\Console\Commands;

use App\Models\ScheduledNotification;
use App\Jobs\SendEmailNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ProcessPendingNotifications extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'notifications:process
                            {--once : Process once and exit instead of continuous loop}';

    /**
     * The console command description.
     */
    protected $description = 'Process pending notifications and dispatch email jobs (runs every 45 seconds like legacy jPAM)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting notification processor...');

        if ($this->option('once')) {
            $this->processNotifications();
            return Command::SUCCESS;
        }

        // Continuous loop like legacy jPAM (checks every 45 seconds)
        while (true) {
            $this->processNotifications();
            sleep(45); // Wait 45 seconds before next check
        }

        return Command::SUCCESS;
    }

    /**
     * Process pending notifications.
     */
    protected function processNotifications(): void
    {
        try {
            $startTime = now();

            // Get pending email notifications
            $notifications = ScheduledNotification::pending()
                ->where(function ($query) {
                    $query->where('email1', true)
                          ->orWhere('email2', true);
                })
                ->orderBy('trigger_date', 'asc')
                ->get();

            if ($notifications->isEmpty()) {
                $this->line('[' . now()->format('Y-m-d H:i:s') . '] No pending notifications found.');
                return;
            }

            $this->info('[' . now()->format('Y-m-d H:i:s') . "] Found {$notifications->count()} pending notification(s)");

            $dispatched = 0;
            $skipped = 0;

            foreach ($notifications as $notification) {
                // Skip if max retries reached
                if (!$notification->shouldRetry()) {
                    $this->warn("  - Notification #{$notification->pam_id}: Max retries reached, skipping");
                    $notification->update(['deleted' => true]); // Soft delete failed notifications
                    $skipped++;
                    continue;
                }

                // Skip if no email address
                if (!$notification->to_email && !optional($notification->toUser)->email) {
                    $this->warn("  - Notification #{$notification->pam_id}: No email address, skipping");
                    $notification->update(['deleted' => true]);
                    $skipped++;
                    continue;
                }

                // Dispatch email job
                SendEmailNotification::dispatch($notification);
                
                $this->line("  ✓ Notification #{$notification->pam_id} dispatched to queue");
                $dispatched++;

                // Log to database
                Log::channel('daily')->info("Dispatched email notification", [
                    'pam_id' => $notification->pam_id,
                    'type' => $notification->type,
                    'to_user' => $notification->to_user,
                    'to_email' => $notification->to_email ?? optional($notification->toUser)->email,
                ]);
            }

            $duration = now()->diffInMilliseconds($startTime);

            $this->info("Processed {$notifications->count()} notification(s) in {$duration}ms");
            $this->info("  - Dispatched: {$dispatched}");
            if ($skipped > 0) {
                $this->warn("  - Skipped: {$skipped}");
            }

        } catch (\Exception $e) {
            $this->error('Error processing notifications: ' . $e->getMessage());
            Log::error('Notification processor error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
