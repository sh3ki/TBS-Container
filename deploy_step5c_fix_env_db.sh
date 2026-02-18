#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/var/www/tbscontainermnl/.env"
DB_PASS="$(cat /root/tbs_db_password.txt)"

set_kv() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

set_kv "APP_ENV" "production"
set_kv "APP_DEBUG" "false"
set_kv "APP_URL" "https://tbscontainermnl.com"
set_kv "DB_CONNECTION" "mysql"
set_kv "DB_HOST" "127.0.0.1"
set_kv "DB_PORT" "3306"
set_kv "DB_DATABASE" "tbs_container"
set_kv "DB_USERNAME" "tbs_user"
set_kv "DB_PASSWORD" "${DB_PASS}"
set_kv "DB_PREFIX" "fjp_"
set_kv "QUEUE_CONNECTION" "redis"
set_kv "CACHE_STORE" "redis"
set_kv "SESSION_DRIVER" "database"

cd /var/www/tbscontainermnl
php artisan migrate --force
php artisan storage:link || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache

echo "[OK] .env DB fixed and migrations completed"
