<?php

return [
    'sftp' => [
        // Keep environment access inside configuration files so these values
        // remain available when Laravel caches its configuration.
        'known_hosts' => env('EDI_SFTP_KNOWN_HOSTS', ''),
        'host_public_key_sha256' => env('EDI_SFTP_HOST_KEY_SHA256', ''),
    ],
];
