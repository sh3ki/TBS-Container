<?php

/**
 * Fix ReportsController to use prefixed aliases like fjp_inv, fjp_c, etc.
 * Since Laravel adds prefix to BOTH table and alias, we need to use prefixed aliases in queries
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

// Get prefix variable
$prefix = 'fjp_';

// Replace all column references to use prefixed aliases
$replacements = [
    // Table alias references
    "'inv." => "'{$prefix}inv.",
    "'c." => "'{$prefix}c.",
    "'st." => "'{$prefix}st.",
    "'cs." => "'{$prefix}cs.",
    "'lt." => "'{$prefix}lt.",
    "'hc." => "'{$prefix}hc.",
    
    // In DB::raw() calls
    "DB::raw('inv." => "DB::raw('{$prefix}inv.",
    "DB::raw('c." => "DB::raw('{$prefix}c.",
    "DB::raw('st." => "DB::raw('{$prefix}st.",
    "DB::raw('cs." => "DB::raw('{$prefix}cs.",
    "DB::raw('lt." => "DB::raw('{$prefix}lt.",
    "DB::raw('hc." => "DB::raw('{$prefix}hc.",
    
    // In CONCAT and other functions
    "(st.size" => "({$prefix}st.size",
    "(st.type" => "({$prefix}st.type",
    
    // In leftJoin ON clauses - these need to be wrapped in quotes
    "', 'inv.client_id', '=', 'c.c_id'" => "', '{$prefix}inv.client_id', '=', '{$prefix}c.c_id'",
    "', 'inv.size_type', '=', 'st.s_id'" => "', '{$prefix}inv.size_type', '=', '{$prefix}st.s_id'",
    "', 'inv.container_status', '=', 'cs.s_id'" => "', '{$prefix}inv.container_status', '=', '{$prefix}cs.s_id'",
    "', 'inv.load_type', '=', 'lt.l_id'" => "', '{$prefix}inv.load_type', '=', '{$prefix}lt.l_id'",
    "', 'hc.container_no', '=', 'inv.container_no'" => "', '{$prefix}hc.container_no', '=', '{$prefix}inv.container_no'",
];

foreach ($replacements as $search => $replace) {
    $content = str_replace($search, $replace, $content);
}

// Special case: Fix DATE() and TIME() functions
$content = str_replace("DATE(inv.date_added)", "DATE({$prefix}inv.date_added)", $content);
$content = str_replace("TIME(inv.date_added)", "TIME({$prefix}inv.date_added)", $content);
$content = str_replace("DATE(inv.approval_date)", "DATE({$prefix}inv.approval_date)", $content);
$content = str_replace("TIME(inv.approval_date)", "TIME({$prefix}inv.approval_date)", $content);

// Fix CONCAT function
$content = str_replace("CONCAT(st.size", "CONCAT({$prefix}st.size", $content);
$content = str_replace(", st.type)", ", {$prefix}st.type)", $content);

file_put_contents($file, $content);

echo "✓ Fixed all column references to use prefixed aliases (fjp_inv, fjp_c, etc.)\n";
echo "Laravel adds prefix to both table names AND aliases\n";
echo "Now using: fjp_inv.i_id, fjp_c.client_name, fjp_st.size, etc.\n";
