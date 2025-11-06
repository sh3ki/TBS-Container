<?php
// Clear OPcache
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "OPcache cleared successfully!<br>";
} else {
    echo "OPcache is not enabled<br>";
}

// Also clear realpath cache
clearstatcache(true);
echo "Realpath cache cleared<br>";

echo "<br>Now refresh the inventory page: <a href='/inventory'>Go to Inventory</a>";
