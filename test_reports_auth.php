<?php

/**
 * Automated Test Script for Reports API
 * Tests all 4 report types with authentication
 */

// Base URL
$baseUrl = 'http://127.0.0.1:8000';

// Colors for output
function colorize($text, $color) {
    $colors = [
        'green' => "\033[32m",
        'red' => "\033[31m",
        'yellow' => "\033[33m",
        'blue' => "\033[34m",
        'reset' => "\033[0m",
    ];
    return $colors[$color] . $text . $colors['reset'];
}

echo "\n" . colorize("=== FJPWL Reports API Test Suite ===", 'blue') . "\n\n";

// Step 1: Login and get session cookie
echo colorize("Step 1: Logging in as admin...", 'yellow') . "\n";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "$baseUrl/login");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_COOKIEJAR, 'cookie.txt');
curl_setopt($ch, CURLOPT_COOKIEFILE, 'cookie.txt');
$loginPage = curl_exec($ch);

// Extract CSRF token
preg_match('/<input[^>]+name="_token"[^>]+value="([^"]+)"/', $loginPage, $matches);
$csrfToken = $matches[1] ?? null;

if (!$csrfToken) {
    echo colorize("✗ Failed to get CSRF token", 'red') . "\n";
    exit(1);
}

// Post login credentials
curl_setopt($ch, CURLOPT_URL, "$baseUrl/login");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    '_token' => $csrfToken,
    'email' => 'admin',
    'password' => 'admin123',
]));
$loginResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($httpCode === 200 || $httpCode === 302) {
    echo colorize("✓ Login successful", 'green') . "\n\n";
} else {
    echo colorize("✗ Login failed (HTTP $httpCode)", 'red') . "\n";
    exit(1);
}

// Step 2: Test all 4 report endpoints
$tests = [
    [
        'name' => 'Incoming Report (Date Range)',
        'endpoint' => '/api/reports/incoming',
        'params' => [
            'start_date' => '2025-11-01',
            'end_date' => '2025-11-12',
            'client_id' => 'all',
        ],
    ],
    [
        'name' => 'Incoming Report (Specific Client)',
        'endpoint' => '/api/reports/incoming',
        'params' => [
            'start_date' => '2025-11-01',
            'end_date' => '2025-11-12',
            'client_id' => '18',
        ],
    ],
    [
        'name' => 'Outgoing Report (Date Range)',
        'endpoint' => '/api/reports/outgoing',
        'params' => [
            'start_date' => '2025-11-01',
            'end_date' => '2025-11-12',
            'client_id' => 'all',
        ],
    ],
    [
        'name' => 'Outgoing Report (Specific Client)',
        'endpoint' => '/api/reports/outgoing',
        'params' => [
            'start_date' => '2025-11-01',
            'end_date' => '2025-11-12',
            'client_id' => '18',
        ],
    ],
    [
        'name' => 'DMR Report (All Clients)',
        'endpoint' => '/api/reports/dmr',
        'params' => [
            'date' => '2025-11-12',
            'client_id' => 'all',
        ],
    ],
    [
        'name' => 'DMR Report (Specific Client)',
        'endpoint' => '/api/reports/dmr',
        'params' => [
            'date' => '2025-11-12',
            'client_id' => '18',
        ],
    ],
    [
        'name' => 'DCR Report',
        'endpoint' => '/api/reports/dcr',
        'params' => [
            'date' => '2025-11-12',
        ],
    ],
];

$passed = 0;
$failed = 0;

foreach ($tests as $index => $test) {
    $testNum = $index + 1;
    echo colorize("Test $testNum: {$test['name']}", 'yellow') . "\n";
    
    $url = $baseUrl . $test['endpoint'] . '?' . http_build_query($test['params']);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, false);
    curl_setopt($ch, CURLOPT_HTTPGET, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if ($data && isset($data['success']) && $data['success'] === true) {
            $count = count($data['data'] ?? []);
            echo colorize("  ✓ PASSED - HTTP 200 - Found $count records", 'green') . "\n";
            $passed++;
        } else {
            $error = $data['message'] ?? 'Unknown error';
            echo colorize("  ✗ FAILED - Invalid response: $error", 'red') . "\n";
            echo "  Response: " . substr($response, 0, 200) . "...\n";
            $failed++;
        }
    } else {
        echo colorize("  ✗ FAILED - HTTP $httpCode", 'red') . "\n";
        echo "  Response: " . substr($response, 0, 200) . "...\n";
        $failed++;
    }
    echo "\n";
}

curl_close($ch);

// Cleanup
if (file_exists('cookie.txt')) {
    unlink('cookie.txt');
}

// Summary
echo colorize("=== Test Summary ===", 'blue') . "\n";
echo colorize("Passed: $passed", 'green') . "\n";
if ($failed > 0) {
    echo colorize("Failed: $failed", 'red') . "\n";
    exit(1);
} else {
    echo colorize("All tests passed! ✓", 'green') . "\n";
    exit(0);
}
