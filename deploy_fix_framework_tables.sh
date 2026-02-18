#!/usr/bin/env bash
set -euo pipefail

DB_NAME="fjpwl_sys_db"
PREFIX="fjp_"

mysql -u root -D "$DB_NAME" -e "
CREATE TABLE IF NOT EXISTS \`${PREFIX}sessions\` (
  \`id\` varchar(255) NOT NULL,
  \`user_id\` bigint unsigned DEFAULT NULL,
  \`ip_address\` varchar(45) DEFAULT NULL,
  \`user_agent\` text,
  \`payload\` longtext NOT NULL,
  \`last_activity\` int NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`${PREFIX}sessions_user_id_index\` (\`user_id\`),
  KEY \`${PREFIX}sessions_last_activity_index\` (\`last_activity\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

mysql -u root -D "$DB_NAME" -e "
CREATE TABLE IF NOT EXISTS \`${PREFIX}cache\` (
  \`key\` varchar(255) NOT NULL,
  \`value\` mediumtext NOT NULL,
  \`expiration\` int NOT NULL,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

mysql -u root -D "$DB_NAME" -e "
CREATE TABLE IF NOT EXISTS \`${PREFIX}cache_locks\` (
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

echo "[OK] Framework tables verified (sessions/cache/cache_locks)"
