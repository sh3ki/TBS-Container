#!/usr/bin/env bash
set -euo pipefail

mysql -D fjpwl_sys_db -e "CREATE TABLE IF NOT EXISTS fjp_migrations (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, migration VARCHAR(255) NOT NULL, batch INT NOT NULL);"

CURRENT_BATCH=$(mysql -N -B -D fjpwl_sys_db -e "SELECT COALESCE(MAX(batch),0)+1 FROM fjp_migrations;")

ensure_migration() {
  local name="$1"
  mysql -D fjpwl_sys_db -e "INSERT INTO fjp_migrations (migration,batch) SELECT '${name}', ${CURRENT_BATCH} FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM fjp_migrations WHERE migration='${name}');"
}

# Tables that already exist from imported schema
ensure_migration "2025_10_20_221849_create_personal_access_tokens_table"

cd /var/www/tbscontainermnl
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "[OK] Migration table synchronized and migrate completed"
