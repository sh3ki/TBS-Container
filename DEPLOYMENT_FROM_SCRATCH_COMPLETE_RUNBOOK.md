# TBS Container Full Deployment Runbook (From Scratch)

**Date completed:** 2026-02-19  
**Server:** `72.60.42.105`  
**Domain:** `tbscontainermnl.com`  
**App path:** `/var/www/tbscontainermnl`  
**Repository:** `https://github.com/sh3ki/TBS-Container`

---

## 1) Why this runbook exists

This is the exact end-to-end deployment flow used after the VPS was rebuilt from scratch.  
It includes the real command sequence, helper scripts, fixes for blockers, and final health checks.

---

## 2) Local machine preparation (PowerShell)

### 2.1 Reset SSH host key after OS reinstall
```powershell
ssh-keygen -R 72.60.42.105
```

### 2.2 Connect test
```powershell
ssh -o StrictHostKeyChecking=accept-new root@72.60.42.105 "hostname; whoami"
```

---

## 3) Base server bootstrap

### 3.1 Update and upgrade system
```bash
apt update
apt -y upgrade
```

### 3.2 Install core packages (web/app/runtime)
```bash
apt install -y \
  nginx mysql-server redis-server supervisor certbot python3-certbot-nginx \
  git unzip curl ufw fail2ban \
  php8.3-fpm php8.3-cli php8.3-common php8.3-mysql php8.3-zip php8.3-gd \
  php8.3-mbstring php8.3-curl php8.3-xml php8.3-bcmath php8.3-intl php8.3-redis \
  composer nodejs npm
```

### 3.3 Verify versions
```bash
node -v
npm -v
php -v
mysql --version
redis-server --version
nginx -v
```

### 3.4 Add swap (4 GB)
```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -m
```

---

## 4) Database provisioning (exact scripts used)

> These scripts were created locally, uploaded via `scp`, then executed on server via `ssh`.

### 4.1 Script: `deploy_step3_db.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

DB_PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"

mysql -e "CREATE DATABASE IF NOT EXISTS tbscontainermnl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS \"tbs_user\"@\"localhost\" IDENTIFIED BY '${DB_PASS}';"
mysql -e "ALTER USER \"tbs_user\"@\"localhost\" IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON tbscontainermnl.* TO \"tbs_user\"@\"localhost\"; FLUSH PRIVILEGES;"

echo "${DB_PASS}" > /root/tbs_db_password.txt
chmod 600 /root/tbs_db_password.txt

echo "[OK] Database ready"
echo "[OK] Credentials file: /root/tbs_db_password.txt"
```

### 4.2 Upload + run
```powershell
scp -o StrictHostKeyChecking=accept-new .\deploy_step3_db.sh root@72.60.42.105:/root/deploy_step3_db.sh
ssh -o StrictHostKeyChecking=accept-new root@72.60.42.105 "bash /root/deploy_step3_db.sh"
```

### 4.3 Verification script: `deploy_step3_verify.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "--- DB CHECK ---"
mysql -N -B -e "SHOW DATABASES LIKE 'tbscontainermnl';"

echo "--- USER CHECK ---"
mysql -N -B -e "SELECT user,host FROM mysql.user WHERE user='tbs_user';"

echo "--- PASS FILE CHECK ---"
wc -c /root/tbs_db_password.txt
```

### 4.4 Compatibility DB script (from docs): `deploy_step3b_db_compat.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

DB_PASS="$(cat /root/tbs_db_password.txt)"
mysql -e "CREATE DATABASE IF NOT EXISTS tbs_container CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "GRANT ALL PRIVILEGES ON tbs_container.* TO \"tbs_user\"@\"localhost\"; FLUSH PRIVILEGES;"

echo "[OK] Added compatibility DB: tbs_container"
```

---

## 5) Application deployment

### 5.1 Clone application
```bash
rm -rf /var/www/tbscontainermnl
git clone https://github.com/sh3ki/TBS-Container.git /var/www/tbscontainermnl
```

### 5.2 Initial `.env` production setup script: `deploy_step4_env.sh`
```bash
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
```

---

## 6) Build and migration phase + blockers encountered

### 6.1 First build script used: `deploy_step5_build.sh`
```bash
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
```

### 6.2 Blocker #1 (Node version)
- `vite@7` required Node `20.19+`, server had Node `18.x`.

### 6.3 Blocker #2 (missing generated routes)
- Build error: missing `resources/js/routes` import target.
- Resolved by generating Wayfinder routes before build.

### 6.4 Recovery script used: `deploy_step5b_fix_build.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

