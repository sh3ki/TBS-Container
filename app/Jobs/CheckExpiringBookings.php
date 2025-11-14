<?php

namespace App\Jobs;

use App\Models\Booking;
use App\Services\AuditService;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckExpiringBookings implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Execute the job.
     * 
     * Checks for bookings that are expiring soon and sends notifications
     * to clients via email and SMS.
     */
    public function handle(NotificationService $notificationService, AuditService $audit): void
    {
        try {
            // Get bookings expiring in the next 3 days
            $expiringBookings = Booking::with(['client', 'user'])
                ->whereDate('expiration_date', '>=', now())
                ->whereDate('expiration_date', '<=', now()->addDays(3))
                ->get();

            $notifiedCount = 0;
            $expiredCount = 0;

            foreach ($expiringBookings as $booking) {
                try {
                    $daysUntilExpiry = now()->diffInDays($booking->expiration_date, false);
                    $daysText = $daysUntilExpiry <= 0 ? 'today' : "in {$daysUntilExpiry} days";

                    // Calculate remaining containers
                    $totalContainers = $booking->twenty + $booking->fourty + $booking->fourty_five;
                    $remainingContainers = $booking->twenty_rem + $booking->fourty_rem + $booking->fourty_five_rem;

                    // Skip if booking is already fully allocated
                    if ($remainingContainers <= 0) {
                        continue;
                    }

                    // Prepare notification data
                    $bookingData = [
                        'book_no' => $booking->book_no,
                        'shipper' => $booking->shipper,
                        'expiration_date' => $booking->expiration_date->format('Y-m-d'),
                        'remaining_containers' => $remainingContainers,
                        'total_containers' => $totalContainers,
                    ];

                    // Send notification if client has contact info
                    if ($booking->client) {
                        $clientEmail = $booking->client->client_email;
                        $clientPhone = $booking->client->phone_number;

                        if ($clientEmail) {
                            $notificationService->sendExpiringBookingReminder(
                                $bookingData,
                                $clientEmail,
                                $clientPhone
                            );

                            $notifiedCount++;

                            // Log the notification
                            $audit->log(
                                'NOTIFICATION',
                                "Expiration alert sent for booking: {$booking->book_no} (expires {$daysText})",
                                'BOOKINGS',
                                $booking->b_id
                            );
                        }
                    }

                    // Mark as expired if expiration date has passed
                    if ($daysUntilExpiry < 0 && $remainingContainers > 0) {
                        // You could add logic here to mark booking as expired
                        $expiredCount++;
                        
                        Log::warning("Booking expired with remaining containers", [
                            'book_no' => $booking->book_no,
                            'remaining' => $remainingContainers
                        ]);
                    }

                } catch (\Exception $e) {
                    Log::error("Failed to send expiration alert for booking {$booking->book_no}: " . $e->getMessage());
                }
            }

            // Log job execution
            $message = "Booking expiration check completed. {$notifiedCount} alerts sent.";
            if ($expiredCount > 0) {
                $message .= " {$expiredCount} bookings expired.";
            }

            $audit->log(
                'SYSTEM',
                $message,
                'SYSTEM'
            );

            Log::info($message, [
                'expiring_bookings' => $expiringBookings->count(),
                'notifications_sent' => $notifiedCount,
                'expired' => $expiredCount
            ]);

        } catch (\Exception $e) {
            Log::error("Booking expiration check failed: " . $e->getMessage());
            
            $audit->log(
                'ERROR',
                "Booking expiration check failed: {$e->getMessage()}",
                'SYSTEM'
            );
        }
    }
}
