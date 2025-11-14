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
