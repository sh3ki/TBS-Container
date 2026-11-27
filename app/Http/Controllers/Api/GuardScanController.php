<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Symfony\Component\Process\Process;

class GuardScanController extends Controller
{
    public function heartbeat(Request $request)
    {
        $userId = $this->guardUserId($request);
        abort_unless($userId, 401, 'Guard session is invalid.');

        DB::table('guard_presence')->updateOrInsert(
            ['user_id' => $userId],
            ['last_seen_at' => now(), 'ip_address' => $request->ip(), 'user_agent' => (string) $request->userAgent(), 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['success' => true]);
    }

    public function queueDisplay(Request $request)
    {
        $guardUserId = $this->guardUserId($request);
        $activeStatuses = ['waiting', 'standby', 'calling', 'floating'];
        $servingCapacity = (int) (DB::table('app_settings')->where('setting_id', 1)->value('serving_capacity') ?? 0);
        $waitingIn = DB::table('queue_entries')->leftJoin('pre_inventory as queue_pre', 'queue_pre.p_id', '=', 'queue_entries.pre_inventory_id')->leftJoin('container_size_type as queue_size', 'queue_size.s_id', '=', 'queue_pre.size_type')->where('queue_entries.direction', 'IN')->whereIn('queue_entries.status', $activeStatuses)->whereNull('queue_entries.completed_at')->orderBy('queue_entries.waiting_number')->orderBy('queue_entries.id')->get(['queue_entries.id', 'queue_entries.plate_no', 'queue_entries.direction', 'queue_entries.status', 'queue_entries.waiting_number', 'queue_entries.booking_time', 'queue_entries.manual_reason', 'queue_entries.calling_at', 'queue_entries.floating_at', 'queue_size.size as size_type_size', 'queue_size.type as size_type_type']);
        $waitingOut = DB::table('queue_entries')->leftJoin('pre_inventory as queue_pre', 'queue_pre.p_id', '=', 'queue_entries.pre_inventory_id')->leftJoin('container_size_type as queue_size', 'queue_size.s_id', '=', 'queue_pre.size_type')->where('queue_entries.direction', 'OUT')->whereIn('queue_entries.status', $activeStatuses)->whereNull('queue_entries.completed_at')->orderBy('queue_entries.waiting_number')->orderBy('queue_entries.id')->get(['queue_entries.id', 'queue_entries.plate_no', 'queue_entries.direction', 'queue_entries.status', 'queue_entries.waiting_number', 'queue_entries.booking_time', 'queue_entries.manual_reason', 'queue_entries.calling_at', 'queue_entries.floating_at', 'queue_size.size as size_type_size', 'queue_size.type as size_type_type']);
        $manualCapture = DB::table('queue_entries')
            ->whereNotNull('manual_reason')
            ->where('manual_guard_user_id', $guardUserId ?: 0)
            ->whereIn('status', $activeStatuses)
            ->whereNull('completed_at')
            ->orderBy('id')
            ->first(['id', 'plate_no', 'direction', 'manual_reason', 'manual_guard_user_id']);
        $serving = DB::table('queue_entries')->leftJoin('pre_inventory as queue_pre', 'queue_pre.p_id', '=', 'queue_entries.pre_inventory_id')->leftJoin('container_size_type as queue_size', 'queue_size.s_id', '=', 'queue_pre.size_type')->where('queue_entries.status', 'serving')->whereNull('queue_entries.completed_at')->orderBy('queue_entries.direction')->orderBy('queue_entries.serving_number')->orderBy('queue_entries.id')->get(['queue_entries.id', 'queue_entries.plate_no', 'queue_entries.direction', 'queue_entries.serving_number', 'queue_entries.serving_at', 'queue_size.size as size_type_size', 'queue_size.type as size_type_type']);

        return response()->json(['success' => true, 'data' => [
            'waiting_in' => $waitingIn,
            'waiting_out' => $waitingOut,
            'serving' => $serving,
            'serving_capacity' => $servingCapacity,
            'manual_capture' => $manualCapture,
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

    public function queueEntryDetails(Request $request, int $entryId)
    {
        abort_unless($this->guardUserId($request), 401, 'Guard session is invalid.');

        $entry = DB::table('queue_entries')->where('id', $entryId)->first(['plate_no']);
        if (!$entry) return response()->json(['success' => false, 'message' => 'Queue entry not found.'], 404);

        $preInventoryId = Schema::hasColumn('queue_entries', 'pre_inventory_id')
            ? DB::table('queue_entries')->where('id', $entryId)->value('pre_inventory_id')
            : null;
        $tablePrefix = DB::getTablePrefix();
        $query = DB::table('pre_inventory as p')
            ->leftJoin('clients as c', 'c.c_id', '=', 'p.client_id')
            ->leftJoin('container_size_type as st', 'st.s_id', '=', 'p.size_type')
            ->where('p.status', 0)
            ->select([
                'p.plate_no',
                DB::raw("COALESCE({$tablePrefix}c.client_name, {$tablePrefix}c.client_code, '-') as client"),
                DB::raw("COALESCE(CONCAT({$tablePrefix}st.size, ' ', {$tablePrefix}st.type), '-') as size_type"),
                DB::raw("COALESCE({$tablePrefix}p.iso_code, '') as iso_code"),
                DB::raw("COALESCE(NULLIF({$tablePrefix}p.hauler, ''), '-') as hauler"),
            ]);

        $record = $preInventoryId
            ? $query->where('p.p_id', $preInventoryId)->first()
            : $query->whereRaw("REPLACE(REPLACE(UPPER({$tablePrefix}p.plate_no), '-', ''), ' ', '') = ?", [strtoupper(preg_replace('/[\\s-]+/', '', (string) $entry->plate_no) ?? '')])->first();

        if (!$record) return response()->json(['success' => false, 'message' => 'Pre-inventory record not found.'], 404);

        return response()->json(['success' => true, 'data' => $record]);
    }

    public function manualCapture(Request $request)
    {
        $validated = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'queue_entry_id' => ['required', 'integer'],
            'user_id' => ['nullable', 'integer'],
        ]);

        $entry = DB::table('queue_entries')
            ->where('id', $validated['queue_entry_id'])
            ->whereNotNull('manual_reason')
            ->whereIn('status', ['waiting', 'calling', 'floating'])
            ->whereNull('completed_at')
            ->first();
        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'This manual capture request is no longer active.'], 409);
        }
        abort_unless((int) $entry->manual_guard_user_id === (int) $this->guardUserId($request), 403, 'This manual capture is assigned to another Guard account.');

        $capacity = (int) (DB::table('app_settings')->where('setting_id', 1)->value('serving_capacity') ?? 0);
        $current = (int) DB::table('queue_entries')->where('status', 'serving')->whereNull('completed_at')->count();
        if ($capacity > 0 && $current >= $capacity) {
            return response()->json(['success' => false, 'serving_capacity_full' => true, 'message' => 'Serving capacity is full.'], 409);
        }

        $temporaryDirectory = storage_path('app/guard-scan-tmp');
        if (!is_dir($temporaryDirectory)) mkdir($temporaryDirectory, 0755, true);
        $temporaryFilename = bin2hex(random_bytes(16)) . '.' . strtolower($request->file('image')->getClientOriginalExtension());
        $request->file('image')->move($temporaryDirectory, $temporaryFilename);
        $imagePath = $temporaryDirectory . DIRECTORY_SEPARATOR . $temporaryFilename;

        try {
            $servedEntry = DB::transaction(function () use ($entry) {
                $locked = DB::table('queue_entries')
                    ->where('id', $entry->id)
                    ->whereNotNull('manual_reason')
                    ->whereIn('status', ['waiting', 'calling', 'floating'])
                    ->whereNull('completed_at')
                    ->lockForUpdate()
                    ->first();
                abort_unless($locked, 409, 'This manual capture request is no longer active.');

                $servingAt = now();
                DB::table('queue_entries')->where('id', $locked->id)->update([
                    'status' => 'serving',
                    'waiting_number' => null,
                    'serving_number' => null,
                    'serving_at' => $servingAt,
                    'updated_at' => $servingAt,
                ]);

                $serving = DB::table('queue_entries')
                    ->where('direction', $locked->direction)
                    ->where('status', 'serving')
                    ->whereNull('completed_at')
                    ->where('id', '<>', $locked->id)
                    ->orderByRaw('CASE WHEN serving_at IS NULL THEN 1 ELSE 0 END')
                    ->orderBy('serving_at')->orderBy('id')
                    ->lockForUpdate()->get(['id']);
                $servingIds = $serving->pluck('id')->map(fn ($id) => (int) $id)->all();
                $servingIds[] = (int) $locked->id;
                foreach ($servingIds as $index => $servingId) {
                    DB::table('queue_entries')->where('id', $servingId)->update(['serving_number' => $index + 1, 'updated_at' => now()]);
                }

                $waiting = DB::table('queue_entries')
                    ->where('direction', $locked->direction)
                    ->whereIn('status', ['waiting', 'calling', 'floating'])
                    ->orderBy('waiting_number')->orderBy('id')->lockForUpdate()->get(['id']);
                foreach ($waiting as $index => $waitingEntry) {
                    DB::table('queue_entries')->where('id', $waitingEntry->id)->update(['waiting_number' => $index + 1, 'updated_at' => now()]);
                }

                return DB::table('queue_entries')->where('id', $locked->id)->first();
            });

            $this->saveSuccessfulScanImage($imagePath, $servedEntry->direction, $servedEntry->plate_no);
            DB::table('audit_logs')->insert([
                'action' => 'SCAN',
                'description' => sprintf('[MANUAL SCAN %s] Captured plate "%s" and moved to serving.', $servedEntry->direction, $servedEntry->plate_no),
                'user_id' => $request->user()?->user_id ?? ($validated['user_id'] ?? 0),
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
            return response()->json(['success' => true, 'queue_updated' => true, 'plate_no' => $servedEntry->plate_no]);
        } catch (\Throwable $exception) {
            \Log::error('Guard manual plate capture failed', ['error' => $exception->getMessage(), 'queue_entry_id' => $entry->id]);
            return response()->json(['success' => false, 'message' => 'Manual plate capture could not be completed.'], 500);
        } finally {
            @unlink($imagePath);
        }
    }

    private function guardUserId(Request $request): ?int
    {
        $token = $request->bearerToken();
        if (!$token) return null;
        $decoded = base64_decode($token, true);
        $userId = is_string($decoded) ? (int) explode(':', $decoded, 2)[0] : 0;
        if ($userId <= 0) return null;
        return DB::table('users')->where('user_id', $userId)->where('is_guard', 1)->where('archived', 0)->exists() ? $userId : null;
    }

    public function updateQueueStatus(Request $request)
    {
        $validated = $request->validate([
            'id' => ['required', 'integer'],
            'status' => ['required', 'in:calling,floating'],
            'user_id' => ['nullable', 'integer'],
        ]);
        $userId = $request->user()?->user_id ?? ($validated['user_id'] ?? 0);

        $transition = DB::transaction(function () use ($validated) {
            $entry = DB::table('queue_entries')->where('id', $validated['id'])->lockForUpdate()->first();
            abort_unless($entry, 404, 'Queue entry not found.');
            $fromStatus = $entry->status;

            if ($validated['status'] === 'calling') {
                abort_unless($entry->status === 'waiting', 409, 'Only waiting trucks can be called.');
                $firstEntry = DB::table('queue_entries')
                    ->where('direction', $entry->direction)
                    ->where('status', 'waiting')
                    ->whereNull('completed_at')
                    ->orderBy('waiting_number')
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->first();
                abort_unless($firstEntry && (int) $firstEntry->id === (int) $entry->id, 409, 'Only the first waiting truck can be called.');
                DB::table('queue_entries')->where('id', $entry->id)->update([
                    'status' => 'calling', 'calling_at' => now(), 'updated_at' => now(),
                ]);
            } else {
                abort_unless($entry->status === 'calling', 409, 'Only calling trucks can be floated.');
                DB::table('queue_entries')->where('id', $entry->id)->update([
                    'status' => 'floating', 'floating_at' => now(), 'updated_at' => now(),
                ]);
            }

            return [
                'entry' => DB::table('queue_entries')->where('id', $entry->id)->first(),
                'from_status' => $fromStatus,
            ];
        });

        DB::table('audit_logs')->insert([
            'action' => 'EDIT',
            'description' => sprintf(
                '[QUEUE] Change plate number "%s" status from %s to %s.',
                $transition['entry']->plate_no,
                $transition['from_status'],
                $transition['entry']->status
            ),
            'user_id' => $userId,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['success' => true, 'entry' => $transition['entry']]);
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
        $temporaryDirectory = storage_path('app/guard-scan-tmp');
        if (! is_dir($temporaryDirectory)) {
            mkdir($temporaryDirectory, 0755, true);
        }
        $temporaryFilename = bin2hex(random_bytes(16)) . '.' . strtolower($request->file('image')->getClientOriginalExtension());
        $request->file('image')->move($temporaryDirectory, $temporaryFilename);
        $imagePath = $temporaryDirectory . DIRECTORY_SEPARATOR . $temporaryFilename;

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
            @unlink($imagePath);
            return response()->json(['success' => false, 'message' => 'Plate recognition service is unavailable.'], 503);
        }
        $result = json_decode(trim($process->getOutput()), true);
        $plateNo = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) ($result['plate_no'] ?? '')));
        if ($plateNo === '') {
            @unlink($imagePath);
            return response()->json(['success' => false, 'message' => 'Plate number could not be recognized.'], 422);
        }

