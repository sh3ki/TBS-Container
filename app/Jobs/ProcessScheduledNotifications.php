<?php

namespace App\Jobs;

use App\Models\ScheduledNotification;
use App\Services\NotificationService;
use App\Services\AuditService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessScheduledNotifications implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Execute the job.
     * 
     * Based on legacy jPAM routine - processes all due notifications
     * and delivers them via configured channels (Email, SMS, Phone, Fax).
     */
    public function handle(NotificationService $notificationService, AuditService $audit): void
    {
        // Check if table exists (in case migration hasn't been run yet)
        if (!$this->tableExists()) {
            Log::warning('Scheduled notifications table does not exist. Skipping job.');
            return;
        }

        // Get all due notifications that haven't been delivered
        $notifications = ScheduledNotification::pending()
            ->orderBy('trigger_date', 'asc')
            ->limit(100) // Process max 100 per run to avoid timeouts
            ->get();

        $processedCount = 0;
        $failedCount = 0;

        foreach ($notifications as $notification) {
            try {
                // Process notification through all active channels
                $results = $notificationService->process($notification);

                if (!empty($results['success'])) {
                    $processedCount++;
                } else {
                    $failedCount++;
                }

            } catch (\Exception $e) {
                $failedCount++;
                Log::error("Failed to process notification {$notification->pam_id}: " . $e->getMessage());
                
                // Mark as failed with error
                $notification->markAsFailed($e->getMessage());
            }
        }

        // Log job execution summary
        if ($processedCount > 0 || $failedCount > 0) {
            $audit->log(
                'SYSTEM',
                "Scheduled notifications job executed. Processed: {$processedCount}, Failed: {$failedCount}",
                'SYSTEM'
            );

            Log::info("Scheduled notifications processed", [
                'processed' => $processedCount,
                'failed' => $failedCount,
                'total' => $notifications->count()
            ]);
        }
    }

    /**
     * Check if the scheduled notifications table exists.
     *
     * @return bool
     */
    protected function tableExists(): bool
    {
        try {
            \DB::table('fjp_scheduled_notifications')->limit(1)->get();
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
