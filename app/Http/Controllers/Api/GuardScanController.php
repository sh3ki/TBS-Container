<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\Process\Process;

class GuardScanController extends Controller
{
    public function queueDisplay()
    {
        $waitingIn = DB::table('queue_entries')->where('direction', 'IN')->where('status', 'waiting')->whereNull('completed_at')->orderBy('waiting_number')->orderBy('id')->get(['id', 'plate_no', 'direction', 'waiting_number', 'booking_time']);
        $waitingOut = DB::table('queue_entries')->where('direction', 'OUT')->where('status', 'waiting')->whereNull('completed_at')->orderBy('waiting_number')->orderBy('id')->get(['id', 'plate_no', 'direction', 'waiting_number', 'booking_time']);
        $serving = DB::table('queue_entries')->where('status', 'serving')->whereNull('completed_at')->orderBy('direction')->orderBy('serving_number')->orderBy('id')->get(['id', 'plate_no', 'direction', 'serving_number', 'serving_at']);

        return response()->json(['success' => true, 'data' => [
            'waiting_in' => $waitingIn,
            'waiting_out' => $waitingOut,
            'serving' => $serving,
        ]]);
    }

    public function queueCapacity()
    {
        $capacity = (int) (DB::table('app_settings')->where('setting_id', 1)->value('serving_capacity') ?? 0);
        $current = (int) DB::table('queue_entries')->where('status', 'serving')->whereNull('completed_at')->count();

        return response()->json([
            'success' => true,
            'serving_capacity' => $capacity,
            'current_serving' => $current,
            // Zero means unlimited, while any positive value is enforced.
            'at_capacity' => $capacity > 0 && $current >= $capacity,
        ]);
    }

