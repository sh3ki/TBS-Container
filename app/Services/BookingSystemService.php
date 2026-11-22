<?php

namespace App\Services;

use App\Exceptions\BookingLookupException;
use Carbon\Carbon;
use GuzzleHttp\Cookie\CookieJar;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use DOMDocument;
use DOMXPath;

class BookingSystemService
{
    public function findVerifiedBooking(string $containerNo): array
    {
        ['url' => $url, 'username' => $username, 'password' => $password, 'login_url' => $loginUrl, 'timeout' => $timeout] = $this->credentials();

        if ($url === '' || $username === '' || $password === '') {
            throw new BookingLookupException('Booking System credentials are not configured.');
        }

        $jar = new CookieJar();
        $client = Http::timeout($timeout)
            ->withOptions(['allow_redirects' => true, 'cookies' => $jar])
            ->withHeaders(['User-Agent' => 'TBS Container Yard/1.0']);

        $loginUrl = $loginUrl ?: $url;
        $loginPage = $client->get($loginUrl);
        if (!$loginPage->successful()) {
            throw new BookingLookupException('Unable to connect to Booking System.');
        }

        $loginEvent = $this->eventFromFunction($loginPage->body(), 'jLogin');
        if ($loginEvent !== null) {
            $login = $this->brokerCall($client, $jar, $loginUrl, $loginEvent, [$username, $password]);
            if (!$login->successful() || str_contains($login->body(), 'invalid hyperevent') || str_contains($login->body(), 'CSP error occurred')) {
                throw new BookingLookupException('Unable to log in to Booking System.');
            }
        }

        $summary = $client->get($url);
        if (!$summary->successful()) {
            throw new BookingLookupException('Unable to read Booking System results.');
        }

        $initEvent = $this->eventFromFunction($summary->body(), 'jInitMe');
        $booking = null;
        if ($initEvent !== null) {
            $initResponse = $this->brokerCall($client, $jar, $url, $initEvent, []);
            $booking = $this->findBookingInBrokerResponse($initResponse->body(), $containerNo);
        }
        $searchEvent = $this->eventFromFunction($summary->body(), 'jSearch');
        if ($booking === null && $searchEvent !== null) {
            $date = Carbon::today()->format('m/d/Y');
            $response = $this->brokerCall($client, $jar, $url, $searchEvent, [$date, $date, '', '', '', $containerNo, '', '', '']);
            $booking = $booking ?? $this->findBookingInBrokerResponse($response->body(), $containerNo);
        }
        if ($booking === null) $booking = $this->findBookingRow($summary->body(), $containerNo);
        if ($booking === null || strtoupper($booking['status']) !== 'VERIFIED') {
            throw new BookingLookupException('Booking is not verified in Booking System.');
        }

        if ($booking['booking_date'] === '' || $booking['time_slot'] === '') {
            throw new BookingLookupException('Verified booking has no valid booking date or time slot.');
        }

        try {
            $dateText = trim($booking['booking_date']);
            $timeText = $this->slotToTime($booking['time_slot']);
            $date = null;
            foreach (['m/d/Y', 'd/m/Y', 'Y-m-d'] as $format) {
                try {
                    $date = Carbon::createFromFormat($format . ' H:i', $dateText . ' ' . $timeText);
                    if ($date !== false) break;
                } catch (\Throwable) {
                    // Try the next supported date representation.
                }
            }
            if (!$date) $date = Carbon::parse($dateText . ' ' . $timeText);
        } catch (\Throwable) {
            throw new BookingLookupException('Verified booking has an invalid booking date or time slot.');
        }

        return [
            'ref_no' => $booking['ref_no'],
            'booking_time' => $date->format('Y-m-d H:i:s'),
        ];
    }

    public function findEarliestVerifiedBookingByPlate(string $plateNo, array $excludedRefNos = []): array
    {
        $response = $this->fetchInitialSummaryBrokerResponse();
        $excluded = array_fill_keys(array_map('strval', $excludedRefNos), true);
        $candidates = [];

        foreach ($this->parseBrokerBookings($response) as $booking) {
            if (strtoupper(trim($booking['plate_no'])) !== strtoupper(trim($plateNo))) continue;
            if (strtoupper($booking['status']) !== 'VERIFIED') continue;
            if ($booking['ref_no'] !== '' && isset($excluded[$booking['ref_no']])) continue;
            try {
                $booking['booking_time'] = $this->parseBookingTime($booking['booking_date'], $booking['time_slot']);
                $candidates[] = $booking;
            } catch (BookingLookupException) {
                continue;
            }
        }

        if ($candidates === []) throw new BookingLookupException('Booking is not verified in Booking System.');
        usort($candidates, static fn (array $a, array $b) => strcmp($a['booking_time'], $b['booking_time']));
        return [
            'ref_no' => $candidates[0]['ref_no'],
            'booking_time' => $candidates[0]['booking_time'],
        ];
    }

