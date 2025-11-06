# BACKGROUND JOBS MODULE - COMPLETE DOCUMENTATION
## FJPWL Laravel System

---

## 📋 TABLE OF CONTENTS
1. [Overview](#overview)
2. [Migration from Legacy](#migration-from-legacy)
3. [Available Jobs](#available-jobs)
4. [Database Tables](#database-tables)
5. [Configuration](#configuration)
6. [Running Jobs](#running-jobs)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 OVERVIEW

This module implements the complete background jobs system from the legacy FJPWL PHP application, now modernized with Laravel's job queue system. All legacy functionality has been preserved and enhanced.

### Key Features:
✅ **Force Logoff** - Automatically logout users after shift ends  
✅ **Multi-Channel Notifications** - Email, SMS, Phone, Fax delivery  
✅ **Booking Expiration Alerts** - Notify clients of expiring bookings  
✅ **Scheduled Delivery** - Send notifications at specific times  
✅ **Retry Logic** - Automatic retries for failed deliveries  
✅ **Audit Logging** - Complete tracking of all job executions  

---

## 🔄 MIGRATION FROM LEGACY

### Legacy System (PHP):
```
public/cron/FORCE_LOGOFF/index.php     → ForceLogoffUsers.php
public/php/tbs/web/export.ro (jPAM)   → ProcessScheduledNotifications.php
public/cron/email_sender.php           → ProcessScheduledNotifications.php
```

### Legacy Tables:
```
MX.PAM (InterSystems Caché)  → fjp_scheduled_notifications (MySQL)
```

### Legacy Timings Preserved:
| Job | Legacy Timing | Laravel Timing |
|-----|--------------|----------------|
| Force Logoff | Hourly/Daily at midnight | Hourly |
| Notifications | Every 45 seconds | Every 5 minutes* |
| Booking Checks | Daily at 8 AM | Daily at 8 AM |

\* Can be changed to every minute if needed (see console.php)

---

## 📦 AVAILABLE JOBS

### 1. ForceLogoffUsers
**Purpose:** Automatically logout users who forgot to logout after their shift ended.

**Legacy Location:** `public/cron/FORCE_LOGOFF/index.php`

**What It Does:**
- Revokes authentication tokens for users with tokens older than 24 hours
- Maintains data integrity and accurate attendance tracking
- Prevents users from appearing permanently logged in

**Schedule:** Hourly

**Manual Run:**
```powershell
php artisan jobs:force-logoff
```

**Configuration:**
```env
FORCE_LOGOFF_ENABLED=true
FORCE_LOGOFF_TOKEN_EXPIRY=24  # Hours
```

---

### 2. ProcessScheduledNotifications
**Purpose:** Multi-channel notification system that sends messages via Email, SMS, Phone, and Fax.

**Legacy Location:** `public/php/tbs/web/export.ro` (jPAM routine)

**What It Does:**
- Processes pending notifications from `fjp_scheduled_notifications` table
- Delivers via multiple channels simultaneously:
  - **Email** (personal + office addresses)
  - **SMS** (personal + office mobile numbers)
  - **Phone Calls** (home + office + mobile phones)
  - **Fax** (home + office fax machines)
  - **On-Screen** notifications
- Tracks acknowledgment and delivery status
- Retries failed deliveries (max 3 attempts)

**Schedule:** Every 5 minutes

**Manual Run:**
```powershell
php artisan notifications:process
```

**Configuration:**
```env
PROCESS_NOTIFICATIONS_ENABLED=true
NOTIFICATION_BATCH_SIZE=100
NOTIFICATION_MAX_RETRIES=3
```

---

### 3. CheckExpiringBookings
**Purpose:** Send expiration alerts to clients for bookings expiring soon.

**What It Does:**
- Checks for bookings expiring in next 3 days
- Sends email + SMS notifications to clients
- Logs all notifications in audit trail
- Identifies bookings expired with remaining containers

**Schedule:** Daily at 8:00 AM

**Manual Run:**
```powershell
php artisan bookings:check-expiring
```

**Configuration:**
```env
CHECK_BOOKINGS_ENABLED=true
BOOKING_ALERT_DAYS=3
```

---

## 💾 DATABASE TABLES

### fjp_scheduled_notifications
**Purpose:** Stores all scheduled notifications for multi-channel delivery.

**Migration File:** `database/migrations/2024_11_03_000001_create_scheduled_notifications_table.php`

**Run Migration:**
```powershell
php artisan migrate
```

**Table Structure:**
```sql
CREATE TABLE `fjp_scheduled_notifications` (
  `pam_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `from_user` int DEFAULT NULL,
  `to_user` int DEFAULT NULL,
  `sent_date` datetime DEFAULT NULL,
  `trigger_date` datetime DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `message` text,
  
  -- Delivery channels
  `screen` tinyint(1) DEFAULT '0',
  `email1` tinyint(1) DEFAULT '0',
  `email2` tinyint(1) DEFAULT '0',
  `sms1` tinyint(1) DEFAULT '0',
  `sms2` tinyint(1) DEFAULT '0',
  `tel1` tinyint(1) DEFAULT '0',
  `tel2` tinyint(1) DEFAULT '0',
  `mobile1` tinyint(1) DEFAULT '0',
  `mobile2` tinyint(1) DEFAULT '0',
  `fax1` tinyint(1) DEFAULT '0',
  `fax2` tinyint(1) DEFAULT '0',
  
  -- Acknowledgment tracking
  `ack_required` tinyint(1) DEFAULT '0',
  `ack_date` datetime DEFAULT NULL,
  `ack_message` text,
  
  -- Delivery status
  `delivered` tinyint(1) DEFAULT '0',
  `retry_count` int DEFAULT '0',
  `error_message` text,
  
  -- Additional fields
  `to_email` varchar(255) DEFAULT NULL,
  `to_phone` varchar(20) DEFAULT NULL,
  `to_address` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT '0',
  
  PRIMARY KEY (`pam_id`)
) ENGINE=InnoDB;
```

---

## ⚙️ CONFIGURATION

### 1. Environment Variables (.env)

Add these to your `.env` file:

```env
# ============================================================================
# BACKGROUND JOBS CONFIGURATION
# ============================================================================

# Force Logoff Job
FORCE_LOGOFF_ENABLED=true
FORCE_LOGOFF_TOKEN_EXPIRY=24

# Notifications Job
PROCESS_NOTIFICATIONS_ENABLED=true
NOTIFICATION_BATCH_SIZE=100
NOTIFICATION_MAX_RETRIES=3

# Bookings Check Job
CHECK_BOOKINGS_ENABLED=true
BOOKING_ALERT_DAYS=3

# ============================================================================
# SMS GATEWAY CONFIGURATION
# ============================================================================

SMS_GATEWAY_URL=http://172.16.1.91:80/sendsms
SMS_GATEWAY_USER=admin
SMS_GATEWAY_PASSWORD=passw0rd
SMS_DEFAULT_PORT=gsm-2.1
SMS_GLOBE_PORT=gsm-2.1
SMS_SMART_PORT=gsm-2.1
SMS_TIMEOUT=10

# ============================================================================
# EMAIL NOTIFICATIONS
# ============================================================================

EMAIL_NOTIFICATIONS_ENABLED=true
MAIL_FROM_ADDRESS=noreply@fjpwl.com
MAIL_FROM_NAME="FJPWL System"
EMAIL_REPLY_TO=info@fjpwl.com

# SMTP Settings (Legacy: smtp.bizmail.yahoo.com)
MAIL_MAILER=smtp
MAIL_HOST=smtp.bizmail.yahoo.com
MAIL_PORT=587
MAIL_USERNAME=PAM@Mx-Sys.com
MAIL_PASSWORD=your_email_password
MAIL_ENCRYPTION=tls

# ============================================================================
# QUEUE CONFIGURATION
# ============================================================================

QUEUE_CONNECTION=database
```

### 2. Queue Configuration (config/queue.php)

The queue is already configured to use the database driver. No changes needed.

### 3. Services Configuration (config/services.php)

All SMS and notification settings are configured in `config/services.php`.

---

## 🚀 RUNNING JOBS

### Method 1: Scheduled Automatic Execution (Production)

Laravel's scheduler handles all jobs automatically. You just need to add ONE cron entry:

**Windows (Task Scheduler):**

1. Open Task Scheduler
2. Create new task:
   - **Name:** Laravel Scheduler
   - **Trigger:** Every minute
   - **Action:** Start a program
     - Program: `C:\laragon\bin\php\php8.1.10\php.exe`
     - Arguments: `artisan schedule:run`
     - Start in: `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl`

**Linux (Crontab):**
```bash
* * * * * cd /path/to/fjpwl && php artisan schedule:run >> /dev/null 2>&1
```

This single cron entry will run ALL scheduled jobs at their configured times.

### Method 2: Queue Worker (Required for job processing)

Start the queue worker to process jobs:

```powershell
# Start queue worker
php artisan queue:work

# With specific options
php artisan queue:work --tries=3 --timeout=60

# Run in background (Windows)
start /B php artisan queue:work
```

**For Production:** Use a process manager like:
- Windows: NSSM (Non-Sucking Service Manager)
- Linux: Supervisor

### Method 3: Manual Testing

Run individual jobs for testing:

```powershell
# Test force logoff
php artisan jobs:force-logoff

# Test notifications
php artisan notifications:process

# Test booking checks
php artisan bookings:check-expiring

# Or dispatch directly
php artisan tinker
>>> App\Jobs\ForceLogoffUsers::dispatch();
>>> App\Jobs\ProcessScheduledNotifications::dispatch();
>>> App\Jobs\CheckExpiringBookings::dispatch();
```

---

## 📊 MONITORING

### 1. Check Scheduled Jobs

```powershell
# List all scheduled jobs
php artisan schedule:list
```

Output:
```
0 * * * * force-logoff-users .................... Next Due: 1 hour from now
*/5 * * * * process-notifications ............... Next Due: 3 minutes from now
0 8 * * * check-expiring-bookings ............... Next Due: Tomorrow at 8:00
```

### 2. Monitor Queue

```powershell
# Check queue status
php artisan queue:monitor

# View failed jobs
php artisan queue:failed

# Retry failed jobs
php artisan queue:retry all

# Clear failed jobs
php artisan queue:flush
```

### 3. Check Logs

**Laravel Logs:**
```
storage/logs/laravel.log
```

**Audit Logs:**
```sql
SELECT * FROM fjp_audit_logs 
WHERE action IN ('SYSTEM', 'NOTIFICATION', 'LOGOUT') 
ORDER BY date_added DESC 
LIMIT 50;
```

**Notification Status:**
```sql
SELECT 
    type,
    COUNT(*) as total,
    SUM(delivered) as delivered,
    SUM(CASE WHEN delivered = 0 AND deleted = 0 THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END) as retried
FROM fjp_scheduled_notifications
GROUP BY type;
```

---

## 📈 USAGE EXAMPLES

### Example 1: Send Booking Confirmation

```php
use App\Services\NotificationService;

$notificationService = app(NotificationService::class);

$notificationService->sendBookingConfirmation(
    bookingData: [
        'book_no' => 'BK-2024-001',
        'shipper' => 'ABC Corp',
        'expiration_date' => '2024-12-31',
    ],
    clientEmail: 'client@example.com',
    clientPhone: '09123456789'
);
```

### Example 2: Send Gate-In Notification

```php
$notificationService->sendGateInNotification(
    gateData: [
        'container_no' => 'ABCD1234567',
        'plate_no' => 'ABC-1234',
        'hauler' => 'XYZ Trucking',
    ],
    clientEmail: 'client@example.com',
    clientPhone: '09123456789'
);
```

### Example 3: Create Custom Notification

```php
use App\Models\ScheduledNotification;

ScheduledNotification::create([
    'from_user' => auth()->id(),
    'to_user' => $clientUserId,
    'type' => 'Custom Alert',
    'message' => 'Your custom message here',
    'trigger_date' => now()->addHours(2), // Send in 2 hours
    'email1' => true,
    'sms1' => true,
    'ack_required' => true,
]);
```

---

## 🔧 TROUBLESHOOTING

### Issue 1: Jobs Not Running

**Problem:** Jobs are scheduled but not executing

**Solutions:**
1. Check scheduler is running:
   ```powershell
   php artisan schedule:list
   ```

2. Verify cron/task scheduler entry exists

3. Check queue worker is running:
   ```powershell
   php artisan queue:work
   ```

4. Check logs:
   ```powershell
   tail storage/logs/laravel.log
   ```

### Issue 2: Notifications Not Sending

**Problem:** Notifications created but not delivered

**Solutions:**
1. Check table exists:
   ```powershell
   php artisan migrate
   ```

2. Check configuration:
   ```powershell
   php artisan config:cache
   ```

3. Test manually:
   ```powershell
   php artisan notifications:process
   ```

4. Check notification status:
   ```sql
   SELECT * FROM fjp_scheduled_notifications 
   WHERE delivered = 0 
   ORDER BY trigger_date DESC;
   ```

### Issue 3: SMS Not Sending

**Problem:** SMS notifications failing

**Solutions:**
1. Check SMS gateway configuration in `.env`

2. Test SMS service:
   ```php
   php artisan tinker
   >>> $sms = app(\App\Services\SmsService::class);
   >>> $sms->send('09123456789', 'Test message');
   ```

3. Check gateway status:
   ```php
   >>> $sms->getGatewayStatus();
   ```

4. Verify network connectivity to SMS gateway (172.16.1.91)

### Issue 4: Email Not Sending

**Problem:** Email notifications failing

**Solutions:**
1. Check email configuration in `.env`

2. Test email:
   ```powershell
   php artisan tinker
   >>> Mail::raw('Test', fn($m) => $m->to('test@example.com')->subject('Test'));
   ```

3. Check SMTP credentials

4. Enable mail debugging:
   ```env
   MAIL_DEBUG=true
   LOG_CHANNEL=daily
   ```

### Issue 5: Queue Worker Stops

**Problem:** Queue worker stops processing

**Solutions:**
1. Restart queue worker:
   ```powershell
   php artisan queue:restart
   ```

2. Check for failed jobs:
   ```powershell
   php artisan queue:failed
   ```

3. Use supervisor or NSSM to auto-restart

4. Increase timeout:
   ```powershell
   php artisan queue:work --timeout=120
   ```

---

## 📝 MAINTENANCE

### Daily:
- [ ] Check queue for failed jobs
- [ ] Review notification delivery rates
- [ ] Monitor disk space (logs, queue table)

### Weekly:
- [ ] Review audit logs for job executions
- [ ] Clear old delivered notifications (auto-scheduled)
- [ ] Check SMS gateway connectivity

### Monthly:
- [ ] Archive old audit logs (auto-scheduled)
- [ ] Review and optimize job schedules
- [ ] Update SMS/Email credentials if needed

---

## 🆘 SUPPORT

### Log Locations:
- **Laravel Logs:** `storage/logs/laravel.log`
- **Audit Logs:** Database table `fjp_audit_logs`
- **Queue Logs:** Database table `jobs` and `failed_jobs`

### Useful Commands:
```powershell
# View real-time logs
tail -f storage/logs/laravel.log  # Linux
Get-Content storage/logs/laravel.log -Wait  # Windows

# Clear caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear

# Database
php artisan migrate:status
php artisan db:show

# Jobs
php artisan queue:monitor
php artisan queue:failed
php artisan queue:retry all
```

---

## ✅ COMPLETION CHECKLIST

Before deploying to production:

- [ ] Run migration: `php artisan migrate`
- [ ] Configure `.env` with SMS/Email settings
- [ ] Test each job manually
- [ ] Set up scheduler cron/task
- [ ] Start queue worker
- [ ] Monitor for 24 hours
- [ ] Verify notifications are sending
- [ ] Check audit logs are being created

---

**Document Version:** 1.0  
**Last Updated:** November 3, 2024  
**System:** FJPWL Container Yard Management System (Laravel)
