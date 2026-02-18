#!/usr/bin/env bash
set -euo pipefail

mysql -u root -e "DROP DATABASE IF EXISTS fjpwl_sys_db;"
mysql -u root -e "CREATE DATABASE fjpwl_sys_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -e "GRANT ALL PRIVILEGES ON fjpwl_sys_db.* TO \"tbs_user\"@\"localhost\"; FLUSH PRIVILEGES;"

mysql -u root fjpwl_sys_db < /tmp/fjpwl_sys_db_sync.sql
rm -f /tmp/fjpwl_sys_db_sync.sql

# Recreate framework tables required by Laravel runtime.
mysql -u root -D fjpwl_sys_db -e "
CREATE TABLE IF NOT EXISTS \`fjp_sessions\` (
	\`id\` varchar(255) NOT NULL,
	\`user_id\` bigint unsigned DEFAULT NULL,
	\`ip_address\` varchar(45) DEFAULT NULL,
	\`user_agent\` text,
	\`payload\` longtext NOT NULL,
	\`last_activity\` int NOT NULL,
	PRIMARY KEY (\`id\`),
	KEY \`fjp_sessions_user_id_index\` (\`user_id\`),
	KEY \`fjp_sessions_last_activity_index\` (\`last_activity\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

mysql -u root -D fjpwl_sys_db -e "
CREATE TABLE IF NOT EXISTS \`fjp_cache\` (
	\`key\` varchar(255) NOT NULL,
	\`value\` mediumtext NOT NULL,
	\`expiration\` int NOT NULL,
	PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

mysql -u root -D fjpwl_sys_db -e "
CREATE TABLE IF NOT EXISTS \`fjp_cache_locks\` (
	\`key\` varchar(255) NOT NULL,
	\`owner\` varchar(255) NOT NULL,
	\`expiration\` int NOT NULL,
	PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

cd /var/www/tbscontainermnl
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache
chmod -R 775 /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache

systemctl restart php8.3-fpm

echo "[OK] Localhost DB imported to VPS successfully"
