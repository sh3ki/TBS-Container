# 🚀 Complete Deployment Checklist

Use this checklist to track your deployment progress.

---

## Pre-Deployment (On Your Local Machine)

- [ ] **Ensure all code is pushed to GitHub**
  ```powershell
  cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
  git add .
  git commit -m "Final deployment commit"
  git push origin master
  ```

- [ ] **Configure Namecheap DNS** (Do this first - DNS takes time to propagate)
  - Go to: https://ap.www.namecheap.com/
  - Domain List > tbscontainermnl.com > Manage > Advanced DNS
  - Add A Record: `@` → `72.60.42.105`
  - Add A Record: `www` → `72.60.42.105`
  - Wait 5-30 minutes for propagation

---

## Server Setup (One-Time)

### 1. Connect to Server

- [ ] **SSH into VPS**
  ```bash
  ssh root@72.60.42.105
  # Password: Shekisheki5726.
  ```

### 2. Update System

- [ ] **Update Ubuntu packages**
  ```bash
  apt update && apt upgrade -y
  ```

### 3. Install Software Stack

- [ ] **Install Nginx**
  ```bash
  apt install nginx -y
  systemctl start nginx
  systemctl enable nginx
  ```

- [ ] **Install PHP 8.2**
  ```bash
  apt install software-properties-common -y
  add-apt-repository ppa:ondrej/php -y
  apt update
  apt install php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath php8.2-intl php8.2-redis -y
  ```

- [ ] **Install MySQL**
  ```bash
  apt install mysql-server -y
  systemctl start mysql
  systemctl enable mysql
  ```

- [ ] **Install Composer**
  ```bash
  curl -sS https://getcomposer.org/installer | php
  mv composer.phar /usr/local/bin/composer
  chmod +x /usr/local/bin/composer
  ```

- [ ] **Install Node.js 20**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install nodejs -y
  ```

- [ ] **Install Git**
  ```bash
  apt install git -y
  ```

- [ ] **Install Certbot (SSL)**
  ```bash
  apt install certbot python3-certbot-nginx -y
  ```

### 4. Configure Database

- [ ] **Create database and user**
  ```bash
  mysql -u root -p
  ```
  
  ```sql
  CREATE DATABASE tbs_container;
  CREATE USER 'tbs_user'@'localhost' IDENTIFIED BY 'TbsSecure2025!';
  GRANT ALL PRIVILEGES ON tbs_container.* TO 'tbs_user'@'localhost';
  FLUSH PRIVILEGES;
  EXIT;
  ```

### 5. Upload & Import Database

- [ ] **Upload database file from local machine**
  
  **Option A: Using PowerShell script (Recommended)**
  ```powershell
  cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
  .\upload-database.ps1
  ```
  
  **Option B: Manual SCP**
  ```powershell
  scp C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\tbs_db.sql root@72.60.42.105:/tmp/tbs_db.sql
  ```

- [ ] **Import database on server**
  ```bash
  # Back on the server
  mysql -u tbs_user -p tbs_container < /tmp/tbs_db.sql
  # Password: TbsSecure2025!
  
  # Clean up
  rm /tmp/tbs_db.sql
  ```

### 6. Clone Repository

- [ ] **Clone from GitHub**
  ```bash
  cd /var/www
  git clone https://github.com/sh3ki/TBS-Container.git tbscontainermnl
  cd tbscontainermnl
  ```

### 7. Configure Laravel

- [ ] **Create .env file**
  ```bash
  cp .env.example .env
  nano .env
  ```

- [ ] **Update .env values**
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
  DB_PASSWORD=TbsSecure2025!
  ```
  Save: `Ctrl+O`, Exit: `Ctrl+X`

- [ ] **Install dependencies**
  ```bash
  composer install --optimize-autoloader --no-dev
  npm install
  npm run build
  ```

- [ ] **Run Laravel setup**
  ```bash
  php artisan key:generate
  php artisan storage:link
  ```

- [ ] **Run specific migrations**
  ```bash
  # Migration 1: Change audit_logs description to TEXT
  php artisan migrate --path=/database/migrations/2025_11_14_000002_change_audit_logs_description_to_text.php --force
  
  # Migration 2: Add all database indexes
  php artisan migrate --path=/database/migrations/2025_11_14_100000_add_all_database_indexes.php --force
  ```

- [ ] **Cache configuration**
  ```bash
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
  ```

- [ ] **Set permissions**
  ```bash
  chown -R www-data:www-data /var/www/tbscontainermnl
  chmod -R 755 /var/www/tbscontainermnl
  chmod -R 775 /var/www/tbscontainermnl/storage
  chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache
  ```

### 8. Configure Nginx

- [ ] **Create Nginx configuration**
  ```bash
  nano /etc/nginx/sites-available/tbscontainermnl
  ```
  
  Paste the content from `nginx-config.conf` file

- [ ] **Enable site**
  ```bash
  ln -s /etc/nginx/sites-available/tbscontainermnl /etc/nginx/sites-enabled/
  nginx -t
  systemctl reload nginx
  ```

