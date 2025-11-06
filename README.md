# FJPWL System - Complete Laravel + React Implementation

## 🚀 Quick Start Guide

This document provides step-by-step instructions to get your FJPWL system up and running.

---

## 📋 Prerequisites

- PHP 8.1 or higher
- Composer
- Node.js 18+ and npm
- MySQL 8.0+
- Git (optional)

---

## ⚙️ Installation Steps

### 1. Install PHP Dependencies

```powershell
cd c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
composer install
```

### 2. Install Node Dependencies

```powershell
npm install
```

### 3. Configure Environment

The `.env` file has already been configured with your database credentials. Verify the settings:

```env
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=fjpwl_sys_db
DB_USERNAME=fjp_user
DB_PASSWORD=g8y1URb6gDbnH0Lz
DB_PREFIX=fjp_
```

### 4. Test Database Connection

```powershell
php artisan tinker
```

Then run:
```php
DB::connection()->getPdo();
exit;
```

If successful, you'll see the PDO connection object.

### 5. Clear and Cache Configuration

```powershell
php artisan config:clear
php artisan config:cache
php artisan route:clear
```

### 6. Build Frontend Assets

For development:
```powershell
npm run dev
```

For production:
```powershell
npm run build
```

### 7. Start the Development Server

In one terminal:
```powershell
php artisan serve
```

The application will be available at `http://localhost:8000`

### 8. Start Queue Worker (for background jobs)

In another terminal:
```powershell
php artisan queue:work --sleep=3 --tries=3
```

---

## 📦 Additional Packages Needed

Install these packages for full functionality:

### PDF Generation
```powershell
composer require barryvdh/laravel-dompdf
```

### Excel Import/Export
```powershell
composer require maatwebsite/excel
```

### HTTP Client (for SMS/Email gateways)
```powershell
composer require guzzlehttp/guzzle
```

### Email Processing (POP3/IMAP)
```powershell
composer require webklex/php-imap
```

After installing packages, run:
```powershell
php artisan config:clear
composer dump-autoload
```

---

## 🔧 Configuration Files

### Publish Configuration Files

```powershell
# DomPDF
php artisan vendor:publish --provider="Barryvdh\DomPDF\ServiceProvider"

# Laravel Excel
php artisan vendor:publish --provider="Maatwebsite\Excel\ExcelServiceProvider"

# PHP-IMAP
php artisan vendor:publish --provider="Webklex\PHPIMAP\Providers\LaravelServiceProvider"
```

---

## 🗄️ Database Setup

**Important:** We are using the EXISTING database, so NO migrations will be run.

To verify your tables, run:
```powershell
php artisan tinker
```

```php
// List all tables
DB::select('SHOW TABLES');

// Check users table
DB::table('fjp_users')->count();

exit;
```

---

## 🎨 Frontend Development

The frontend is built with:
- React 19
- Inertia.js
- Tailwind CSS
- TypeScript

### Development Mode

```powershell
npm run dev
```

This starts Vite in development mode with hot module replacement.

### Production Build

```powershell
npm run build
```

This creates optimized production assets in `public/build/`.

---

## 🧪 Testing

### Run Backend Tests

```powershell
php artisan test
```

### Run Frontend Tests

```powershell
npm run test
```

---

## 📧 Email Configuration

Update your `.env` with actual SMTP credentials:

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.bizmail.yahoo.com
MAIL_PORT=587
MAIL_USERNAME=your-email@domain.com
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=your-email@domain.com
MAIL_FROM_NAME="${APP_NAME}"
```

Test email sending:
```powershell
php artisan tinker
```

```php
Mail::raw('Test email', function($message) {
    $message->to('test@example.com')->subject('Test');
});
exit;
```

---

## 📱 SMS Configuration

SMS gateway is already configured in `.env`:

```env
SMS_GATEWAY_URL=http://172.16.1.91:80/sendsms
SMS_GATEWAY_USER=admin
SMS_GATEWAY_PASSWORD=passw0rd
```

---

## ⏱️ Scheduled Tasks

The following background jobs are configured:

1. **Force Logoff** - Hourly
2. **Process Scheduled Notifications** - Every minute
3. **Process Incoming Emails** - Every 10 minutes

To start the scheduler, add this to your task scheduler or cron:

```
* * * * * cd c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl && php artisan schedule:run >> NUL 2>&1
```

For Windows Task Scheduler:
- Action: Start a program
- Program: `C:\path\to\php.exe`
- Arguments: `artisan schedule:run`
- Start in: `c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl`
- Trigger: Daily, repeat every 1 minute

---

## 🚀 Production Deployment

See `DEPLOYMENT.md` for detailed deployment instructions to Hostinger.

---

## 📚 Project Structure

```
fjpwl/
├── app/
│   ├── Console/          # Console commands
│   ├── Http/
│   │   ├── Controllers/  # API & Web controllers
│   │   └── Middleware/   # Custom middleware
│   ├── Models/           # Eloquent models
│   ├── Jobs/             # Queue jobs
│   ├── Notifications/    # Notification classes
│   └── Services/         # Business logic services
├── resources/
│   ├── js/
│   │   ├── components/   # React components
│   │   ├── pages/        # Inertia pages
│   │   └── app.tsx       # Root component
│   └── css/              # Stylesheets
├── routes/
│   ├── web.php           # Web routes
│   ├── api.php           # API routes
│   └── console.php       # Console routes
├── public/               # Public assets
├── storage/              # Logs, cache, uploads
└── tests/                # Test files
```

---

## 🔑 Default Login (if using legacy data)

Check your database for existing users:

```sql
SELECT username FROM fjp_users WHERE is_active = 1;
```

The password is hashed using:
```
SHA1(CONCAT(salt, SHA1('password'), SHA1(salt)))
```

---

## 🆘 Troubleshooting

### Database Connection Issues

```powershell
# Test connection
php artisan tinker
DB::connection()->getPdo();
```

### Clear All Cache

```powershell
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

### Permission Issues (for storage/logs)

```powershell
# Windows (run as administrator)
icacls storage /grant Everyone:(OI)(CI)F /T
icacls bootstrap\cache /grant Everyone:(OI)(CI)F /T
```

### Assets Not Loading

```powershell
# Rebuild assets
npm run build

# Clear browser cache
# Hard refresh: Ctrl + Shift + R
```

---

## 📖 Documentation

- [Migration Plan](MIGRATION_PLAN.md) - Complete migration strategy
- [API Documentation](API_DOCUMENTATION.md) - API endpoints reference
- [Deployment Guide](DEPLOYMENT.md) - Production deployment steps
- [User Manual](USER_MANUAL.md) - End-user documentation

---

## 🤝 Support

For issues or questions, refer to the documentation or contact the development team.

---

**Happy Coding! 🎉**
