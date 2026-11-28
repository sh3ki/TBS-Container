<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\QueryException;

class DatabaseController extends Controller
{
    private function access(): array
    {
        $user = Auth::user();
        $page = DB::table('pages')->where('page', 'database')->first('p_id');
        $row = $page ? DB::table('pages_access')
            ->where(['page_id' => $page->p_id, 'privilege' => $user?->priv_id])
            ->first(['acs_edit', 'acs_delete']) : null;

        return [
            'can_view' => $row !== null,
            'acs_edit' => (int) ($row->acs_edit ?? 0),
            'acs_delete' => (int) ($row->acs_delete ?? 0),
        ];
    }

    private function tableName(string $table): string
    {
        abort_unless((bool) preg_match('/^[A-Za-z0-9_]+$/', $table), 422, 'Invalid table name.');
        abort_unless(in_array($table, $this->availableTables(), true), 404, 'Table not found.');
        return $table;
    }

    private function availableTables(): array
    {
        $prefix = (string) DB::getTablePrefix();
        $key = 'Tables_in_' . DB::getDatabaseName();
        return collect(DB::select('SHOW TABLES'))
            ->map(fn ($row) => (string) (array_values((array) $row)[0] ?? ''))
            ->filter(fn (string $name) => $name !== '' && ($prefix === '' || str_starts_with($name, $prefix)))
            ->map(fn (string $name) => $prefix !== '' ? substr($name, strlen($prefix)) : $name)
            ->filter(fn (string $name) => !in_array($name, ['migrations'], true))
            ->values()->all();
    }

    private function primaryKey(string $table): ?string
    {
        $key = DB::select("SHOW KEYS FROM `" . $this->qualified($table) . "` WHERE Key_name = 'PRIMARY'");
        return isset($key[0]) ? (string) ($key[0]->Column_name ?? null) : null;
    }

    private function columnDetails(string $table, array $columns): array
    {
        return collect(DB::select('SHOW FULL COLUMNS FROM `' . $this->qualified($table) . '`'))
            ->filter(fn ($column) => in_array((string) $column->Field, $columns, true))
            ->mapWithKeys(function ($column): array {
                $type = (string) $column->Type;
                $enumOptions = [];
                if (preg_match('/^enum\((.*)\)$/i', $type, $match)) {
                    $enumOptions = str_getcsv($match[1], ',', "'");
                }

                return [(string) $column->Field => [
                    'type' => strtolower($type),
                    'nullable' => (string) $column->Null === 'YES',
                    'default' => $column->Default,
                    'extra' => (string) ($column->Extra ?? ''),
                    'enum_options' => $enumOptions,
                ]];
            })->all();
    }

    private function qualified(string $table): string
    {
        return str_replace('`', '``', DB::getTablePrefix() . $table);
    }

    public function tables(): \Illuminate\Http\JsonResponse
    {
        $access = $this->access();
        abort_unless($access['can_view'], 403);

        return response()->json(['success' => true, 'data' => collect($this->availableTables())->map(fn ($name) => [
            'name' => $name,
            'label' => str($name)->replace('_', ' ')->title()->toString(),
            'rows' => DB::table($name)->count(),
        ])->values(), 'access' => $access]);
    }

    public function rows(Request $request): \Illuminate\Http\JsonResponse
    {
        $access = $this->access();
        abort_unless($access['can_view'], 403);
        $table = $this->tableName((string) $request->query('table', ''));
        $columns = Schema::getColumnListing($table);
        $primaryKey = $this->primaryKey($table);
        $perPage = min(max((int) $request->query('per_page', 25), 5), 100);
        $requestedSort = (string) $request->query('sort', '');
        $sort = (bool) preg_match('/^[A-Za-z0-9_]+$/', $requestedSort) && in_array($requestedSort, $columns, true)
            ? $requestedSort
            : ($primaryKey ?: ($columns[0] ?? ''));
        abort_unless($sort !== '' && in_array($sort, $columns, true), 422, 'This table has no sortable columns.');
        $direction = strtolower((string) $request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query = DB::table($table);
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(function ($nested) use ($columns, $search): void {
                foreach ($columns as $column) $nested->orWhere($column, 'like', '%' . $search . '%');
            });
        }
        $filters = json_decode((string) $request->query('filters', '{}'), true);
        foreach (is_array($filters) ? $filters : [] as $column => $value) {
            if (in_array($column, $columns, true) && trim((string) $value) !== '') $query->where($column, 'like', '%' . trim((string) $value) . '%');
        }

        $result = $query->orderBy($sort, $direction)->paginate($perPage)->withQueryString();
        return response()->json([
            'success' => true,
            'data' => collect($result->items())->map(fn ($row) => (array) $row)->values(),
            'columns' => $columns,
            'column_details' => $this->columnDetails($table, $columns),
            'primary_key' => $primaryKey,
            'pagination' => [
                'current_page' => $result->currentPage(), 'last_page' => $result->lastPage(),
                'per_page' => $result->perPage(), 'total' => $result->total(),
            ],
            'access' => $access,
        ]);
    }

