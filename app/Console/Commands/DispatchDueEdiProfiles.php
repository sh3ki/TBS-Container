<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\EdiController;
use App\Models\EdiProfile;
use Illuminate\Console\Command;
use Illuminate\Http\Request;

class DispatchDueEdiProfiles extends Command
{
    protected $signature = 'edi:dispatch-auto';
    protected $description = 'Generate queued payloads for due automatic EDI profiles';

    public function handle(EdiController $controller): int
    {
        $now = now();
        $count = 0;

        EdiProfile::query()
            ->where('is_enabled', true)
            ->where('automatic_enabled', true)
            ->where(function ($query) use ($now) {
                $query->whereNull('next_run_at')->orWhere('next_run_at', '<=', $now);
            })
            ->get()
            ->each(function (EdiProfile $profile) use ($controller, $now, &$count) {
                $currentTime = $now->format('H:i:s');
                if ($profile->start_time && $currentTime < $profile->start_time) return;
                if ($profile->end_time && $currentTime > $profile->end_time) return;

                try {
                    $controller->send(Request::create('/api/edi/profiles/' . $profile->profile_id . '/send', 'POST'), $profile);
                    $profile->update([
                        'last_run_at' => $now,
                        'next_run_at' => $now->copy()->addSeconds($profile->interval_seconds),
                    ]);
                    $count++;
                } catch (\Throwable $exception) {
                    $profile->update([
                        'last_run_at' => $now,
                        'next_run_at' => $now->copy()->addSeconds($profile->interval_seconds),
                        'last_error' => $exception->getMessage(),
                    ]);
                    $this->error($profile->profile_name . ': ' . $exception->getMessage());
                }
            });

        $this->info("Queued {$count} automatic EDI profile(s).");
        return self::SUCCESS;
    }
}
