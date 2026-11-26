<?php

namespace App\Console\Commands;

use App\Services\SmsService;
use Illuminate\Console\Command;

class SendSmsTest extends Command
{
    protected $signature = 'sms:test
        {phone : Recipient number, for example 09171234567}
        {message? : Message to send}';

    protected $description = 'Send one test SMS through the configured SMS gateway';

    public function handle(SmsService $smsService): int
    {
        $this->info('Sending test SMS through ' . config('services.sms.driver') . '...');
        $message = $this->argument('message') ?: 'Test SMS from TBS';
        $result = $smsService->send($this->argument('phone'), $message);

        if (!$result['success']) {
            $this->error($result['error'] ?? 'SMS failed.');
            return self::FAILURE;
        }

        $this->info('SMS provider accepted the message. Check the recipient phone.');
        return self::SUCCESS;
    }
}
