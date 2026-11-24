<?php

namespace App\Console\Commands;

use App\Services\UtilizationSnapshotService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CaptureUtilization extends Command
{
    protected $signature = 'utilization:capture {--force : Capture immediately, ignoring the configured time and day exceptions}';
    protected $description = 'Capture the real-time inventory utilization snapshot';

    public function handle(UtilizationSnapshotService $snapshotService): int
    {
        $timezone = 'Asia/Manila';
        $now = Carbon::now($timezone);
        $settings = DB::table('app_settings')->where('setting_id', 1)->first();
        $configuredTime = (string) ($settings?->utilization_time ?? '');
        $exceptions = json_decode((string) ($settings?->utilization_day_exceptions ?? '[]'), true) ?: [];

        if (!$this->option('force')) {
            if (!$configuredTime || $now->format('H:i') !== substr($configuredTime, 0, 5)) return self::SUCCESS;
            if (in_array($now->format('l'), $exceptions, true)) return self::SUCCESS;
        }

        try {
            $id = $snapshotService->capture($now);
            $this->info("Utilization snapshot {$id} captured for {$now->toDateString()}.");
            return self::SUCCESS;
        } catch (\Throwable $exception) {
            report($exception);
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
