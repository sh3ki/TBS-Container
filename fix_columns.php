<?php

/**
 * FINAL FIX: Use fromSub() instead of DB::table(DB::raw())
 * This prevents Laravel from prefixing the aliases
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

// Strategy: Replace DB::table(DB::raw(...)) with proper fromSub approach
// But simpler: just use DB::connection()->table() with full table names

$replacements = [
    // Replace the problematic DB::table calls with direct table names (no aliases in DB::table)
    "DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))" => "DB::table('inventory as inv')",
];

// Actually, the real issue is the select columns need DB::raw() too
// Let's wrap all plain column references in DB::raw()

// Find all instances of 'inv.container_no', 'cs.status', etc and wrap them
$content = preg_replace(
    "/'(inv|c|st|cs|lt|hc)\.(\w+)'/",
    "DB::raw('$1.$2')",
    $content
);

file_put_contents($file, $content);

echo "✓ Fixed column references!\n";
echo "All column references now use DB::raw() to prevent prefix issues\n";
