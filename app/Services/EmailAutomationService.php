<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Webklex\PHPIMAP\ClientManager;

class EmailAutomationService
{
    public function __construct(private readonly EmailService $emailService)
    {
    }

    public function runCycle(): array
    {
        $summary = [
            'incoming' => ['processed' => 0, 'queued_replies' => 0, 'errors' => 0],
            'scheduled' => ['processed' => 0, 'delivered' => 0, 'failed' => 0],
            'replies' => ['processed' => 0, 'sent' => 0, 'failed' => 0],
        ];

        if (config('email_automation.incoming.enabled', true)) {
            $summary['incoming'] = $this->processIncomingEmails();
        }

        if (config('email_automation.scheduled.enabled', true)) {
            $summary['scheduled'] = $this->processScheduledMessages();
        }

        if (config('email_automation.reply.enabled', true)) {
            $summary['replies'] = $this->processReplyQueue();
        }

        return $summary;
    }

    public function processIncomingEmails(): array
    {
        $processed = 0;
        $queuedReplies = 0;
        $errors = 0;

        $host = (string) config('email_automation.incoming.host');
        $username = (string) config('email_automation.incoming.username');
        $password = (string) config('email_automation.incoming.password');

        if ($host === '' || $username === '' || $password === '') {
            $this->logAutomation('incoming', 'skipped', null, null, null, null, 'Incoming mail skipped. POP3 credentials are incomplete.');
            return compact('processed', 'queuedReplies', 'errors');
        }

        try {
            $cm = new ClientManager([
                'options' => ['delimiter' => '/'],
                'accounts' => [
                    'automation' => [
                        'host' => $host,
                        'port' => (int) config('email_automation.incoming.port', 110),
                        'encryption' => (string) config('email_automation.incoming.encryption', 'none'),
                        'validate_cert' => (bool) config('email_automation.incoming.validate_cert', false),
                        'username' => $username,
                        'password' => $password,
                        'protocol' => 'pop3',
                    ],
                ],
            ]);

            $client = $cm->account('automation');
            $client->connect();

            $folder = $client->getFolder((string) config('email_automation.incoming.folder', 'INBOX'));
            $messages = $folder->query()->all()->get();

            foreach ($messages as $message) {
                try {
                    $processed++;

                    $subject = (string) $message->getSubject();
                    $messageId = method_exists($message, 'getMessageId') ? (string) $message->getMessageId() : null;

                    $fromEmail = null;
                    $from = $message->getFrom();
                    if (!empty($from) && isset($from[0]->mail)) {
                        $fromEmail = (string) $from[0]->mail;
                    }

                    $savedAttachment = null;
                    $attachmentCount = 0;

                    $attachments = $message->getAttachments();
                    foreach ($attachments as $attachment) {
                        $attachmentCount++;
                        $attachmentName = preg_replace('/[^A-Za-z0-9._-]/', '_', (string) $attachment->name);
                        $dir = trim((string) config('email_automation.attachments_dir', 'email-automation/attachments'), '/');
                        $path = $dir . '/' . Carbon::now()->format('Ymd') . '/' . uniqid('att_', true) . '_' . $attachmentName;

                        $content = null;
                        if (method_exists($attachment, 'getContent')) {
                            $content = $attachment->getContent();
                        } elseif (isset($attachment->content)) {
                            $content = $attachment->content;
                        }

                        if ($content === null) {
                            throw new \RuntimeException('Unable to read attachment content.');
                        }

                        Storage::disk((string) config('email_automation.attachments_disk', 'local'))
                            ->put($path, $content);

                        if ($savedAttachment === null) {
                            $savedAttachment = $path;
                        }
                    }

                    $isKnownSubject = str_contains(strtoupper($subject), 'YARD FILE') || str_contains(strtoupper($subject), 'AGENT FILE');
                    if ($isKnownSubject && $attachmentCount === 0) {
                        $errors++;
                        $this->enqueueReply(
                            (string) $fromEmail,
                            'ERR',
                            'Error Report On ' . Carbon::now()->format('Y-m-d H:i:s'),
                            'No attachment found for subject requiring EDI processing.',
                            null,
                            $messageId,
                            $subject
                        );
                        $queuedReplies++;
                        $this->logAutomation('incoming', 'error', $fromEmail, null, $subject, $messageId, null, 'No attachment found.');
                    } else {
                        $statusText = 'Successfully Update ' . Carbon::now()->format('Y-m-d H:i:s');
                        $body = $attachmentCount > 0
                            ? 'Attachment received and stored successfully.'
                            : 'Message received and logged successfully.';

                        if (!empty($fromEmail)) {
                            $this->enqueueReply(
                                (string) $fromEmail,
                                'OK',
                                $statusText,
                                $body,
                                $savedAttachment,
                                $messageId,
                                $subject
                            );
                            $queuedReplies++;
                        }

                        $this->logAutomation('incoming', 'ok', $fromEmail, null, $subject, $messageId, $savedAttachment, 'Incoming message processed.');
                    }

                    if ((bool) config('email_automation.incoming.delete_processed', false)) {
                        $message->setFlag('DELETED');
                    }
                } catch (\Throwable $e) {
                    $errors++;
                    $this->logAutomation('incoming', 'error', null, null, null, null, null, null, $e->getMessage());
                }
            }

            if ((bool) config('email_automation.incoming.delete_processed', false)) {
                $client->expunge();
            }

            $client->disconnect();
        } catch (\Throwable $e) {
            $errors++;
            $this->logAutomation('incoming', 'error', null, null, null, null, null, null, $e->getMessage());
            Log::error('Incoming email automation failed', ['error' => $e->getMessage()]);
        }

        return ['processed' => $processed, 'queued_replies' => $queuedReplies, 'errors' => $errors];
    }

