# TBS Container - Quick Deployment Commands

## SSH into Server
```bash
ssh root@72.60.42.105
# Password: Shekisheki5726.
```

## Initial Setup (One-time only)

### 1. Update System
```bash
apt update && apt upgrade -y
```

### 2. Install Everything at Once
```bash
# Install Nginx
apt install nginx -y

# Install PHP 8.2
apt install software-properties-common -y
add-apt-repository ppa:ondrej/php -y
apt update
apt install php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath php8.2-intl php8.2-redis -y

# Install MySQL
apt install mysql-server -y

# Install Composer
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
chmod +x /usr/local/bin/composer

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y

# Install Git
apt install git -y

# Install Certbot for SSL
apt install certbot python3-certbot-nginx -y
```

### 3. Create Database
```bash
mysql -u root -p
```
Then run:
```sql
CREATE DATABASE tbs_container;
CREATE USER 'tbs_user'@'localhost' IDENTIFIED BY 'TbsSecure2025!';
GRANT ALL PRIVILEGES ON tbs_container.* TO 'tbs_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Clone Repository
```bash
cd /var/www
git clone https://github.com/sh3ki/TBS-Container.git tbscontainermnl
cd tbscontainermnl
```

### 5. Configure Laravel
```bash
# Copy environment file
cp .env.example .env

# Edit .env
nano .env
```

**Update these values:**
```env
APP_URL=https://tbscontainermnl.com
DB_DATABASE=tbs_container
DB_USERNAME=tbs_user
DB_PASSWORD=TbsSecure2025!
```

Then:
```bash
# Install dependencies
composer install --optimize-autoloader --no-dev
npm install
npm run build

# Laravel setup
php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache
```

### 6. Configure Nginx
```bash
nano /etc/nginx/sites-available/tbscontainermnl
```

**Paste the nginx-config.conf content, then:**
```bash
ln -s /etc/nginx/sites-available/tbscontainermnl /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 7. Set Up SSL
```bash
certbot --nginx -d tbscontainermnl.com -d www.tbscontainermnl.com
```

### 8. Create Deployment Script
```bash
nano /var/www/tbscontainermnl/deploy.sh
```
**Paste the deploy.sh content, then:**
```bash
chmod +x /var/www/tbscontainermnl/deploy.sh
```

### 9. Set Up Firewall
```bash
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

---

## Deploy Updates (Every time you push to GitHub)

```bash
ssh root@72.60.42.105
cd /var/www/tbscontainermnl
./deploy.sh
```

---

## Namecheap DNS Configuration

1. Go to: https://ap.www.namecheap.com/
2. Domain List > tbscontainermnl.com > Manage
3. Advanced DNS > Add New Record

**Add these records:**

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | 72.60.42.105 | Automatic |
| A Record | www | 72.60.42.105 | Automatic |

Wait 5-30 minutes for DNS propagation.

---

## Useful Commands

```bash
# Check logs
tail -f /var/log/nginx/error.log
tail -f /var/www/tbscontainermnl/storage/logs/laravel.log

# Restart services
systemctl restart nginx
systemctl restart php8.2-fpm

# Check status
systemctl status nginx
systemctl status php8.2-fpm

# Fix permissions
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache

# Clear cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

---

## Troubleshooting

**500 Error?**
```bash
# Check permissions
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage

# Check logs
tail -f /var/www/tbscontainermnl/storage/logs/laravel.log
```

**Can't connect to database?**
```bash
# Test MySQL connection
mysql -u tbs_user -p tbs_container

# Check .env file
cat /var/www/tbscontainermnl/.env | grep DB_
```

**Assets not loading?**
```bash
cd /var/www/tbscontainermnl
npm run build
php artisan cache:clear
```

---

## Complete Setup Script (Copy & Paste)

Save this as `setup.sh` on your server and run it:

```bash
#!/bin/bash

echo "Installing software..."
apt update && apt upgrade -y
apt install nginx mysql-server git software-properties-common -y

add-apt-repository ppa:ondrej/php -y
apt update
apt install php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath php8.2-intl -y

curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
chmod +x /usr/local/bin/composer

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y

apt install certbot python3-certbot-nginx -y

echo "Done! Now configure MySQL and clone repository."
```