cd /var/www/tbscontainermnl

php artisan wayfinder:generate

npm install
npm run build

php artisan migrate --force
php artisan storage:link || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache

echo "[OK] Node upgraded and build completed"
```

### 6.5 Blocker #3 (`DB_CONNECTION=sqlite` remained)
- Migration failed trying to use SQLite.
- Fixed by force-updating `.env` DB keys.

### 6.6 `.env` DB fix script: `deploy_step5c_fix_env_db.sh`
```bash
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
```

---

## 7) Schema alignment for existing `fjp_` tables

### 7.1 Source schema imported
Local file used:
```text
C:\laragon\www\fjpwl_system\tbs.sql
```

### 7.2 Upload + import
```powershell
scp -o StrictHostKeyChecking=accept-new C:\laragon\www\fjpwl_system\tbs.sql root@72.60.42.105:/tmp/tbs.sql
ssh -o StrictHostKeyChecking=accept-new root@72.60.42.105 "mysql < /tmp/tbs.sql"
```

### 7.3 Switch app DB to imported schema DB (`fjpwl_sys_db`)
Script used: `deploy_step5d_switch_dbname.sh`
```bash
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
```

### 7.4 Fix duplicate migration table conflict
Script used: `deploy_step5e_sync_migrations.sh`
```bash
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
```

---

## 8) Service configuration (Nginx, Supervisor, Cron, Firewall)

### 8.1 Script used: `deploy_step6_services.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

apt-get install -y supervisor

cat > /etc/nginx/sites-available/tbscontainermnl <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name tbscontainermnl.com www.tbscontainermnl.com;
    root /var/www/tbscontainermnl/public;

    index index.php;
    charset utf-8;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    client_max_body_size 100M;
}
NGINX

ln -sf /etc/nginx/sites-available/tbscontainermnl /etc/nginx/sites-enabled/tbscontainermnl
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl restart nginx

cat > /etc/supervisor/conf.d/tbs-worker.conf <<'SUP'
[program:tbs-worker]
process_name=%(program_name)s_%(process_num)02d
command=/usr/bin/php /var/www/tbscontainermnl/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/tbscontainermnl/storage/logs/worker.log
stopwaitsecs=3600
SUP

systemctl enable --now supervisor
supervisorctl reread
supervisorctl update
supervisorctl restart tbs-worker:* || true

cat > /etc/cron.d/tbs-scheduler <<'CRON'
* * * * * www-data cd /var/www/tbscontainermnl && /usr/bin/php artisan schedule:run >> /dev/null 2>&1
CRON
chmod 644 /etc/cron.d/tbs-scheduler

ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw --force enable || true

echo "[OK] Nginx, Supervisor, Cron, and firewall configured"
```

---

## 9) Runtime fix after deployment

### 9.1 Symptom
- HTTP `500 Internal Server Error`.

### 9.2 Root cause
- `APP_KEY` empty in production `.env`.

### 9.3 Fix commands
```bash
cd /var/www/tbscontainermnl
php artisan key:generate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 9.4 Verification
```bash
grep '^APP_KEY=' /var/www/tbscontainermnl/.env
curl -I -H 'Host: tbscontainermnl.com' http://127.0.0.1
```
Expected: HTTP `302`/`200`, not `500`.

---

## 10) Final health checks used

```bash
systemctl is-active nginx php8.3-fpm mysql redis-server supervisor
supervisorctl status
ls -l /etc/cron.d/tbs-scheduler
ufw status
php artisan about
curl -I -H 'Host: tbscontainermnl.com' http://127.0.0.1
```

Expected final state:
- All core services `active`
- workers running
- scheduler file exists
- firewall active with SSH/HTTP/HTTPS rules
- app responds successfully

---

## 11) SSL (if not yet applied)

```bash
certbot --nginx -d tbscontainermnl.com -d www.tbscontainermnl.com
```

Then verify:
```bash
curl -I https://tbscontainermnl.com
```

---

## 12) Files produced during deployment work

- `deploy_step3_db.sh`
- `deploy_step3_verify.sh`
- `deploy_step3b_db_compat.sh`
- `deploy_step4_env.sh`
- `deploy_step5_build.sh`
- `deploy_step5b_fix_build.sh`
- `deploy_step5c_fix_env_db.sh`
- `deploy_step5d_switch_dbname.sh`
- `deploy_step5e_sync_migrations.sh`
- `deploy_step6_services.sh`

These scripts document the exact recovery and deployment process used in production.