    public function update(Request $request, AuditService $audit): \Illuminate\Http\JsonResponse
    {
        $access = $this->access(); abort_unless($access['acs_edit'] > 0, 403);
        $table = $this->tableName((string) $request->input('table', ''));
        $primaryKey = $this->primaryKey($table); abort_unless($primaryKey, 422, 'This table has no primary key and cannot be edited safely.');
        $id = $request->input('id'); $values = $request->input('values');
        abort_unless(is_array($values) && $id !== null, 422, 'Invalid row data.');
        $columns = Schema::getColumnListing($table);
        $values = collect($values)->filter(fn ($value, $column) => $column !== $primaryKey && in_array($column, $columns, true))->all();
        abort_unless(count($values) > 0, 422, 'No editable values supplied.');
        $query = DB::table($table)->where($primaryKey, $id);
        abort_unless($query->exists(), 404, 'Record not found.');
        try {
            $query->update($values);
        } catch (QueryException $exception) {
            if ((string) $exception->getCode() === '23000') {
                return response()->json(['success' => false, 'message' => 'Record could not be updated because it violates a database constraint. Check required and foreign-key values.'], 409);
            }
            throw $exception;
        }
        $audit->logCustom('UPDATE', "Updated record {$id} in database table {$table}", 'DATABASE');
        return response()->json(['success' => true, 'message' => 'Record updated successfully.']);
    }

    public function store(Request $request, AuditService $audit): \Illuminate\Http\JsonResponse
    {
        $access = $this->access(); abort_unless($access['acs_edit'] > 0, 403);
        $table = $this->tableName((string) $request->input('table', ''));
        $values = $request->input('values'); abort_unless(is_array($values), 422, 'Invalid record data.');
        $columns = Schema::getColumnListing($table);
        $details = $this->columnDetails($table, $columns);
        $values = collect($values)->filter(function ($value, $column) use ($columns, $details): bool {
            if (!in_array($column, $columns, true)) return false;
            $extra = (string) ($details[$column]['extra'] ?? '');
            return !str_contains($extra, 'auto_increment') && !str_contains($extra, 'generated');
        })->map(function ($value, $column) use ($details) {
            return $value === '' && ($details[$column]['nullable'] ?? false) ? null : $value;
        })->all();
        abort_unless(count($values) > 0, 422, 'No record values supplied.');

        try {
            DB::table($table)->insert($values);
        } catch (QueryException $exception) {
            if ((string) $exception->getCode() === '23000') {
                return response()->json(['success' => false, 'message' => 'Record could not be added because it violates a database constraint. Check required and foreign-key values.'], 409);
            }
            throw $exception;
        }

        $audit->logCustom('CREATE', "Added record to database table {$table}", 'DATABASE');
        return response()->json(['success' => true, 'message' => 'Record added successfully.']);
    }

    public function destroy(Request $request, AuditService $audit): \Illuminate\Http\JsonResponse
    {
        $access = $this->access(); abort_unless($access['acs_delete'] > 0, 403);
        $table = $this->tableName((string) $request->input('table', ''));
        $primaryKey = $this->primaryKey($table); abort_unless($primaryKey, 422, 'This table has no primary key and cannot be deleted safely.');
        $ids = $request->input('ids'); $ids = is_array($ids) ? array_values(array_filter($ids, fn ($id) => $id !== null && $id !== '')) : [];
        abort_unless(count($ids) > 0, 422, 'No records selected.');
        try {
            $deleted = DB::table($table)->whereIn($primaryKey, $ids)->delete();
        } catch (QueryException $exception) {
            if ((string) $exception->getCode() === '23000') {
                return response()->json(['success' => false, 'message' => 'Record cannot be deleted because it is referenced by another table.'], 409);
            }
            throw $exception;
        }
        $audit->logCustom('DELETE', "Deleted {$deleted} record(s) from database table {$table}", 'DATABASE');
        return response()->json(['success' => true, 'message' => "{$deleted} record(s) deleted."]);
    }
}
