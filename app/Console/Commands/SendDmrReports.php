<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\ReportsController;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SendDmrReports extends Command
{
    protected $signature = 'dmr:send {--force : Send immediately, ignoring configured time and day exceptions}';
    protected $description = 'Generate and send configured DMR reports for yesterday';

    public function handle(): int
    {
        $timezone = 'Asia/Manila';
        $now = Carbon::now($timezone);
        $settings = DB::table('app_settings')->where('setting_id', 1)->first();
        $configuredTime = (string) ($settings?->dmr_time ?? '');
        $exceptions = json_decode((string) ($settings?->dmr_day_exceptions ?? '[]'), true) ?: [];

        if (!$this->option('force')) {
            if (!$configuredTime || $now->format('H:i') !== substr($configuredTime, 0, 5)) return self::SUCCESS;
            if (in_array($now->format('l'), $exceptions, true)) return self::SUCCESS;
        }

        $reportDate = $now->copy()->subDay()->toDateString();
        $utilization = DB::table('utilizations')->where('utilization_date', $reportDate)->first();
        if (!$utilization) {
            Log::warning('DMR send skipped because yesterday has no utilization snapshot.', ['report_date' => $reportDate]);
            $this->warn("Skipped: no utilization snapshot exists for {$reportDate}.");
            return self::SUCCESS;
        }

        $groups = json_decode((string) ($settings?->dmr_groups ?? '[]'), true) ?: [];
        $senderEmail = (string) ($settings?->dmr_sender_email ?? '');
        $senderPassword = $this->decrypt((string) ($settings?->dmr_sender_password ?? ''));
        $senderName = (string) ($settings?->dmr_sender_name ?: $settings?->smtp_from_name ?: config('mail.from.name'));
        if (!$senderEmail || !$senderPassword || !$groups || !$settings?->smtp_host) {
            $this->error('DMR sender credentials or client groups are not configured.');
            return self::FAILURE;
        }

        $dateLabel = Carbon::parse($reportDate, $timezone)->format('F d, Y');
        $sent = 0;
        foreach ($groups as $group) {
            $clientId = (string) ($group['client_id'] ?? '');
            if ($clientId === '') continue;

            $deliveryStartedAt = Carbon::now($timezone);
            $deliveryLogId = $this->markDeliveryProcessing($clientId, $reportDate, $deliveryStartedAt);

            try {
                $receivers = $this->emails($group['receiver_emails'] ?? '');
                if (!$receivers) {
                    $this->markDeliverySkipped($deliveryLogId, 'No valid receiver email addresses configured.');
                    continue;
                }
                $cc = $this->emails($group['cc_emails'] ?? '');
                $subject = $this->replaceTokens(strip_tags((string) ($group['subject'] ?? '')), $dateLabel, (float) $utilization->utilization_percentage);
                $content = $this->replaceTokens((string) ($group['content'] ?? ''), $dateLabel, (float) $utilization->utilization_percentage);
                $signature = (string) ($settings?->dmr_signature ?? '');
                $html = $content . ($signature !== '' ? '<br><br>' . $signature : '');
                $attachment = $this->exportDmr($reportDate, $clientId);

                $mailer = Mail::build([
                    'transport' => 'smtp',
                    'host' => $settings->smtp_host,
                    'port' => (int) $settings->smtp_port,
                    'scheme' => $settings->smtp_encryption === 'ssl' ? 'smtps' : ($settings->smtp_encryption ?: null),
                    'username' => $senderEmail,
                    'password' => $senderPassword,
                    'timeout' => 30,
                    'from' => ['address' => $senderEmail, 'name' => $senderName],
                ]);
                $sentMessage = $mailer->send([], [], function ($message) use ($senderEmail, $senderName, $receivers, $cc, $subject, $html, $attachment): void {
                    $message->from($senderEmail, $senderName)->to($receivers)->subject($subject)->html($html)->attach($attachment['path'], ['as' => $attachment['name']]);
                    if ($cc) $message->cc($cc);
                });
                @unlink($attachment['path']);
                $this->markDeliverySent($deliveryLogId, $sentMessage?->getMessageId());
                $sent++;
                Log::info('DMR sent successfully.', ['client_id' => $clientId, 'report_date' => $reportDate, 'recipients' => $receivers]);
            } catch (\Throwable $exception) {
                $this->markDeliveryFailed($deliveryLogId, $exception->getMessage());
                Log::error('DMR send failed.', ['client_id' => $group['client_id'] ?? null, 'report_date' => $reportDate, 'error' => $exception->getMessage()]);
                $this->error($exception->getMessage());
            }
        }

        $this->info("DMR send completed. Sent {$sent} group(s) for {$reportDate}.");
        return $sent > 0 ? self::SUCCESS : self::FAILURE;
    }

    private function markDeliveryProcessing(string $clientId, string $reportDate, Carbon $startedAt): int
    {
        $now = $startedAt->toDateTimeString();

        return (int) DB::table('dmr_delivery_logs')->insertGetId([
            'client_id' => $clientId,
            'report_date' => $reportDate,
            'scheduled_at' => $now,
            'started_at' => $now,
            'status' => 'processing',
            'attempts' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function markDeliverySent(int $deliveryLogId, ?string $messageId): void
    {
        DB::table('dmr_delivery_logs')
            ->where('id', $deliveryLogId)
            ->update([
                'status' => 'sent',
                'sent_at' => now('Asia/Manila'),
                'message_id' => $messageId,
                'error_message' => null,
                'last_error_at' => null,
                'updated_at' => now(),
            ]);
    }

    private function markDeliveryFailed(int $deliveryLogId, string $error): void
    {
        $now = now('Asia/Manila');
        DB::table('dmr_delivery_logs')
            ->where('id', $deliveryLogId)
            ->update([
                'status' => 'failed',
                'error_message' => $error,
                'last_error_at' => $now,
                'updated_at' => now(),
            ]);
    }

    private function markDeliverySkipped(int $deliveryLogId, string $reason): void
    {
        $now = now('Asia/Manila');
        DB::table('dmr_delivery_logs')
            ->where('id', $deliveryLogId)
            ->update([
                'status' => 'skipped',
                'error_message' => $reason,
                'last_error_at' => $now,
                'updated_at' => now(),
            ]);
    }

    private function exportDmr(string $date, string $clientId): array
    {
        $request = Request::create('/api/reports/dmr/export', 'POST', ['date' => $date, 'client_id' => $clientId]);
        $response = app(ReportsController::class)->exportDmrReport($request);
        if (!$response instanceof BinaryFileResponse) {
            $body = method_exists($response, 'getContent') ? (string) $response->getContent() : '';
            throw new \RuntimeException('DMR export did not return a file. HTTP ' . $response->getStatusCode() . ': ' . $body);
        }
        $source = $response->getFile()->getPathname();
        $target = tempnam(storage_path('app'), 'dmr_') . '.xlsx';
        if (!$source || !copy($source, $target)) throw new \RuntimeException('Unable to prepare DMR attachment.');
        return ['path' => $target, 'name' => basename($source)];
    }

    private function decrypt(string $value): string
    {
        try { return $value !== '' ? decrypt($value) : ''; } catch (\Throwable) { return ''; }
    }

    private function emails(string $value): array
    {
        return collect(preg_split('/[,;\s]+/', $value) ?: [])->map(fn ($email) => trim((string) $email))->filter(fn ($email) => filter_var($email, FILTER_VALIDATE_EMAIL))->unique()->values()->all();
    }

    private function replaceTokens(string $value, string $date, float $utilization): string
    {
        return str_replace(['{{dmr_date}}', '{{utilization}}'], [$date, number_format($utilization, 2)], $value);
    }
}
