<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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

            // Prepare SMS gateway request
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

        // Check if it starts with +639 (custom prefix) - 13 digits
        if (strlen($mobile) === 13 && substr($mobile, 0, 4) === '+639') {
            // Convert to 09 format
            return '09' . substr($mobile, 4);
        }

        // Check if it starts with 639 (without +) - 12 digits
        if (strlen($mobile) === 12 && substr($mobile, 0, 3) === '639') {
            // Convert to 09 format
            return '09' . substr($mobile, 3);
        }

        // Invalid format
        return null;
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
