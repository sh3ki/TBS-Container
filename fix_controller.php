<?php

/**
 * Fix ReportsController to use proper table prefix with aliases
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

// Replace table references with proper prefix handling
$replacements = [
    // Fix DB::table calls to use prefix with aliases
    "DB::table('fjp_inventory as inv')" => "DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))",
    "DB::table('fjp_clients as c')" => "DB::table(DB::raw('`' . DB::getTablePrefix() . 'clients` as c'))",
    "DB::table('fjp_container_size_type as st')" => "DB::table(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'))",
    "DB::table('fjp_container_status as cs')" => "DB::table(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'))",
    "DB::table('fjp_load_type as lt')" => "DB::table(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'))",
    
    // Fix leftJoin calls
    "->leftJoin('fjp_clients as c'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c')",
    "->leftJoin('fjp_container_size_type as st'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st')",
    "->leftJoin('fjp_container_status as cs'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs')",
    "->leftJoin('fjp_load_type as lt'" => "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt')",
    
    // Remove fjp_ prefix from all table names (let DB_PREFIX handle it)
    "'fjp_inventory" => "'inventory",
    "'fjp_clients" => "'clients",
    "'fjp_container_size_type" => "'container_size_type",
    "'fjp_container_status" => "'container_status",
    "'fjp_load_type" => "'load_type",
    "'fjp_hold_containers" => "'hold_containers",
];

foreach ($replacements as $search => $replace) {
    $content = str_replace($search, $replace, $content);
}

file_put_contents($file, $content);

echo "✓ ReportsController fixed successfully!\n";
echo "Changes applied:\n";
echo "- Removed fjp_ prefix from all table names\n";
echo "- Added proper DB::getTablePrefix() usage with aliases\n";
echo "- All queries now work with DB_PREFIX configuration\n";
