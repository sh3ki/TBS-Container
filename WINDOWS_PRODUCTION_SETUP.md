# Windows Production Setup - Email Automation & Background Jobs

## Prerequisites
- PHP 8.2+ installed and in PATH
- Laravel project at: `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl`
- MySQL running on Laragon
- Email SMTP credentials configured in `.env`

---

## Setup Instructions

### 1. Configure Environment (.env)

```env
# Application
APP_NAME="TBS Container Management"
APP_ENV=production
APP_DEBUG=false

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=fjpwl_sys_db
DB_USERNAME=root
DB_PASSWORD=your-password

# Queue (Use database for simplicity)
QUEUE_CONNECTION=database

# Mail Configuration
MAIL_MAILER=smtp
MAIL_HOST=smtp.bizmail.yahoo.com
MAIL_PORT=587
MAIL_USERNAME=notifications@fjpwl.com
MAIL_PASSWORD=your-email-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@fjpwl.com
MAIL_FROM_NAME="TBS Container Management"
```

### 2. Optimize Laravel for Production

Run these commands:

```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl

# Clear and cache configuration
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run migrations (if needed)
php artisan migrate --force
```

---

## Windows Task Scheduler Setup

### Task 1: Queue Worker (Process Email Jobs)

1. **Open Task Scheduler** → Create Task → General tab:
   - Name: `Laravel Queue Worker - TBS`
   - Description: `Processes email notification jobs from the queue`
   - User account: `SYSTEM` or your Windows account
   - ✅ Run whether user is logged on or not
   - ✅ Run with highest privileges

2. **Triggers tab** → New:
   - Begin the task: `At startup`
   - ✅ Enabled

3. **Actions tab** → New:
   - Action: `Start a program`
   - Program/script: `C:\laragon\bin\php\php-8.2.4-Win32-vs16-x64\php.exe`
   - Add arguments: `artisan queue:work database --tries=3 --timeout=90 --sleep=3 --max-time=3600`
   - Start in: `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl`

4. **Conditions tab**:
   - ✅ Start only if the computer is on AC power: **UNCHECK** (if laptop)

5. **Settings tab**:
   - ✅ Allow task to be run on demand
   - ✅ Run task as soon as possible after a scheduled start is missed
   - If the running task does not end when requested: `Do not stop`

**Start the task manually:**
- Right-click → Run

**Verify it's running:**
```powershell
tasklist | findstr php
# Should show: php.exe with command line containing "queue:work"
```

---

### Task 2: Notification Processor (45-second jPAM loop)

1. **Open Task Scheduler** → Create Task → General tab:
   - Name: `Laravel Notification Processor - TBS`
   - Description: `Processes pending notifications every 45 seconds (jPAM equivalent)`
   - User account: `SYSTEM` or your Windows account
   - ✅ Run whether user is logged on or not
   - ✅ Run with highest privileges

2. **Triggers tab** → New:
   - Begin the task: `At startup`
   - ✅ Enabled

3. **Actions tab** → New:
   - Action: `Start a program`
   - Program/script: `C:\laragon\bin\php\php-8.2.4-Win32-vs16-x64\php.exe`
   - Add arguments: `artisan notifications:process`
   - Start in: `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl`

4. **Settings tab**:
   - ✅ Allow task to be run on demand
   - ✅ Run task as soon as possible after a scheduled start is missed
   - If the running task does not end when requested: `Do not stop`

**Start the task manually:**
- Right-click → Run

**Verify it's running:**
```powershell
tasklist | findstr php
# Should show: php.exe with command line containing "notifications:process"
```

---

### Task 3: Laravel Task Scheduler (Runs every minute)

1. **Open Task Scheduler** → Create Task → General tab:
   - Name: `Laravel Scheduler - TBS`
   - Description: `Runs Laravel scheduled tasks (force logout, cleanup, etc.)`
   - User account: `SYSTEM` or your Windows account
   - ✅ Run whether user is logged on or not
   - ✅ Run with highest privileges

2. **Triggers tab** → New:
   - Begin the task: `On a schedule`
   - Settings: `Daily`, Start: `12:00:00 AM`
   - Advanced settings:
     - ✅ Repeat task every: `1 minute`
     - For a duration of: `Indefinitely`
   - ✅ Enabled

3. **Actions tab** → New:
   - Action: `Start a program`
   - Program/script: `C:\laragon\bin\php\php-8.2.4-Win32-x64\php.exe`
   - Add arguments: `artisan schedule:run`
   - Start in: `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl`

4. **Conditions tab**:
   - ✅ Start only if the computer is on AC power: **UNCHECK**

5. **Settings tab**:
   - ✅ Allow task to be run on demand
   - ✅ Run task as soon as possible after a scheduled start is missed
   - If the task is already running: `Do not start a new instance`

**Test the task:**
```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
php artisan schedule:list
# Should show scheduled tasks
```

---

## Verification & Testing

### 1. Test Email Configuration

```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
php artisan tinker
```

```php
Mail::raw('Test email from TBS', function($msg) {
    $msg->to('your-email@example.com')
        ->subject('Test Email - TBS');
});
// Should return: Illuminate\Mail\SentMessage
```

