<?php

namespace App\Services;

use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class EmailService
{
    /**
     * Send email notification.
     *
     * @param string $to Recipient email address
     * @param string $subject Email subject
     * @param string $message Email message content
     * @param array $options Additional options (cc, bcc, attachments)
     * @return bool Success status
     */
    public function send(string $to, string $subject, string $message, array $options = []): bool
    {
        try {
            Mail::raw($message, function ($mail) use ($to, $subject, $options) {
                $mail->to($to)->subject($subject);

                // Handle CC
                if (isset($options['cc']) && !empty($options['cc'])) {
                    $mail->cc($options['cc']);
                }

                // Handle BCC
                if (isset($options['bcc']) && !empty($options['bcc'])) {
                    $mail->bcc($options['bcc']);
                }

                // Handle attachments
                if (isset($options['attachments']) && is_array($options['attachments'])) {
                    foreach ($options['attachments'] as $attachment) {
                        if (file_exists($attachment)) {
                            $mail->attach($attachment);
                        }
                    }
                }

                // Handle reply-to
                if (isset($options['reply_to'])) {
                    $mail->replyTo($options['reply_to']);
                }
            });

            Log::info("Email sent successfully to {$to}", [
                'subject' => $subject,
                'message_length' => strlen($message)
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error("Email sending failed: " . $e->getMessage(), [
                'to' => $to,
                'subject' => $subject,
                'error' => $e->getMessage()
            ]);

            return false;
        }
    }

    /**
     * Send HTML email.
     *
     * @param string $to Recipient email address
     * @param string $subject Email subject
     * @param string $html HTML content
     * @param array $options Additional options
     * @return bool Success status
     */
    public function sendHtml(string $to, string $subject, string $html, array $options = []): bool
    {
        try {
            Mail::send([], [], function ($mail) use ($to, $subject, $html, $options) {
                $mail->to($to)
                     ->subject($subject)
                     ->html($html);

                if (isset($options['cc'])) {
                    $mail->cc($options['cc']);
                }

                if (isset($options['bcc'])) {
                    $mail->bcc($options['bcc']);
                }

                if (isset($options['attachments']) && is_array($options['attachments'])) {
                    foreach ($options['attachments'] as $attachment) {
                        if (file_exists($attachment)) {
                            $mail->attach($attachment);
                        }
                    }
                }

                if (isset($options['reply_to'])) {
                    $mail->replyTo($options['reply_to']);
                }
            });

            Log::info("HTML email sent successfully to {$to}", [
                'subject' => $subject
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error("HTML email sending failed: " . $e->getMessage(), [
                'to' => $to,
                'subject' => $subject
            ]);

            return false;
        }
    }

    /**
     * Send bulk emails to multiple recipients.
     *
     * @param array $recipients Array of email addresses
     * @param string $subject Email subject
     * @param string $message Email message
     * @param array $options Additional options
     * @return array Results with 'success' and 'failed' arrays
     */
    public function sendBulk(array $recipients, string $subject, string $message, array $options = []): array
    {
        $results = [
            'success' => [],
            'failed' => [],
        ];

        foreach ($recipients as $email) {
            if ($this->send($email, $subject, $message, $options)) {
                $results['success'][] = $email;
            } else {
                $results['failed'][] = $email;
            }
        }

        return $results;
    }

    /**
     * Validate email address.
     *
     * @param string $email Email address to validate
     * @return bool True if valid
     */
    public function isValidEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Send booking confirmation email.
     *
     * @param string $to Recipient email
     * @param array $bookingData Booking details
     * @return bool Success status
     */
    public function sendBookingConfirmation(string $to, array $bookingData): bool
    {
        $subject = "FJPWL Booking Confirmation - {$bookingData['book_no']}";
        
        $message = "Dear {$bookingData['client_name']},\n\n";
        $message .= "Your booking has been confirmed.\n\n";
        $message .= "Booking Number: {$bookingData['book_no']}\n";
        $message .= "Shipper: {$bookingData['shipper']}\n";
        $message .= "Containers: {$bookingData['total_containers']}\n";
        $message .= "Expiration Date: {$bookingData['expiration_date']}\n\n";
        $message .= "Thank you for choosing FJPWL Container Yard.\n\n";
        $message .= "Best regards,\n";
        $message .= "FJPWL Management";

        return $this->send($to, $subject, $message);
    }

    /**
     * Send invoice email.
     *
     * @param string $to Recipient email
     * @param array $invoiceData Invoice details
     * @param string|null $attachmentPath Path to PDF invoice
     * @return bool Success status
     */
    public function sendInvoice(string $to, array $invoiceData, ?string $attachmentPath = null): bool
    {
        $subject = "FJPWL Invoice - {$invoiceData['invoice_no']}";
        
        $message = "Dear {$invoiceData['client_name']},\n\n";
        $message .= "Please find attached your invoice.\n\n";
        $message .= "Invoice Number: {$invoiceData['invoice_no']}\n";
        $message .= "Billing Period: {$invoiceData['period']}\n";
        $message .= "Total Amount: PHP " . number_format($invoiceData['total'], 2) . "\n\n";
        $message .= "Please settle the amount by {$invoiceData['due_date']}.\n\n";
        $message .= "Thank you for your business.\n\n";
        $message .= "Best regards,\n";
        $message .= "FJPWL Billing Department";

        $options = [];
        if ($attachmentPath && file_exists($attachmentPath)) {
            $options['attachments'] = [$attachmentPath];
        }

        return $this->send($to, $subject, $message, $options);
    }

    /**
     * Send container status notification.
     *
     * @param string $to Recipient email
     * @param array $containerData Container details
     * @return bool Success status
     */
    public function sendContainerStatus(string $to, array $containerData): bool
    {
        $subject = "FJPWL Container Status Update - {$containerData['container_no']}";
        
        $message = "Dear {$containerData['client_name']},\n\n";
        $message .= "Container Status Update:\n\n";
        $message .= "Container Number: {$containerData['container_no']}\n";
        $message .= "Status: {$containerData['status']}\n";
        $message .= "Location: {$containerData['location']}\n";
        $message .= "Date: {$containerData['date']}\n\n";
        
        if (isset($containerData['remarks'])) {
            $message .= "Remarks: {$containerData['remarks']}\n\n";
        }
        
        $message .= "For inquiries, please contact us.\n\n";
        $message .= "Best regards,\n";
        $message .= "FJPWL Operations";

        return $this->send($to, $subject, $message);
    }

    /**
     * Send gate-in/out notification.
     *
     * @param string $to Recipient email
     * @param array $gateData Gate activity details
     * @return bool Success status
     */
    public function sendGateNotification(string $to, array $gateData): bool
    {
        $action = $gateData['action'] === 'IN' ? 'Gate In' : 'Gate Out';
        $subject = "FJPWL {$action} Notification - {$gateData['container_no']}";
        
        $message = "Dear {$gateData['client_name']},\n\n";
        $message .= "Container {$action} Notification:\n\n";
        $message .= "Container Number: {$gateData['container_no']}\n";
        $message .= "Plate Number: {$gateData['plate_no']}\n";
        $message .= "Hauler: {$gateData['hauler']}\n";
        $message .= "Date/Time: {$gateData['datetime']}\n\n";
        
        if ($gateData['action'] === 'IN') {
            $message .= "The container is now in our yard.\n\n";
        } else {
            $message .= "The container has been released from our yard.\n\n";
        }
        
        $message .= "Best regards,\n";
        $message .= "FJPWL Gate Operations";

        return $this->send($to, $subject, $message);
    }
}
