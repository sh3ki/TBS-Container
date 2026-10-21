<?php

namespace App\Services;

use App\Models\EdiProfile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class EdiDeliveryService
{
    public function deliver(EdiProfile $profile, string $payload, string $filename, string $payloadPath): array
    {
        $config = $profile->destination_config ?? [];
        $credentials = $this->credentials($profile->credentials);

        return match ($profile->destination_type) {
            'manual' => [
                'destination' => 'manual',
                'message' => 'Payload generated and saved for manual delivery.',
            ],
            'file' => $this->toFile($config, $payload, $filename),
            'http', 'https', 'cache_csp' => $this->toHttp($profile, $config, $credentials, $payload, $filename),
            'sftp', 'ftp', 'ftps' => $this->toFileTransfer($profile->destination_type, $config, $credentials, $payload, $filename),
            'email' => $this->toEmail($config, $credentials, $payload, $filename),
            default => throw new RuntimeException('Unsupported EDI destination: ' . $profile->destination_type),
        };
    }

    private function credentials($value): array
    {
        if (is_array($value)) return $value;
        if (! is_string($value) || trim($value) === '') return [];
        try {
            return (array) json_decode(Crypt::decryptString($value), true);
        } catch (\Throwable) {
            return (array) json_decode($value, true);
        }
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

    private function toFileTransfer(string $type, array $config, array $credentials, string $payload, string $filename): array
    {
        if (! function_exists('curl_init')) {
            throw new RuntimeException('PHP cURL is required for file-transfer delivery.');
        }

        $host = trim((string) ($config['host'] ?? $config['endpoint'] ?? $credentials['host'] ?? ''));
        // Administrators may paste MSC's browser-style URL. SFTP uses the
        // hostname only; the selected destination type determines the
        // transport protocol.
        if (filter_var($host, FILTER_VALIDATE_URL)) {
            $parsedHost = parse_url($host, PHP_URL_HOST);
            $parsedPath = parse_url($host, PHP_URL_PATH);
            $host = (string) ($parsedHost ?: $host);
            if (empty($config['remote_path']) && $parsedPath && $parsedPath !== '/') {
                $config['remote_path'] = $parsedPath;
            }
        }
        $host = preg_replace('#^s?ftps?://#i', '', $host);
        $host = trim((string) $host, " /\t\n\r\0\x0B");
        $username = (string) ($credentials['username'] ?? '');
        $password = (string) ($credentials['password'] ?? '');
        $remotePath = trim((string) ($config['remote_path'] ?? ''), '/');
        if (filter_var($remotePath, FILTER_VALIDATE_URL)) {
            $remotePath = trim((string) (parse_url($remotePath, PHP_URL_PATH) ?: ''), '/');
        }
        if ($host === '' || $username === '' || $password === '' || $remotePath === '') {
            throw new RuntimeException('EDI SFTP host, username, password, and remote path are required.');
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'edi_');
        if ($temporaryPath === false || file_put_contents($temporaryPath, $payload) === false) {
            throw new RuntimeException('Unable to create the temporary EDI upload file.');
        }

        try {
            $handle = fopen($temporaryPath, 'rb');
            $scheme = $type === 'ftp' ? 'ftp' : ($type === 'ftps' ? 'ftps' : 'sftp');
            $remoteUrl = $scheme . '://' . $host . '/' . $remotePath . '/' . rawurlencode($filename);
            $curl = curl_init($remoteUrl);
            curl_setopt_array($curl, [
                CURLOPT_UPLOAD => true,
                CURLOPT_INFILE => $handle,
                CURLOPT_INFILESIZE => filesize($temporaryPath),
                CURLOPT_USERPWD => $username . ':' . $password,
                CURLOPT_PORT => (int) ($config['port'] ?? $credentials['port'] ?? ($type === 'sftp' ? 22 : 21)),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 30,
                CURLOPT_TIMEOUT => (int) ($config['timeout_seconds'] ?? 120),
            ]);
            if ($type === 'sftp' && defined('CURLOPT_SSH_AUTH_TYPES') && defined('CURLSSH_AUTH_PASSWORD')) {
                curl_setopt($curl, CURLOPT_SSH_AUTH_TYPES, CURLSSH_AUTH_PASSWORD);
            }
            $result = curl_exec($curl);
            $errno = curl_errno($curl);
            $error = curl_error($curl);
            $code = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            $primaryIp = (string) curl_getinfo($curl, CURLINFO_PRIMARY_IP);
            $osError = defined('CURLINFO_OS_ERRNO') ? (int) curl_getinfo($curl, CURLINFO_OS_ERRNO) : 0;
            curl_close($curl);
            fclose($handle);

            if ($result === false || $error !== '') {
                $detail = trim($error);
                if ($detail === '') {
                    $detail = 'cURL error '.$errno.($errno && function_exists('curl_strerror') ? ': '.curl_strerror($errno) : '');
                }
                if ($osError) $detail .= ' (OS error '.$osError.')';
                throw new RuntimeException('EDI '.strtoupper($type).' delivery failed: '.$detail.' [host='.$host.', ip='.($primaryIp ?: 'unresolved').', port='.(int) ($config['port'] ?? $credentials['port'] ?? ($type === 'sftp' ? 22 : 21)).']');
            }

            return ['destination' => $type, 'status_code' => $code ?: 200, 'remote_path' => '/' . $remotePath . '/' . $filename, 'message' => 'EDI file uploaded successfully.'];
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
