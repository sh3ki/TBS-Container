#!/usr/bin/env bash
set -euo pipefail

cd /var/www/tbscontainermnl

if [ -f resources/js/pages/dashboard.tsx ]; then
  rm -f resources/js/pages/dashboard.tsx
fi

composer install --optimize-autoloader --no-dev
npm install
npm run build

php artisan key:generate --force
php artisan migrate --force
php artisan storage:link || true

php artisan cache:clear || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data /var/www/tbscontainermnl
find /var/www/tbscontainermnl -type d -exec chmod 755 {} \;
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache

echo "[OK] Build and optimize complete"
