# TBS Container — Full Deployment Guide (Hostinger KVM1)
**From fresh Ubuntu VPS → fully running production system**

- **Server:** Hostinger KVM1 (Ubuntu 22.04)
- **Domain:** `tbscontainermnl.com`
- **App path:** `/var/www/tbscontainermnl`
- **GitHub:** `https://github.com/sh3ki/TBS-Container`

---

## STEP 1 — Initial Server Setup

SSH into server as root:
```bash
ssh root@YOUR_SERVER_IP
```

Update system packages:
```bash
apt update && apt upgrade -y
```

Set timezone:
```bash
timedatectl set-timezone Asia/Manila
```

---

## STEP 2 — Install Required Software

### 2.1 Add PHP 8.3 repository
```bash
apt install -y software-properties-common
add-apt-repository ppa:ondrej/php -y
apt update
```

### 2.2 Install PHP 8.3 and extensions
```bash
apt install -y php8.3 php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring \
  php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath php8.3-intl \
  php8.3-redis php8.3-gd php8.3-tokenizer php8.3-fileinfo
```

Verify:
```bash
php -v
```

### 2.3 Install Nginx
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 2.4 Install MySQL 8
```bash
apt install -y mysql-server
systemctl enable mysql
systemctl start mysql
```

### 2.5 Install Redis
```bash
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server
```

### 2.6 Install Composer
```bash
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
chmod +x /usr/local/bin/composer
composer --version
```

### 2.7 Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

### 2.8 Install Supervisor
```bash
apt install -y supervisor
systemctl enable supervisor
systemctl start supervisor
```

### 2.9 Install Certbot (SSL)
```bash
apt install -y certbot python3-certbot-nginx
```

### 2.10 Install Git
```bash
apt install -y git
```

---

## STEP 3 — Configure MySQL Database

Log in to MySQL:
```bash
mysql -u root
```

Run these SQL commands:
```sql
CREATE DATABASE fjpwl_sys_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tbs_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON fjpwl_sys_db.* TO 'tbs_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> Replace `YOUR_STRONG_PASSWORD` with a secure password. Save it — you will need it for `.env`.

---

## STEP 4 — Clone the Application from GitHub

Create app directory:
```bash
mkdir -p /var/www/tbscontainermnl
cd /var/www
```

Clone the repo:
```bash
git clone https://github.com/sh3ki/TBS-Container.git tbscontainermnl
cd /var/www/tbscontainermnl
```

---

## STEP 5 — Configure the Environment

Copy the example env file:
```bash
cp .env.example .env
```

Edit the env file:
```bash
nano .env
```

Set these values (replace placeholders):
```env
APP_NAME="TBS"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://tbscontainermnl.com

VITE_APP_NAME="TBS"

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=fjpwl_sys_db
DB_USERNAME=tbs_user
DB_PASSWORD=YOUR_STRONG_PASSWORD
DB_PREFIX=fjp_

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_DOMAIN=.tbscontainermnl.com
SESSION_SECURE_COOKIE=true

CACHE_STORE=redis
QUEUE_CONNECTION=redis

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@email.com
MAIL_PASSWORD=your_mail_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=your@email.com
MAIL_FROM_NAME="TBS"
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## STEP 6 — Install Dependencies and Build

Install PHP dependencies:
```bash
composer install --optimize-autoloader --no-dev
```

Generate application key:
```bash
php artisan key:generate
```

Install Node.js dependencies and build frontend:
```bash
npm install
php artisan wayfinder:generate
npm run build
```

---

## STEP 7 — Run Database Migrations

```bash
php artisan migrate --force
```

This creates all required tables including `fjp_sessions`, `fjp_cache`, `fjp_cache_locks`, `fjp_scheduled_notifications`, etc.

---

## STEP 8 — Cache for Production

