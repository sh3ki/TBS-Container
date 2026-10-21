<?php

namespace App\Console\Commands;

use App\Models\EdiProfile;
use App\Services\EdiProfileDispatchService;
use Illuminate\Console\Command;

class DispatchDueEdiProfiles extends Command
{
    protected $signature = 'edi:dispatch-auto';
    protected $description = 'Generate queued payloads for due automatic EDI profiles';

    public function handle(EdiProfileDispatchService $dispatch): int
    {
        $now = now('Asia/Manila');
        $count = 0;

        EdiProfile::query()
            ->where('is_enabled', true)
            ->where('automatic_enabled', true)
            ->where(function ($query) use ($now) {
                $query->whereNull('next_run_at')->orWhere('next_run_at', '<=', $now);
            })
            ->get()
            ->each(function (EdiProfile $profile) use ($now, $dispatch, &$count) {
                $currentTime = $now->format('H:i:s');
                if ($profile->start_time || $profile->end_time) {
                    $start = $profile->start_time ?: '00:00:00';
                    $end = $profile->end_time ?: '23:59:59';
                    $inside = $start <= $end
                        ? ($currentTime >= $start && $currentTime <= $end)
                        : ($currentTime >= $start || $currentTime <= $end);
                    if (! $inside) return;
                }

                try {
                    $dispatch->dispatch($profile, 'automatic');
                    $profile->update([
                        'last_run_at' => $now,
                        'next_run_at' => $now->copy()->startOfMinute()->addMinutes($profile->schedule_minutes ?: max(1, (int) round($profile->interval_seconds / 60))),
                    ]);
                    $count++;
                } catch (\Throwable $exception) {
                    $profile->update([
                        'last_run_at' => $now,
                        'next_run_at' => $now->copy()->startOfMinute()->addMinutes($profile->schedule_minutes ?: max(1, (int) round($profile->interval_seconds / 60))),
                        'last_error' => $exception->getMessage(),
                    ]);
                    $this->error($profile->profile_name . ': ' . $exception->getMessage());
                }
            });

        $this->info("Queued {$count} automatic EDI profile(s).");
        return self::SUCCESS;
    }
}
