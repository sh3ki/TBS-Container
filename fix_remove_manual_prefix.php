<?php

/**
 * FINAL FIX: Remove manually added fjp_ prefix
 * Laravel adds the prefix automatically to aliases
 * We should use: inv.i_id, c.client_name, st.size
 * NOT: fjp_inv.i_id, fjp_c.client_name, fjp_st.size
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

// Remove the manually added fjp_ prefix from all alias references
$replacements = [
    "'fjp_inv." => "'inv.",
    "'fjp_c." => "'c.",
    "'fjp_st." => "'st.",
    "'fjp_cs." => "'cs.",
    "'fjp_lt." => "'lt.",
    "'fjp_hc." => "'hc.",
    
    "DB::raw('fjp_inv." => "DB::raw('inv.",
    "DB::raw('fjp_c." => "DB::raw('c.",
    "DB::raw('fjp_st." => "DB::raw('st.",
    "DB::raw('fjp_cs." => "DB::raw('cs.",
    "DB::raw('fjp_lt." => "DB::raw('lt.",
    "DB::raw('fjp_hc." => "DB::raw('hc.",
    
    "(fjp_st.size" => "(st.size",
    "(fjp_st.type" => "(st.type",
    "DATE(fjp_inv." => "DATE(inv.",
    "TIME(fjp_inv." => "TIME(inv.",
    "CONCAT(fjp_st." => "CONCAT(st.",
    ", fjp_st.type)" => ", st.type)",
    
    // Fix join conditions
    "', 'fjp_inv.client_id', '=', 'fjp_c.c_id'" => "', 'inv.client_id', '=', 'c.c_id'",
    "', 'fjp_inv.size_type', '=', 'fjp_st.s_id'" => "', 'inv.size_type', '=', 'st.s_id'",
    "', 'fjp_inv.container_status', '=', 'fjp_cs.s_id'" => "', 'inv.container_status', '=', 'cs.s_id'",
    "', 'fjp_inv.load_type', '=', 'fjp_lt.l_id'" => "', 'inv.load_type', '=', 'lt.l_id'",
    "', 'fjp_hc.container_no', '=', 'fjp_inv.container_no'" => "', 'hc.container_no', '=', 'inv.container_no'",
];

foreach ($replacements as $search => $replace) {
    $content = str_replace($search, $replace, $content);
}

file_put_contents($file, $content);

echo "✓ Removed manually added fjp_ prefix from all alias references\n";
echo "Now using: inv.i_id, c.client_name, st.size (Laravel adds fjp_ automatically)\n";
