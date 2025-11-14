<?php

/**
 * Reports API Test Script
 * Tests all 4 report endpoints to ensure they work correctly
 */

// Configuration
$baseUrl = 'http://127.0.0.1:8000';
$testDate = date('Y-m-d');
$startDate = date('Y-m-d', strtotime('-7 days'));
$endDate = date('Y-m-d');

// Colors for terminal output
$green = "\033[32m";
$red = "\033[31m";
$yellow = "\033[33m";
$reset = "\033[0m";

echo "\n╔════════════════════════════════════════════════╗\n";
echo "║  FJPWL REPORTS API TEST SUITE                 ║\n";
echo "╚════════════════════════════════════════════════╝\n\n";

$totalTests = 0;
$passedTests = 0;
$failedTests = 0;

/**
 * Test function
 */
function testEndpoint($name, $url, $params = [], $method = 'GET') {
    global $totalTests, $passedTests, $failedTests, $green, $red, $yellow, $reset;
    
    $totalTests++;
    echo "[TEST {$totalTests}] {$name}\n";
    echo "  URL: {$url}\n";
    
    $ch = curl_init();
    
    if ($method === 'GET' && !empty($params)) {
        $url .= '?' . http_build_query($params);
    }
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        echo "  {$red}✗ FAILED{$reset} - cURL Error: {$error}\n\n";
        $failedTests++;
        return false;
    }
    
    if ($httpCode !== 200) {
        echo "  {$red}✗ FAILED{$reset} - HTTP {$httpCode}\n";
        echo "  Response: " . substr($response, 0, 200) . "...\n\n";
        $failedTests++;
        return false;
    }
    
    $data = json_decode($response, true);
    
    if (!$data) {
        echo "  {$red}✗ FAILED{$reset} - Invalid JSON response\n\n";
        $failedTests++;
        return false;
    }
    
    if (!isset($data['success']) || $data['success'] !== true) {
        echo "  {$red}✗ FAILED{$reset} - API returned success=false\n";
        if (isset($data['message'])) {
            echo "  Message: {$data['message']}\n";
        }
        echo "\n";
        $failedTests++;
        return false;
    }
    
    $recordCount = isset($data['data']) ? count($data['data']) : 0;
    echo "  {$green}✓ PASSED{$reset} - {$recordCount} records returned\n\n";
    $passedTests++;
    return true;
}

// Get first available client ID
echo "Fetching client list...\n";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $baseUrl . '/api/reports/clients');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

$clientsData = json_decode($response, true);
$clientId = null;

if ($clientsData && isset($clientsData['data']) && count($clientsData['data']) > 0) {
    $clientId = $clientsData['data'][0]['id'];
    echo "Using client ID: {$clientId}\n\n";
} else {
    echo "{$yellow}Warning: No clients found, testing with 'all' clients{$reset}\n\n";
    $clientId = '';
}

// Test 1: Get Clients
testEndpoint(
    'Get Clients List',
    $baseUrl . '/api/reports/clients'
);

// Test 2: Incoming Report (with date range)
testEndpoint(
    'Incoming Report (Date Range)',
    $baseUrl . '/api/reports/incoming',
    [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'client_id' => $clientId
    ]
);

// Test 3: Incoming Report (All clients)
testEndpoint(
    'Incoming Report (All Clients)',
    $baseUrl . '/api/reports/incoming',
    [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'client_id' => ''
    ]
);

// Test 4: Outgoing Report
testEndpoint(
    'Outgoing Report',
    $baseUrl . '/api/reports/outgoing',
    [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'client_id' => $clientId
    ]
);

// Test 5: Outgoing Report (All clients)
testEndpoint(
    'Outgoing Report (All Clients)',
    $baseUrl . '/api/reports/outgoing',
    [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'client_id' => ''
    ]
);

// Test 6: DMR Report
testEndpoint(
    'DMR Report (Daily Monitoring Report)',
    $baseUrl . '/api/reports/dmr',
    [
        'date' => $testDate,
        'client_id' => $clientId
    ]
);

// Test 7: DMR Report (All clients)
testEndpoint(
    'DMR Report (All Clients)',
    $baseUrl . '/api/reports/dmr',
    [
        'date' => $testDate,
        'client_id' => ''
    ]
);

// Test 8: DCR Report
testEndpoint(
    'DCR Report (Daily Container Report)',
    $baseUrl . '/api/reports/dcr',
    [
        'date' => $testDate
    ]
);

// Summary
echo "\n╔════════════════════════════════════════════════╗\n";
echo "║  TEST SUMMARY                                  ║\n";
echo "╚════════════════════════════════════════════════╝\n\n";
echo "Total Tests:  {$totalTests}\n";
echo "{$green}Passed:       {$passedTests}{$reset}\n";

if ($failedTests > 0) {
    echo "{$red}Failed:       {$failedTests}{$reset}\n\n";
    echo "{$red}❌ SOME TESTS FAILED{$reset}\n";
    exit(1);
} else {
    echo "{$green}Failed:       0{$reset}\n\n";
    echo "{$green}✅ ALL TESTS PASSED!{$reset}\n";
    exit(0);
}
