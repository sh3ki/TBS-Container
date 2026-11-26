<?php

return [

    'booking_system' => [
        'url' => env('BOOKING_SYSTEM_URL', 'https://simplybook.com.ph/csp/simplybook/ADMIN/fjp/BookingSummary.csp'),
        'login_url' => env('BOOKING_SYSTEM_LOGIN_URL'),
        'username' => env('BOOKING_SYSTEM_USERNAME'),
        'password' => env('BOOKING_SYSTEM_PASSWORD'),
        'username_field' => 'username',
        'password_field' => 'password',
        'container_parameter' => 'container_no',
        'timeout' => env('BOOKING_SYSTEM_TIMEOUT', 20),
    ],

    'plate_ocr' => [
        'command' => env('PLATE_OCR_COMMAND', 'python ocr/plate_ocr.py {image}'),
    ],

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

    'groq' => [
        'api_key' => env('GROQ_API_KEY'),
        'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
        'model' => env('GROQ_MODEL', 'openai/gpt-oss-20b'),
        'timeout' => (int) env('GROQ_TIMEOUT', 30),
        'max_tokens' => (int) env('GROQ_MAX_TOKENS', 1200),
        'enabled' => (bool) env('GROQ_ENABLED', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | SMS Gateway Configuration
    |--------------------------------------------------------------------------
    */

    'sms' => [
        'driver' => env('SMS_DRIVER', 'legacy'),
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
        'smsgate' => [
            'url' => env('SMSGATE_API_URL', 'https://api.sms-gate.app/3rdparty/v1/messages'),
            'username' => env('SMSGATE_USERNAME'),
            'password' => env('SMSGATE_PASSWORD'),
            'device_id' => env('SMSGATE_DEVICE_ID'),
            'sim_number' => env('SMSGATE_SIM_NUMBER'),
            'timeout' => (int) env('SMSGATE_TIMEOUT', 20),
        ],
        'philsms' => [
            'url' => env('PHILSMS_API_URL', 'https://app.philsms.com/api/v3/sms/send'),
            'api_token' => env('PHILSMS_API_TOKEN'),
            'sender_id' => env('PHILSMS_SENDER_ID', 'TBSYARD'),
            'timeout' => (int) env('PHILSMS_TIMEOUT', 20),
        ],
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
