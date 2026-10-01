<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EdiProfile;
use App\Services\EdiDeliveryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class EdiController extends Controller
{
    private const INVENTORY_FIELDS = [
        'i_id', 'gate_status', 'date_added', 'container_no', 'client_id', 'container_status',
        'size_type', 'iso_code', 'class', 'date_manufactured', 'vessel', 'voyage', 'origin',
        'ex_consignee', 'load_type', 'plate_no', 'hauler', 'hauler_driver', 'license_no',
        'location', 'chasis', 'contact_no', 'bill_of_lading', 'booking', 'shipper', 'seal_no',
        'remarks', 'user_id', 'complete', 'out_id',
    ];

    public function index()
    {
        $this->ensureAdmin();

        $profiles = EdiProfile::with('fields')->orderBy('profile_name')->get();

        return response()->json([
            'success' => true,
            'data' => $profiles->map(fn (EdiProfile $profile) => $this->profilePayload($profile)),
        ]);
    }

    public function clients()
    {
        $this->ensureAdmin();

        return response()->json([
            'success' => true,
            'data' => DB::table('clients')
                ->where('archived', 0)
                ->select('c_id', 'client_code', 'client_name')
                ->orderBy('client_name')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $this->ensureAdmin();

        $validated = $request->validate([
            'profile_name' => ['required', 'string', 'max:120', 'unique:edi_profiles,profile_name'],
            'client_id' => ['nullable', 'integer'],
            'edi_type' => ['required', 'string', 'max:40'],
            'is_enabled' => ['required', 'boolean'],
            'manual_enabled' => ['required', 'boolean'],
            'automatic_enabled' => ['required', 'boolean'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'interval_seconds' => ['required', 'integer', 'min:1', 'max:31536000'],
            'batch_limit' => ['required', 'integer', 'min:1', 'max:100000'],
            'delimiter' => ['required', 'string', 'max:20'],
            'line_ending' => ['required', Rule::in(['LF', 'CRLF'])],
            'record_terminator' => ['required', 'string', 'max:80'],
            'terminator_mode' => ['required', Rule::in(['once', 'per_record'])],
            'destination_type' => ['required', Rule::in(['cache_csp', 'http', 'sftp', 'file', 'email', 'manual'])],
            'destination_config' => ['nullable', 'array'],
            'credentials' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
            'fields' => ['required', 'array', 'min:1'],
            'fields.*.source_column' => ['required', 'string', Rule::in(self::INVENTORY_FIELDS)],
            'fields.*.output_order' => ['required', 'integer', 'min:1'],
            'fields.*.transform' => ['nullable', 'string', 'max:40'],
            'fields.*.is_enabled' => ['required', 'boolean'],
        ]);

        $profile = new EdiProfile(collect($validated)->except(['fields', 'credentials'])->all());
        $profile->credentials = $validated['credentials'] ?? null;
        $profile->created_by = $request->user()->user_id ?? null;
        $profile->updated_by = $request->user()->user_id ?? null;
        $profile->save();

        foreach ($validated['fields'] as $field) {
            $profile->fields()->create($field);
        }

        return response()->json(['success' => true, 'data' => $this->profilePayload($profile->fresh('fields'))], 201);
    }

    public function update(Request $request, EdiProfile $profile)
    {
        $this->ensureAdmin();

        $validated = $request->validate([
            'profile_name' => ['required', 'string', 'max:120', Rule::unique('edi_profiles', 'profile_name')->ignore($profile->profile_id, 'profile_id')],
            'client_id' => ['nullable', 'integer'],
            'edi_type' => ['required', 'string', 'max:40'],
            'is_enabled' => ['required', 'boolean'],
            'manual_enabled' => ['required', 'boolean'],
            'automatic_enabled' => ['required', 'boolean'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'interval_seconds' => ['required', 'integer', 'min:1', 'max:31536000'],
            'batch_limit' => ['required', 'integer', 'min:1', 'max:100000'],
            'delimiter' => ['required', 'string', 'max:20'],
            'line_ending' => ['required', Rule::in(['LF', 'CRLF'])],
            'record_terminator' => ['required', 'string', 'max:80'],
            'terminator_mode' => ['required', Rule::in(['once', 'per_record'])],
            'destination_type' => ['required', Rule::in(['cache_csp', 'http', 'sftp', 'file', 'email', 'manual'])],
            'destination_config' => ['nullable', 'array'],
            'credentials' => ['nullable', 'array'],
            'max_attempts' => ['required', 'integer', 'min:1', 'max:20'],
            'notes' => ['nullable', 'string'],
            'fields' => ['required', 'array', 'min:1'],
            'fields.*.source_column' => ['required', 'string', Rule::in(self::INVENTORY_FIELDS)],
            'fields.*.output_order' => ['required', 'integer', 'min:1'],
            'fields.*.transform' => ['nullable', 'string', 'max:40'],
            'fields.*.is_enabled' => ['required', 'boolean'],
        ]);

        $profile->fill(collect($validated)->except(['fields', 'credentials'])->all());
        if (array_key_exists('credentials', $validated)) {
            $profile->credentials = $validated['credentials'];
        }
        $profile->updated_by = $request->user()->user_id ?? null;
        $profile->save();

        $profile->fields()->delete();
        foreach ($validated['fields'] as $field) {
            $profile->fields()->create($field);
        }

        return response()->json(['success' => true, 'data' => $this->profilePayload($profile->fresh('fields'))]);
    }

    public function send(Request $request, EdiProfile $profile, EdiDeliveryService $delivery)
    {
        $this->ensureAdmin();

        $automaticRun = app()->runningInConsole();
        abort_unless($profile->is_enabled && (($profile->manual_enabled && ! $automaticRun) || ($profile->automatic_enabled && $automaticRun)), 422, 'Sending is disabled for this profile.');

        $fields = $profile->fields()->where('is_enabled', true)->orderBy('output_order')->get();
        $columns = $fields->pluck('source_column')->all();
        $query = DB::table($profile->source_table)->where('client_id', $profile->client_id);
        $records = $query->orderBy($profile->sort_column, $profile->sort_direction)->limit($profile->batch_limit)->get($columns);

        $delimiter = $profile->delimiter === 'TAB' ? "\t" : $profile->delimiter;
        $lineEnding = $profile->line_ending === 'CRLF' ? "\r\n" : "\n";
        $lines = [];
        foreach ($records as $record) {
            $values = [];
            foreach ($fields as $field) {
                $value = $record->{$field->source_column} ?? $field->default_value ?? '';
                if ($field->transform === 'strip_line_breaks') {
                    $value = preg_replace('/[\r\n]+/', ' ', (string) $value);
                }
                $values[] = $value;
            }
            $lines[] = implode($delimiter, $values);
        }

        if ($profile->terminator_mode === 'per_record') {
            $lines = array_map(fn ($line) => $line . $delimiter . $profile->record_terminator, $lines);
        } else {
            $lines[] = $profile->record_terminator;
        }

        $payload = implode($lineEnding, $lines);
        $filename = str_replace(
            ['{profile}', '{datetime}'],
            [preg_replace('/[^A-Za-z0-9_-]+/', '_', $profile->legacy_key ?: $profile->profile_name), now()->format('YmdHis')],
            $profile->filename_pattern
        );
        $path = 'edi/' . now()->format('Y/m/d') . '/' . $filename;
        Storage::disk('local')->put($path, $payload);

        $batchId = DB::table('edi_dispatch_batches')->insertGetId([
            'profile_id' => $profile->profile_id,
            'trigger_type' => $automaticRun ? 'automatic' : 'manual',
            'status' => 'processing',
            'record_count' => $records->count(),
            'filename' => $filename,
            'payload_hash' => hash('sha256', $payload),
            'payload_path' => $path,
            'queued_at' => now(),
            'requested_by' => optional($request->user())->user_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($records as $record) {
            DB::table('edi_dispatch_records')->insert([
                'batch_id' => $batchId,
                'source_table' => $profile->source_table,
                'source_id' => $record->{$profile->source_table === 'inventory' ? 'i_id' : 'p_id'},
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $attemptId = DB::table('edi_dispatch_attempts')->insertGetId([
            'batch_id' => $batchId,
            'attempt_number' => 1,
            'status' => 'started',
            'started_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $deliveryResult = $delivery->deliver($profile, $payload, $filename, $path);
            DB::table('edi_dispatch_attempts')->where('attempt_id', $attemptId)->update([
                'status' => 'success',
                'response_code' => $deliveryResult['status_code'] ?? null,
                'response_body' => json_encode($deliveryResult),
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('edi_dispatch_batches')->where('batch_id', $batchId)->update([
                'status' => 'sent',
                'started_at' => now(),
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('edi_outbound_artifacts')->insert([
                'batch_id' => $batchId,
                'artifact_type' => 'payload',
                'filename' => $filename,
                'storage_path' => $path,
                'sha256' => hash('sha256', $payload),
                'size_bytes' => strlen($payload),
                'created_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            DB::table('edi_dispatch_attempts')->where('attempt_id', $attemptId)->update([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('edi_dispatch_batches')->where('batch_id', $batchId)->update([
                'status' => 'failed',
                'last_error' => $exception->getMessage(),
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
            $profile->update(['last_error' => $exception->getMessage()]);
            throw $exception;
        }

        $profile->update([
            'last_success_at' => now(),
            'last_error' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => $deliveryResult['message'] ?? 'EDI payload delivered successfully.',
            'batch_id' => $batchId,
            'record_count' => $records->count(),
            'filename' => $filename,
        ]);
    }

    private function profilePayload(EdiProfile $profile): array
    {
        $payload = $profile->toArray();
        $payload['has_credentials'] = ! empty($profile->credentials);
        // This endpoint is restricted to administrator user 1, so the admin
        // can review and edit the plain database-stored delivery credentials.
        $payload['credentials'] = $profile->credentials ?? [];
        $payload['destination_config'] = $profile->destination_config ?? [];
        return $payload;
    }

    private function ensureAdmin(): void
    {
        abort_unless(app()->runningInConsole() || (int) auth()->id() === 1, 403);
    }
}
