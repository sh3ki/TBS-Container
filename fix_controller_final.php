<?php

/**
 * Fix ALL DB::table() calls in ReportsController to use proper prefix with DB::raw()
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

// Count occurrences before
$before_count = substr_count($content, "DB::table('inventory as inv')");

echo "Found {$before_count} occurrences to fix...\n";

// Replace all DB::table() and leftJoin() calls
$content = str_replace(
    "DB::table('inventory as inv')",
    "DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))",
    $content
);

$content = str_replace(
    "->leftJoin('clients as c'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c')",
    $content
);

$content = str_replace(
    "->leftJoin('container_size_type as st'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st')",
    $content
);

$content = str_replace(
    "->leftJoin('container_status as cs'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs')",
    $content
);

$content = str_replace(
    "->leftJoin('load_type as lt'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt')",
    $content
);

$content = str_replace(
    "->leftJoin('hold_containers as hc'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'hold_containers` as hc')",
    $content
);

// Also need to add $prefix variable before each query
// This is more complex, so we'll do it with a pattern
$content = preg_replace(
    '/(\$clientId = \$request->client_id;\n\n        )(\$query = DB::table\(DB::raw)/',
    '$1$prefix = DB::getTablePrefix();' . "\n        " . '$2',
    $content
);

$content = preg_replace(
    '/(\$date = \$request->date;\n        \$clientId = \$request->client_id;\n\n        )(\$query = DB::table\(DB::raw)/',
    '$1$prefix = DB::getTablePrefix();' . "\n        " . '$2',
    $content
);

$content = preg_replace(
    '/(\$date = \$request->date;\n\n        )(\$data = DB::table\(DB::raw)/',
    '$1$prefix = DB::getTablePrefix();' . "\n        " . '$2',
    $content
);

// Write back
file_put_contents($file, $content);

// Count after
$after_content = file_get_contents($file);
$after_count = substr_count($after_content, "DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv')");

echo "✓ Fixed successfully!\n";
echo "  - Updated {$after_count} DB::table() calls\n";
echo "  - Updated all leftJoin() calls to use DB::raw()\n";
echo "  - Added \$prefix = DB::getTablePrefix(); where needed\n";