    public function scanTruckPlate(Request $request)
    {
        $validated = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'action' => ['required', Rule::in(['return', 'withdraw'])],
            'user_id' => ['nullable', 'integer'],
        ]);
        $direction = $validated['action'] === 'return' ? 'IN' : 'OUT';
        $oppositeDirection = $direction === 'IN' ? 'OUT' : 'IN';
        $capacity = (int) (DB::table('app_settings')->where('setting_id', 1)->value('serving_capacity') ?? 0);
        $current = (int) DB::table('queue_entries')->where('status', 'serving')->whereNull('completed_at')->count();
        if ($capacity > 0 && $current >= $capacity) {
            return response()->json([
                'success' => false,
                'serving_capacity_full' => true,
                'message' => 'Serving capacity is full.',
            ], 409);
        }
        $directory = public_path('truck_plates');
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }
        $filename = now()->format('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $request->file('image')->getClientOriginalExtension();
        $request->file('image')->move($directory, $filename);
        $imagePath = $directory . DIRECTORY_SEPARATOR . $filename;

        $command = (string) config('services.plate_ocr.command', 'python ocr/plate_ocr.py {image}');
        // FastALPR downloads model files into the user's cache directory. Keep
        // that cache under Laravel storage because the web worker may not be
        // allowed to write under /var/www.
        $ocrCacheDirectory = storage_path('app/ocr-cache');
        if (! is_dir($ocrCacheDirectory)) {
            mkdir($ocrCacheDirectory, 0775, true);
        }
        $process = Process::fromShellCommandline(
            str_replace('{image}', escapeshellarg($imagePath), $command),
            base_path(),
            [
                'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
                'TEMP' => getenv('TEMP') ?: sys_get_temp_dir(),
                'TMP' => getenv('TMP') ?: sys_get_temp_dir(),
                'USERPROFILE' => getenv('USERPROFILE') ?: 'C:\\Users\\USER',
                'HOMEDRIVE' => getenv('HOMEDRIVE') ?: 'C:',
                'HOMEPATH' => getenv('HOMEPATH') ?: '\\Users\\USER',
                // pathlib.Path.home() uses HOME on Linux; FastALPR currently
                // derives its model cache from that instead of XDG_CACHE_HOME.
                'HOME' => $ocrCacheDirectory,
                'XDG_CACHE_HOME' => $ocrCacheDirectory,
            ]
        );
        $process->setTimeout(60);
        $process->run();
        if (! $process->isSuccessful()) {
            \Log::error('Guard plate OCR command failed', [
                'command' => $command,
                'exit_code' => $process->getExitCode(),
                'error' => $process->getErrorOutput(),
                'output' => $process->getOutput(),
            ]);
            return response()->json(['success' => false, 'message' => 'Plate recognition service is unavailable.'], 503);
        }
        $result = json_decode(trim($process->getOutput()), true);
        $plateNo = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) ($result['plate_no'] ?? '')));
        if ($plateNo === '') {
            return response()->json(['success' => false, 'message' => 'Plate number could not be recognized.'], 422);
        }

        $queue = DB::transaction(function () use ($plateNo, $direction, $oppositeDirection) {
            $entries = DB::table('queue_entries')
                ->where('direction', $direction)
                ->where('status', 'waiting')
                ->whereNull('completed_at')
                ->orderBy('waiting_number')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $entry = $entries->first(fn ($item) => strtoupper(preg_replace('/[^A-Z0-9]/', '', $item->plate_no)) === $plateNo);
            if (! $entry) {
                $oppositeEntry = DB::table('queue_entries')
                    ->where('direction', $oppositeDirection)
                    ->where('status', 'waiting')
                    ->whereNull('completed_at')
                    ->orderBy('waiting_number')
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->first(fn ($item) => strtoupper(preg_replace('/[^A-Z0-9]/', '', $item->plate_no)) === $plateNo);

                return [
                    'entry' => null,
                    'opposite_direction' => $oppositeEntry ? $oppositeDirection : null,
                ];
            }
            DB::table('queue_entries')->where('id', $entry->id)->update([
                'status' => 'serving',
                'waiting_number' => null,
                'serving_number' => null,
                'serving_at' => now(),
                'updated_at' => now(),
            ]);
            $serving = DB::table('queue_entries')->where('status', 'serving')->where('direction', $entry->direction)->whereNull('completed_at')->where('id', '<>', $entry->id)->orderBy('serving_number')->orderBy('id')->lockForUpdate()->get(['id', 'booking_time']);
            $servingIds = $serving->pluck('id')->map(fn ($id) => (int) $id)->all();
            $insertAt = count($servingIds);
            $newTimestamp = strtotime((string) $entry->booking_time) ?: PHP_INT_MAX;
            foreach ($serving as $index => $servingEntry) {
                if ((strtotime((string) $servingEntry->booking_time) ?: PHP_INT_MAX) > $newTimestamp) { $insertAt = $index; break; }
            }
            array_splice($servingIds, $insertAt, 0, [(int) $entry->id]);
            foreach ($servingIds as $index => $servingId) DB::table('queue_entries')->where('id', $servingId)->update(['serving_number' => $index + 1, 'updated_at' => now()]);
            // Keep the remaining waiting numbers contiguous after removing
            // the scanned truck, independently for IN or OUT.
            $waiting = DB::table('queue_entries')
                ->where('direction', $entry->direction)
                ->where('status', 'waiting')
                ->orderBy('waiting_number')
                ->orderBy('id')
                ->lockForUpdate()
                ->get(['id']);
            foreach ($waiting as $index => $waitingEntry) {
                DB::table('queue_entries')->where('id', $waitingEntry->id)->update([
                    'waiting_number' => $index + 1,
                    'updated_at' => now(),
                ]);
            }

            return ['entry' => $entry, 'opposite_direction' => null];
        });

        if ($queue['opposite_direction']) {
            $expectedAction = $queue['opposite_direction'] === 'IN' ? 'Return' : 'Withdraw';
            return response()->json([
                'success' => false,
                'wrong_queue' => true,
                'message' => "This plate was found in the {$queue['opposite_direction']} queue. Please choose {$expectedAction}.",
            ], 422);
        }

        $queueUpdated = (bool) $queue['entry'];
        if ($queueUpdated) {
            DB::table('audit_logs')->insert([
                'action' => 'SCAN',
                'description' => sprintf(
                    '[SCAN %s] Scanned Plate "%s" for %s and moved to serving.',
                    strtoupper($validated['action']),
                    $plateNo,
                    $validated['action']
                ),
                'user_id' => $validated['user_id'] ?? 0,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
        }

        return response()->json(['success' => true, 'plate_no' => $plateNo, 'queue_updated' => $queueUpdated]);
    }
}
