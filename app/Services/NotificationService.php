<?php

namespace App\Services;

use App\Models\ScheduledNotification;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    protected $emailService;
    protected $smsService;
    protected $auditService;

    public function __construct(
        EmailService $emailService,
        SmsService $smsService,
        AuditService $auditService
    ) {
        $this->emailService = $emailService;
        $this->smsService = $smsService;
        $this->auditService = $auditService;
    }

    /**
     * Create a new scheduled notification.
     *
     * @param array $data Notification data
     * @return ScheduledNotification
     */
    public function create(array $data): ScheduledNotification
    {
        $notification = ScheduledNotification::create([
            'from_user' => $data['from_user'] ?? auth()->id(),
            'to_user' => $data['to_user'] ?? null,
            'sent_date' => now(),
            'trigger_date' => $data['trigger_date'] ?? now(),
            'type' => $data['type'] ?? 'General',
            'message' => $data['message'],
            'screen' => $data['screen'] ?? false,
            'email1' => $data['email1'] ?? false,
            'email2' => $data['email2'] ?? false,
            'sms1' => $data['sms1'] ?? false,
            'sms2' => $data['sms2'] ?? false,
            'tel1' => $data['tel1'] ?? false,
            'tel2' => $data['tel2'] ?? false,
            'mobile1' => $data['mobile1'] ?? false,
            'mobile2' => $data['mobile2'] ?? false,
            'fax1' => $data['fax1'] ?? false,
            'fax2' => $data['fax2'] ?? false,
            'ack_required' => $data['ack_required'] ?? true,
            'to_email' => $data['to_email'] ?? null,
            'to_phone' => $data['to_phone'] ?? null,
            'to_address' => $data['to_address'] ?? null,
        ]);

        // Log notification creation
        $this->auditService->log(
            'CREATE',
            "Scheduled notification created: {$notification->type}",
            'NOTIFICATIONS',
            $notification->pam_id
        );

        return $notification;
    }

    /**
     * Process a notification through all active channels.
     *
     * @param ScheduledNotification $notification
     * @return array Results of delivery attempts
     */
    public function process(ScheduledNotification $notification): array
    {
        $results = [
            'success' => [],
            'failed' => [],
        ];

        // Get recipient user if specified
        $user = $notification->to_user ? User::find($notification->to_user) : null;

        // Process each active channel
        $channels = $notification->getActiveChannels();

        foreach ($channels as $channel) {
            try {
                $success = $this->deliverViaChannel($notification, $channel, $user);
                
                if ($success) {
                    $results['success'][] = $channel;
                } else {
                    $results['failed'][] = $channel;
                }
            } catch (\Exception $e) {
                $results['failed'][] = $channel;
                Log::error("Channel delivery failed: {$channel}", [
                    'notification_id' => $notification->pam_id,
                    'error' => $e->getMessage()
                ]);
            }
        }

        // Mark as delivered if any channel succeeded
        if (!empty($results['success'])) {
            $notification->markAsDelivered("Delivered via: " . implode(', ', $results['success']));
            
            // Log successful delivery
            $this->auditService->log(
                'NOTIFICATION',
                "Notification delivered via " . implode(', ', $results['success']),
                'NOTIFICATIONS',
                $notification->pam_id
            );
        } else {
            // Mark as failed
            $notification->markAsFailed("All channels failed: " . implode(', ', $results['failed']));
        }

        return $results;
    }

    /**
     * Deliver notification via specific channel.
     *
     * @param ScheduledNotification $notification
     * @param string $channel
     * @param User|null $user
     * @return bool Success status
     */
    protected function deliverViaChannel(ScheduledNotification $notification, string $channel, ?User $user): bool
    {
        switch ($channel) {
            case 'email1':
                return $this->sendViaEmail($notification, $user?->email ?? $notification->to_email);

            case 'email2':
                // Office email (if user has it)
                return $this->sendViaEmail($notification, $user?->office_email ?? $notification->to_email);

            case 'sms1':
                return $this->sendViaSms($notification, $user?->phone_number ?? $notification->to_phone);

            case 'sms2':
                // Office mobile (if user has it)
                return $this->sendViaSms($notification, $user?->office_mobile ?? $notification->to_phone);

            case 'tel1':
            case 'tel2':
            case 'mobile1':
            case 'mobile2':
                // Phone call functionality (would need VOIP integration)
                return $this->sendViaPhone($notification, $user);

            case 'fax1':
            case 'fax2':
                // Fax functionality (would need fax gateway integration)
                return $this->sendViaFax($notification, $user);

            case 'screen':
                // On-screen notification (handled by frontend)
                return true;

            default:
                Log::warning("Unknown channel: {$channel}");
                return false;
        }
    }

    /**
     * Send notification via email.
     *
     * @param ScheduledNotification $notification
     * @param string|null $email
     * @return bool
     */
    protected function sendViaEmail(ScheduledNotification $notification, ?string $email): bool
    {
        if (!$email || !$this->emailService->isValidEmail($email)) {
            Log::warning("Invalid or missing email address", [
                'notification_id' => $notification->pam_id
            ]);
            return false;
        }

        $subject = "FJPWL Notification - {$notification->type}";
        return $this->emailService->send($email, $subject, $notification->message);
    }

    /**
     * Send notification via SMS.
     *
     * @param ScheduledNotification $notification
     * @param string|null $phone
     * @return bool
     */
    protected function sendViaSms(ScheduledNotification $notification, ?string $phone): bool
    {
        if (!$phone) {
            Log::warning("Missing phone number", [
                'notification_id' => $notification->pam_id
            ]);
            return false;
        }

        $result = $this->smsService->send($phone, $notification->message);
        return is_array($result) ? ($result['success'] ?? false) : $result;
    }

    /**
     * Send notification via phone call.
     * (Placeholder for VOIP integration)
     *
     * @param ScheduledNotification $notification
     * @param User|null $user
     * @return bool
     */
    protected function sendViaPhone(ScheduledNotification $notification, ?User $user): bool
    {
        // This would require integration with a VOIP service
        // For now, log and return true
        Log::info("Phone call notification (not implemented)", [
            'notification_id' => $notification->pam_id,
            'user_id' => $user?->user_id
        ]);
        
        return true; // Simulate success
    }

    /**
     * Send notification via fax.
     * (Placeholder for fax gateway integration)
     *
     * @param ScheduledNotification $notification
     * @param User|null $user
     * @return bool
     */
    protected function sendViaFax(ScheduledNotification $notification, ?User $user): bool
    {
        // This would require integration with a fax service
        // For now, log and return true
        Log::info("Fax notification (not implemented)", [
            'notification_id' => $notification->pam_id,
            'user_id' => $user?->user_id
        ]);
        
        return true; // Simulate success
    }

    /**
     * Send booking confirmation to client.
     *
     * @param array $bookingData
     * @param string $clientEmail
     * @param string|null $clientPhone
     * @return ScheduledNotification
     */
    public function sendBookingConfirmation(array $bookingData, string $clientEmail, ?string $clientPhone = null): ScheduledNotification
    {
        $message = "Booking Confirmed!\n\n";
        $message .= "Booking No: {$bookingData['book_no']}\n";
        $message .= "Shipper: {$bookingData['shipper']}\n";
        $message .= "Expiration: {$bookingData['expiration_date']}\n\n";
        $message .= "Thank you for choosing FJPWL!";

        return $this->create([
            'type' => 'Booking Confirmation',
            'message' => $message,
            'email1' => true,
            'sms1' => !empty($clientPhone),
            'to_email' => $clientEmail,
            'to_phone' => $clientPhone,
            'trigger_date' => now(),
        ]);
    }

    /**
     * Send gate-in notification to client.
     *
     * @param array $gateData
     * @param string $clientEmail
     * @param string|null $clientPhone
     * @return ScheduledNotification
     */
    public function sendGateInNotification(array $gateData, string $clientEmail, ?string $clientPhone = null): ScheduledNotification
    {
        $message = "Container Gate In\n\n";
        $message .= "Container: {$gateData['container_no']}\n";
        $message .= "Plate: {$gateData['plate_no']}\n";
        $message .= "Hauler: {$gateData['hauler']}\n";
        $message .= "Date: " . now()->format('Y-m-d H:i') . "\n\n";
        $message .= "Container is now in FJPWL yard.";

        return $this->create([
            'type' => 'Gate In',
            'message' => $message,
            'email1' => true,
            'sms1' => !empty($clientPhone),
            'to_email' => $clientEmail,
            'to_phone' => $clientPhone,
            'trigger_date' => now(),
        ]);
    }

    /**
     * Send expiring booking reminder.
     *
     * @param array $bookingData
     * @param string $clientEmail
     * @param string|null $clientPhone
     * @return ScheduledNotification
     */
    public function sendExpiringBookingReminder(array $bookingData, string $clientEmail, ?string $clientPhone = null): ScheduledNotification
    {
        $message = "Booking Expiration Reminder\n\n";
        $message .= "Booking No: {$bookingData['book_no']}\n";
        $message .= "Expires: {$bookingData['expiration_date']}\n";
        $message .= "Remaining: {$bookingData['remaining_containers']} containers\n\n";
        $message .= "Please arrange delivery before expiration.";

        return $this->create([
            'type' => 'Booking Reminder',
            'message' => $message,
            'email1' => true,
            'sms1' => !empty($clientPhone),
            'to_email' => $clientEmail,
            'to_phone' => $clientPhone,
            'trigger_date' => now(),
        ]);
    }

    /**
     * Get pending notifications count.
     *
     * @return int
     */
    public function getPendingCount(): int
    {
        return ScheduledNotification::pending()->count();
    }

    /**
     * Get notifications for a specific user.
     *
     * @param int $userId
     * @param bool $unreadOnly
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getUserNotifications(int $userId, bool $unreadOnly = false)
    {
        $query = ScheduledNotification::where('to_user', $userId)
                                     ->where('screen', true)
                                     ->orderBy('trigger_date', 'desc');

        if ($unreadOnly) {
            $query->where('delivered', 0);
        }

        return $query->get();
    }
}
