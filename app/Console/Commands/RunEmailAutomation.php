<?php

namespace App\Console\Commands;

use App\Services\EmailAutomationService;
use Illuminate\Console\Command;

class RunEmailAutomation extends Command
{
    protected $signature = 'email:automation
                            {--once : Run one cycle then exit}
                            {--sleep=45 : Seconds to sleep between cycles in loop mode}';

    protected $description = 'Run legacy-style email automation (POP3 intake, scheduled SMTP sends, and auto-replies).';

    public function handle(EmailAutomationService $automationService): int
    {
        if (!config('email_automation.enabled', true)) {
            $this->warn('Email automation is disabled by EMAIL_AUTOMATION_ENABLED=false');
            return self::SUCCESS;
        }

        $sleep = max(5, (int) $this->option('sleep'));

        if ($this->option('once')) {
            $summary = $automationService->runCycle();
            $this->line($this->formatSummary($summary));
            return self::SUCCESS;
        }

        $this->info('Starting email automation loop...');
        $this->info('Press Ctrl+C to stop.');

        while (true) {
            $summary = $automationService->runCycle();
            $this->line($this->formatSummary($summary));
            sleep($sleep);
        }
    }

    private function formatSummary(array $summary): string
    {
        $now = now()->format('Y-m-d H:i:s');

        return sprintf(
            '[%s] incoming: processed=%d queued_replies=%d errors=%d | scheduled: processed=%d delivered=%d failed=%d | replies: processed=%d sent=%d failed=%d',
            $now,
            $summary['incoming']['processed'] ?? 0,
            $summary['incoming']['queued_replies'] ?? 0,
            $summary['incoming']['errors'] ?? 0,
            $summary['scheduled']['processed'] ?? 0,
            $summary['scheduled']['delivered'] ?? 0,
            $summary['scheduled']['failed'] ?? 0,
            $summary['replies']['processed'] ?? 0,
            $summary['replies']['sent'] ?? 0,
            $summary['replies']['failed'] ?? 0,
        );
    }
}