    private function fetchInitialSummaryBrokerResponse(): string
    {
        ['url' => $url, 'username' => $username, 'password' => $password, 'login_url' => $loginUrl, 'timeout' => $timeout] = $this->credentials();
        if ($url === '' || $username === '' || $password === '') throw new BookingLookupException('Booking System credentials are not configured.');

        $jar = new CookieJar();
        $client = Http::timeout($timeout)
            ->withOptions(['allow_redirects' => true, 'cookies' => $jar])
            ->withHeaders(['User-Agent' => 'TBS Container Yard/1.0']);
        $loginUrl = $loginUrl ?: $url;
        $loginPage = $client->get($loginUrl);
        if (!$loginPage->successful()) throw new BookingLookupException('Unable to connect to Booking System.');
        $loginEvent = $this->eventFromFunction($loginPage->body(), 'jLogin');
        if ($loginEvent !== null) {
            $login = $this->brokerCall($client, $jar, $loginUrl, $loginEvent, [$username, $password]);
            if (!$login->successful() || str_contains($login->body(), 'invalid hyperevent') || str_contains($login->body(), 'CSP error occurred')) throw new BookingLookupException('Unable to log in to Booking System.');
        }
        $summary = $client->get($url);
        if (!$summary->successful()) throw new BookingLookupException('Unable to read Booking System results.');
        $initEvent = $this->eventFromFunction($summary->body(), 'jInitMe');
        if ($initEvent === null) throw new BookingLookupException('Unable to load Booking System records.');
        $response = $this->brokerCall($client, $jar, $url, $initEvent, []);
        return $response->body();
    }

    private function credentials(): array
    {
        $configured = DB::table('app_settings')->where('setting_id', 1)->first();
        $password = (string) config('services.booking_system.password');

        if (!empty($configured?->booking_system_password)) {
            try {
                $password = decrypt($configured->booking_system_password);
            } catch (\Throwable) {
                $password = (string) $configured->booking_system_password;
            }
        }

        return [
            'url' => (string) ($configured?->booking_system_url ?: config('services.booking_system.url')),
            'login_url' => (string) ($configured?->booking_system_login_url ?: config('services.booking_system.login_url')),
            'username' => (string) ($configured?->booking_system_username ?: config('services.booking_system.username')),
            'password' => $password,
            'timeout' => (int) ($configured?->booking_system_timeout ?: config('services.booking_system.timeout', 20)),
        ];
    }

    private function parseBookingTime(string $bookingDate, string $timeSlot): string
    {
        $time = $this->slotToTime($timeSlot);
        foreach (['m/d/Y', 'd/m/Y', 'Y-m-d'] as $format) {
            try {
                $date = Carbon::createFromFormat($format . ' H:i', trim($bookingDate) . ' ' . $time);
                if ($date !== false) return $date->format('Y-m-d H:i:s');
            } catch (\Throwable) {
            }
        }
        throw new BookingLookupException('Verified booking has an invalid booking date or time slot.');
    }

    private function brokerCall($client, CookieJar $jar, string $pageUrl, string $event, array $arguments)
    {
        // CSP's browser helper intentionally leaves CSPCHD as a separate
        // form field. Sending the entire event token as an encoded WEVENT
        // value makes the server reject it as an invalid hyper-event.
        [$method, $challenge] = array_pad(explode('&CSPCHD=', $event, 2), 2, null);
        $payload = ['WARGC' => count($arguments), 'WEVENT' => $method];
        if ($challenge !== null) $payload['CSPCHD'] = $challenge;
        foreach ($arguments as $index => $argument) $payload['WARG_' . ($index + 1)] = $argument;
        return $client->asForm()->post($this->absoluteUrl($pageUrl, '%25CSP.Broker.cls'), $payload);
    }

    private function eventFromFunction(string $html, string $function): ?string
    {
        if (preg_match('/function\s+' . preg_quote($function, '/') . '\s*\(.*?cspHttpServerMethod\(\'([^\']+)\'/s', $html, $matches)) return $matches[1];
        return null;
    }

    private function findBookingInBrokerResponse(string $response, string $containerNo): ?array
    {
        foreach ($this->parseBrokerBookings($response) as $booking) {
            if (strtoupper(trim($booking['container_no'])) === strtoupper(trim($containerNo))) return $booking;
        }
        return null;
    }

