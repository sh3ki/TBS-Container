<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class SmsService
{
    protected $gatewayUrl;
    protected $username;
    protected $password;
    protected $defaultPort;

    public function __construct()
    {
        $this->gatewayUrl = config('services.sms.gateway_url');
        $this->username = config('services.sms.username');
        $this->password = config('services.sms.password');
        $this->defaultPort = config('services.sms.default_port', 'gsm-2.1');
    }

    /**
     * Send SMS message.
     *
     * @param string $mobile Mobile number
     * @param string $message Message content
     * @param string|null $port SMS gateway port
     * @return array
     */
    public function send(string $mobile, string $message, ?string $port = null, ?int $queueEntryId = null, ?string $queueStatus = null, ?int $standbyStatusId = null): array
    {
        $logId = null;
        try {
            // Format mobile number
            $formattedMobile = $this->formatMobileNumber($mobile);

            if (!$formattedMobile) {
                return [
                    'success' => false,
                    'error' => 'Invalid mobile number format',
                ];
            }

            $smsSettings = $this->getSmsSettings();
            $logId = $this->createSmsDeliveryLog($formattedMobile, $message, $smsSettings['driver'], $queueEntryId, $queueStatus, $standbyStatusId);

            if ($smsSettings['driver'] === 'smsgate') {
                $result = $this->sendViaSmsGate($formattedMobile, $message, $smsSettings['smsgate']);
                $this->finishSmsDeliveryLog($logId, $result);
                return $result;
            }

            if ($smsSettings['driver'] === 'philsms') {
                $result = $this->sendViaPhilSms($formattedMobile, $message);
                $this->finishSmsDeliveryLog($logId, $result);
                return $result;
            }

            // Prepare legacy SMS gateway request
            $response = Http::timeout(10)
                ->withBasicAuth($this->username, $this->password)
                ->post($this->gatewayUrl, [
                    'mobile' => $formattedMobile,
                    'message' => $message,
                    'port' => $port ?? $this->defaultPort,
                    'report' => 'json',
                ]);

            if ($response->successful()) {
                Log::info('SMS sent successfully', [
                    'mobile' => $formattedMobile,
                    'message' => $message,
                ]);

                $result = [
                    'success' => true,
                    'response' => $response->json(),
                ];
                $this->finishSmsDeliveryLog($logId, $result);
                return $result;
            }

            Log::error('SMS sending failed', [
                'mobile' => $formattedMobile,
                'status' => $response->status(),
                'error' => $response->body(),
            ]);

            $result = [
                'success' => false,
                'error' => 'SMS gateway returned error: ' . $response->status(),
            ];
            $this->finishSmsDeliveryLog($logId, $result);
            return $result;
        } catch (\Exception $e) {
            Log::error('SMS sending exception', [
                'mobile' => $mobile,
                'error' => $e->getMessage(),
            ]);

            $result = [
                'success' => false,
                'error' => $e->getMessage(),
            ];
            $this->finishSmsDeliveryLog($logId, $result);
            return $result;
        }
    }

    protected function createSmsDeliveryLog(string $recipient, string $message, string $provider, ?int $queueEntryId = null, ?string $queueStatus = null, ?int $standbyStatusId = null): ?int
    {
        try {
            return (int) DB::table('sms_delivery_logs')->insertGetId([
                'provider' => $provider,
                'queue_entry_id' => $queueEntryId,
                'queue_status' => $queueStatus,
                'standby_status_id' => $standbyStatusId,
                'recipient' => $recipient,
                'message' => $message,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('SMS delivery log could not be created.', ['error' => $exception->getMessage()]);
            return null;
        }
    }

    protected function finishSmsDeliveryLog(?int $logId, array $result): void
    {
        if (!$logId) return;
        $response = $result['response'] ?? null;
        $providerMessageId = is_array($response)
            ? ($response['messageId'] ?? $response['message_id'] ?? $response['id'] ?? null)
            : null;
        DB::table('sms_delivery_logs')->where('id', $logId)->update([
            'provider_message_id' => $providerMessageId,
            'status' => ($result['success'] ?? false) ? 'sent' : 'failed',
            'provider_response' => $response ? json_encode($response) : null,
            'error_message' => ($result['success'] ?? false) ? null : ($result['error'] ?? 'SMS failed.'),
            'sent_at' => ($result['success'] ?? false) ? now() : null,
            'failed_at' => ($result['success'] ?? false) ? null : now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Send a queue-status SMS using the configured header, status message,
     * and footer. Standby uses its selected standby-status message.
     */
    public function sendQueueStatus(string $mobile, string $status, ?int $standbyStatusId = null, ?string $port = null, ?int $queueEntryId = null): array
    {
        $settings = $this->getSmsSettings();
        $configuredMessage = $status === 'standby' && $standbyStatusId
            ? DB::table('queue_standby_status')->where('id', $standbyStatusId)->first(['message', 'enabled'])
            : DB::table('queue_status_messages')->where('status', $status)->first(['message', 'enabled']);

        if (!$configuredMessage || !$configuredMessage->enabled) {
            return [
                'success' => false,
                'error' => 'SMS is disabled or not configured for queue status: ' . $status,
            ];
        }

        $parts = array_filter([
            trim((string) ($settings['header'] ?? '')),
            '[' . strtoupper($status) . "]\n" . trim((string) $configuredMessage->message),
            trim((string) ($settings['footer'] ?? '')),
        ], static fn (string $part): bool => $part !== '');

        return $this->send($mobile, implode("\n\n", $parts), $port, $queueEntryId, $status, $standbyStatusId);
    }

    /** Send the configured destination-status message for a queue entry. */
    public function sendQueueStatusForEntry(int $queueEntryId, string $status): array
    {
        try {
            $entry = DB::table('queue_entries')
                ->leftJoin('pre_inventory', 'pre_inventory.p_id', '=', 'queue_entries.pre_inventory_id')
                ->where('queue_entries.id', $queueEntryId)
                ->first(['pre_inventory.phone_number', 'queue_entries.standby_id']);

            if (!$entry || !filled($entry->phone_number)) {
                return ['success' => false, 'skipped' => true, 'error' => 'Queue entry has no phone number.'];
            }

            return $this->sendQueueStatus(
                (string) $entry->phone_number,
                $status,
                $entry->standby_id ? (int) $entry->standby_id : null,
            null,
            $queueEntryId,
            );
        } catch (\Throwable $exception) {
            Log::error('Queue status SMS could not be sent.', [
                'queue_entry_id' => $queueEntryId,
                'status' => $status,
                'error' => $exception->getMessage(),
            ]);

            return ['success' => false, 'error' => $exception->getMessage()];
        }
    }

    /**
     * Format mobile number for SMS gateway.
     *
     * @param string $mobile
     * @return string|null
     */
    protected function formatMobileNumber(string $mobile): ?string
    {
        // Remove all non-numeric characters
        $mobile = preg_replace('/[^0-9]/', '', $mobile);

        // Check if it starts with 09 (normal prefix) - 11 digits
        if (strlen($mobile) === 11 && substr($mobile, 0, 2) === '09') {
            return $mobile;
        }

        // Check if it starts with 639 (without +) - 12 digits
        if (strlen($mobile) === 12 && substr($mobile, 0, 3) === '639') {
            // Convert to 09 format
            return '09' . substr($mobile, 3);
        }

        // Invalid format
        return null;
    }

    /** Send through SMS Gateway for Android (SMSGate). */
    protected function sendViaSmsGate(string $mobile, string $message, ?array $settings = null): array
    {
        $settings ??= config('services.sms.smsgate');
        $payload = [
            'textMessage' => ['text' => $message],
            'phoneNumbers' => [$this->toInternationalNumber($mobile)],
            'withDeliveryReport' => true,
        ];

        if ($settings['sim_number'] !== null && $settings['sim_number'] !== '') {
            $payload['simNumber'] = (int) $settings['sim_number'];
        }

        if (!empty($settings['device_id'])) {
            $payload['deviceId'] = $settings['device_id'];
        }

        $response = Http::timeout($settings['timeout'])
            ->withBasicAuth($settings['username'], $settings['password'])
            ->acceptJson()
            ->post($settings['url'], $payload);

        if ($response->successful()) {
            Log::info('SMS accepted by SMSGate', [
                'mobile' => $this->toInternationalNumber($mobile),
                'response' => $response->json(),
            ]);

            return ['success' => true, 'response' => $response->json()];
        }

        Log::error('SMSGate rejected SMS', [
            'mobile' => $this->toInternationalNumber($mobile),
            'status' => $response->status(),
            'error' => $response->body(),
        ]);

        return [
            'success' => false,
            'error' => 'SMSGate returned error: ' . $response->status()
                . ' (' . str($response->body())->limit(300) . ')',
        ];
    }

    protected function toInternationalNumber(string $mobile): string
    {
        return '+63' . substr($mobile, 1);
    }

    /** Send through the PhilSMS REST API. */
    protected function sendViaPhilSms(string $mobile, string $message): array
    {
        $settings = $this->getSmsSettings()['philsms'];
        $response = Http::timeout($settings['timeout'])
            ->withToken($settings['api_token'])
            ->acceptJson()
            ->post($settings['url'], [
                'recipient' => $this->toInternationalNumber($mobile),
                'sender_id' => $settings['sender_id'],
                'type' => 'plain',
                'message' => $message,
            ]);

        $body = $response->json();
        $accepted = $response->successful() && ($body['status'] ?? null) === 'success';

        if ($accepted) {
            Log::info('SMS accepted by PhilSMS', [
                'mobile' => $this->toInternationalNumber($mobile),
                'response' => $body,
            ]);

            return ['success' => true, 'response' => $body];
        }

        Log::error('PhilSMS rejected SMS', [
            'mobile' => $this->toInternationalNumber($mobile),
            'status' => $response->status(),
            'error' => $response->body(),
        ]);

        return [
            'success' => false,
            'error' => 'PhilSMS returned error: ' . $response->status()
                . ' (' . str($response->body())->limit(300) . ')',
        ];
    }

    /**
     * Read SMS settings from the database, with environment configuration as
     * a fallback until the settings migration has been applied.
     */
    protected function getSmsSettings(): array
    {
        $stored = DB::table('app_settings')->where('setting_id', 1)->first();
        $decrypt = static function (?string $value): ?string {
            if (!$value) {
                return null;
            }

            try {
                return decrypt($value);
            } catch (\Throwable) {
                return $value;
            }
        };

        $philsms = config('services.sms.philsms');
        $smsgate = config('services.sms.smsgate');

        return [
            'driver' => $stored?->sms_driver ?: config('services.sms.driver', 'legacy'),
            'header' => (string) ($stored?->sms_header_text ?? ''),
            'footer' => (string) ($stored?->sms_footer_text ?? ''),
            'smsgate' => [
                'url' => $stored?->smsgate_api_url ?: $smsgate['url'],
                'username' => $stored?->smsgate_username ?: $smsgate['username'],
                'password' => $decrypt($stored?->smsgate_password) ?: $smsgate['password'],
                'device_id' => $stored?->smsgate_device_id ?: $smsgate['device_id'],
                'sim_number' => $stored?->smsgate_sim_number,
                'timeout' => (int) ($stored?->smsgate_timeout ?: $smsgate['timeout']),
            ],
            'philsms' => [
                'url' => $stored?->philsms_api_url ?: $philsms['url'],
                'api_token' => $decrypt($stored?->philsms_api_token) ?: $philsms['api_token'],
                'sender_id' => $stored?->philsms_sender_id ?: $philsms['sender_id'],
                'timeout' => (int) ($stored?->philsms_timeout ?: $philsms['timeout']),
            ],
        ];
    }

    /**
     * Determine which port to use based on mobile network.
     *
     * @param string $mobile
     * @return string
     */
    public function determinePort(string $mobile): string
    {
        $formattedMobile = $this->formatMobileNumber($mobile);

        if (!$formattedMobile) {
            return $this->defaultPort;
        }

        // Get the first 4 digits after 09
        $prefix = substr($formattedMobile, 0, 4);

        // Globe/TM prefixes: 0905, 0906, 0915, 0916, 0917, 0926, 0927, 0935, 0936, 0937, 0945, 0953, 0954, 0955, 0956, 0965, 0966, 0967, 0975, 0976, 0977, 0978, 0979, 0995, 0996, 0997
        $globePrefixes = ['0905', '0906', '0915', '0916', '0917', '0926', '0927', '0935', '0936', '0937', '0945', '0953', '0954', '0955', '0956', '0965', '0966', '0967', '0975', '0976', '0977', '0978', '0979', '0995', '0996', '0997'];

        // Smart/TNT prefixes: 0907, 0908, 0909, 0910, 0911, 0912, 0913, 0914, 0918, 0919, 0920, 0921, 0928, 0929, 0930, 0938, 0939, 0946, 0947, 0948, 0949, 0950, 0951, 0961, 0970, 0971, 0980, 0981, 0989, 0992, 0998, 0999
        $smartPrefixes = ['0907', '0908', '0909', '0910', '0911', '0912', '0913', '0914', '0918', '0919', '0920', '0921', '0928', '0929', '0930', '0938', '0939', '0946', '0947', '0948', '0949', '0950', '0951', '0961', '0970', '0971', '0980', '0981', '0989', '0992', '0998', '0999'];

        if (in_array($prefix, $globePrefixes)) {
            return config('services.sms.globe_port', 'gsm-2.1');
        }

        if (in_array($prefix, $smartPrefixes)) {
            return config('services.sms.smart_port', 'gsm-2.1');
        }

        return $this->defaultPort;
    }

    /**
     * Send SMS to multiple recipients.
     *
     * @param array $mobiles
     * @param string $message
     * @return array
     */
    public function sendBulk(array $mobiles, string $message): array
    {
        $results = [];

        foreach ($mobiles as $mobile) {
            $port = $this->determinePort($mobile);
            $results[$mobile] = $this->send($mobile, $message, $port);
        }

        return $results;
    }
}
