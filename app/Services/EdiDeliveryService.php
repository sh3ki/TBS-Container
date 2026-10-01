<?php

namespace App\Services;

use App\Models\EdiProfile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class EdiDeliveryService
{
    public function deliver(EdiProfile $profile, string $payload, string $filename, string $payloadPath): array
    {
        $config = $profile->destination_config ?? [];
        $credentials = $profile->credentials ?? [];

        return match ($profile->destination_type) {
            'manual' => [
                'destination' => 'manual',
                'message' => 'Payload generated and saved for manual delivery.',
            ],
            'file' => $this->toFile($config, $payload, $filename),
            'http', 'cache_csp' => $this->toHttp($profile, $config, $credentials, $payload, $filename),
            'sftp' => $this->toSftp($config, $credentials, $payload, $filename),
            'email' => $this->toEmail($config, $credentials, $payload, $filename),
            default => throw new RuntimeException('Unsupported EDI destination: ' . $profile->destination_type),
        };
    }

    private function toFile(array $config, string $payload, string $filename): array
    {
        $directory = trim((string) ($config['path'] ?? 'edi/outbound'), '/');
        $path = $directory . '/' . $filename;
        Storage::disk('local')->put($path, $payload);

        return ['destination' => 'file', 'path' => $path, 'message' => 'EDI file saved to the configured file destination.'];
    }

    private function toHttp(EdiProfile $profile, array $config, array $credentials, string $payload, string $filename): array
    {
        $endpoint = trim((string) ($config['endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new RuntimeException('EDI HTTP/CSP destination endpoint is not configured.');
        }

        $request = Http::timeout((int) ($config['timeout_seconds'] ?? 60))
            ->withHeaders(array_filter([
                'Content-Type' => 'text/plain; charset=UTF-8',
                'X-EDI-Filename' => $filename,
                'X-EDI-Profile' => $profile->legacy_key ?: $profile->profile_name,
                'Authorization' => ! empty($credentials['api_key']) ? 'Bearer ' . $credentials['api_key'] : null,
            ]));

        if (! empty($credentials['username'])) {
            $request = $request->withBasicAuth($credentials['username'], (string) ($credentials['password'] ?? ''));
        }

        $response = strtolower((string) ($config['method'] ?? 'post')) === 'get'
            ? $request->get($endpoint, ['filename' => $filename, 'payload' => $payload])
            : $request->withBody($payload, 'text/plain')->post($endpoint);

        if ($response->failed()) {
            throw new RuntimeException('EDI HTTP/CSP delivery failed with status ' . $response->status() . ': ' . str($response->body())->limit(500));
        }

        return ['destination' => $profile->destination_type, 'status_code' => $response->status(), 'message' => 'EDI payload delivered over HTTP.'];
    }

    private function toSftp(array $config, array $credentials, string $payload, string $filename): array
    {
        if (! function_exists('curl_init')) {
            throw new RuntimeException('PHP cURL is required for SFTP delivery on Hostinger.');
        }

        $host = trim((string) ($config['host'] ?? $credentials['host'] ?? ''));
        $username = (string) ($credentials['username'] ?? '');
        $password = (string) ($credentials['password'] ?? '');
        $remotePath = trim((string) ($config['remote_path'] ?? ''), '/');
        if ($host === '' || $username === '' || $password === '' || $remotePath === '') {
            throw new RuntimeException('EDI SFTP host, username, password, and remote path are required.');
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'edi_');
        if ($temporaryPath === false || file_put_contents($temporaryPath, $payload) === false) {
            throw new RuntimeException('Unable to create the temporary EDI upload file.');
        }

        try {
            $handle = fopen($temporaryPath, 'rb');
            $curl = curl_init('sftp://' . $host . '/' . $remotePath . '/' . rawurlencode($filename));
            curl_setopt_array($curl, [
                CURLOPT_UPLOAD => true,
                CURLOPT_INFILE => $handle,
                CURLOPT_INFILESIZE => filesize($temporaryPath),
                CURLOPT_USERPWD => $username . ':' . $password,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 30,
                CURLOPT_TIMEOUT => (int) ($config['timeout_seconds'] ?? 120),
            ]);
            $result = curl_exec($curl);
            $error = curl_error($curl);
            $code = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            curl_close($curl);
            fclose($handle);

            if ($result === false || $error !== '') {
                throw new RuntimeException('EDI SFTP delivery failed: ' . ($error ?: 'unknown cURL error'));
            }

            return ['destination' => 'sftp', 'status_code' => $code ?: 200, 'remote_path' => '/' . $remotePath . '/' . $filename, 'message' => 'EDI file uploaded to SFTP.'];
        } finally {
            @unlink($temporaryPath);
        }
    }

    private function toEmail(array $config, array $credentials, string $payload, string $filename): array
    {
        $to = trim((string) ($config['to'] ?? ''));
        if ($to === '') {
            throw new RuntimeException('EDI email destination address is not configured.');
        }

        \Illuminate\Support\Facades\Mail::raw($payload, function ($message) use ($config, $to, $filename) {
            $message->to($to)
                ->subject((string) ($config['subject'] ?? 'EDI Inventory Export'))
                ->attachData($payload, $filename, ['mime' => 'text/plain']);
            if (! empty($config['from'])) $message->from($config['from']);
        });

        return ['destination' => 'email', 'message' => 'EDI file sent by email.'];
    }
}