        $queue = DB::transaction(function () use ($plateNo, $direction, $oppositeDirection) {
            $entries = DB::table('queue_entries')
                ->where('direction', $direction)
                ->whereIn('status', ['waiting', 'calling', 'floating'])
                ->whereNull('completed_at')
                ->orderBy('waiting_number')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $entry = $entries->first(fn ($item) => strtoupper(preg_replace('/[^A-Z0-9]/', '', $item->plate_no)) === $plateNo);
            if (! $entry) {
                $oppositeEntry = DB::table('queue_entries')
                    ->where('direction', $oppositeDirection)
                    ->whereIn('status', ['waiting', 'calling', 'floating'])
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

            // Only the first calling truck in its direction may be scanned.
            $firstCallingEntry = $entries->first(fn ($item) => $item->status === 'calling');
            $isEligible = $entry->status === 'calling'
                && $firstCallingEntry
                && (int) $firstCallingEntry->id === (int) $entry->id;
            if (! $isEligible) {
                return [
                    'entry' => null,
                    'opposite_direction' => null,
                    'not_next_line' => true,
                    'waiting_number' => (int) ($entry->waiting_number ?? 0),
                    'entry_status' => $entry->status,
                ];
            }

            $servingAt = now();
            DB::table('queue_entries')->where('id', $entry->id)->update([
                'status' => 'serving',
                'waiting_number' => null,
                'serving_number' => null,
                'serving_at' => $servingAt,
                'updated_at' => $servingAt,
            ]);
            $serving = DB::table('queue_entries')->where('status', 'serving')->where('direction', $entry->direction)->whereNull('completed_at')->where('id', '<>', $entry->id)->orderByRaw('CASE WHEN serving_at IS NULL THEN 1 ELSE 0 END')->orderBy('serving_at')->orderBy('id')->lockForUpdate()->get(['id', 'serving_at']);
            $servingIds = $serving->pluck('id')->map(fn ($id) => (int) $id)->all();
            $insertAt = count($servingIds);
            $newTimestamp = strtotime((string) $servingAt) ?: PHP_INT_MAX;
            foreach ($serving as $index => $servingEntry) {
                if ((strtotime((string) $servingEntry->serving_at) ?: PHP_INT_MAX) > $newTimestamp) { $insertAt = $index; break; }
            }
            array_splice($servingIds, $insertAt, 0, [(int) $entry->id]);
            foreach ($servingIds as $index => $servingId) DB::table('queue_entries')->where('id', $servingId)->update(['serving_number' => $index + 1, 'updated_at' => now()]);
            // Keep the remaining waiting numbers contiguous after removing
            // the scanned truck, independently for IN or OUT.
            $waiting = DB::table('queue_entries')
                ->where('direction', $entry->direction)
                ->whereIn('status', ['waiting', 'calling', 'floating'])
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
            @unlink($imagePath);
            $expectedAction = $queue['opposite_direction'] === 'IN' ? 'Return' : 'Withdraw';
            return response()->json([
                'success' => false,
                'wrong_queue' => true,
                'message' => "This plate was found in the {$queue['opposite_direction']} queue. Please choose {$expectedAction}.",
            ], 422);
        }

        if ($queue['not_next_line'] ?? false) {
            @unlink($imagePath);
            $message = ($queue['entry_status'] ?? null) === 'waiting'
                ? "Plate {$plateNo} is still WAITING. Please set plate {$plateNo} to CALLING first before scanning."
                : "Plate {$plateNo} cannot be scanned yet. Only the first calling truck in the WAITING {$direction} queue can be scanned.";
            return response()->json([
                'success' => false,
                'not_next_line' => true,
                'message' => $message,
                'waiting_number' => $queue['waiting_number'] ?? null,
            ], 422);
        }

        $queueUpdated = (bool) $queue['entry'];
        if ($queueUpdated) {
            try {
                $this->saveSuccessfulScanImage($imagePath, $direction, $plateNo);
            } catch (\Throwable $exception) {
                \Log::error('Guard successful scan image could not be saved', [
                    'plate_no' => $plateNo,
                    'direction' => $direction,
                    'error' => $exception->getMessage(),
                ]);
            }
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

        @unlink($imagePath);

        return response()->json(['success' => true, 'plate_no' => $plateNo, 'queue_updated' => $queueUpdated]);
    }

    private function saveSuccessfulScanImage(string $sourcePath, string $direction, string $plateNo): void
    {
        $directory = public_path('truck_plates');
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $filename = now()->format('Ymd_His') . '_' . strtolower($direction) . '_' . strtolower($plateNo) . '.jpg';
        $destination = $directory . DIRECTORY_SEPARATOR . $filename;
        $extension = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
        $image = match ($extension) {
            'jpg', 'jpeg' => imagecreatefromjpeg($sourcePath),
            'png' => imagecreatefrompng($sourcePath),
            'webp' => function_exists('imagecreatefromwebp') ? imagecreatefromwebp($sourcePath) : false,
            default => false,
        };

        if ($image === false) {
            throw new \RuntimeException('Unable to convert the successful scan image to JPEG.');
        }

        imageinterlace($image, true);
        if (! imagejpeg($image, $destination, 90)) {
            imagedestroy($image);
            throw new \RuntimeException('Unable to save the successful scan image.');
        }
        imagedestroy($image);
    }
}
