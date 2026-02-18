#!/usr/bin/env bash
set -euo pipefail

mysql -u root -e "DROP DATABASE IF EXISTS fjpwl_sys_db;"
mysql -u root -e "CREATE DATABASE fjpwl_sys_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -e "GRANT ALL PRIVILEGES ON fjpwl_sys_db.* TO \"tbs_user\"@\"localhost\"; FLUSH PRIVILEGES;"

mysql -u root fjpwl_sys_db < /tmp/fjpwl_sys_db_sync.sql
rm -f /tmp/fjpwl_sys_db_sync.sql

cd /var/www/tbscontainermnl
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache
chmod -R 775 /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache

systemctl restart php8.3-fpm

echo "[OK] Localhost DB imported to VPS successfully"
