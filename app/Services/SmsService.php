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
    public function send(string $mobile, string $message, ?string $port = null): array
    {
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

            if ($smsSettings['driver'] === 'smsgate') {
                return $this->sendViaSmsGate($formattedMobile, $message, $smsSettings['smsgate']);
            }

            if ($smsSettings['driver'] === 'philsms') {
                return $this->sendViaPhilSms($formattedMobile, $message);
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

                return [
                    'success' => true,
                    'response' => $response->json(),
                ];
            }

            Log::error('SMS sending failed', [
                'mobile' => $formattedMobile,
                'status' => $response->status(),
                'error' => $response->body(),
            ]);

            return [
                'success' => false,
                'error' => 'SMS gateway returned error: ' . $response->status(),
            ];
        } catch (\Exception $e) {
            Log::error('SMS sending exception', [
                'mobile' => $mobile,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Send a queue-status SMS using the configured header, status message,
     * and footer. Standby uses its selected standby-status message.
     */
    public function sendQueueStatus(string $mobile, string $status, ?int $standbyStatusId = null, ?string $port = null): array
    {
        $settings = $this->getSmsSettings();
        $message = $status === 'standby' && $standbyStatusId
            ? DB::table('queue_standby_status')->where('id', $standbyStatusId)->value('message')
            : DB::table('queue_status_messages')->where('status', $status)->value('message');

        if (!$message) {
            return [
                'success' => false,
                'error' => 'No SMS message is configured for queue status: ' . $status,
            ];
        }

        $parts = array_filter([
            trim((string) ($settings['header'] ?? '')),
            trim((string) $message),
            trim((string) ($settings['footer'] ?? '')),
        ], static fn (string $part): bool => $part !== '');

        return $this->send($mobile, implode("\n\n", $parts), $port);
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
