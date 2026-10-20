<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SyncController extends Controller
{
    /** @var array<int, string> */
    public const TABLES = [
        'ban_containers', 'bookings', 'clients', 'client_reg_hours',
        'container_size_type', 'container_status', 'handling_rate',
        'hold_containers', 'inventory', 'load_type', 'pages', 'pages_access',
        'pre_inventory', 'storage_rate', 'users',
    ];

    public function bootstrap(Request $request)
    {
        $this->authorizeSync($request, 'sync:read');

        return response()->json([
            'success' => true,
            'server_cursor' => (int) DB::table('sync_events')->max('id'),
            'tables' => $this->tableSummaries(),
        ]);
    }

    public function changes(Request $request)
    {
        $this->authorizeSync($request, 'sync:read');

        $after = max(0, (int) $request->query('after', 0));
        $limit = min(1000, max(1, (int) $request->query('limit', 500)));
        $events = DB::table('sync_events')
            ->where('id', '>', $after)
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $items = $events->map(fn ($event) => [
            'event_id' => (int) $event->id,
            'table' => $event->source_table,
            'operation' => $event->operation,
            'primary_key' => json_decode($event->primary_key, true),
            'row_data' => $event->row_data === null ? null : json_decode($event->row_data, true),
            'row_hash' => $event->row_hash,
            'occurred_at' => $event->occurred_at,
        ])->values();

        $last = $items->last();
        $nextCursor = $last['event_id'] ?? $after;

        return response()->json([
            'success' => true,
            'events' => $items,
            'next_cursor' => $nextCursor,
            'server_cursor' => (int) DB::table('sync_events')->max('id'),
            'has_more' => DB::table('sync_events')->where('id', '>', $nextCursor)->exists(),
        ]);
    }

    public function report(Request $request)
    {
        $this->authorizeSync($request, 'sync:report');
        $data = $request->validate([
            'cursor' => ['required', 'integer', 'min:0'],
            'discrepancies' => ['array'],
            'discrepancies.*.table' => ['required', 'string'],
            'discrepancies.*.message' => ['required', 'string'],
        ]);

        foreach ($data['discrepancies'] ?? [] as $item) {
            logger()->warning('Legacy synchronization discrepancy', [
                'cursor' => $data['cursor'],
                'table' => $item['table'],
                'message' => $item['message'],
            ]);
        }

        return response()->json(['success' => true]);
    }

    private function authorizeSync(Request $request, string $ability): void
    {
        abort_unless($request->user()?->currentAccessToken()?->can($ability), 403, 'Synchronization token is missing the required ability.');
    }

    private function tableSummaries(): array
    {
        $connection = DB::connection();
        $database = $connection->getDatabaseName();
        $prefix = $connection->getTablePrefix();
        $result = [];

        foreach (self::TABLES as $table) {
            $physical = $prefix . $table;
            $columns = collect(DB::select(
                'SELECT column_name, data_type, is_nullable, column_type, ordinal_position FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position',
                [$database, $physical]
            ));
            $keys = collect(DB::select(
                'SELECT column_name FROM information_schema.key_column_usage WHERE table_schema = ? AND table_name = ? AND constraint_name = ? ORDER BY ordinal_position',
                [$database, $physical, 'PRIMARY']
            ))->pluck('column_name')->values();
            $columnNames = $columns->pluck('column_name')->all();

            $result[$table] = [
                'columns' => $columns,
                'primary_key' => $keys,
                'count' => (int) DB::table($table)->count(),
                'record_hash' => $this->recordFingerprint($table, $columnNames, $keys->all()),
            ];
        }

        return $result;
    }

    private function recordFingerprint(string $table, array $columns, array $primaryKeys): string
    {
        $hash = hash_init('sha256');
        $query = DB::table($table)->select($columns);
        foreach ($primaryKeys as $key) {
            $query->orderBy($key);
        }

        foreach ($query->cursor() as $row) {
            $values = [];
            foreach ($columns as $column) {
                $values[$column] = $this->fingerprintValue($row->{$column});
            }
            hash_update($hash, json_encode($values, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE) . "\n");
        }

        return hash_final($hash);
    }

    private function fingerprintValue(mixed $value): mixed
    {
        return $value === null || is_array($value) || is_object($value) ? $value : (string) $value;
    }
}
