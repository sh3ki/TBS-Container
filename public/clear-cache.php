<?php

$remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';
$isCli = PHP_SAPI === 'cli';
$isLocalRequest = in_array($remoteAddress, ['127.0.0.1', '::1'], true);

if (!$isCli && !$isLocalRequest) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "OPcache cleared successfully!<br>";
} else {
    echo "OPcache is not enabled<br>";
}

clearstatcache(true);
echo "Realpath cache cleared<br>";

echo "<br>Now refresh the inventory page: <a href='/inventory'>Go to Inventory</a>";