### 2. Create Test Notification

```powershell
php artisan tinker
```

```php
use App\Models\ScheduledNotification;

ScheduledNotification::create([
    'to_user' => 1,
    'type' => 'Test Notification',
    'message' => 'This is a test email notification from TBS.',
    'trigger_date' => now(),
    'email1' => true,
    'screen' => false,
    'delivered' => false,
    'to_email' => 'your-email@example.com',
]);
```

**Expected:** Within 1 minute, the notification processor should pick it up and dispatch to queue.

### 3. Monitor Queue Jobs

```powershell
# Check database for queued jobs
php artisan db:table jobs
# Should show job with payload containing SendEmailNotification
```

### 4. Monitor Logs

**Location:** `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\storage\logs\laravel.log`

**Watch logs in real-time:**
```powershell
Get-Content -Path "C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\storage\logs\laravel.log" -Wait -Tail 50
```

### 5. Check Scheduled Tasks

```powershell
php artisan schedule:list
```

**Expected output:**
```
0 * * * * users:force-logout ................. Next Due: 5 minutes from now
* * * * * notifications:process --once ....... Next Due: 1 minute from now
```

### 6. Test Force Logout

```powershell
# Dry run (see what would happen)
php artisan users:force-logout --dry-run

# Actual execution
php artisan users:force-logout
```

---

## Troubleshooting

### Queue Worker Not Processing

**Issue:** Jobs stuck in database, not being processed

**Solution:**
1. Check if queue worker task is running:
   ```powershell
   tasklist | findstr php
   ```

2. Restart queue worker task in Task Scheduler

3. Check failed jobs:
   ```powershell
   php artisan db:table failed_jobs
   ```

4. Retry failed jobs:
   ```powershell
   php artisan queue:retry all
   ```

### Emails Not Sending

**Issue:** Notifications created but emails not received

**Check:**
1. Email configuration in `.env`
2. Test email manually (see Testing section above)
3. Check `fjp_scheduled_notifications` table:
   ```sql
   SELECT * FROM fjp_scheduled_notifications 
   WHERE delivered = 0 
   ORDER BY trigger_date DESC;
   ```
4. Check error_message column for failed notifications

### Task Scheduler Not Running

**Issue:** Scheduled tasks not executing

**Solution:**
1. Open Task Scheduler → Task Scheduler Library
2. Find task → Right-click → Properties
3. Check "Last Run Result" (should be `0x0` for success)
4. Check "Last Run Time" (should be recent)
5. View "History" tab for detailed execution log

---

## Production Checklist

- [ ] `.env` configured with production settings
- [ ] `APP_DEBUG=false` in `.env`
- [ ] Email SMTP credentials configured and tested
- [ ] Database connection working
- [ ] Migrations run successfully
- [ ] Configuration cached (`php artisan config:cache`)
- [ ] Queue Worker task created and running
- [ ] Notification Processor task created and running
- [ ] Scheduler task created and running
- [ ] Test notification sent successfully
- [ ] Email received successfully
- [ ] Force logout tested
- [ ] Logs monitored for errors

---

## Maintenance

### Daily Checks

```powershell
# Check if background processes are running
tasklist | findstr php

# Check queue for stuck jobs
php artisan db:table jobs

# Check failed jobs
php artisan db:table failed_jobs

# Check recent logs
Get-Content -Path "storage\logs\laravel.log" -Tail 50
```

### Weekly Tasks

- Review failed notifications:
  ```sql
  SELECT * FROM fjp_scheduled_notifications 
  WHERE retry_count >= 3;
  ```

- Clear old notifications (automated weekly on Sundays at 2 AM)

### Monthly Tasks

- Review audit logs (automated monthly cleanup)
- Check email quota/limits
- Review and optimize queue performance

---

## Support

**Logs Location:** `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\storage\logs`

**Database:** `fjpwl_sys_db` on `127.0.0.1:3306`

**Key Tables:**
- `fjp_scheduled_notifications` - Notification records
- `jobs` - Queued jobs
- `failed_jobs` - Failed jobs
- `fjp_audit_logs` - System audit trail

**Commands Reference:**
```powershell
# Queue management
php artisan queue:work          # Start worker
php artisan queue:restart       # Restart all workers
php artisan queue:retry all     # Retry failed jobs
php artisan queue:flush         # Clear failed jobs

# Notification management
php artisan notifications:process              # Run continuously
php artisan notifications:process --once       # Run once

# Force logout
php artisan users:force-logout                 # Execute
php artisan users:force-logout --dry-run       # Preview

# Scheduler
php artisan schedule:list       # List scheduled tasks
php artisan schedule:run        # Run scheduled tasks manually
```

---

## 🎉 Production Ready!

All background jobs and email automation are now configured for production on Windows. The system will:

✅ Process email notifications every 45 seconds  
✅ Send emails via SMTP queue jobs  
✅ Force logout users hourly  
✅ Cleanup old data automatically  
✅ Log all activities  
✅ Retry failed jobs automatically  

Monitor logs regularly and ensure all 3 Windows tasks are running continuously.
