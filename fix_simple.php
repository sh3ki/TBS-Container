<?php

/**
 * SIMPLEST FIX: Just use the full table names directly
 * Laravel won't double-prefix if we give it the full name
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

// Replace to use full table names with prefix directly in the query
$replacements = [
    // Use the actual table names with prefix
    "DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))" => "DB::table('fjp_inventory as inv')",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c')" => "->leftJoin('fjp_clients as c'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st')" => "->leftJoin('fjp_container_size_type as st'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs')" => "->leftJoin('fjp_container_status as cs'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt')" => "->leftJoin('fjp_load_type as lt'",
    "->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'hold_containers` as hc')" => "->leftJoin('fjp_hold_containers as hc'",
    
    // Remove the unused $prefix variable lines
    "\$prefix = DB::getTablePrefix();\n        " => "",
];

foreach ($replacements as $search => $replace) {
    $content = str_replace($search, $replace, $content);
}

file_put_contents($file, $content);

echo "✓ Fixed! Now using full table names (fjp_inventory, fjp_clients, etc.)\n";
echo "Laravel will NOT add prefix since we're giving it the full name\n";
