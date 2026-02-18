#!/usr/bin/env bash
set -e

# Write the corrected Nginx config — www 301s to apex, app only runs on apex
cat > /etc/nginx/sites-available/tbscontainermnl <<'NGINX'
# Canonical app server — apex only
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

# www -> apex 301 redirect (handled before Laravel, so sessions never split)
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

# HTTP -> HTTPS (both hosts go to apex)
server {
    listen 80;
    listen [::]:80;
    server_name tbscontainermnl.com www.tbscontainermnl.com;
    return 301 https://tbscontainermnl.com$request_uri;
}
NGINX

# Ensure APP_URL and session settings in .env point to apex only
ENV_FILE="/var/www/tbscontainermnl/.env"
sed -i "s|^APP_URL=.*|APP_URL=https://tbscontainermnl.com|" "$ENV_FILE"
sed -i "s|^SESSION_DOMAIN=.*|SESSION_DOMAIN=.tbscontainermnl.com|" "$ENV_FILE"
sed -i "s|^SESSION_SECURE_COOKIE=.*|SESSION_SECURE_COOKIE=true|" "$ENV_FILE"

# Flush Laravel caches so new APP_URL takes effect immediately
cd /var/www/tbscontainermnl
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Test and reload nginx
nginx -t
systemctl reload nginx
systemctl restart php8.3-fpm

echo ""
echo "=== VERIFY ==="
echo "www redirect:"
curl -sk -o /dev/null -w "www -> %{redirect_url} [HTTP %{http_code}]\n" -H 'Host: www.tbscontainermnl.com' https://127.0.0.1/
echo "apex login page:"
curl -sk -o /dev/null -w "apex /login -> [HTTP %{http_code}]\n" -H 'Host: tbscontainermnl.com' https://127.0.0.1/login
echo ""
echo "[DONE] www now 301s to apex. Login loop on www is fixed."
