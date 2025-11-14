<?php

/**
 * CRITICAL FIX: DB::raw() does NOT get prefixed by Laravel!
 * We need to manually add prefix ONLY inside DB::raw() statements
 */

$file = 'app/Http/Controllers/Api/ReportsController.php';
$content = file_get_contents($file);

$prefix = 'fjp_';

// Fix ONLY the DB::raw() statements to use prefixed aliases
$replacements = [
    "DB::raw('inv." => "DB::raw('{$prefix}inv.",
    "DB::raw('c." => "DB::raw('{$prefix}c.",
    "DB::raw('st." => "DB::raw('{$prefix}st.",
    "DB::raw('cs." => "DB::raw('{$prefix}cs.",
    "DB::raw('lt." => "DB::raw('{$prefix}lt.",
    "DB::raw('hc." => "DB::raw('{$prefix}hc.",
    
    // Fix inside CONCAT, DATE, TIME functions within DB::raw
    "(inv." => "({$prefix}inv.",
    "DATE(inv." => "DATE({$prefix}inv.",
    "TIME(inv." => "TIME({$prefix}inv.",
    "CONCAT(st." => "CONCAT({$prefix}st.",
    ", st.type)" => ", {$prefix}st.type)",
    "st.size, \"/\", st.type)" => "{$prefix}st.size, '/', {$prefix}st.type)",
];

foreach ($replacements as $search => $replace) {
    $content = str_replace($search, $replace, $content);
}

file_put_contents($file, $content);

echo "✓ Fixed DB::raw() statements to use prefixed aliases\n";
echo "Inside DB::raw(): fjp_inv.i_id, fjp_st.size, etc.\n";
echo "Outside DB::raw(): inv.client_id, st.s_id, etc. (Laravel adds prefix)\n";
