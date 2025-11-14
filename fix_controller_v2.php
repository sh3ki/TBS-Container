<?php

/**
 * Fix ReportsController to add DB::getTablePrefix() to existing queries
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

// Replace DB::table() and leftJoin() calls to use prefix
$replacements = [
    // Fix DB::table calls
    "DB::table('inventory as inv')" => "DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))",
    "DB::table('clients as c')" => "DB::table(DB::raw('`' . DB::getTablePrefix() . 'clients` as c'))",
    
    // Fix leftJoin calls
    "->leftJoin('clients as c'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c')",
    "->leftJoin('container_size_type as st'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st')",
    "->leftJoin('container_status as cs'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs')",
    "->leftJoin('load_type as lt'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt')",
    "->leftJoin('hold_containers as hc'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'hold_containers` as hc')",
];

$original = $content;
foreach ($replacements as $search => $replace) {
    $content = str_replace($search, $replace, $content);
}

if ($content === $original) {
    echo "⚠ WARNING: No changes made. File may already be correct or patterns don't match.\n";
    echo "Please check the file manually.\n";
} else {
    file_put_contents($file, $content);
    echo "✓ ReportsController fixed successfully!\n";
    echo "Changes applied:\n";
    echo "- Added DB::getTablePrefix() to all table references with aliases\n";
    echo "- Queries now properly use DB_PREFIX configuration\n";
}