### 9. Install SSL Certificate

- [ ] **Get Let's Encrypt SSL**
  ```bash
  certbot --nginx -d tbscontainermnl.com -d www.tbscontainermnl.com
  ```
  Follow prompts, enter your email

### 10. Set Up Deployment Script

- [ ] **Create deployment script**
  ```bash
  nano /var/www/tbscontainermnl/deploy.sh
  ```
  
  Paste the content from `deploy.sh` file

- [ ] **Make it executable**
  ```bash
  chmod +x /var/www/tbscontainermnl/deploy.sh
  ```

### 11. Set Up Firewall

- [ ] **Configure UFW**
  ```bash
  ufw allow ssh
  ufw allow http
  ufw allow https
  ufw enable
  ```

---

## Testing

- [ ] **Test HTTP access**
  - Open browser: `http://tbscontainermnl.com`
  - Should redirect to HTTPS

- [ ] **Test HTTPS access**
  - Open browser: `https://tbscontainermnl.com`
  - Should load the application

- [ ] **Test database connection**
  - Login to application
  - Check if data loads properly

- [ ] **Check logs for errors**
  ```bash
  tail -f /var/log/nginx/error.log
  tail -f /var/www/tbscontainermnl/storage/logs/laravel.log
  ```

---

## Post-Deployment Setup (Optional but Recommended)

### Background Jobs (If Needed)

- [ ] **Install Supervisor**
  ```bash
  apt install supervisor -y
  nano /etc/supervisor/conf.d/tbs-worker.conf
  ```

- [ ] **Configure worker**
  ```ini
  [program:tbs-worker]
  process_name=%(program_name)s_%(process_num)02d
  command=php /var/www/tbscontainermnl/artisan queue:work --sleep=3 --tries=3
  autostart=true
  autorestart=true
  user=www-data
  numprocs=1
  redirect_stderr=true
  stdout_logfile=/var/www/tbscontainermnl/storage/logs/worker.log
  ```

- [ ] **Start worker**
  ```bash
  supervisorctl reread
  supervisorctl update
  supervisorctl start tbs-worker:*
  ```

### Cron Jobs

- [ ] **Set up Laravel scheduler**
  ```bash
  crontab -e
  ```
  
  Add:
  ```
  * * * * * cd /var/www/tbscontainermnl && php artisan schedule:run >> /dev/null 2>&1
  ```

### Database Backups

- [ ] **Create backup script**
  ```bash
  nano /root/backup-database.sh
  ```
  
  ```bash
  #!/bin/bash
  BACKUP_DIR="/root/backups"
  DATE=$(date +%Y%m%d_%H%M%S)
  mkdir -p $BACKUP_DIR
  mysqldump -u tbs_user -pTbsSecure2025! tbs_container > $BACKUP_DIR/tbs_backup_$DATE.sql
  # Keep only last 7 backups
  cd $BACKUP_DIR && ls -t | tail -n +8 | xargs rm -f
  ```

- [ ] **Make backup script executable**
  ```bash
  chmod +x /root/backup-database.sh
  ```

- [ ] **Schedule daily backup**
  ```bash
  crontab -e
  ```
  
  Add:
  ```
  0 2 * * * /root/backup-database.sh
  ```

---

## Future Deployments

When you update code and push to GitHub:

1. **SSH into server**
   ```bash
   ssh root@72.60.42.105
   ```

2. **Run deployment script**
   ```bash
   cd /var/www/tbscontainermnl
   ./deploy.sh
   ```

That's it! The script will:
- Pull latest code
- Update dependencies
- Build assets
- Run migrations
- Clear caches
- Restart services

---

## Quick Reference

### Useful Commands

```bash
# View logs
tail -f /var/log/nginx/error.log
tail -f /var/www/tbscontainermnl/storage/logs/laravel.log

# Restart services
systemctl restart nginx
systemctl restart php8.2-fpm

# Check service status
systemctl status nginx
systemctl status php8.2-fpm
systemctl status mysql

# Fix permissions
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage

# Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

### Emergency Recovery

```bash
# Restore from backup
mysql -u tbs_user -p tbs_container < /root/backups/tbs_backup_YYYYMMDD_HHMMSS.sql

# Rollback git changes
cd /var/www/tbscontainermnl
git reset --hard HEAD~1

# Restart everything
systemctl restart nginx php8.2-fpm mysql
```

---

## Support

**Deployment Documentation:**
- `DEPLOYMENT_GUIDE.md` - Complete detailed guide
- `QUICK_DEPLOY.md` - Quick command reference
- `DATABASE_UPLOAD_GUIDE.md` - Database upload instructions

**Scripts:**
- `upload-database.ps1` - PowerShell script to upload database
- `import-database.sh` - Server script to import database
- `deploy.sh` - Automated deployment script
- `nginx-config.conf` - Nginx configuration

---

**Last Updated:** November 14, 2025
**Deployment Status:** ✅ Ready for deployment
