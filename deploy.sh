#!/bin/bash

echo "🚀 Starting TBS Container deployment..."

# Navigate to project directory
cd /var/www/tbscontainermnl

# Put application in maintenance mode
echo "🔧 Putting application in maintenance mode..."
php artisan down

# Pull latest changes from GitHub
echo "📥 Pulling latest changes from GitHub..."
git pull origin master

# Install/Update PHP dependencies
echo "📦 Installing Composer dependencies..."
composer install --optimize-autoloader --no-dev

# Install/Update Node dependencies and build assets
echo "📦 Installing Node dependencies..."
npm install

echo "🏗️  Building assets..."
npm run build

# Run ONLY specific migrations (indexes and audit logs)
echo "🗄️  Running specific migrations..."
php artisan migrate --path=/database/migrations/2025_11_14_000002_change_audit_logs_description_to_text.php --force
php artisan migrate --path=/database/migrations/2025_11_14_100000_add_all_database_indexes.php --force

# Clear all caches
echo "🧹 Clearing all caches..."
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Optimize for production
echo "⚡ Optimizing for production..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set proper permissions
echo "🔐 Setting proper permissions..."
chown -R www-data:www-data /var/www/tbscontainermnl
chmod -R 755 /var/www/tbscontainermnl
chmod -R 775 /var/www/tbscontainermnl/storage
chmod -R 775 /var/www/tbscontainermnl/bootstrap/cache

# Restart services
echo "🔄 Restarting services..."
systemctl reload nginx
systemctl restart php8.2-fpm

# Restart queue workers if using supervisor
if command -v supervisorctl &> /dev/null; then
    echo "🔄 Restarting queue workers..."
    supervisorctl restart tbs-worker:*
fi

# Bring application back up
echo "✅ Bringing application back online..."
php artisan up

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Your application is now live at https://tbscontainermnl.com"
echo ""
