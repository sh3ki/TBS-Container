# TBS Container Update Runbook (Git Pull from GitHub)

**Target:** Update live server safely when new code is pushed to GitHub (`master`).  
**Server path:** `/var/www/tbscontainermnl`

---

## 1) Standard update flow (one-by-one commands)

SSH to server:
```bash
ssh root@72.60.42.105
```

Go to app:
```bash
cd /var/www/tbscontainermnl
```

Optional quick pre-check:
```bash
git branch --show-current
git status
php -v
node -v
```

Put app in maintenance mode:
```bash
php artisan down --render="errors::503"
```

Pull latest code:
```bash
git fetch origin
git pull origin master
```

Install/update backend deps:
```bash
composer install --optimize-autoloader --no-dev
```

Generate route helper file (important for this project):
```bash
php artisan wayfinder:generate
```

Install/update frontend deps and build:
```bash
npm install
npm run build
```

Run DB migrations:
```bash
php artisan migrate --force
```

Refresh application caches:
```bash
php artisan cache:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Fix permissions:
```bash
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache
```

Restart/reload services:
```bash
systemctl reload nginx
systemctl restart php8.3-fpm
supervisorctl restart tbs-worker:*
```

Bring app back online:
```bash
php artisan up
```

---

## 2) Post-update validation checklist

Run:
```bash
systemctl is-active nginx php8.3-fpm mysql redis-server supervisor
supervisorctl status
php artisan about | grep -E 'Environment|Debug Mode|Database|URL'
curl -I -H 'Host: tbscontainermnl.com' http://127.0.0.1
```

Confirm:
- all services are `active`
- workers are `RUNNING`
- app returns HTTP `200` or `302` (not `500`)

---

## 3) Recommended reusable deployment script for updates

Create/update `/var/www/tbscontainermnl/deploy.sh` with this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting deployment..."
cd /var/www/tbscontainermnl

php artisan down --render="errors::503" || true

echo "📥 Pulling latest code..."
git fetch origin
git pull origin master

echo "📦 Installing dependencies..."
composer install --optimize-autoloader --no-dev
php artisan wayfinder:generate
npm install
npm run build

echo "🗄️ Running migrations..."
php artisan migrate --force

echo "🧹 Refreshing cache..."
php artisan cache:clear || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "🔐 Fixing permissions..."
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache

echo "🔄 Restarting services..."
systemctl reload nginx
systemctl restart php8.3-fpm
supervisorctl restart tbs-worker:* || true

php artisan up

echo "✅ Deployment complete!"
```

Make executable:
```bash
chmod +x /var/www/tbscontainermnl/deploy.sh
```

Then every update is:
```bash
ssh root@72.60.42.105 "cd /var/www/tbscontainermnl && ./deploy.sh"
```

---

## 4) Fast rollback procedure

If update fails after pull/build/migrate:

### 4.1 Put app in maintenance mode
```bash
php artisan down --render="errors::503"
```

### 4.2 Find previous commit and rollback
```bash
git log --oneline -n 10
git reset --hard HEAD~1
```

### 4.3 Rebuild previous code
```bash
composer install --optimize-autoloader --no-dev
php artisan wayfinder:generate
npm install
npm run build
php artisan config:cache
php artisan route:cache
php artisan view:cache
systemctl reload nginx
systemctl restart php8.3-fpm
supervisorctl restart tbs-worker:* || true
php artisan up
```

> If a migration already changed schema and cannot be rolled back safely, restore from DB backup.

---

## 5) Backup before each production update (recommended)

Create backup directory:
```bash
mkdir -p /root/backups
```

Backup database:
```bash
mysqldump -u tbs_user -p fjpwl_sys_db > /root/backups/fjpwl_sys_db_$(date +%F_%H%M%S).sql
```

Backup `.env`:
```bash
cp /var/www/tbscontainermnl/.env /root/backups/.env_$(date +%F_%H%M%S)
```

---

## 6) Common update failures and quick fixes

### A) Vite build says Node too old
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
```

### B) Build fails for missing `resources/js/routes`
```bash
cd /var/www/tbscontainermnl
php artisan wayfinder:generate
npm run build
```

### C) App returns HTTP 500 after update and `APP_KEY` missing
```bash
cd /var/www/tbscontainermnl
php artisan key:generate --force
php artisan config:cache
```

### D) Queue jobs not processing
```bash
supervisorctl status
supervisorctl restart tbs-worker:*
```

---

## 7) Minimal update command set (MVP)

If you need shortest safe flow:
```bash
cd /var/www/tbscontainermnl
php artisan down --render="errors::503"
git pull origin master
composer install --optimize-autoloader --no-dev
php artisan wayfinder:generate
npm install && npm run build
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
systemctl reload nginx
systemctl restart php8.3-fpm
supervisorctl restart tbs-worker:*
php artisan up
```