    public function processScheduledMessages(): array
    {
        $processed = 0;
        $delivered = 0;
        $failed = 0;

        $table = $this->resolveNotificationTable();
        if ($table === null) {
            $this->logAutomation('scheduled', 'skipped', null, null, null, null, 'No scheduled notifications table found.');
            return compact('processed', 'delivered', 'failed');
        }

        $max = (int) config('email_automation.scheduled.max_per_cycle', 100);

        $notifications = DB::table($table)
            ->where(function ($q) {
                $q->where('email1', 1)->orWhere('email2', 1);
            })
            ->where(function ($q) {
                $q->whereNull('delivered')->orWhere('delivered', 0);
            })
            ->where(function ($q) {
                $q->whereNull('deleted')->orWhere('deleted', 0);
            })
            ->where('trigger_date', '<=', now())
            ->orderBy('trigger_date', 'asc')
            ->limit($max)
            ->get();

        foreach ($notifications as $notification) {
            $processed++;
            try {
                $recipient = $this->resolveRecipientEmails($notification);
                $targets = [];
                if ((int) $notification->email1 === 1 && !empty($recipient['email1'])) {
                    $targets[] = $recipient['email1'];
                }
                if ((int) $notification->email2 === 1 && !empty($recipient['email2'])) {
                    $targets[] = $recipient['email2'];
                }

                $targets = array_values(array_unique(array_filter($targets)));
                if (empty($targets)) {
                    $failed++;
                    DB::table($table)->where('pam_id', $notification->pam_id)->update([
                        'retry_count' => DB::raw('COALESCE(retry_count,0)+1'),
                        'error_message' => 'No target email found',
                    ]);
                    $this->logAutomation('scheduled', 'error', null, null, (string) $notification->type, (string) $notification->pam_id, null, null, 'No target email found.');
                    continue;
                }

                $subject = (string) ($notification->type ?: 'Notification');
                $html = nl2br(e((string) ($notification->message ?? '')));

                $sentCount = 0;
                foreach ($targets as $to) {
                    $ok = $this->emailService->sendHtml((string) $to, $subject, $html);
                    if ($ok) {
                        $sentCount++;
                        $this->logAutomation('scheduled', 'ok', null, (string) $to, $subject, (string) $notification->pam_id, null, 'Scheduled email sent.');
                    }
                }

                if ($sentCount > 0) {
                    $ack = 'Message sent by Email to ' . implode(', ', $targets);
                    DB::table($table)->where('pam_id', $notification->pam_id)->update([
                        'delivered' => 1,
                        'sent_date' => now(),
                        'ack_date' => now(),
                        'ack_message' => $ack,
                        'error_message' => null,
                    ]);

                    if (!empty($notification->ack_required) && !empty($notification->from_user)) {
                        DB::table($table)->insert([
                            'from_user' => $notification->to_user,
                            'to_user' => $notification->from_user,
                            'sent_date' => now(),
                            'trigger_date' => now(),
                            'type' => 'Acknowledgement',
                            'message' => $ack,
                            'screen' => 1,
                            'email1' => 0,
                            'email2' => 0,
                            'sms1' => 0,
                            'sms2' => 0,
                            'tel1' => 0,
                            'tel2' => 0,
                            'mobile1' => 0,
                            'mobile2' => 0,
                            'fax1' => 0,
                            'fax2' => 0,
                            'ack_required' => 0,
                            'delivered' => 1,
                            'ack_date' => now(),
                            'ack_message' => 'Acknowledgement created.',
                            'retry_count' => 0,
                            'deleted' => 0,
                        ]);
                    }

                    $delivered++;
                } else {
                    $failed++;
                    DB::table($table)->where('pam_id', $notification->pam_id)->update([
                        'retry_count' => DB::raw('COALESCE(retry_count,0)+1'),
                        'error_message' => 'SMTP send failed for all recipients',
                    ]);
                }
            } catch (\Throwable $e) {
                $failed++;
                DB::table($table)->where('pam_id', $notification->pam_id)->update([
                    'retry_count' => DB::raw('COALESCE(retry_count,0)+1'),
                    'error_message' => $e->getMessage(),
                ]);
                $this->logAutomation('scheduled', 'error', null, null, (string) $notification->type, (string) $notification->pam_id, null, null, $e->getMessage());
            }
        }

        return compact('processed', 'delivered', 'failed');
    }

