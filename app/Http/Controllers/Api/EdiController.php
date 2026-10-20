<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EdiProfile;
use App\Models\Codeco;
use App\Services\EdiProfileDispatchService;
use App\Services\GroqCodecoAnalyzer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

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

        $profiles = EdiProfile::with(['fields', 'directions', 'client'])->orderBy('profile_name')->get();

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
            'direction_mode' => ['nullable', Rule::in(['IN', 'OUT', 'BOTH'])],
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
            'destination_type' => ['required', Rule::in(['http', 'https', 'sftp', 'ftp', 'ftps', 'cache_csp', 'file', 'email', 'manual'])],
            'destination_config' => ['nullable', 'array'],
            'credentials' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
            'fields' => ['required', 'array', 'min:1'],
            'fields.*.source_column' => ['required', 'string', Rule::in(self::INVENTORY_FIELDS)],
            'fields.*.output_order' => ['required', 'integer', 'min:1'],
            'fields.*.transform' => ['nullable', 'string', 'max:40'],
            'fields.*.is_enabled' => ['required', 'boolean'],
        ]);
        $validated['schedule_minutes'] = max(1, (int) round(((int) $validated['interval_seconds']) / 60));
        $validated['manual_enabled'] = true;
        $validated['automatic_enabled'] = true;
        if ($validated['is_enabled']) {
            abort(422, 'Create the profile disabled, upload the required IN/OUT samples, then enable it.');
        }

        $profile = new EdiProfile(collect($validated)->except(['fields', 'credentials'])->all());
        $profile->credentials = array_filter($validated['credentials'] ?? [])
            ? Crypt::encryptString(json_encode($validated['credentials']))
            : null;
        if ($profile->is_enabled) $profile->enabled_at = now('Asia/Manila');
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
            'direction_mode' => ['nullable', Rule::in(['IN', 'OUT', 'BOTH'])],
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
            'destination_type' => ['required', Rule::in(['http', 'https', 'sftp', 'ftp', 'ftps', 'cache_csp', 'file', 'email', 'manual'])],
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
        $validated['schedule_minutes'] = max(1, (int) round(((int) $validated['interval_seconds']) / 60));
        $validated['manual_enabled'] = true;
        $validated['automatic_enabled'] = true;
        if ($validated['is_enabled']) {
            $required = $validated['direction_mode'] ?? $profile->direction_mode ?? 'BOTH';
            $directions = $profile->directions()->pluck('direction')->all();
            $complete = (int) ($validated['client_id'] ?? $profile->client_id) === 67
                ? true
                : ($required === 'IN' ? in_array('IN', $directions, true)
                    : ($required === 'OUT' ? in_array('OUT', $directions, true) : in_array('IN', $directions, true) && in_array('OUT', $directions, true)));
            abort_unless($complete, 422, 'Upload the required CODECO sample for every enabled direction before enabling this profile.');
        }

        $profile->fill(collect($validated)->except(['fields', 'credentials'])->all());
        if (array_key_exists('credentials', $validated) && ! empty(array_filter($validated['credentials'] ?? []))) {
            $existing = [];
            if (is_string($profile->getRawOriginal('credentials')) && trim((string) $profile->getRawOriginal('credentials')) !== '') {
                try {
                    $existing = json_decode(Crypt::decryptString($profile->getRawOriginal('credentials')), true) ?: [];
                } catch (\Throwable) {
                    $existing = json_decode((string) $profile->getRawOriginal('credentials'), true) ?: [];
                }
            }
            $profile->credentials = Crypt::encryptString(json_encode(array_merge($existing, array_filter($validated['credentials'], fn ($value) => $value !== null && $value !== ''))));
        }
        if ($profile->isDirty('is_enabled')) {
            if ($profile->is_enabled) {
                $origin = now('Asia/Manila')->startOfMinute()->addMinute();
                $profile->enabled_at = $origin;
                $profile->next_run_at = $origin->copy()->addMinutes($profile->schedule_minutes ?: 5);
            } else {
                $profile->next_run_at = null;
            }
        }
        if ($profile->isDirty()) $profile->profile_version = ((int) $profile->profile_version) + 1;
        $profile->updated_by = $request->user()->user_id ?? null;
        $profile->save();

        $profile->fields()->delete();
        foreach ($validated['fields'] as $field) {
            $profile->fields()->create($field);
        }

        return response()->json(['success' => true, 'data' => $this->profilePayload($profile->fresh(['fields', 'directions', 'client']))]);
    }

    public function toggle(Request $request, EdiProfile $profile)
    {
        $this->ensureAdmin();

        $enabled = ! $profile->is_enabled;
        if ($enabled && (int) $profile->client_id !== 67) {
            $required = $profile->direction_mode ?: 'BOTH';
            $directions = $profile->directions()->pluck('direction')->all();
            $complete = $required === 'IN'
                ? in_array('IN', $directions, true)
                : ($required === 'OUT'
                    ? in_array('OUT', $directions, true)
                    : in_array('IN', $directions, true) && in_array('OUT', $directions, true));
            abort_unless($complete, 422, 'Upload the required CODECO sample for every enabled direction before enabling this profile.');
        }

        $profile->is_enabled = $enabled;
        if ($enabled) {
            $origin = now('Asia/Manila')->startOfMinute()->addMinute();
            $profile->enabled_at = $origin;
            $profile->next_run_at = $origin->copy()->addMinutes($profile->schedule_minutes ?: 5);
        } else {
            $profile->next_run_at = null;
        }
        $profile->profile_version = ((int) $profile->profile_version) + 1;
        $profile->updated_by = $request->user()->user_id ?? null;
        $profile->save();

        return response()->json([
            'success' => true,
            'data' => $this->profilePayload($profile->fresh(['fields', 'directions', 'client'])),
        ]);
    }

    public function dispatch(Request $request, EdiProfile $profile, EdiProfileDispatchService $dispatch)
    {
        $this->ensureAdmin();
        $data = $request->validate([
            'file_type' => ['nullable', Rule::in(['EDI', 'TXT'])],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'sent_mode' => ['nullable', Rule::in(['unsent', 'sent', 'both'])],
        ]);
        return response()->json(['success' => true, 'data' => $dispatch->dispatch($profile, app()->runningInConsole() ? 'automatic' : 'manual', optional($request->user())->user_id, $data)]);
    }

    public function generate(Request $request, EdiProfile $profile, EdiProfileDispatchService $dispatch)
    {
        $this->ensureAdmin();
        $data = $request->validate([
            'direction' => ['required', Rule::in(['IN', 'OUT', 'BOTH'])],
            'file_type' => ['required', Rule::in(['EDI', 'TXT'])],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'sent_mode' => ['nullable', Rule::in(['unsent', 'sent', 'both'])],
        ]);
        if ((int) $profile->client_id === 67) {
            $configuredMode = $profile->direction_mode ?: 'IN';
            $directions = $configuredMode === 'BOTH'
                ? ($data['direction'] === 'BOTH' ? ['IN', 'OUT'] : [$data['direction']])
                : [$configuredMode];
        } else {
            $directions = $data['direction'] === 'BOTH' ? ['IN', 'OUT'] : [$data['direction']];
        }
        $results = [];
        foreach ($directions as $direction) {
            $result = $dispatch->generatePreview($profile, $direction, $data['file_type'], optional($request->user())->user_id, $data);
            if ($result) $results[] = $result + ['download_url' => '/api/edi/logs/'.$result['log_id'].'/download'];
        }
        return response()->json(['success' => true, 'data' => ['results' => $results, 'count' => count($results)]]);
    }

    public function logs(Request $request)
    {
        $this->ensureAdmin();
        return response()->json(['success' => true, 'data' => \App\Models\EdiDeliveryLog::with('profile')->latest('created_at')->paginate((int) $request->integer('per_page', 25))]);
    }

    public function retryLog(\App\Models\EdiDeliveryLog $log, EdiProfileDispatchService $dispatch)
    {
        $this->ensureAdmin();
        return response()->json(['success' => true, 'data' => $dispatch->retry($log)]);
    }

    public function uploadSample(Request $request, EdiProfile $profile)
    {
        $this->ensureAdmin();
        $data = $request->validate([
            'direction' => ['required', Rule::in(['IN', 'OUT'])],
            'file_type' => ['required', Rule::in(['EDI', 'TXT'])],
            'sample' => ['nullable', 'file', 'mimes:edi,txt', 'max:2048'],
            'draft_token' => ['nullable', 'uuid'],
            'sample_filename' => ['nullable', 'string', 'max:255'],
            'mappings' => ['nullable', 'json'],
        ]);
        $draftPath = $data['draft_token'] ? $this->draftPath($data['draft_token'], strtolower($data['file_type'])) : null;
        // Older analyzed drafts used the default .edi extension; retain
        // compatibility while new TXT drafts use their actual extension.
        if ($data['draft_token'] && ! Storage::disk('local')->exists($draftPath)) {
            $legacyDraftPath = $this->draftPath($data['draft_token']);
            if (Storage::disk('local')->exists($legacyDraftPath)) $draftPath = $legacyDraftPath;
        }
        if ($draftPath) abort_unless(Storage::disk('local')->exists($draftPath), 422, 'The analyzed sample upload has expired or is unavailable.');
        $uploadedSample = $data['sample'] ?? null;
        abort_if(! $uploadedSample && ! $draftPath, 422, 'Upload a sample file before saving the direction.');
        $content = $draftPath
            ? Storage::disk('local')->get($draftPath)
            : file_get_contents($uploadedSample->getRealPath());
        $analysis = $this->prepareCodecoSample($content);
        $profile->directions()->updateOrCreate(
            ['direction' => $data['direction']],
            [
                'file_type' => $data['file_type'],
                'sample_filename' => $data['sample_filename'] ?? ($uploadedSample?->getClientOriginalName() ?? 'sample.edi'),
                'sample_content' => $analysis['template'],
                'mapping_suggestions' => $analysis['suggestions'],
                // Suggestions are advisory only. Generation uses mappings
                // explicitly confirmed by the administrator.
                'mappings' => $data['mappings'] ? json_decode($data['mappings'], true) : [],
                'structure_analysis' => $analysis['structure'],
            ]
        );
        if ($draftPath) Storage::disk('local')->delete($draftPath);
        return response()->json(['success' => true, 'data' => $this->profilePayload($profile->fresh(['directions', 'fields', 'client']))]);
    }

    public function analyzeSample(Request $request)
    {
        $this->ensureAdmin();
        $data = $request->validate([
            'direction' => ['required', Rule::in(['IN', 'OUT'])],
            'file_type' => ['required', Rule::in(['EDI', 'TXT'])],
            'sample' => ['required', 'file', 'mimes:edi,txt', 'max:2048'],
        ]);
        $analysis = $this->prepareCodecoSample(file_get_contents($data['sample']->getRealPath()));
        $token = (string) Str::uuid();
        $path = $this->draftPath($token, strtolower($data['file_type']));
        Storage::disk('local')->put($path, $analysis['template']);

        return response()->json([
            'success' => true,
            'data' => [
                'direction' => $data['direction'],
                'file_type' => $data['file_type'],
                'sample_filename' => $data['sample']->getClientOriginalName(),
                'draft_token' => $token,
                'mapping_suggestions' => $analysis['suggestions'],
                'structure_analysis' => $analysis['structure'],
            ],
        ]);
    }

    public function downloadLog(\App\Models\EdiDeliveryLog $log)
    {
        $this->ensureAdmin();
        abort_unless($log->artifact_path && Storage::disk('local')->exists($log->artifact_path), 404);
        return Storage::disk('local')->download($log->artifact_path, $log->filename);
    }

    public function showCredentials(EdiProfile $profile)
    {
        $this->ensureAdmin();
        $credentials = $this->decodedCredentials($profile->credentials);

        return response()->json([
            'success' => true,
            'data' => [
                'password' => $credentials['password'] ?? '',
                'api_key' => $credentials['api_key'] ?? '',
            ],
        ]);
    }

    private function profilePayload(EdiProfile $profile): array
    {
        $payload = $profile->toArray();
        $payload['has_credentials'] = ! empty($profile->credentials);
        $credentials = $this->decodedCredentials($profile->credentials);
        // Return only non-secret connection metadata. Secret values remain
        // encrypted and are intentionally never sent back to the browser.
        $payload['credential_metadata'] = [
            'host' => $credentials['host'] ?? null,
            'port' => $credentials['port'] ?? null,
            'username' => $credentials['username'] ?? null,
            'has_password' => ! empty($credentials['password']),
            'has_api_key' => ! empty($credentials['api_key']),
        ];
        $payload['credentials'] = [];
        $payload['directions'] = $profile->directions ?? [];
        $payload['destination_config'] = $profile->destination_config ?? [];
        return $payload;
    }

    private function decodedCredentials($value): array
    {
        if (is_array($value)) return $value;
        if (! is_string($value) || trim($value) === '') return [];
        try {
            return json_decode(Crypt::decryptString($value), true) ?: [];
        } catch (\Throwable) {
            return json_decode($value, true) ?: [];
        }
    }

    private function draftPath(string $token, string $extension = 'edi'): string
    {
        return 'edi/samples/drafts/'.$token.'.'.ltrim($extension, '.');
    }

    private function prepareCodecoSample(string $content): array
    {
        $lineEnding = str_contains($content, "\r\n") ? "\r\n" : "\n";
        $elementSeparator = '+';
        $componentSeparator = ':';
        $segmentTerminator = "'";
        $prefix = '';
        if (str_starts_with($content, 'UNA') && strlen($content) >= 9) {
            $prefix = substr($content, 0, 9);
            $componentSeparator = $content[3];
            $elementSeparator = $content[4];
            $segmentTerminator = $content[8];
            $content = substr($content, 9);
        }

        $rawSegments = array_values(array_filter(array_map(
            fn ($segment) => trim($segment, "\r\n \t"),
            preg_split('/'.preg_quote($segmentTerminator, '/').'\s*/', $content)
        )));
        $messageStart = collect($rawSegments)->search(fn ($segment) => str_starts_with($segment, 'UNH'.$elementSeparator));
        $messageEnd = $messageStart === false ? false : collect($rawSegments)->search(
            fn ($segment, $index) => $index > $messageStart && str_starts_with($segment, 'UNT'.$elementSeparator)
        );
        if ($messageStart !== false && $messageEnd !== false) {
            $selected = array_slice($rawSegments, 0, $messageEnd + 1);
            $interchangeEnd = collect($rawSegments)->search(fn ($segment, $index) => $index > $messageEnd && str_starts_with($segment, 'UNZ'.$elementSeparator));
            if ($interchangeEnd !== false) $selected[] = $rawSegments[$interchangeEnd];
        } else {
            $selected = $rawSegments;
        }

        // These are deliberately only candidate mappings. The administrator
        // confirms the final mapping in the UI. Keys are unique per segment
        // and element so repeated transaction loops do not produce duplicate
        // mapping choices.
        $rules = [
            ['EQD', 2, 'container_no', 'Equipment identifier / container number', null],
            ['EQD', 3, 'iso_code', 'Equipment size and type / ISO code', 1],
            ['STS', 1, 'container_status', 'Equipment status', null],
            ['DTM', 1, 'date_added', 'Date/time period', 2],
            ['TDT', 2, 'voyage', 'Transport movement voyage reference', null],
            ['LOC', 2, 'location', 'Location identifier', 1],
            ['SEL', 1, 'seal_no', 'Seal number', null],
            ['RFF', 1, 'booking', 'Reference / booking number', null],
        ];
        $suggestions = [];
        $mappingOptions = [];
        $usedSources = [];
        $usedStructures = [];
        $processedSegments = [];
        $processedRaw = [];
        foreach ($selected as $rawSegment) {
            $parts = explode($elementSeparator, $rawSegment);
            $tag = strtoupper((string) array_shift($parts));
            foreach ($rules as [$ruleTag, $elementNumber, $source, $meaning, $componentNumber]) {
                $structureKey = $tag.'['.$elementNumber.']';
                if ($tag !== $ruleTag || in_array($source, $usedSources, true) || in_array($structureKey, $usedStructures, true)) continue;
                $position = $elementNumber - 1;
                if (! isset($parts[$position]) || trim($parts[$position]) === '') continue;
                $token = '{{'.$source.'}}';
                if ($componentNumber === null) {
                    $parts[$position] = $token;
                } else {
                    $components = explode($componentSeparator, $parts[$position]);
                    if (! isset($components[$componentNumber - 1])) continue;
                    $components[$componentNumber - 1] = $token;
                    $parts[$position] = implode($componentSeparator, $components);
                }
                $option = [
                    'key' => $structureKey,
                    'token' => $token,
                    'segment' => $tag,
                    'element' => $elementNumber,
                    'component' => $componentNumber,
                    'label' => $structureKey.' — '.$meaning,
                    'meaning' => $meaning,
                    'source_column' => $source,
                ];
                $mappingOptions[] = $option;
                $suggestions[] = [
                    'token' => $token,
                    'source_column' => $source,
                    'segment' => $tag,
                    'element' => $elementNumber,
                    'component' => $componentNumber,
                    'meaning' => $meaning,
                    'reason' => 'Suggested from the detected UN/EDIFACT D95B CODECO '.$tag.' structure.',
                ];
                $usedSources[] = $source;
                $usedStructures[] = $structureKey;
            }
            $processedSegments[] = [
                'tag' => $tag,
                'element_count' => count($parts),
                'qualifier' => $parts[0] ?? null,
            ];
            $processedRaw[] = implode($elementSeparator, array_merge([$tag], $parts));
        }

        $structure = [
            'standard' => 'UN/EDIFACT D95B CODECO',
            'element_separator' => $elementSeparator,
            'component_separator' => $componentSeparator,
            'segment_terminator' => $segmentTerminator,
            'line_ending' => $lineEnding,
            'segment_count' => count($processedSegments),
            'segments' => $processedSegments,
            'unique_segments' => collect($processedSegments)->unique('tag')->values()->all(),
            'mapping_options' => $mappingOptions,
            'header_segments' => array_values(array_filter($processedSegments, fn ($segment) => in_array($segment['tag'], ['UNA', 'UNB', 'UNH'], true))),
            'transaction_segments' => array_values(array_filter($processedSegments, fn ($segment) => ! in_array($segment['tag'], ['UNA', 'UNB', 'UNH', 'UNT', 'UNZ'], true))),
            'end_segments' => array_values(array_filter($processedSegments, fn ($segment) => in_array($segment['tag'], ['UNT', 'UNZ'], true))),
        ];
        $processedWithTags = collect($processedRaw)->map(function (string $segment) use ($elementSeparator) {
            $parts = explode($elementSeparator, $segment);
            return ['tag' => strtoupper((string) array_shift($parts)), 'content' => $segment];
        })->values();
        $firstMessageIndex = $processedWithTags->search(fn (array $segment) => $segment['tag'] === 'UNH');
        $firstTrailerIndex = $processedWithTags->search(fn (array $segment, int $index) => $index > (int) $firstMessageIndex && $segment['tag'] === 'UNT');
        $structure['template_parts'] = [
            'header' => $firstMessageIndex === false ? [] : $processedWithTags->slice(0, $firstMessageIndex)->pluck('content')->values()->all(),
            'transaction' => ($firstMessageIndex === false || $firstTrailerIndex === false) ? $processedRaw : $processedWithTags->slice($firstMessageIndex, $firstTrailerIndex - $firstMessageIndex + 1)->pluck('content')->values()->all(),
            'trailer' => $firstTrailerIndex === false ? [] : $processedWithTags->slice($firstTrailerIndex + 1)->pluck('content')->values()->all(),
        ];
        // Keep the uploaded segment line ending as part of the template. The
        // renderer repeats only the first UNH..UNT transaction and writes the
        // UNB/UNZ envelope once around all generated transactions.
        $serializedTemplate = $prefix.implode($segmentTerminator.$lineEnding, $processedRaw).$segmentTerminator.$lineEnding;
        $aiAnalysis = app(GroqCodecoAnalyzer::class)->analyze($structure, $serializedTemplate);
        $aiUsed = (bool) ($aiAnalysis['used_ai'] ?? false);
        $codecoMeanings = Codeco::where('message_code', 'CODECO')
            ->where('release', 'D95B')
            ->where('record_type', 'segment')
            ->pluck('meaning', 'segment_code');
        foreach ($mappingOptions as &$option) {
            $option['catalog_meaning'] = $codecoMeanings[$option['segment']] ?? null;
        }
        unset($option);
        // Show every unique segment/element in the uploaded structure. Only
        // recognized dynamic elements receive a token and can be mapped;
        // static qualifiers remain visible but cannot be overwritten.
        $dynamicOptions = collect($mappingOptions)->keyBy('key');
        $allStructureOptions = [];
        foreach ($selected as $rawSegment) {
            $parts = explode($elementSeparator, $rawSegment);
            $tag = strtoupper((string) array_shift($parts));
            foreach ($parts as $index => $value) {
                if (trim((string) $value) === '') continue;
                $key = $tag.'['.($index + 1).']';
                if (isset($allStructureOptions[$key])) continue;
                $dynamic = $dynamicOptions->get($key);
                $allStructureOptions[$key] = $dynamic ?: [
                    'key' => $key,
                    'token' => null,
                    'segment' => $tag,
                    'element' => $index + 1,
                    'label' => $key.' — detected CODECO element',
                    'meaning' => $codecoMeanings[$tag] ?? null,
                    'source_column' => null,
                    'catalog_meaning' => $codecoMeanings[$tag] ?? null,
                ];
            }
        }
        $mappingOptions = array_values($allStructureOptions);
        $structure['mapping_options'] = $mappingOptions;
        $structure['analysis_source'] = $aiUsed ? 'ai' : 'fallback';
        $structure['ai_layout'] = $aiAnalysis['layout'] ?? null;
        $structure['analysis_message'] = $aiUsed
            ? 'Groq analyzed the uploaded CODECO structure and suggested the mappings below.'
            : 'AI analysis was unavailable. CODECO D95B database definitions were used as fallback.';
        $suggestions = $aiUsed && ! empty($aiAnalysis['suggestions']) ? $aiAnalysis['suggestions'] : $suggestions;
        $suggestions = collect($suggestions)->map(function (array $suggestion) {
            $prefix = preg_quote(($suggestion['segment'] ?? '').'['.($suggestion['element'] ?? '').']', '/');
            $suggestion['meaning'] = preg_replace('/^'.$prefix.'\s*[—-]\s*/u', '', (string) ($suggestion['meaning'] ?? ''));
            return $suggestion;
        })->values()->all();

        return [
            'template' => $serializedTemplate,
            'suggestions' => $suggestions,
            'structure' => $structure,
        ];
    }

    private function ensureAdmin(): void
    {
        abort_unless(app()->runningInConsole() || (int) auth()->id() === 1, 403);
    }
}
