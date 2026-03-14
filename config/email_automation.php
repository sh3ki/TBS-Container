<?php

return [
    // Populated from env and used by email:automation command.
    'enabled' => env('EMAIL_AUTOMATION_ENABLED', true),
    'loop_sleep_seconds' => (int) env('EMAIL_AUTOMATION_LOOP_SLEEP', 45),

    // Notification table candidates (first existing table will be used).
    'notification_table_candidates' => [
        'scheduled_notifications',
        'fjp_scheduled_notifications',
    ],

    // POP3 inbox processing.
    'incoming' => [
        'enabled' => env('EMAIL_AUTOMATION_INCOMING_ENABLED', true),
        'host' => env('EMAIL_AUTOMATION_POP3_HOST', ''),
        'port' => (int) env('EMAIL_AUTOMATION_POP3_PORT', 110),
        'username' => env('EMAIL_AUTOMATION_POP3_USERNAME', ''),
        'password' => env('EMAIL_AUTOMATION_POP3_PASSWORD', ''),
        'encryption' => env('EMAIL_AUTOMATION_POP3_ENCRYPTION', 'none'), // none|ssl|tls
        'validate_cert' => (bool) env('EMAIL_AUTOMATION_POP3_VALIDATE_CERT', false),
        'folder' => env('EMAIL_AUTOMATION_POP3_FOLDER', 'INBOX'),
        'delete_processed' => (bool) env('EMAIL_AUTOMATION_POP3_DELETE_PROCESSED', false),
    ],

    // Attachment storage path under storage/app.
    'attachments_disk' => env('EMAIL_AUTOMATION_ATTACHMENTS_DISK', 'local'),
    'attachments_dir' => env('EMAIL_AUTOMATION_ATTACHMENTS_DIR', 'email-automation/attachments'),

    // Automatic reply behavior.
    'reply' => [
        'enabled' => env('EMAIL_AUTOMATION_REPLY_ENABLED', true),
        'from_name' => env('EMAIL_AUTOMATION_REPLY_FROM_NAME', env('MAIL_FROM_NAME', 'FJPWL Automation')),
    ],

    // Outbound scheduling / ack.
    'scheduled' => [
        'enabled' => env('EMAIL_AUTOMATION_SCHEDULED_ENABLED', true),
        'max_per_cycle' => (int) env('EMAIL_AUTOMATION_SCHEDULED_MAX_PER_CYCLE', 100),
    ],
];
