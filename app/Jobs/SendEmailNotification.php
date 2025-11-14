<?php

namespace App\Jobs;

use App\Models\ScheduledNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class SendEmailNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public $backoff = [60, 300, 600]; // 1min, 5min, 10min

    /**
     * The scheduled notification instance.
     */
    protected ScheduledNotification $notification;

    /**
     * Create a new job instance.
     */
    public function __construct(ScheduledNotification $notification)
    {
        $this->notification = $notification;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Skip if already delivered
            if ($this->notification->delivered) {
                Log::info("Notification {$this->notification->pam_id} already delivered. Skipping.");
                return;
            }

            // Skip if deleted
            if ($this->notification->deleted) {
                Log::info("Notification {$this->notification->pam_id} deleted. Skipping.");
                return;
            }

            // Get recipient email
            $toEmail = $this->notification->to_email;
            
            if (!$toEmail && $this->notification->toUser) {
                $toEmail = $this->notification->toUser->email;
            }

            if (!$toEmail) {
                throw new \Exception('No email address found for recipient');
            }

            // Send email
            Mail::send([], [], function ($message) use ($toEmail) {
                $message->to($toEmail)
                    ->subject($this->notification->type)
                    ->text($this->notification->message);
            });

            // Mark as delivered
            $this->notification->update([
                'delivered' => true,
                'sent_date' => now(),
                'error_message' => null,
            ]);

            Log::info("Email sent successfully for notification {$this->notification->pam_id}");

            // Create acknowledgment notification if required
            if ($this->notification->ack_required && $this->notification->from_user) {
                $ackNotification = new ScheduledNotification([
                    'from_user' => $this->notification->to_user,
                    'to_user' => $this->notification->from_user,
                    'type' => 'Delivery Confirmation',
                    'message' => "Your notification '{$this->notification->type}' has been delivered to {$toEmail}.",
                    'trigger_date' => now(),
                    'screen' => true,
                    'delivered' => true,
                    'sent_date' => now(),
                ]);
                $ackNotification->save();
            }

        } catch (\Exception $e) {
            // Log error
            Log::error("Failed to send email for notification {$this->notification->pam_id}: {$e->getMessage()}");
            
            // Record failure
            $this->notification->recordFailure($e->getMessage());

            // Re-throw to trigger Laravel's retry mechanism
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error("Email notification {$this->notification->pam_id} failed after all retries: {$exception->getMessage()}");
        
        $this->notification->update([
            'error_message' => "Failed after {$this->tries} attempts: {$exception->getMessage()}",
            'delivered' => false,
        ]);

        // Notify admin if critical notification failed
        if ($this->notification->ack_required) {
            // Create admin notification
            $adminNotification = new ScheduledNotification([
                'to_user' => 1, // Admin user ID
                'type' => 'Failed Notification Alert',
                'message' => "Critical notification {$this->notification->pam_id} failed to send.\nRecipient: {$this->notification->to_email}\nError: {$exception->getMessage()}",
                'trigger_date' => now(),
                'screen' => true,
                'email1' => true,
                'delivered' => false,
            ]);
            $adminNotification->save();
        }
    }
}
