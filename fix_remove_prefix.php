<?php

/**
 * CORRECT FIX: Remove fjp_ prefix from table names
 * Let Laravel add it automatically via DB_PREFIX configuration
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

// Remove fjp_ prefix from ALL table names since Laravel adds it automatically
$replacements = [
    "'fjp_inventory as inv'" => "'inventory as inv'",
    "'fjp_clients as c'" => "'clients as c'",
    "'fjp_container_size_type as st'" => "'container_size_type as st'",
    "'fjp_container_status as cs'" => "'container_status as cs'",
    "'fjp_load_type as lt'" => "'load_type as lt'",
    "'fjp_hold_containers as hc'" => "'hold_containers as hc'",
];

foreach ($replacements as $search => $replace) {
    $content = str_replace($search, $replace, $content);
}

file_put_contents($file, $content);

echo "✓ Removed fjp_ prefix from all table names\n";
echo "Laravel will automatically add the prefix from DB_PREFIX=fjp_\n";
