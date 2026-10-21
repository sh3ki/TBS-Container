<?php

namespace App\Services;

use App\Models\EdiDeliveryLog;
use App\Models\EdiProfile;
use App\Models\EdiProfileDirection;
use App\Models\EdiTransaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class EdiProfileDispatchService
{
    public function dispatch(EdiProfile $profile, string $trigger = 'manual', ?int $userId = null, array $filters = []): array
    {
        $timezone = $profile->timezone ?: 'Asia/Manila';
        $now = Carbon::now($timezone);
        $directions = $this->directionsFor($profile);
        $results = [];

        foreach ($directions as $direction) {
            $results[] = $this->dispatchDirection($profile, $direction, $trigger, $userId, $now, $filters);
        }

        return ['results' => array_values(array_filter($results)), 'count' => count(array_filter($results))];
    }

    public function retry(EdiDeliveryLog $log): array
    {
        $profile = EdiProfile::findOrFail($log->profile_id);
        if ((int) $profile->client_id === 67 && in_array($log->direction, ['IN', 'OUT'], true) && $log->artifact_path && Storage::disk('local')->exists($log->artifact_path)) {
            $payload = Storage::disk('local')->get($log->artifact_path);
            $log->update(['status' => 'sending', 'attempts' => $log->attempts + 1, 'next_retry_at' => null]);
            try {
                $delivery = app(EdiDeliveryService::class)->deliver($profile, $payload, $log->filename, $log->artifact_path);
                $sentAt = Carbon::now($profile->timezone ?: 'Asia/Manila');
                $log->update(['status' => 'sent', 'sent_at' => $sentAt, 'response' => $delivery]);
                if ($log->transaction_ids) {
                    EdiTransaction::whereIn('transaction_id', $log->transaction_ids)->update(['status' => 'sent', 'sent_at' => $sentAt, 'last_error' => null]);
                }
                return ['log_id' => $log->log_id, 'filename' => $log->filename, 'status' => 'sent'];
            } catch (\Throwable $exception) {
                $nextRetry = Carbon::now($profile->timezone ?: 'Asia/Manila')->addSeconds($profile->retry_delay_seconds ?: 120);
                $status = $log->attempts >= ($profile->max_attempts ?: 3) ? 'failed' : 'retry_pending';
                $log->update([
                    'status' => $status,
                    'error_message' => $exception->getMessage(),
                    'next_retry_at' => $status === 'retry_pending' ? $nextRetry : null,
                ]);
                if ($log->transaction_ids) {
                    EdiTransaction::whereIn('transaction_id', $log->transaction_ids)->update([
                        'status' => $status,
                        'last_error' => $exception->getMessage(),
                        'next_retry_at' => $status === 'retry_pending' ? $nextRetry : null,
                    ]);
                }
                throw $exception;
            }
        }
        $log->update(['status' => 'retry_pending', 'next_retry_at' => now($profile->timezone ?: 'Asia/Manila')]);
        return $this->dispatchDirection($profile, $profile->directions()->where('direction', $log->direction)->firstOrFail(), 'retry', null, now($profile->timezone ?: 'Asia/Manila'));
    }

    /**
     * Generate a comparison artifact without sending it or changing any
     * inventory/EDI transaction to sent. This is used by the profile UI.
     */
    public function generatePreview(EdiProfile $profile, string $directionCode, string $fileType, ?int $userId = null, array $filters = []): array
    {
        if ((int) $profile->client_id === 67 && in_array($directionCode, ['IN', 'OUT'], true)) {
            return $this->generateMscDirection($profile, $directionCode, $fileType, $userId, $filters);
        }
        $direction = $profile->directions()->where('direction', $directionCode)->firstOrFail();
        $now = Carbon::now($profile->timezone ?: 'Asia/Manila');
        $this->claimEligibleTransactions($profile, $direction, $now, $filters, true, true);
        $transactions = EdiTransaction::query()
            ->where('profile_id', $profile->profile_id)
            ->where('direction', $directionCode)
            ->orderBy('inventory_id')
            ->when(! empty($filters['start_date']), fn ($query) => $query->whereRaw("DATE(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.date_added'))) >= ?", [$filters['start_date']]))
            ->when(! empty($filters['end_date']), fn ($query) => $query->whereRaw("DATE(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.date_added'))) <= ?", [$filters['end_date']]))
            ->when(! empty($filters['start_time']) && ! empty($filters['end_time']), function ($query) use ($filters) {
                $start = $filters['start_time'];
                $end = $filters['end_time'];
                return $start <= $end
                    ? $query->whereRaw("TIME(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.date_added'))) >= ?", [$start])->whereRaw("TIME(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.date_added'))) <= ?", [$end])
                    : $query->where(function ($nested) use ($start, $end) {
                        $nested->whereRaw("TIME(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.date_added'))) >= ?", [$start])->orWhereRaw("TIME(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.date_added'))) <= ?", [$end]);
                    });
            })
            ->when(! empty($filters['start_time']) && empty($filters['end_time']), fn ($query) => $query->whereRaw("TIME(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.date_added'))) >= ?", [$filters['start_time']]))
            ->when(empty($filters['start_time']) && ! empty($filters['end_time']), fn ($query) => $query->whereRaw("TIME(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.date_added'))) <= ?", [$filters['end_time']]))
            ->limit($profile->batch_limit ?: 500)
            ->get();

        if ($transactions->isEmpty()) return [];

        // A preview always uses the currently saved profile mapping/template,
        // even when the inventory row already has a sent transaction snapshot.
        $transactions->each(function (EdiTransaction $transaction) use ($direction, $fileType, $profile) {
            $transaction->setAttribute('snapshot', array_merge((array) $transaction->snapshot, [
                '_edi_template' => $direction->sample_content,
                '_edi_mappings' => $direction->mappings ?: [],
                '_edi_fields' => $profile->fields()->where('is_enabled', true)->pluck('source_column')->values()->all(),
                '_edi_file_type' => $fileType,
                '_edi_structure_analysis' => $direction->structure_analysis ?: [],
            ]));
        });

        [$payload, $warnings] = $this->render($direction, $transactions);
        $filename = $this->filename($profile, $directionCode, $fileType, $now);
        $path = 'edi/previews/'.$now->format('Y/m/d').'/'.$filename;
        Storage::disk('local')->put($path, $payload);
        $log = EdiDeliveryLog::create([
            'profile_id' => $profile->profile_id,
            'direction' => $directionCode,
            'filename' => $filename,
            'profile_version' => $profile->profile_version,
            'transaction_count' => $transactions->count(),
            'status' => 'generated',
            'artifact_path' => $path,
            'sha256' => hash('sha256', $payload),
            'generated_at' => $now,
            'response' => $warnings ? ['warnings' => $warnings, 'preview' => true] : ['preview' => true],
            'requested_by' => $userId,
        ]);

        return ['log_id' => $log->log_id, 'direction' => $directionCode, 'filename' => $filename, 'transaction_count' => $transactions->count(), 'warnings' => $warnings];
    }

    private function dispatchDirection(EdiProfile $profile, EdiProfileDirection $direction, string $trigger, ?int $userId, Carbon $now, array $filters = []): ?array
    {
        if ((int) $profile->client_id === 67 && in_array($direction->direction, ['IN', 'OUT'], true)) {
            return $this->dispatchMscDirection($profile, $direction->direction, $userId, $now, $filters);
        }
        $this->claimEligibleTransactions($profile, $direction, $now);
        $transactions = EdiTransaction::query()
            ->where('profile_id', $profile->profile_id)
            ->where('direction', $direction->direction)
            ->whereIn('status', ['pending', 'retry_pending'])
            ->where(function ($query) use ($now) {
                $query->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', $now);
            })
            ->orderBy('inventory_id')
            ->limit($profile->batch_limit)
            ->get();

        if ($transactions->isEmpty()) {
            return null;
        }

        // Never mix queued work from different profile versions/templates.
        $batches = $transactions->groupBy(fn ($transaction) => implode(':', [
            $transaction->profile_version,
            data_get($transaction->snapshot, '_edi_file_type', $direction->file_type),
        ]));
        $results = $batches->map(fn ($batch) => $this->dispatchBatch($profile, $direction, $batch, $userId, $now))->values()->all();

        return count($results) === 1 ? $results[0] : [
            'direction' => $direction->direction,
            'status' => 'sent',
            'batches' => $results,
            'record_count' => $transactions->count(),
        ];
    }

    private function dispatchBatch(EdiProfile $profile, EdiProfileDirection $direction, $transactions, ?int $userId, Carbon $now): array
    {
        $fileType = (string) data_get($transactions->first()->snapshot, '_edi_file_type', $direction->file_type);
        $filename = $this->filename($profile, $direction->direction, $fileType, $now);
        $log = EdiDeliveryLog::create([
            'profile_id' => $profile->profile_id,
            'direction' => $direction->direction,
            'filename' => $filename,
            'profile_version' => $transactions->first()->profile_version,
            'transaction_count' => $transactions->count(),
            'status' => 'generating',
            'requested_by' => $userId,
        ]);

        $transactions->each(fn ($transaction) => $transaction->update(['status' => 'generating']));

        try {
            [$payload, $warnings] = $this->render($direction, $transactions);
            $path = 'edi/' . $now->format('Y/m/d') . '/' . $filename;
            Storage::disk('local')->put($path, $payload);
            $log->update([
                'status' => 'generated',
                'artifact_path' => $path,
                'sha256' => hash('sha256', $payload),
                'generated_at' => now($profile->timezone ?: 'Asia/Manila'),
                'response' => $warnings ? ['warnings' => $warnings] : null,
            ]);
            $transactions->each(fn ($transaction) => $transaction->update(['status' => 'generated']));

            $log->update(['status' => 'sending', 'attempts' => $log->attempts + 1]);
            $transactions->each(fn ($transaction) => $transaction->update(['status' => 'sending', 'attempts' => $transaction->attempts + 1]));
            $delivery = app(EdiDeliveryService::class)->deliver($profile, $payload, $filename, $path);

            $sentAt = now($profile->timezone ?: 'Asia/Manila');
            $log->update(['status' => 'sent', 'sent_at' => $sentAt, 'response' => $delivery]);
            $transactions->each(fn ($transaction) => $transaction->update(['status' => 'sent', 'sent_at' => $sentAt, 'last_error' => null]));
            $profile->update(['last_success_at' => $sentAt, 'last_error' => null]);

            return ['log_id' => $log->log_id, 'direction' => $direction->direction, 'filename' => $filename, 'record_count' => $transactions->count(), 'status' => 'sent', 'warnings' => $warnings];
        } catch (\Throwable $exception) {
            $nextRetry = now($profile->timezone ?: 'Asia/Manila')->addSeconds($profile->retry_delay_seconds ?: 120);
            $status = $log->attempts >= ($profile->max_attempts ?: 3) ? 'failed' : 'retry_pending';
            $log->update(['status' => $status, 'error_message' => $exception->getMessage(), 'next_retry_at' => $status === 'retry_pending' ? $nextRetry : null]);
            $transactions->each(fn ($transaction) => $transaction->update(['status' => $status, 'last_error' => $exception->getMessage(), 'next_retry_at' => $status === 'retry_pending' ? $nextRetry : null]));
            $profile->update(['last_error' => $exception->getMessage()]);
            throw $exception;
        }
    }

    private function dispatchMscDirection(EdiProfile $profile, string $direction, ?int $userId, Carbon $now, array $filters = []): ?array
    {
        $manual = ! empty($filters);
        if (! $manual) {
            $retry = $this->retryDueMscDeliveries($profile, $direction, $now);
            // A retry uses the already-generated artifact and does not query
            // inventory. New movements in this run may still be sent below.
        }
        $transactions = $this->claimMscTransactions($profile, $direction, $now, [
            ...$filters,
            'sent_mode' => $filters['sent_mode'] ?? 'unsent',
            // Automatic runs collect all still-unsent eligible movements so
            // missed scheduler intervals are recovered on the next run.
            'start_at' => $manual ? ($filters['start_at'] ?? null) : null,
            'end_at' => $manual ? ($filters['end_at'] ?? $now) : $now,
        ]);
        if ($transactions->isEmpty()) return null;

        return $this->createMscArtifact($profile, $direction, $transactions, $filters['file_type'] ?? 'EDI', $userId, true, $now);
    }

    private function retryDueMscDeliveries(EdiProfile $profile, string $direction, Carbon $now): ?array
    {
        $log = EdiDeliveryLog::query()
            ->where('profile_id', $profile->profile_id)
            ->where('direction', $direction)
            ->where('status', 'retry_pending')
            ->where(function ($query) use ($now) {
                $query->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', $now);
            })
            ->whereNotNull('artifact_path')
            ->where('attempts', '<', $profile->max_attempts ?: 3)
            ->oldest('log_id')
            ->first();

        if (! $log || ! Storage::disk('local')->exists($log->artifact_path)) return null;

        return $this->retry($log);
    }

    private function generateMscDirection(EdiProfile $profile, string $direction, string $fileType, ?int $userId, array $filters): array
    {
        $timezone = $profile->timezone ?: 'Asia/Manila';
        $now = Carbon::now($timezone);
        $transactions = $this->claimMscTransactions($profile, $direction, $now, $filters + ['sent_mode' => 'unsent']);
        if ($transactions->isEmpty()) return [];

        return $this->createMscArtifact($profile, $direction, $transactions, $fileType, $userId, false, $now, true);
    }

    private function claimMscTransactions(EdiProfile $profile, string $direction, Carbon $now, array $filters): \Illuminate\Support\Collection
    {
        $mode = in_array(($filters['sent_mode'] ?? 'unsent'), ['unsent', 'sent', 'both'], true)
            ? $filters['sent_mode'] : 'unsent';
        $enabledAt = $profile->enabled_at ? Carbon::parse($profile->enabled_at, 'Asia/Manila') : Carbon::create(1970, 1, 1, 0, 0, 0, 'Asia/Manila');
        $startAt = $filters['start_at'] ?? null;
        $endAt = $filters['end_at'] ?? null;

        if (! $startAt && ! empty($filters['start_date'])) {
            $startAt = Carbon::parse($filters['start_date'].' '.($filters['start_time'] ?? '00:00:00'), 'Asia/Manila');
        }
        if (! $startAt && ! empty($filters['start_time'])) {
            $startAt = $now->copy()->setTimeFromTimeString($filters['start_time']);
        }
        if (! $endAt && ! empty($filters['end_date'])) {
            $endAt = Carbon::parse($filters['end_date'].' '.($filters['end_time'] ?? '23:59:59'), 'Asia/Manila');
        }
        if (! $endAt && ! empty($filters['end_time'])) {
            $endAt = $now->copy()->setTimeFromTimeString($filters['end_time']);
        }
        $startAt = $startAt ? Carbon::parse($startAt, 'Asia/Manila')->max($enabledAt) : $enabledAt;
        $endAt = $endAt ? Carbon::parse($endAt, 'Asia/Manila') : null;

        // Do not qualify these columns with an alias. This application uses
        // a configurable table prefix (for example, fjp_) and the query
        // builder rewrites the table name while raw alias-qualified columns
        // can remain as `i.column`, causing production SQL failures.
        $query = DB::table('inventory')
            ->where('client_id', 67)
            ->where('gate_status', $direction)
            ->where('date_added', '>=', $startAt)
            ->where('date_added', '<', $endAt ?: $now)
            ->when($mode === 'sent', fn ($q) => $q->whereExists(function ($sub) use ($profile, $direction) {
                $sub->select(DB::raw(1))->from('edi_transactions as et')
                    ->whereColumn('et.inventory_id', 'i_id')->where('et.profile_id', $profile->profile_id)
                    ->where('et.direction', $direction)->where('et.status', 'sent');
            }))
            ->when($mode === 'unsent', fn ($q) => $q->whereNotExists(function ($sub) use ($profile, $direction) {
                $sub->select(DB::raw(1))->from('edi_transactions as et')
                    ->whereColumn('et.inventory_id', 'i_id')->where('et.profile_id', $profile->profile_id)
                    ->where('et.direction', $direction)->where('et.status', 'sent');
            }))
            ->select('*')
            ->orderBy('date_added')->orderBy('i_id')
            ->limit($profile->batch_limit ?: 500)
            ->get();

        $fields = $profile->fields()->where('is_enabled', true)->pluck('source_column')->values()->all();
        return $query->map(function ($record) use ($profile, $direction, $fields, $now) {
            $transaction = EdiTransaction::firstOrCreate(
                ['profile_id' => $profile->profile_id, 'direction' => $direction, 'inventory_id' => $record->i_id],
                ['profile_version' => $profile->profile_version, 'status' => 'pending', 'eligible_at' => $now, 'snapshot' => array_merge((array) $record, ['_edi_fields' => $fields])]
            );
            if (! $transaction->snapshot) $transaction->update(['snapshot' => array_merge((array) $record, ['_edi_fields' => $fields])]);
            return $transaction->fresh();
        });
    }

    private function createMscArtifact(EdiProfile $profile, string $direction, $transactions, string $fileType, ?int $userId, bool $send, Carbon $now, bool $manual = false): array
    {
        $fingerprint = hash('sha256', implode('|', [$direction, strtolower($fileType), $transactions->pluck('inventory_id')->sort()->implode(',')]));
        $existing = EdiDeliveryLog::where('profile_id', $profile->profile_id)->where('direction', $direction)
            ->where('transaction_fingerprint', $fingerprint)->whereIn('status', ['generated', 'sending', 'sent'])
            ->whereNotNull('artifact_path')->latest('log_id')->first();
        if ($existing && Storage::disk('local')->exists($existing->artifact_path)) {
            if ($send && $existing->status !== 'sent') {
                $payload = Storage::disk('local')->get($existing->artifact_path);
                try {
                    $existing->update(['status' => 'sending', 'attempts' => $existing->attempts + 1]);
                    $delivery = app(EdiDeliveryService::class)->deliver($profile, $payload, $existing->filename, $existing->artifact_path);
                    $sentAt = Carbon::now($profile->timezone ?: 'Asia/Manila');
                    $existing->update(['status' => 'sent', 'sent_at' => $sentAt, 'response' => $delivery]);
                    if ($existing->transaction_ids) {
                        EdiTransaction::whereIn('transaction_id', $existing->transaction_ids)
                            ->update(['status' => 'sent', 'sent_at' => $sentAt, 'last_error' => null]);
                    }
                    $profile->update(['last_success_at' => $sentAt, 'last_error' => null]);
                } catch (\Throwable $exception) {
                    $existing->update(['status' => 'failed', 'error_message' => $exception->getMessage()]);
                    throw $exception;
                }
            }
            return ['log_id' => $existing->log_id, 'direction' => $direction, 'filename' => $existing->filename, 'transaction_count' => $existing->transaction_count, 'status' => $existing->status, 'warnings' => []];
        }

        $references = DB::transaction(function () use ($profile, $transactions) {
            $counter = DB::table('edi_interchange_counters')->where('client_id', 67)->lockForUpdate()->first();
            if (! $counter) {
                $next = 1;
                DB::table('edi_interchange_counters')->insert(['client_id' => 67, 'direction' => 'IN', 'next_number' => 2 + $transactions->count(), 'created_at' => now(), 'updated_at' => now()]);
            } else {
                $next = (int) $counter->next_number;
                DB::table('edi_interchange_counters')->where('id', $counter->id)->update(['next_number' => $next + 1 + $transactions->count(), 'updated_at' => now()]);
            }
            return ['REF'.str_pad((string) $next, 4, '0', STR_PAD_LEFT), collect(range($next + 1, $next + $transactions->count()))->map(fn ($number) => 'MSC'.str_pad((string) $number, 4, '0', STR_PAD_LEFT))->all()];
        });
        [$reference, $messageReferences] = $references;
        $filename = 'MSC'.($direction === 'IN' ? 'GIE' : 'GOE').$now->format('YmdHis').'.'.strtolower($fileType);
        $payload = $this->renderMsc($direction, $transactions, $reference, $messageReferences, $profile, $now);
        $path = 'edi/'.$now->format('Y/m/d').'/'.$filename;
        Storage::disk('local')->put($path, $payload);
        $log = EdiDeliveryLog::create([
            'profile_id' => $profile->profile_id, 'direction' => $direction, 'filename' => $filename,
            'profile_version' => $profile->profile_version, 'transaction_count' => $transactions->count(),
            'status' => 'generated', 'artifact_path' => $path, 'sha256' => hash('sha256', $payload),
            'transaction_fingerprint' => $fingerprint, 'generated_at' => $now, 'requested_by' => $userId,
            'transaction_ids' => $transactions->pluck('transaction_id')->values()->all(),
        ]);
        if (! $send) return ['log_id' => $log->log_id, 'direction' => $direction, 'filename' => $filename, 'transaction_count' => $transactions->count(), 'status' => 'generated', 'warnings' => []];

        try {
            $log->update(['status' => 'sending', 'attempts' => $log->attempts + 1]);
            $transactions->each(fn ($t) => $t->update(['status' => 'sending', 'attempts' => $t->attempts + 1]));
            $delivery = app(EdiDeliveryService::class)->deliver($profile, $payload, $filename, $path);
            $sentAt = Carbon::now($profile->timezone ?: 'Asia/Manila');
            $log->update(['status' => 'sent', 'sent_at' => $sentAt, 'response' => $delivery]);
            $transactions->each(fn ($t) => $t->update(['status' => 'sent', 'sent_at' => $sentAt, 'last_error' => null]));
            $profile->update(['last_success_at' => $sentAt, 'last_error' => null]);
            return ['log_id' => $log->log_id, 'direction' => $direction, 'filename' => $filename, 'record_count' => $transactions->count(), 'status' => 'sent', 'warnings' => []];
        } catch (\Throwable $exception) {
            $nextRetry = Carbon::now($profile->timezone ?: 'Asia/Manila')->addSeconds($profile->retry_delay_seconds ?: 120);
            $status = $log->attempts >= ($profile->max_attempts ?: 3) ? 'failed' : 'retry_pending';
            $log->update([
                'status' => $status,
                'error_message' => $exception->getMessage(),
                'next_retry_at' => $status === 'retry_pending' ? $nextRetry : null,
            ]);
            $transactions->each(fn ($t) => $t->update([
                'status' => $status,
                'last_error' => $exception->getMessage(),
                'next_retry_at' => $status === 'retry_pending' ? $nextRetry : null,
            ]));
            throw $exception;
        }
    }

    private function renderMsc(string $direction, $transactions, string $reference, array $messageReferences, EdiProfile $profile, Carbon $now): string
    {
        $eol = ($profile->line_ending ?: 'LF') === 'CRLF' ? "\r\n" : "\n";
        $segments = ['UNB+UNOA:2+FJPPHMNL+MSC+'.$now->format('ymd:Hi').'+'.$reference];
        foreach ($transactions->values() as $index => $transaction) {
            $s = (array) $transaction->snapshot;
            $message = $messageReferences[$index];
            $load = ((int) ($s['load_type'] ?? 0)) === 1 ? '4' : (((int) ($s['load_type'] ?? 0)) === 2 ? '5' : '');
            $date = $s['date_added'] ?? '';
            try { $date = Carbon::parse((string) $date, 'Asia/Manila')->format('YmdHi'); } catch (\Throwable) {}
            $segments = array_merge($segments, $direction === 'OUT' ? [
                'UNH+'.$message.'+CODECO:D:95B:UN:ITG13', 'BGM+36+'.$message.'+9', 'NAD+CF+MSC:160:166',
                'EQD+CN+'.($s['container_no'] ?? '').'+'.($s['iso_code'] ?? '').':102:5++2+'.$load,
                'RFF+BN:'.($s['booking'] ?? ''), 'TMD+3', 'DTM+7:'.$date.':203', 'LOC+165+PHMNL:139:6+MNL10:BER:ZZZ',
                'SEL+'.($s['seal_no'] ?? '').'+SH', 'TDT+20++1++'.($s['plate_no'] ?? '').':172+++'.($s['hauler'] ?? ''),
                'CNT+12:1', 'UNT+13+'.$message,
            ] : [
                'UNH+'.$message.'+CODECO:D:95B:UN:ITG13', 'BGM+34+'.$message.'+9', 'NAD+CF+MSC:160:166',
                'EQD+CN+'.($s['container_no'] ?? '').'+'.($s['iso_code'] ?? '').':102:5++3+'.$load,
                'DTM+7:'.$date.':203', 'LOC+165+PHMNL:139:6+MNL10:BER:ZZZ',
                'TDT+20++1++'.($s['plate_no'] ?? '').'+++'.($s['hauler'] ?? '').'::ZZZ',
                'IMD+B+38+'.($s['class'] ?? '').':ZZZ:ZZZ', 'FTX+QQD+'.($s['class'] ?? ''), 'CNT+16:1', 'UNT+10+'.$message,
            ]);
        }
        $segments[] = 'UNZ+'.$transactions->count().'+'.$reference;
        return implode("'".$eol, $segments)."'".$eol;
    }

    private function claimEligibleTransactions(EdiProfile $profile, EdiProfileDirection $direction, Carbon $now, array $filters = [], bool $includeSent = false, bool $ignoreBaseline = false): void
    {
        if (! $ignoreBaseline && ! $profile->enabled_at || ! in_array($direction->direction, $this->directionsFor($profile)->pluck('direction')->all(), true)) {
            return;
        }

        $inventoryTable = 'inventory';
        $directionValue = $direction->direction;
        $query = DB::table($inventoryTable)
            ->where('client_id', $profile->client_id)
            ->whereRaw('UPPER(gate_status) = ?', [$directionValue])
            ->when(! $ignoreBaseline, fn ($query) => $query->where('date_added', '>=', $profile->enabled_at))
            ->when(! empty($filters['start_date']), fn ($query) => $query->whereDate('date_added', '>=', $filters['start_date']))
            ->when(! empty($filters['end_date']), fn ($query) => $query->whereDate('date_added', '<=', $filters['end_date']))
            ->when(! empty($filters['start_time']) && ! empty($filters['end_time']), function ($query) use ($filters) {
                $start = $filters['start_time'];
                $end = $filters['end_time'];
                return $start <= $end
                    ? $query->whereTime('date_added', '>=', $start)->whereTime('date_added', '<=', $end)
                    : $query->where(function ($nested) use ($start, $end) {
                        $nested->whereTime('date_added', '>=', $start)->orWhereTime('date_added', '<=', $end);
                    });
            })
            ->when(! empty($filters['start_time']) && empty($filters['end_time']), fn ($query) => $query->whereTime('date_added', '>=', $filters['start_time']))
            ->when(empty($filters['start_time']) && ! empty($filters['end_time']), fn ($query) => $query->whereTime('date_added', '<=', $filters['end_time']))
            ->when(! $includeSent, function ($query) use ($profile, $directionValue) {
                $query->whereNotExists(function ($sub) use ($profile, $directionValue) {
                    $sub->select(DB::raw(1))->from('edi_transactions')
                        ->whereColumn('edi_transactions.inventory_id', 'i_id')
                        ->where('edi_transactions.profile_id', $profile->profile_id)
                        ->where('edi_transactions.direction', $directionValue)
                        ->where('edi_transactions.status', 'sent');
                });
            });

        $enabledFields = $profile->fields()->where('is_enabled', true)->pluck('source_column')->values()->all();
        $query->select('inventory.*')->orderBy('i_id')->limit($profile->batch_limit ?: 500)->get()->each(function ($record) use ($profile, $direction, $now, $enabledFields) {
            EdiTransaction::firstOrCreate(
                ['profile_id' => $profile->profile_id, 'direction' => $direction->direction, 'inventory_id' => $record->i_id],
                ['profile_version' => $profile->profile_version, 'status' => 'pending', 'eligible_at' => $now, 'snapshot' => array_merge((array) $record, [
                    '_edi_template' => $direction->sample_content,
                    '_edi_mappings' => $direction->mappings ?: [],
                    '_edi_fields' => $enabledFields,
                    '_edi_file_type' => $direction->file_type,
                    '_edi_structure_analysis' => $direction->structure_analysis ?: [],
                ])]
            );
        });
    }

    public function render(EdiProfileDirection $direction, $transactions): array
    {
        $warnings = [];
        $transactions = collect($transactions);
        if ($transactions->isEmpty()) return ['', []];

        $first = $transactions->first();
        $analysis = (array) data_get($first->snapshot, '_edi_structure_analysis', $direction->structure_analysis ?: []);
        $parts = (array) ($analysis['template_parts'] ?? []);
        $elementSeparator = (string) ($analysis['element_separator'] ?? '+');
        $segmentTerminator = (string) ($analysis['segment_terminator'] ?? "'");
        $lineEnding = (string) ($analysis['line_ending'] ?? "\r\n");
        $template = (string) data_get($first->snapshot, '_edi_template', $direction->sample_content ?: '');
        if ($template === '') throw new RuntimeException('A sample template is required for ' . $direction->direction . '.');

        // Legacy profiles may not have template_parts yet. They retain the
        // uploaded layout by deriving the same envelope/transaction split.
        if (empty($parts['transaction'])) {
            $parts = $this->deriveTemplateParts($template, $segmentTerminator);
            if (empty($parts['transaction'])) {
                return $this->renderLegacyTemplate($direction, $transactions, $warnings, $segmentTerminator, $lineEnding);
            }
        }

        $header = array_values(array_filter((array) ($parts['header'] ?? []), 'strlen'));
        $transactionTemplate = array_values(array_filter((array) ($parts['transaction'] ?? []), 'strlen'));
        $trailer = array_values(array_filter((array) ($parts['trailer'] ?? []), 'strlen'));
        $renderedTransactions = [];
        $baseReference = $this->messageReference($transactionTemplate, 'UNH', 1, $elementSeparator);

        foreach ($transactions->values() as $index => $transaction) {
            $snapshot = (array) $transaction->snapshot;
            $mappings = data_get($snapshot, '_edi_mappings', $direction->mappings ?: []);
            $enabledFields = data_get($snapshot, '_edi_fields', []);
            $segments = $transactionTemplate;
            foreach ($mappings as $mapping) {
                $token = (string) ($mapping['token'] ?? '');
                $source = (string) ($mapping['source_column'] ?? '');
                if ($token === '' || $source === '') continue;
                // Message/control references belong to the generated CODECO
                // envelope and must never be replaced with inventory data.
                if ($this->isGeneratedControlMapping($mapping)) continue;
                if ($enabledFields && ! in_array($source, $enabledFields, true)) continue;
                $value = data_get($snapshot, $source, '');
                if ($value === '' || $value === null) {
                    $warnings[] = 'Transaction '.$transaction->transaction_id.': '.$source.' is blank; mapped value left blank.';
                    $value = '';
                }
                $value = $this->formatMappedValue($source, $value, $analysis);
                foreach ($segments as $segmentIndex => $segment) {
                    $segments[$segmentIndex] = str_replace([$token, '{{'.$source.'}}', '[['.$source.']]'], (string) $value, $segment);
                }
            }

            if ($baseReference !== '') {
                $reference = $this->incrementReference($baseReference, (int) $index);
                foreach ($segments as $segmentIndex => $segment) {
                    $segments[$segmentIndex] = $this->replaceSegmentElement($segment, 'UNH', 1, $reference, $elementSeparator);
                    $segments[$segmentIndex] = $this->replaceSegmentElement($segments[$segmentIndex], 'BGM', 2, $reference, $elementSeparator);
                    $segments[$segmentIndex] = $this->replaceSegmentElement($segments[$segmentIndex], 'UNT', 2, $reference, $elementSeparator);
                }
            }
            foreach ($enabledFields as $source) {
                if (! collect($mappings)->contains(fn ($mapping) => ($mapping['source_column'] ?? null) === $source)) {
                    $warnings[] = 'Transaction '.$transaction->transaction_id.': '.$source.' is enabled but has no mapping in the '.$direction->direction.' template.';
                }
            }
            $renderedTransactions[] = implode($segmentTerminator.$lineEnding, $segments);
        }

        $trailer = array_map(function (string $segment) use ($elementSeparator, $transactions) {
            return $this->replaceSegmentElement($segment, 'UNZ', 1, (string) $transactions->count(), $elementSeparator);
        }, $trailer);
        $allSegments = array_merge($header, $renderedTransactions, $trailer);
        return [implode($segmentTerminator.$lineEnding, $allSegments).$lineEnding, array_values(array_unique($warnings))];
    }

    private function renderLegacyTemplate(EdiProfileDirection $direction, $transactions, array &$warnings, string $segmentTerminator, string $lineEnding): array
    {
        $messages = [];
        foreach ($transactions as $transaction) {
            $template = (string) data_get($transaction->snapshot, '_edi_template', $direction->sample_content ?: '');
            if ($template === '') {
                throw new RuntimeException('A sample template is required for ' . $direction->direction . '.');
            }
            $mappings = data_get($transaction->snapshot, '_edi_mappings', $direction->mappings ?: []);
            $enabledFields = data_get($transaction->snapshot, '_edi_fields', []);
            $message = $template;
            foreach ($mappings as $mapping) {
                $token = (string) ($mapping['token'] ?? '');
                $source = (string) ($mapping['source_column'] ?? '');
                if ($token === '' || $source === '') continue;
                if ($enabledFields && ! in_array($source, $enabledFields, true)) continue;
                $value = data_get($transaction->snapshot, $source, '');
                if ($value === '' || $value === null) {
                    $warnings[] = 'Transaction '.$transaction->transaction_id.': '.$source.' is blank; mapped value left blank.';
                }
                $message = str_replace([$token, '{{' . $source . '}}', '[[' . $source . ']]'], (string) $value, $message);
            }
            foreach ($enabledFields as $source) {
                if (! collect($mappings)->contains(fn ($mapping) => ($mapping['source_column'] ?? null) === $source)) {
                    $warnings[] = 'Transaction '.$transaction->transaction_id.': '.$source.' is enabled but has no mapping in the '.$direction->direction.' template.';
                }
            }
            $messages[] = trim($message, "\r\n");
        }

        return [implode($lineEnding, $messages) . $lineEnding, array_values(array_unique($warnings))];
    }

    private function formatMappedValue(string $source, mixed $value, array $analysis): string
    {
        if ($source !== 'date_added' || $value === '' || $value === null) return (string) $value;
        try {
            return Carbon::parse((string) $value, 'Asia/Manila')->format('YmdHi');
        } catch (\Throwable) {
            return (string) $value;
        }
    }

    private function messageReference(array $segments, string $tag, int $element, string $elementSeparator): string
    {
        foreach ($segments as $segment) {
            $parts = explode($elementSeparator, $segment);
            if (strtoupper((string) ($parts[0] ?? '')) === $tag) return (string) ($parts[$element] ?? '');
        }
        return '';
    }

    private function incrementReference(string $reference, int $offset): string
    {
        if (! preg_match('/^(.*?)(\d+)$/', $reference, $matches)) return $reference;
        $number = (string) ((int) $matches[2] + $offset);
        return $matches[1].str_pad($number, strlen($matches[2]), '0', STR_PAD_LEFT);
    }

    private function replaceSegmentElement(string $segment, string $tag, int $element, string $value, string $elementSeparator): string
    {
        $parts = explode($elementSeparator, $segment);
        if (strtoupper((string) ($parts[0] ?? '')) !== $tag) return $segment;
        while (count($parts) <= $element) $parts[] = '';
        $parts[$element] = $value;
        return implode($elementSeparator, $parts);
    }

    private function isGeneratedControlMapping(array $mapping): bool
    {
        return in_array(strtoupper((string) ($mapping['segment'] ?? '')), ['UNH', 'UNT'], true)
            && in_array((int) ($mapping['element'] ?? 0), [1, 2], true)
            || strtoupper((string) ($mapping['segment'] ?? '')) === 'BGM'
            && (int) ($mapping['element'] ?? 0) === 2;
    }

    private function deriveTemplateParts(string $template, string $segmentTerminator): array
    {
        $segments = array_values(array_filter(array_map(
            fn ($segment) => trim($segment, "\r\n \t"),
            preg_split('/'.preg_quote($segmentTerminator, '/').'\s*/', $template)
        )));
        $tags = array_map(fn ($segment) => strtoupper((string) strtok($segment, '+')), $segments);
        $messageStart = array_search('UNH', $tags, true);
        $messageEnd = false;
        if ($messageStart !== false) {
            for ($index = $messageStart + 1, $count = count($tags); $index < $count; $index++) {
                if ($tags[$index] === 'UNT') {
                    $messageEnd = $index;
                    break;
                }
            }
        }
        if ($messageStart === false || $messageEnd === false) return [];
        $trailerStart = $messageEnd + 1;
        while ($trailerStart < count($tags) && $tags[$trailerStart] !== 'UNZ') $trailerStart++;
        return [
            'header' => array_slice($segments, 0, $messageStart),
            'transaction' => array_slice($segments, $messageStart, $messageEnd - $messageStart + 1),
            'trailer' => $trailerStart < count($segments) ? array_slice($segments, $trailerStart) : [],
        ];
    }

    private function filename(EdiProfile $profile, string $direction, string $fileType, Carbon $now): string
    {
        $clientCode = strtoupper((string) optional($profile->client)->client_code);
        if ($clientCode === '') $clientCode = strtoupper((string) ($profile->legacy_key ?: 'CLIENT'));
        // Client codes are normalized so the direction marker is immediately
        // adjacent: CLIENTCODEGIE... or CLIENTCODEGOE....
        $clientCode = (string) preg_replace('/\s+/', '', $clientCode);
        return $clientCode . ($direction === 'IN' ? 'GIE' : 'GOE') . $now->format('YmdHis') . '.' . strtolower($fileType);
    }

    private function directionsFor(EdiProfile $profile)
    {
        if ((int) $profile->client_id === 67) {
            return collect(in_array($profile->direction_mode, ['IN', 'BOTH'], true) ? [new EdiProfileDirection(['direction' => 'IN', 'file_type' => 'EDI'])] : [])
                ->merge(in_array($profile->direction_mode, ['OUT', 'BOTH'], true) ? [new EdiProfileDirection(['direction' => 'OUT', 'file_type' => 'EDI'])] : []);
        }
        $directions = $profile->directions;
        if ($directions->isNotEmpty()) {
            return $directions->filter(fn ($direction) => $profile->direction_mode === 'BOTH' || $direction->direction === $profile->direction_mode)->values();
        }
        return collect(in_array($profile->direction_mode, ['IN', 'BOTH'], true) ? [new EdiProfileDirection(['direction' => 'IN'])] : [])
            ->merge(in_array($profile->direction_mode, ['OUT', 'BOTH'], true) ? [new EdiProfileDirection(['direction' => 'OUT'])] : []);
    }
}
