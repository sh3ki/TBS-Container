<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<int, string> */
    private array $tables = [
        'ban_containers', 'bookings', 'clients', 'client_reg_hours',
        'container_size_type', 'container_status', 'handling_rate',
        'hold_containers', 'inventory', 'load_type', 'pages', 'pages_access',
        'pre_inventory', 'storage_rate', 'users',
    ];

    public function up(): void
    {
        // MySQL DDL is not transactional. If a previous deployment failed after
        // creating this table, keep the empty table and finish the trigger setup.
        if (!Schema::hasTable('sync_events')) {
            Schema::create('sync_events', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('source_table', 64);
                $table->string('operation', 12);
                $table->json('primary_key');
                $table->json('row_data')->nullable();
                $table->char('row_hash', 64)->nullable();
                $table->timestamp('occurred_at')->useCurrent();
                $table->index(['source_table', 'id']);
            });
        }

        $connection = DB::connection();
        $database = $connection->getDatabaseName();
        $prefix = $connection->getTablePrefix();
        $eventTable = $this->quoteIdentifier($prefix . 'sync_events');

        foreach ($this->tables as $logicalTable) {
            $physicalTable = $prefix . $logicalTable;
            $columns = array_map(
                fn ($row) => $this->metadataValue($row, 'column_name'),
                $connection->select(
                    'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position',
                    [$database, $physicalTable]
                )
            );

            $primaryKeys = array_map(
                fn ($row) => $this->metadataValue($row, 'column_name'),
                $connection->select(
                    'SELECT column_name FROM information_schema.key_column_usage WHERE table_schema = ? AND table_name = ? AND constraint_name = ? ORDER BY ordinal_position',
                    [$database, $physicalTable, 'PRIMARY']
                )
            );

            if (!$columns || !$primaryKeys) {
                throw new RuntimeException("Cannot create sync trigger for {$physicalTable}: missing table or primary key.");
            }

            $this->createTrigger($prefix . 'sync_ai_' . $logicalTable, $physicalTable, 'INSERT', 'NEW', $logicalTable, $columns, $primaryKeys, $eventTable);
            $this->createTrigger($prefix . 'sync_au_' . $logicalTable, $physicalTable, 'UPDATE', 'NEW', $logicalTable, $columns, $primaryKeys, $eventTable);
            $this->createTrigger($prefix . 'sync_ad_' . $logicalTable, $physicalTable, 'DELETE', 'OLD', $logicalTable, $columns, $primaryKeys, $eventTable);
        }
    }

    public function down(): void
    {
        $connection = DB::connection();
        $prefix = $connection->getTablePrefix();

        foreach ($this->tables as $logicalTable) {
            foreach (['ai', 'au', 'ad'] as $suffix) {
                DB::unprepared('DROP TRIGGER IF EXISTS ' . $this->quoteIdentifier($prefix . 'sync_' . $suffix . '_' . $logicalTable));
            }
        }

        Schema::dropIfExists('sync_events');
    }

    private function createTrigger(string $name, string $table, string $event, string $recordAlias, string $logicalTable, array $columns, array $primaryKeys, string $eventTable): void
    {
        $rowExpression = $this->jsonObject($columns, $recordAlias);
        $keyExpression = $this->jsonObject($primaryKeys, $recordAlias);
        $sql = sprintf(
            'CREATE TRIGGER %s AFTER %s ON %s FOR EACH ROW INSERT INTO %s (source_table, operation, primary_key, row_data, row_hash, occurred_at) VALUES (%s, %s, %s, %s, SHA2(CAST(%s AS CHAR), 256), CURRENT_TIMESTAMP)',
            $this->quoteIdentifier($name),
            $event,
            $this->quoteIdentifier($table),
            $eventTable,
            DB::getPdo()->quote($logicalTable),
            DB::getPdo()->quote(strtolower($event)),
            $keyExpression,
            $rowExpression,
            $rowExpression,
        );

        DB::unprepared('DROP TRIGGER IF EXISTS ' . $this->quoteIdentifier($name));
        DB::unprepared($sql);
    }

    private function jsonObject(array $columns, string $recordAlias): string
    {
        $parts = [];
        foreach ($columns as $column) {
            $parts[] = DB::getPdo()->quote($column);
            $parts[] = $recordAlias . '.' . $this->quoteIdentifier($column);
        }

        return 'JSON_OBJECT(' . implode(', ', $parts) . ')';
    }

    private function quoteIdentifier(string $identifier): string
    {
        return '`' . str_replace('`', '``', $identifier) . '`';
    }

    private function metadataValue(object $row, string $name): string
    {
        $values = array_change_key_case((array) $row, CASE_LOWER);
        return (string) ($values[strtolower($name)] ?? '');
    }
};
