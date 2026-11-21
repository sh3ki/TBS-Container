<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

class GuardScanController extends Controller
{
    public function queueDisplay()
    {
        $waitingIn = DB::table('queue_entries')->where('direction', 'IN')->where('status', 'waiting')->whereNull('completed_at')->orderBy('waiting_number')->orderBy('id')->get(['id', 'plate_no', 'direction', 'waiting_number', 'booking_time']);
        $waitingOut = DB::table('queue_entries')->where('direction', 'OUT')->where('status', 'waiting')->whereNull('completed_at')->orderBy('waiting_number')->orderBy('id')->get(['id', 'plate_no', 'direction', 'waiting_number', 'booking_time']);
        $serving = DB::table('queue_entries')->where('status', 'serving')->whereNull('completed_at')->orderBy('serving_number')->orderBy('id')->get(['id', 'plate_no', 'direction', 'serving_number', 'serving_at']);

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
        $capacity = (int) (DB::table('app_settings')->where('setting_id', 1)->value('serving_capacity') ?? 0);
        $current = (int) DB::table('queue_entries')->where('status', 'serving')->whereNull('completed_at')->count();
        if ($capacity > 0 && $current >= $capacity) {
            return response()->json([
                'success' => false,
                'serving_capacity_full' => true,
                'message' => 'Serving capacity is full.',
            ], 409);
        }
        $request->validate(['image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240']]);
        $directory = public_path('truck_plates');
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }
        $filename = now()->format('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $request->file('image')->getClientOriginalExtension();
        $request->file('image')->move($directory, $filename);
        $imagePath = $directory . DIRECTORY_SEPARATOR . $filename;

        $command = (string) env('PLATE_OCR_COMMAND', 'python ocr/plate_ocr.py {image}');
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
            ]
        );
        $process->setTimeout(8);
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

        $queue = DB::transaction(function () use ($plateNo) {
            $entries = DB::table('queue_entries')->where('status', 'waiting')->orderBy('created_at')->lockForUpdate()->get();
            $entry = $entries->first(fn ($item) => strtoupper(preg_replace('/[^A-Z0-9]/', '', $item->plate_no)) === $plateNo);
            if (! $entry) return null;
            $servingNumber = ((int) DB::table('queue_entries')->where('status', 'serving')->max('serving_number')) + 1;
            DB::table('queue_entries')->where('id', $entry->id)->update([
                'status' => 'serving',
                'waiting_number' => null,
                'serving_number' => $servingNumber,
                'serving_at' => now(),
                'updated_at' => now(),
            ]);
            // Keep the remaining waiting numbers contiguous after removing
            // the scanned truck, independently for IN or OUT.
            $waiting = DB::table('queue_entries')
                ->where('direction', $entry->direction)
                ->where('queue_date', $entry->queue_date)
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

            return $entry;
        });

        return response()->json(['success' => true, 'plate_no' => $plateNo, 'queue_updated' => (bool) $queue]);
    }
}
