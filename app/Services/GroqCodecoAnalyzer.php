<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class GroqCodecoAnalyzer
{
    public function analyze(array $structure, string $template): array
    {
        if (! config('services.groq.enabled') || ! config('services.groq.api_key')) {
            return ['used_ai' => false, 'suggestions' => []];
        }

        $options = collect($structure['mapping_options'] ?? [])->filter(fn (array $option) => filled($option['token'] ?? null))
            ->map(fn (array $option) => [
                'key' => $option['key'] ?? null,
                'token' => $option['token'] ?? null,
                'segment' => $option['segment'] ?? null,
                'element' => $option['element'] ?? null,
                'component' => $option['component'] ?? null,
                'label' => $option['label'] ?? null,
                'source_column' => $option['source_column'] ?? null,
            ])->values()->all();

        // The local parser is authoritative for the exact layout. Groq only
        // needs the compact layout signature and field names to suggest
        // mappings; sending full schema metadata wastes free-tier tokens.
        $inventoryFields = Schema::getColumnListing('inventory');
        $compactStructure = [
            'standard' => $structure['standard'] ?? 'UN/EDIFACT D95B CODECO',
            'separators' => [
                'element' => $structure['element_separator'] ?? '+',
                'component' => $structure['component_separator'] ?? ':',
                'terminator' => $structure['segment_terminator'] ?? "'",
                'line_ending' => $structure['line_ending'] ?? "\r\n",
            ],
            'segments' => collect($structure['segments'] ?? [])->map(fn (array $segment) => [
                'tag' => $segment['tag'] ?? null,
                'element_count' => (int) ($segment['element_count'] ?? 0),
                'qualifier' => $segment['qualifier'] ?? null,
            ])->values()->all(),
            'header' => data_get($structure, 'template_parts.header', []),
            'transaction' => data_get($structure, 'template_parts.transaction', []),
            'trailer' => data_get($structure, 'template_parts.trailer', []),
            'mapping_options' => $options,
        ];

        $prompt = <<<'PROMPT'
Analyze the uploaded UN/EDIFACT D95B CODECO sample as an exact layout template for container transactions.
Return JSON only with this shape:
{"layout":{"segments":[{"tag":"EQD","element_count":7,"qualifier":"CN","elements":[{"position":2,"value_role":"container number"}]}]},"suggestions":[{"key":"EQD[2]","source_column":"container_no","confidence":0.0,"reason":"short reason"}]}

Rules:
- Use only the detected mapping option keys provided below.
- Use only these source columns when suggesting a mapping: i_id, gate_status, date_added, container_no, client_id, container_status, size_type, iso_code, class, date_manufactured, vessel, voyage, origin, ex_consignee, load_type, plate_no, hauler, hauler_driver, license_no, location, chasis, contact_no, bill_of_lading, booking, shipper, seal_no, remarks, user_id, complete, out_id.
- Do not invent segments, elements, repeated occurrences, or source columns.
- Suggestions are advisory; an administrator will confirm them.
- Return at most one suggestion per detected option key and omit uncertain mappings.
- The structure must describe the exact detected sample order and element counts. Do not remove, duplicate, reorder, or collapse segments.
- Preserve the exact interchange envelope (UNB once and UNZ once), the first complete transaction (UNH through UNT), every qualifier, composite component, static value, segment terminator, and line-ending convention.
- The uploaded sample is a layout/template, not a set of rows to repeat. The first UNH..UNT transaction is the only transaction structure to use for generation; generation repeats that transaction only, while the envelope remains singular.
- Do not treat a control/reference number such as UNH element 1 or BGM element 2 as an inventory field unless the administrator explicitly maps it. These values are generated as message references.
- Preserve the sample's date/time shape. For CODECO DTM values, keep the qualifier and format qualifier and replace only the mapped component (for example, DTM+7:YYYYMMDDHHMM:203).
- Preserve newline placement after every segment exactly as supplied.
- Use only the supplied inventory field names; do not invent fields.
- Keep reasons under 12 words. Return no more than one suggestion per mapping option.
PROMPT;

        try {
            $response = Http::withToken(config('services.groq.api_key'))
                ->acceptJson()
                ->timeout((int) config('services.groq.timeout', 30))
                ->post(rtrim(config('services.groq.base_url'), '/').'/chat/completions', [
                    'model' => config('services.groq.model'),
                    'temperature' => 0,
                    'max_tokens' => (int) config('services.groq.max_tokens', 1200),
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        ['role' => 'system', 'content' => $prompt],
                        ['role' => 'user', 'content' => json_encode([
                            'exact_layout' => $compactStructure,
                            'inventory_fields' => $inventoryFields,
                            'sample' => mb_substr($template, 0, 8000),
                        ], JSON_THROW_ON_ERROR)],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('Groq CODECO analysis failed.', ['status' => $response->status()]);
                return ['used_ai' => false, 'suggestions' => []];
            }

            $content = data_get($response->json(), 'choices.0.message.content');
            $decoded = is_string($content) ? json_decode($content, true) : null;
            if (! is_array($decoded)) return ['used_ai' => false, 'suggestions' => []];

            $allowed = collect($options)->keyBy('key');
            $allowedSources = $inventoryFields;
            $layout = is_array($decoded['layout'] ?? null) ? $decoded['layout'] : null;
            $expectedSegments = collect($structure['segments'] ?? [])->map(fn (array $segment) => [
                'tag' => $segment['tag'] ?? null,
                'element_count' => (int) ($segment['element_count'] ?? 0),
            ])->values()->all();
            $returnedSegments = collect($layout['segments'] ?? [])->map(fn (array $segment) => [
                'tag' => strtoupper((string) ($segment['tag'] ?? '')),
                'element_count' => (int) ($segment['element_count'] ?? 0),
            ])->values()->all();
            $layoutMatchesSample = $returnedSegments === $expectedSegments;
            if (! $layoutMatchesSample) {
                Log::warning('Groq CODECO layout did not match the uploaded sample; using fallback analysis.');
                return ['used_ai' => false, 'suggestions' => []];
            }

            $suggestions = collect($decoded['suggestions'] ?? [])
                ->filter(fn ($item) => is_array($item) && $allowed->has($item['key'] ?? '') && in_array($item['source_column'] ?? '', $allowedSources, true))
                ->unique('key')
                ->map(function (array $item) use ($allowed) {
                    $option = $allowed->get($item['key']);
                    return [
                        'token' => $option['token'] ?? '{{'.$item['source_column'].'}}',
                        'source_column' => $item['source_column'],
                        'segment' => $option['segment'],
                        'element' => $option['element'],
                        'meaning' => $option['catalog_meaning'] ?? ($option['meaning'] ?? $option['label']),
                        'confidence' => (float) ($item['confidence'] ?? 0),
                        'reason' => $item['reason'] ?? 'Groq CODECO structure suggestion.',
                    ];
                })->values()->all();

            return [
                'used_ai' => true,
                'layout' => $layout,
                'suggestions' => $suggestions,
            ];
        } catch (\Throwable $exception) {
            Log::warning('Groq CODECO analysis exception.', ['message' => $exception->getMessage()]);
            return ['used_ai' => false, 'suggestions' => []];
        }
    }
}
