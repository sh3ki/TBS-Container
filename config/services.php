<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | SMS Gateway Configuration
    |--------------------------------------------------------------------------
    */

    'sms' => [
        'gateway_url' => env('SMS_GATEWAY_URL', 'http://172.16.1.91:80/sendsms'),
        'username' => env('SMS_GATEWAY_USER', 'admin'),
        'password' => env('SMS_GATEWAY_PASSWORD', 'passw0rd'),
        'default_port' => env('SMS_DEFAULT_PORT', 'gsm-2.1'),
        'globe_port' => env('SMS_GLOBE_PORT', 'gsm-2.1'),
        'smart_port' => env('SMS_SMART_PORT', 'gsm-2.1'),
        'timeout' => env('SMS_TIMEOUT', 10),
        'available_ports' => ['COM3', 'COM4', 'COM5'],
        'normal_length' => 11,
        'custom_length' => 13,
        'normal_prefix' => '09',
        'custom_prefix' => '+639',
    ],

    /*
    |--------------------------------------------------------------------------
    | Email Notification Configuration
    |--------------------------------------------------------------------------
    */

    'email_notifications' => [
        'enabled' => env('EMAIL_NOTIFICATIONS_ENABLED', true),
        'from_address' => env('MAIL_FROM_ADDRESS', 'noreply@fjpwl.com'),
        'from_name' => env('MAIL_FROM_NAME', 'FJPWL System'),
        'reply_to' => env('EMAIL_REPLY_TO', 'info@fjpwl.com'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Background Jobs Configuration
    |--------------------------------------------------------------------------
    */

    'background_jobs' => [
        'force_logoff' => [
            'enabled' => env('FORCE_LOGOFF_ENABLED', true),
            'token_expiry_hours' => env('FORCE_LOGOFF_TOKEN_EXPIRY', 24),
        ],
        'notifications' => [
            'enabled' => env('PROCESS_NOTIFICATIONS_ENABLED', true),
            'batch_size' => env('NOTIFICATION_BATCH_SIZE', 100),
            'max_retries' => env('NOTIFICATION_MAX_RETRIES', 3),
        ],
        'bookings' => [
            'enabled' => env('CHECK_BOOKINGS_ENABLED', true),
            'alert_days' => env('BOOKING_ALERT_DAYS', 3),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | LDAP Configuration (Optional)
    |--------------------------------------------------------------------------
    */

    'ldap' => [
        'enabled' => env('LDAP_ENABLED', false),
        'host' => env('LDAP_HOST', 'ldaps://172.16.0.34'),
        'port' => env('LDAP_PORT', 636),
        'base_dn' => env('LDAP_BASE_DN', 'dc=csi,dc=lan'),
        'user_dn' => env('LDAP_USER_DN', 'OU=CSI-Users,DC=csi,DC=lan'),
        'user_domain' => env('LDAP_USER_DOMAIN', '@csi.lan'),
    ],

];
