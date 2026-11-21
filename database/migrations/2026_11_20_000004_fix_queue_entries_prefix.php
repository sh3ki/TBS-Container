<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $prefix = DB::getTablePrefix();
        $correct = $prefix . 'queue_entries';
        $duplicate = $prefix . $prefix . 'queue_entries';
        $tables = DB::select('SHOW TABLES');
        $names = array_map(static fn ($row) => (string) array_values((array) $row)[0], $tables);

        if (in_array($duplicate, $names, true) && !in_array($correct, $names, true)) {
            $quote = static fn (string $name): string => '`' . str_replace('`', '``', $name) . '`';
            DB::statement('RENAME TABLE ' . $quote($duplicate) . ' TO ' . $quote($correct));
        }
    }

    public function down(): void
    {
        // The corrected table name is retained when rolling back later migrations.
    }
};
