# TBS Container — Update Guide (Git Pull)
**How to update the live production server after pushing new code to GitHub**

- **Server:** Hostinger KVM1 — `root@YOUR_SERVER_IP`
- **App path:** `/var/www/tbscontainermnl`
- **GitHub:** `https://github.com/sh3ki/TBS-Container` (branch: `master`)

---

## Option A — One-Command Update (Recommended)

The `deploy.sh` script in the repo handles everything automatically.

SSH into server and run:
```bash
ssh root@YOUR_SERVER_IP "cd /var/www/tbscontainermnl && bash deploy.sh"
```

That's it. The script will:
1. Put app in maintenance mode
2. Enforce correct `.env` values (APP_URL, SESSION_DOMAIN, etc.)
3. Pull latest code from GitHub
4. Install/update Composer and NPM dependencies
5. Rebuild frontend assets
6. Run new migrations
7. Clear and rebuild all caches
8. Fix permissions
9. Restart PHP-FPM and reload Nginx
10. Bring app back online

---

## Option B — Manual Step-by-Step Update

Use this if you want to run each step yourself.

### 1. SSH into server
```bash
ssh root@YOUR_SERVER_IP
```

### 2. Go to app directory
```bash
cd /var/www/tbscontainermnl
```

### 3. Put app in maintenance mode
```bash
php artisan down
```

### 4. Pull latest code from GitHub
```bash
git fetch origin
git pull origin master
```

> If the pull fails due to local changes, reset to GitHub:
> ```bash
> git fetch origin
> git reset --hard origin/master
> git clean -fd
> git pull origin master
> ```

### 5. Install/update PHP dependencies
```bash
composer install --optimize-autoloader --no-dev
```

### 6. Generate route helper file
```bash
php artisan wayfinder:generate
```

### 7. Install/update frontend dependencies and rebuild
```bash
npm install
npm run build
```

### 8. Run any new database migrations
```bash
php artisan migrate --force
```

### 9. Clear and rebuild all caches
```bash
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 10. Fix permissions
```bash
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache
```

### 11. Restart services
```bash
systemctl reload nginx
systemctl restart php8.3-fpm
supervisorctl restart tbs-worker:*
```

### 12. Bring app back online
```bash
php artisan up
```

---

## Post-Update Verification

Run after every update to confirm the system is healthy:

```bash
# All should show "active"
systemctl is-active nginx php8.3-fpm mysql redis-server supervisor

# Workers should show RUNNING
supervisorctl status

# Confirm correct URL, DB, and debug=false
php artisan about | grep -E 'Environment|Debug|URL|Database'

# Confirm HTTP responses
curl -I https://tbscontainermnl.com        # expects 302 → /login
curl -I https://www.tbscontainermnl.com    # expects 301 → https://tbscontainermnl.com/

# Check for recent errors
tail -n 20 /var/log/nginx/error.log
tail -n 20 /var/www/tbscontainermnl/storage/logs/laravel.log
```

---

## Rollback (if something breaks)

### Quick rollback to previous commit
```bash
cd /var/www/tbscontainermnl
php artisan down
git log --oneline -n 10          # find the previous good commit hash
git reset --hard COMMIT_HASH
composer install --optimize-autoloader --no-dev
php artisan wayfinder:generate
npm install && npm run build
php artisan optimize:clear
php artisan config:cache && php artisan route:cache && php artisan view:cache
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache
systemctl reload nginx && systemctl restart php8.3-fpm
supervisorctl restart tbs-worker:*
php artisan up
```

> If a migration already ran and you need to revert schema changes, restore from your database backup before rolling back.

---

## Backup Before Every Update (Recommended)

```bash
# Backup database
mkdir -p /root/backups
mysqldump -u tbs_user -p fjpwl_sys_db > /root/backups/fjpwl_$(date +%F_%H%M%S).sql

# Backup .env
cp /var/www/tbscontainermnl/.env /root/backups/.env_$(date +%F_%H%M%S)
```

---

## Common Problems and Fixes

### App shows 500 after update
```bash
tail -n 30 /var/www/tbscontainermnl/storage/logs/laravel.log
php artisan optimize:clear
php artisan config:cache
systemctl restart php8.3-fpm
```

### App shows 502 Bad Gateway
```bash
systemctl status php8.3-fpm
systemctl restart php8.3-fpm
tail -n 20 /var/log/nginx/error.log
```

### Login redirects back to login page (www. issue)
```bash
# Confirm APP_URL is apex only (no www)
grep APP_URL /var/www/tbscontainermnl/.env
# Should be: APP_URL=https://tbscontainermnl.com

# Confirm www redirects to apex at nginx level
curl -I https://www.tbscontainermnl.com
# Should return: Location: https://tbscontainermnl.com/
```

### Build fails — missing route file
```bash
cd /var/www/tbscontainermnl
php artisan wayfinder:generate
npm run build
```

### Queue workers not running
```bash
supervisorctl status
supervisorctl restart tbs-worker:*
```

### APP_KEY missing after reset
```bash
cd /var/www/tbscontainermnl
php artisan key:generate --force
php artisan config:cache
systemctl restart php8.3-fpm
```

### Sessions table missing (500 on login)
```bash
cd /var/www/tbscontainermnl
php artisan migrate --force
php artisan optimize:clear && php artisan config:cache
systemctl restart php8.3-fpm
```
