# TBS Container - Hostinger VPS Deployment Guide

## Server Details
- **Server IP**: 72.60.42.105
- **Domain**: tbscontainermnl.com
- **OS**: Ubuntu 24.04
- **SSH**: `ssh root@72.60.42.105`
- **Repository**: https://github.com/sh3ki/TBS-Container

---

## Step 1: Initial Server Setup

SSH into your server:
```bash
ssh root@72.60.42.105
# Password: Shekisheki5726.
```

Update the system:
```bash
apt update && apt upgrade -y
```

---

## Step 2: Install Required Software

### Install Nginx
```bash
apt install nginx -y
systemctl start nginx
systemctl enable nginx
```

### Install PHP 8.2 and Extensions
```bash
apt install software-properties-common -y
add-apt-repository ppa:ondrej/php -y
apt update
apt install php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath php8.2-intl php8.2-redis -y
```

### Install MySQL
```bash
apt install mysql-server -y
systemctl start mysql
systemctl enable mysql

# Secure MySQL installation
mysql_secure_installation
# Follow prompts: set root password, remove anonymous users, etc.
```

### Install Composer
```bash
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
chmod +x /usr/local/bin/composer
```

### Install Node.js and npm
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y
```

### Install Git
```bash
apt install git -y
```

---

## Step 3: Configure MySQL Database

```bash
mysql -u root -p
```

Run these SQL commands:
```sql
CREATE DATABASE tbs_container;
CREATE USER 'tbs_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON tbs_container.* TO 'tbs_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## Step 4: Clone Repository and Configure Application

### Create web directory and clone repo
```bash
cd /var/www
git clone https://github.com/sh3ki/TBS-Container.git tbscontainermnl
cd tbscontainermnl
```

### Set up Laravel
```bash
# Copy environment file
cp .env.example .env

# Edit .env file
nano .env
```

Update these values in `.env`:
```env
APP_NAME="TBS Container"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://tbscontainermnl.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=tbs_container
DB_USERNAME=tbs_user
DB_PASSWORD=your_secure_password_here
```

### Install dependencies and set up Laravel
```bash
# Install PHP dependencies
composer install --optimize-autoloader --no-dev

# Install Node dependencies
npm install

# Build assets
npm run build

# Generate application key
php artisan key:generate

# Run migrations
php artisan migrate --force

# Create storage link
php artisan storage:link

# Cache configuration
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Set permissions
```bash
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache
```

---

## Step 5: Configure Nginx

Create Nginx configuration:
```bash
nano /etc/nginx/sites-available/tbscontainermnl
```

Paste this configuration:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name tbscontainermnl.com www.tbscontainermnl.com;
    root /var/www/tbscontainermnl/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    client_max_body_size 50M;
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/tbscontainermnl /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Step 6: Configure DNS at Namecheap

1. Log in to Namecheap
2. Go to Domain List > tbscontainermnl.com > Manage
3. Go to Advanced DNS
4. Add/Update these records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | 72.60.42.105 | Automatic |
| A Record | www | 72.60.42.105 | Automatic |

Wait 5-30 minutes for DNS propagation.

---

## Step 7: Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d tbscontainermnl.com -d www.tbscontainermnl.com

# Follow prompts and enter your email
```

Certbot will automatically configure SSL and set up auto-renewal.

---

## Step 8: Set Up Deployment Script

Create deployment script:
```bash
nano /var/www/tbscontainermnl/deploy.sh
```

Paste this content:
```bash
#!/bin/bash

echo "🚀 Starting deployment..."

# Navigate to project directory
cd /var/www/tbscontainermnl

# Put application in maintenance mode
php artisan down

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin master

# Install/Update dependencies
echo "📦 Installing dependencies..."
composer install --optimize-autoloader --no-dev
npm install
npm run build

# Run migrations
echo "🗄️  Running migrations..."
php artisan migrate --force

# Clear and cache
echo "🧹 Clearing cache..."
php artisan cache:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
echo "🔐 Setting permissions..."
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache

# Restart services
echo "🔄 Restarting services..."
systemctl reload nginx
systemctl restart php8.2-fpm

# Bring application back up
php artisan up

echo "✅ Deployment complete!"
```

Make it executable:
```bash
chmod +x /var/www/tbscontainermnl/deploy.sh
```

---

## Step 9: Configure Background Jobs (if needed)

If your application uses queues:

```bash
# Install Supervisor
apt install supervisor -y

# Create supervisor config
nano /etc/supervisor/conf.d/tbs-worker.conf
```

Add:
```ini
[program:tbs-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/tbscontainermnl/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/www/tbscontainermnl/storage/logs/worker.log
stopwaitsecs=3600
```

```bash
supervisorctl reread
supervisorctl update
supervisorctl start tbs-worker:*
```

Set up scheduler:
```bash
crontab -e
```

Add:
```
* * * * * cd /var/www/tbscontainermnl && php artisan schedule:run >> /dev/null 2>&1
```

---

## How to Deploy Updates

Whenever you push changes to GitHub, just run:

```bash
ssh root@72.60.42.105
cd /var/www/tbscontainermnl
./deploy.sh
```

Or create an alias for easier deployment:
```bash
# Add to ~/.bashrc
echo "alias deploy='cd /var/www/tbscontainermnl && ./deploy.sh'" >> ~/.bashrc
source ~/.bashrc

# Now you can just type:
deploy
```

---

## Useful Commands

```bash
# View Nginx error logs
tail -f /var/log/nginx/error.log

# View Laravel logs
tail -f /var/www/tbscontainermnl/storage/logs/laravel.log

# Restart services
systemctl restart nginx
systemctl restart php8.2-fpm

# Check service status
systemctl status nginx
systemctl status php8.2-fpm
systemctl status mysql

# Database backup
mysqldump -u tbs_user -p tbs_container > backup_$(date +%Y%m%d).sql
```

---

## Security Checklist

- [ ] Change default SSH port (optional but recommended)
- [ ] Set up firewall (UFW)
- [ ] Disable root SSH login (create sudo user)
- [ ] Set up automated backups
- [ ] Regular security updates: `apt update && apt upgrade -y`

---

## Firewall Setup (Optional but Recommended)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

---

## Troubleshooting

### Permission Issues
```bash
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache
```

### Clear all caches
```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

### Can't connect to database
- Check MySQL is running: `systemctl status mysql`
- Verify credentials in `.env`
- Test connection: `mysql -u tbs_user -p tbs_container`

---

## Next Steps After Deployment

1. Test all features thoroughly
2. Set up monitoring (optional)
3. Configure automated backups
4. Set up Git deployment webhooks (optional)
5. Configure email settings in `.env`

---

**Deployment Date**: November 14, 2025
