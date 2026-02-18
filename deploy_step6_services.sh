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