    public function processReplyQueue(): array
    {
        $processed = 0;
        $sent = 0;
        $failed = 0;

        if (!Schema::hasTable('email_reply_queue')) {
            return compact('processed', 'sent', 'failed');
        }

        $rows = DB::table('email_reply_queue')
            ->where('status', 'pending')
            ->orderBy('id', 'asc')
            ->limit(200)
            ->get();

        foreach ($rows as $row) {
            $processed++;
            try {
                $options = [];
                if (!empty($row->attachment_path)) {
                    $absolute = Storage::disk((string) config('email_automation.attachments_disk', 'local'))->path($row->attachment_path);
                    if (is_file($absolute)) {
                        $options['attachments'] = [$absolute];
                    }
                }

                $ok = $this->emailService->sendHtml((string) $row->to_email, (string) $row->subject, nl2br(e((string) $row->body)), $options);
                if ($ok) {
                    DB::table('email_reply_queue')->where('id', $row->id)->update([
                        'status' => 'sent',
                        'attempts' => $row->attempts + 1,
                        'sent_at' => now(),
                        'last_error' => null,
                        'updated_at' => now(),
                    ]);
                    $sent++;
                    $this->logAutomation('reply', 'ok', null, (string) $row->to_email, (string) $row->subject, (string) $row->source_message_id, $row->attachment_path, 'Auto reply sent.');
                } else {
                    DB::table('email_reply_queue')->where('id', $row->id)->update([
                        'status' => 'failed',
                        'attempts' => $row->attempts + 1,
                        'last_error' => 'SMTP send failed',
                        'updated_at' => now(),
                    ]);
                    $failed++;
                }
            } catch (\Throwable $e) {
                $failed++;
                DB::table('email_reply_queue')->where('id', $row->id)->update([
                    'status' => 'failed',
                    'attempts' => $row->attempts + 1,
                    'last_error' => $e->getMessage(),
                    'updated_at' => now(),
                ]);
                $this->logAutomation('reply', 'error', null, (string) $row->to_email, (string) $row->subject, (string) $row->source_message_id, $row->attachment_path, null, $e->getMessage());
            }
        }

        return compact('processed', 'sent', 'failed');
    }

    private function enqueueReply(
        string $toEmail,
        string $replyType,
        string $subject,
        string $body,
        ?string $attachmentPath,
        ?string $sourceMessageId,
        ?string $sourceSubject
    ): void {
        if (!Schema::hasTable('email_reply_queue')) {
            return;
        }

        DB::table('email_reply_queue')->insert([
            'to_email' => $toEmail,
            'reply_type' => $replyType,
            'subject' => $subject,
            'body' => $body,
            'attachment_path' => $attachmentPath,
            'status' => 'pending',
            'attempts' => 0,
            'source_message_id' => $sourceMessageId,
            'source_subject' => $sourceSubject,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function resolveRecipientEmails(object $notification): array
    {
        $email1 = $notification->to_email ?? null;
        $email2 = null;

        if (!empty($notification->to_user) && Schema::hasTable('users')) {
            $user = DB::table('users')->where('user_id', $notification->to_user)->first();
            if ($user) {
                $email1 = $email1 ?: ($user->email ?? ($user->email1 ?? null));
                $email2 = $user->email2 ?? null;
            }
        }

        // Fallback for secondary email to primary if only one exists.
        if (empty($email2)) {
            $email2 = $email1;
        }

        return ['email1' => $email1, 'email2' => $email2];
    }

    private function resolveNotificationTable(): ?string
    {
        $candidates = (array) config('email_automation.notification_table_candidates', []);
        foreach ($candidates as $candidate) {
            if (Schema::hasTable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function logAutomation(
        string $direction,
        string $status,
        ?string $fromEmail,
        ?string $toEmail,
        ?string $subject,
        ?string $messageId,
        ?string $attachmentPath = null,
        ?string $details = null,
        ?string $errorMessage = null
    ): void {
        if (!Schema::hasTable('email_automation_logs')) {
            return;
        }

        DB::table('email_automation_logs')->insert([
            'direction' => $direction,
            'status' => $status,
            'from_email' => $fromEmail,
            'to_email' => $toEmail,
            'subject' => $subject,
            'message_id' => $messageId,
            'attachment_path' => $attachmentPath,
            'details' => $details,
            'error_message' => $errorMessage,
            'processed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
