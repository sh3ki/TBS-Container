<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== Testing AuditLogs Query (WORKING) ===\n\n";

// Same pattern as AuditLogsController
$query = DB::table('audit_logs as a')
    ->select('a.*', 'u.username')
    ->leftJoin('users as u', 'a.user_id', '=', 'u.u_id');

$sql = $query->toSql();

echo "Generated SQL:\n";
echo $sql . "\n\n";
