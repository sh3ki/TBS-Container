#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt update
apt -y upgrade
apt -y install curl git unzip nginx mysql-server redis-server supervisor fail2ban ufw ca-certificates lsb-release gnupg software-properties-common php-fpm php-cli php-mysql php-mbstring php-xml php-curl php-zip php-bcmath php-intl php-gd php-redis composer

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt -y install nodejs
fi

if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

DB_PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
mysql -e "CREATE DATABASE IF NOT EXISTS tbscontainermnl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'tbs_user'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON tbscontainermnl.* TO 'tbs_user'@'localhost'; FLUSH PRIVILEGES;"

echo "${DB_PASS}" > /root/tbs_db_password.txt
chmod 600 /root/tbs_db_password.txt

rm -rf /var/www/tbscontainermnl
git clone https://github.com/sh3ki/TBS-Container.git /var/www/tbscontainermnl
cd /var/www/tbscontainermnl

composer install --no-dev --optimize-autoloader --no-interaction
npm install
rm -f resources/js/pages/dashboard.tsx
npm run build

cp -f .env.example .env

upsert_env() {
  local key="$1"; local val="$2"
  if grep -qE "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

upsert_env APP_NAME "TBS_Container_Management_System"
upsert_env APP_ENV production
upsert_env APP_DEBUG false
upsert_env APP_URL https://tbscontainermnl.com
upsert_env LOG_CHANNEL daily
upsert_env LOG_LEVEL warning
upsert_env DB_CONNECTION mysql
upsert_env DB_HOST 127.0.0.1
upsert_env DB_PORT 3306
upsert_env DB_DATABASE tbscontainermnl
upsert_env DB_USERNAME tbs_user
upsert_env DB_PASSWORD "${DB_PASS}"
upsert_env DB_PREFIX fjp_
upsert_env CACHE_STORE redis
upsert_env QUEUE_CONNECTION redis
upsert_env SESSION_DRIVER redis
upsert_env REDIS_HOST 127.0.0.1
upsert_env REDIS_PORT 6379
upsert_env REDIS_PASSWORD null

php artisan key:generate --force
php artisan migrate --force || true
php artisan config:clear
php artisan cache:clear || true
php artisan config:cache
php artisan route:cache || true
php artisan view:cache

chown -R www-data:www-data /var/www/tbscontainermnl
find /var/www/tbscontainermnl -type d -exec chmod 755 {} \;
chmod -R 775 /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache

PHP_FPM_SOCK="$(ls /run/php/php*-fpm.sock | head -n1)"
cat > /etc/nginx/sites-available/tbscontainermnl <<EOF
server {
    listen 80;
    server_name tbscontainermnl.com www.tbscontainermnl.com;
    root /var/www/tbscontainermnl/public;
    index index.php index.html;

    client_max_body_size 64M;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_FPM_SOCK};
        fastcgi_read_timeout 300;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
EOF

ln -sf /etc/nginx/sites-available/tbscontainermnl /etc/nginx/sites-enabled/tbscontainermnl
rm -f /etc/nginx/sites-enabled/default

cat > /etc/supervisor/conf.d/tbs-worker.conf <<EOF
[program:tbs-worker]
process_name=%(program_name)s_%(process_num)02d
command=/usr/bin/php /var/www/tbscontainermnl/artisan queue:work redis --sleep=1 --tries=3 --timeout=120 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=4
redirect_stderr=true
stdout_logfile=/var/www/tbscontainermnl/storage/logs/worker.log
stopwaitsecs=3600
EOF

(crontab -l 2>/dev/null | grep -v 'artisan schedule:run' || true; echo '* * * * * cd /var/www/tbscontainermnl && /usr/bin/php artisan schedule:run >> /dev/null 2>&1') | crontab -

nginx -t
systemctl daemon-reload
systemctl enable nginx mysql redis-server supervisor fail2ban
systemctl restart nginx
systemctl restart mysql
systemctl restart redis-server
systemctl restart supervisor
supervisorctl reread
supervisorctl update
supervisorctl restart tbs-worker:*

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo '=== DEPLOYMENT COMPLETE ==='
echo 'DB user: tbs_user'
echo 'DB password saved at: /root/tbs_db_password.txt'
echo 'App path: /var/www/tbscontainermnl'
supervisorctl status
systemctl --no-pager --full status nginx | sed -n '1,12p'
systemctl --no-pager --full status mysql | sed -n '1,12p'
systemctl --no-pager --full status redis-server | sed -n '1,12p'
