#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/tbscontainermnl"
ENV_FILE="$APP_DIR/.env"

set_kv() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

set_kv "APP_NAME" '"TBS"'
set_kv "VITE_APP_NAME" '"TBS"'
set_kv "APP_URL" "https://tbscontainermnl.com"
set_kv "SESSION_DOMAIN" ".tbscontainermnl.com"
set_kv "SESSION_SECURE_COOKIE" "true"

cat > /etc/nginx/sites-available/tbscontainermnl <<'NGINX'
# ── Canonical app server (apex only) ─────────────────────────────────────────
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

# ── www → apex redirect (HTTPS) ───────────────────────────────────────────────
# Keeps all traffic on one canonical domain so sessions/cookies never mismatch.
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

# ── HTTP → HTTPS redirect (both hosts) ───────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name tbscontainermnl.com www.tbscontainermnl.com;
    return 301 https://tbscontainermnl.com$request_uri;
}
NGINX

cd "$APP_DIR"
php artisan migrate --force
php artisan wayfinder:generate
npm install
npm run build
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data "$APP_DIR/storage" "$APP_DIR/bootstrap/cache"
chmod -R 775 "$APP_DIR/storage" "$APP_DIR/bootstrap/cache"

nginx -t
systemctl reload nginx
systemctl restart php8.3-fpm

echo "[OK] Web stabilization applied"
