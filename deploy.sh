#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting deployment..."

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

# Navigate to project directory
cd "$APP_DIR"

# Fix git safe directory (prevents 'dubious ownership' error when www-data owns the files)
git config --global --add safe.directory "$APP_DIR"

# Put application in maintenance mode
php artisan down || true

cleanup() {
	php artisan up || true
}
trap cleanup EXIT

# Enforce stable production environment values
set_kv "APP_NAME" '"TBS System"'
set_kv "VITE_APP_NAME" '"TBS System"'
set_kv "APP_URL" "https://tbscontainermnl.com"
set_kv "SESSION_DOMAIN" ".tbscontainermnl.com"
set_kv "SESSION_SECURE_COOKIE" "true"

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git stash
git fetch origin
git pull origin master

# Install/Update dependencies
echo "📦 Installing dependencies..."
composer install --optimize-autoloader --no-dev
php artisan wayfinder:generate
npm install
npm run build

# Run migrations
echo "🗄️  Running migrations..."
php artisan migrate --force

# Clear and cache
echo "🧹 Clearing cache..."
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
# Only chown storage and cache — NOT the whole app (chowning .git to www-data breaks git for root)
echo "🔐 Setting permissions..."
chown -R www-data:www-data "$APP_DIR/storage" "$APP_DIR/bootstrap/cache" "$APP_DIR/public"
chmod -R 755 "$APP_DIR"
chmod -R 775 "$APP_DIR/storage"
chmod -R 775 "$APP_DIR/bootstrap/cache"

# Ensure temp uploads and container_pics directories exist and are writable
echo "🗂️  Ensuring image storage directories..."
mkdir -p "$APP_DIR/storage/app/temp_uploads"
chown -R www-data:www-data "$APP_DIR/storage/app/temp_uploads"
chmod -R 775 "$APP_DIR/storage/app/temp_uploads"

mkdir -p "/var/www/tbscontainermnl/public/container_pics"
chown -R www-data:www-data "/var/www/tbscontainermnl/public/container_pics"
chmod -R 775 "/var/www/tbscontainermnl/public/container_pics"

# Also ensure top-level container_pics exists and is writable (used by /containerimages)
chown -R www-data:www-data "$APP_DIR/container_pics"
chmod -R 775 "$APP_DIR/container_pics"

# Restart services
echo "🔄 Restarting services..."
systemctl reload nginx
systemctl restart php8.3-fpm

# Restart supervisor workers to load latest code
if command -v supervisorctl >/dev/null 2>&1; then
	echo "🔁 Restarting supervisor workers..."

	# Install supervisor config shipped in repo if present
	if [ -f "$APP_DIR/deploy/supervisor/tbs-worker.conf" ]; then
		echo "📄 Installing supervisor config for tbs-worker..."
		cp "$APP_DIR/deploy/supervisor/tbs-worker.conf" /etc/supervisor/conf.d/tbs-worker.conf || true
		supervisorctl reread || true
		supervisorctl update || true
	fi
	supervisorctl restart tbs-worker:* || true
	supervisorctl restart tbs-email-automation || true
fi

# Bring application back up
php artisan up
trap - EXIT

echo "✅ Deployment complete!"