    private function parseBrokerBookings(string $response): array
    {
        preg_match_all('/CSVRec="(.*?)"/s', $response, $matches);
        $csv = null;
        foreach (array_reverse($matches[1] ?? []) as $encoded) {
            $candidate = json_decode('"' . $encoded . '"');
            if (is_string($candidate) && str_contains($candidate, 'Container No.')) {
                $csv = $candidate;
                break;
            }
        }
        if (!is_string($csv)) return [];
        $rows = [];
        foreach (array_slice(preg_split('/\r\n|\n/', trim($csv)), 1) as $line) {
            if ($line === '') continue;
            $values = str_getcsv($line);
            $rows[] = [
                'ref_no' => trim((string) ($values[1] ?? '')),
                'booking_date' => trim((string) ($values[2] ?? '')),
                'time_slot' => trim((string) ($values[3] ?? '')),
                'container_no' => trim((string) ($values[4] ?? '')),
                'plate_no' => trim((string) ($values[8] ?? '')),
                'status' => strtoupper(trim((string) ($values[12] ?? ''))),
            ];
        }
        return $rows;
    }

    private function findBookingRow(string $html, string $containerNo): ?array
    {
        libxml_use_internal_errors(true);
        $document = new DOMDocument();
        $document->loadHTML($html);
        $xpath = new DOMXPath($document);
        foreach ($xpath->query('//table//tr') as $row) {
            $cells = $xpath->query('./th|./td', $row);
            if (!$cells || $cells->length === 0) continue;
            $table = $row->parentNode?->parentNode;
            $headerCells = $table ? $xpath->query('.//thead/tr[last()]/*[self::th or self::td]', $table) : null;
            if (!$headerCells || $headerCells->length === 0) {
                $headerCells = $table ? $xpath->query('.//tr[th][1]/*[self::th or self::td]', $table) : null;
            }
            $values = [];
            foreach ($cells as $cell) $values[] = trim(preg_replace('/\s+/', ' ', $this->cellText($cell, $xpath)));
            $joined = strtoupper(implode(' ', $values));
            if (!str_contains($joined, strtoupper($containerNo))) continue;
            $headers = [];
            if ($headerCells) foreach ($headerCells as $cell) $headers[] = trim(preg_replace('/\s+/', ' ', $cell->textContent));
            $byHeader = static function (array $headers, array $values, array $labels): string {
                foreach ($labels as $label) foreach ($headers as $index => $header) {
                    if (strtolower(trim($header)) === strtolower($label)) return trim($values[$index] ?? '');
                }
                return '';
            };
            return [
                'ref_no' => $byHeader($headers, $values, ['ref. no.', 'ref no.', 'reference no.']),
                'booking_date' => $byHeader($headers, $values, ['booking date']),
                'time_slot' => $byHeader($headers, $values, ['time slot']),
                'status' => strtoupper($byHeader($headers, $values, ['booking status', 'status'])),
            ];
        }
        return null;
    }

    private function findForm(string $html, bool $passwordRequired): ?array
    {
        libxml_use_internal_errors(true);
        $document = new DOMDocument();
        $document->loadHTML($html);
        $xpath = new DOMXPath($document);
        foreach ($xpath->query('//form') as $form) {
            if ($passwordRequired && $xpath->query('.//input[@type="password"]', $form)->length === 0) continue;
            $hidden = [];
            foreach ($xpath->query('.//input[@type="hidden"]', $form) as $input) $hidden[$input->getAttribute('name')] = $input->getAttribute('value');
            return ['action' => $form->getAttribute('action'), 'hidden' => $hidden];
        }
        return null;
    }

    private function cellText($cell, DOMXPath $xpath): string
    {
        $selected = $xpath->query('.//select/option[@selected]', $cell);
        if ($selected->length > 0) return $selected->item(0)->textContent;
        return $cell->textContent;
    }

    private function columnValue(array $values, DOMXPath $xpath, $cells, array $labels): string
    {
        foreach ($labels as $label) {
            foreach ($values as $index => $value) {
                if (strtolower(trim($value)) === strtolower($label) && isset($values[$index + 1])) return trim($values[$index + 1]);
            }
        }
        return '';
    }

    private function slotToTime(string $slot): string
    {
        if (!preg_match('/^(?:[01]\d|2[0-3])[0-5]\dH$/i', trim($slot))) throw new BookingLookupException('Invalid booking time slot.');
        return substr($slot, 0, 2) . ':' . substr($slot, 2, 2);
    }

    private function absoluteUrl(string $base, string $path): string
    {
        if ($path === '') return $base;
        if (preg_match('/^https?:\/\//i', $path)) return $path;
        return rtrim(dirname($base), '/') . '/' . ltrim($path, '/');
    }
}