```bash
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

## STEP 9 — Set File Permissions

```bash
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache
```

---

## STEP 10 — Configure Nginx

Create the site config:
```bash
nano /etc/nginx/sites-available/tbscontainermnl
```

Paste the following exactly:
```nginx
# Canonical app server — apex domain only
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name tbscontainermnl.com;

    root /var/www/tbscontainermnl/public;
    index index.php;
    charset utf-8;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    client_max_body_size 100M;
    large_client_header_buffers 8 32k;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_read_timeout 300;
        fastcgi_buffer_size 256k;
        fastcgi_buffers 32 64k;
        fastcgi_busy_buffers_size 512k;
        fastcgi_temp_file_write_size 512k;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    ssl_certificate /etc/letsencrypt/live/tbscontainermnl.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tbscontainermnl.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# www → apex 301 redirect (prevents session/cookie mismatch on login)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name www.tbscontainermnl.com;

    ssl_certificate /etc/letsencrypt/live/tbscontainermnl.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tbscontainermnl.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://tbscontainermnl.com$request_uri;
}

# HTTP → HTTPS (both hosts go to apex)
server {
    listen 80;
    listen [::]:80;
    server_name tbscontainermnl.com www.tbscontainermnl.com;
    return 301 https://tbscontainermnl.com$request_uri;
}
```

Save and exit. Enable the site:
```bash
ln -s /etc/nginx/sites-available/tbscontainermnl /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
```

---

## STEP 11 — Obtain SSL Certificate (Let's Encrypt)

> DNS A records for `tbscontainermnl.com` and `www.tbscontainermnl.com` must already point to this server's IP before running this.

Temporarily allow HTTP for certificate validation:
```bash
# Get certificate using standalone (nginx must be stopped temporarily)
systemctl stop nginx
certbot certonly --standalone -d tbscontainermnl.com -d www.tbscontainermnl.com \
  --agree-tos --non-interactive --email your@email.com
systemctl start nginx
```

Test and reload nginx:
```bash
nginx -t && systemctl reload nginx
```

Set up auto-renewal:
```bash
crontab -e
```
Add this line:
```
0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

## STEP 12 — Configure Supervisor (Queue Workers)

Create the worker config:
```bash
nano /etc/supervisor/conf.d/tbs-worker.conf
```

Paste:
```ini
[program:tbs-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/tbscontainermnl/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/tbscontainermnl/storage/logs/worker.log
stopwaitsecs=3600
```

Save and load:
```bash
supervisorctl reread
supervisorctl update
supervisorctl start tbs-worker:*
supervisorctl status
```

---

## STEP 13 — Configure Laravel Scheduler (Cron)

```bash
crontab -e
```

Add this line:
```
* * * * * cd /var/www/tbscontainermnl && php artisan schedule:run >> /dev/null 2>&1
```

---

## STEP 14 — Configure UFW Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

---

## STEP 15 — Final Verification

Check all services are running:
```bash
systemctl is-active nginx php8.3-fpm mysql redis-server supervisor
```

Check queue workers:
```bash
supervisorctl status
```

Check app status:
```bash
cd /var/www/tbscontainermnl
php artisan about
```

Test HTTP responses:
```bash
# Should return 301 → https://tbscontainermnl.com/
curl -I http://tbscontainermnl.com

# Should return 301 → https://tbscontainermnl.com/
curl -I https://www.tbscontainermnl.com

# Should return 200 or 302 to /login
curl -I https://tbscontainermnl.com
```

Check Nginx error log:
```bash
tail -n 30 /var/log/nginx/error.log
```

Check Laravel log:
```bash
tail -n 30 /var/www/tbscontainermnl/storage/logs/laravel.log
```

---

## STEP 16 — Import Production Database (if migrating existing data)

On your local machine, export the database:
```bash
mysqldump -u root fjpwl_sys_db > fjpwl_sys_db.sql
```

Upload to server:
```bash
scp fjpwl_sys_db.sql root@YOUR_SERVER_IP:/root/
```

On the server, import:
```bash
mysql -u root fjpwl_sys_db < /root/fjpwl_sys_db.sql
```

Then recreate any framework tables that may have been overwritten:
```bash
cd /var/www/tbscontainermnl
php artisan migrate --force
php artisan optimize:clear && php artisan config:cache && php artisan route:cache && php artisan view:cache
systemctl restart php8.3-fpm
```

---

## Deployment Complete ✓

The application is now live at `https://tbscontainermnl.com`.  
Any visit to `www.tbscontainermnl.com` automatically redirects to the apex domain.

For future updates, see `DEPLOY_UPDATE.md`.
