#!/usr/bin/env bash
set -euo pipefail

cd /var/www/tbscontainermnl
cp -f .env.example .env

DB_PASS="$(cat /root/tbs_db_password.txt)"

sed -i "s|^APP_ENV=.*|APP_ENV=production|" .env
sed -i "s|^APP_DEBUG=.*|APP_DEBUG=false|" .env
sed -i "s|^APP_URL=.*|APP_URL=https://tbscontainermnl.com|" .env

sed -i "s|^DB_HOST=.*|DB_HOST=127.0.0.1|" .env
sed -i "s|^DB_PORT=.*|DB_PORT=3306|" .env
sed -i "s|^DB_DATABASE=.*|DB_DATABASE=tbs_container|" .env
sed -i "s|^DB_USERNAME=.*|DB_USERNAME=tbs_user|" .env
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env

if grep -q '^DB_PREFIX=' .env; then
  sed -i "s|^DB_PREFIX=.*|DB_PREFIX=fjp_|" .env
else
  echo "DB_PREFIX=fjp_" >> .env
fi

sed -i "s|^CACHE_STORE=.*|CACHE_STORE=redis|" .env || true
sed -i "s|^QUEUE_CONNECTION=.*|QUEUE_CONNECTION=redis|" .env || true
sed -i "s|^SESSION_DRIVER=.*|SESSION_DRIVER=database|" .env || true

chown root:root .env
chmod 640 .env

echo "[OK] .env configured"
