<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== Testing Query Generation ===\n\n";

// Enable query logging
DB::connection()->enableQueryLog();

// Build the same query as incomingReport
$query = DB::table('inventory as inv')
    ->leftJoin('clients as c', 'inv.client_id', '=', 'c.c_id')
    ->leftJoin('container_size_type as st', 'inv.size_type', '=', 'st.s_id')
    ->whereBetween('inv.date_added', ['2025-11-01 00:00:00', '2025-11-12 23:59:59'])
    ->where('inv.gate_status', 'IN')
    ->select(
        DB::raw('inv.i_id as eir_no'),
        'inv.container_no',
        'cs.status'
    );

// Get the SQL without executing
$sql = $query->toSql();
$bindings = $query->getBindings();

echo "Generated SQL:\n";
echo $sql . "\n\n";

echo "Bindings:\n";
print_r($bindings);

echo "\nDB Prefix: " . DB::getTablePrefix() . "\n";
echo "Connection: " . DB::connection()->getName() . "\n";
