#!/usr/bin/env bash
set -euo pipefail

DB_PASS="$(cat /root/tbs_db_password.txt)"
mysql -e "CREATE DATABASE IF NOT EXISTS fjpwl_sys_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "GRANT ALL PRIVILEGES ON fjpwl_sys_db.* TO \"tbs_user\"@\"localhost\"; FLUSH PRIVILEGES;"

ENV_FILE="/var/www/tbscontainermnl/.env"
if grep -q '^DB_DATABASE=' "$ENV_FILE"; then
  sed -i 's|^DB_DATABASE=.*|DB_DATABASE=fjpwl_sys_db|' "$ENV_FILE"
else
  echo 'DB_DATABASE=fjpwl_sys_db' >> "$ENV_FILE"
fi
if grep -q '^DB_CONNECTION=' "$ENV_FILE"; then
  sed -i 's|^DB_CONNECTION=.*|DB_CONNECTION=mysql|' "$ENV_FILE"
else
  echo 'DB_CONNECTION=mysql' >> "$ENV_FILE"
fi
if grep -q '^DB_USERNAME=' "$ENV_FILE"; then
  sed -i 's|^DB_USERNAME=.*|DB_USERNAME=tbs_user|' "$ENV_FILE"
else
  echo 'DB_USERNAME=tbs_user' >> "$ENV_FILE"
fi
if grep -q '^DB_PASSWORD=' "$ENV_FILE"; then
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" "$ENV_FILE"
else
  echo "DB_PASSWORD=${DB_PASS}" >> "$ENV_FILE"
fi

cd /var/www/tbscontainermnl
php artisan migrate --force
php artisan storage:link || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "[OK] Switched DB to fjpwl_sys_db and completed migrations"
