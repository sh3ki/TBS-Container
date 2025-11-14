# EMAIL AUTOMATION & BACKGROUND JOBS - IMPLEMENTATION COMPLETE ✅

## Overview
Successfully implemented the legacy PAM (Personal Admin Manager) email automation system and background jobs for the Laravel TBS application. This replicates the functionality from the legacy InterSystems Caché system.

---

## 📋 What Was Implemented

### 1. **ScheduledNotification Model** ✅
**File:** `app/Models/ScheduledNotification.php`

**Features:**
- Full model with relationships to User model (from_user, to_user)
- Eloquent scopes:
  - `pending()` - Get notifications ready to send
  - `delivered()` - Get sent notifications
  - `ofType($type)` - Filter by notification type
- Helper methods:
  - `markAsDelivered()` - Update delivery status
  - `markAsFailed()` - Track retry attempts
  - `shouldRetry()` - Check if max retries (3) reached
  - `getActiveChannels()` - Get enabled delivery channels
- All PAM fields supported (email1/2, sms1/2, tel1/2, mobile1/2, fax1/2, screen)

### 2. **NotificationService** ✅
**File:** `app/Services/NotificationService.php` (Already exists - enhanced)

**Methods:**
- `create()` - Create custom notifications
- `process()` - Process notifications through active channels
- Multi-channel delivery via EmailService, SmsService

### 3. **SendEmailNotification Job** ✅
**File:** `app/Jobs/SendEmailNotification.php`

**Features:**
- Queued email sending via Laravel Mail
- Automatic retry logic (3 attempts with backoff: 1min, 5min, 10min)
- Delivery status tracking
- Error logging and reporting
- Acknowledgment notification creation for critical messages
- Admin alerts on failed critical notifications

### 4. **ProcessPendingNotifications Command** ✅
**File:** `app/Console/Commands/ProcessPendingNotifications.php`

**Features:**
- Mimics legacy jPAM background job behavior
- Continuous loop checking every 45 seconds (like legacy)
- Dispatches email jobs to queue for pending notifications
- `--once` flag for scheduled execution via cron
- Detailed logging and console output
- Skips notifications with max retries reached
- Validates email addresses before dispatching

**Usage:**
```bash
# Run once (for cron/scheduler)
php artisan notifications:process --once

# Run continuously (for production - use with supervisor)
php artisan notifications:process
```

### 5. **ForceLogoutUsers Command** ✅
**File:** `app/Console/Commands/ForceLogoutUsers.php`

**Features:**
- Automatically logs out users who forgot to logout after shift
- Checks fjp_users table for users with dt_stamp_end = NULL
- Calculates expected logout time (login time + 8 hours)
- Updates dt_stamp_end when overdue
- Creates audit log entries for force logout actions
- `--dry-run` flag for testing
- Detailed logging of overdue hours

**Usage:**
```bash
# Dry run (see what would happen)
php artisan users:force-logout --dry-run

# Execute force logout
php artisan users:force-logout
```

### 6. **Task Scheduler Configuration** ✅
**File:** `routes/console.php`

**Scheduled Tasks:**

| Task | Schedule | Description |
|------|----------|-------------|
| `notifications:process --once` | Every minute | Process pending notifications (mimics 45-sec jPAM loop) |
| `users:force-logout` | Hourly at :05 | Force logout users past shift end |
| Cleanup old notifications | Weekly Sundays 2 AM | Delete delivered notifications > 90 days |
| Cleanup old audit logs | Monthly | Delete audit logs > 180 days |

---

## 🗂️ Database Structure

### fjp_scheduled_notifications Table (Already exists)

**Primary Key:** `pam_id`

**User Tracking:**
- `from_user` - Sender user ID
- `to_user` - Recipient user ID

**Timing:**
- `sent_date` - When notification was created
- `trigger_date` - When notification should be sent (scheduled delivery)

**Content:**
- `type` - Notification type (Booking Confirmation, Gate In, Invoice Reminder, etc.)
- `message` - Notification message body

**Multi-Channel Delivery Flags:**
- `screen` - Show on-screen notification
- `email1`, `email2` - Send to primary/secondary email
- `sms1`, `sms2` - Send SMS (not implemented - requires Skype)
- `tel1`, `tel2` - Phone call (not implemented)
- `mobile1`, `mobile2` - Mobile call (not implemented)
- `fax1`, `fax2` - Fax (not implemented)

**Acknowledgment:**
- `ack_required` - Requires acknowledgment
- `ack_date` - When acknowledged
- `ack_message` - Acknowledgment message

**Delivery Tracking:**
- `delivered` - Boolean delivery status
- `retry_count` - Number of retry attempts
- `error_message` - Last error message

**Contact Info:**
- `to_email` - Recipient email address
- `to_phone` - Recipient phone (for SMS/calls)
- `to_address` - Recipient address

**Soft Delete:**
- `deleted` - Boolean flag for soft delete

**Indexes:**
- `[trigger_date, delivered]` - Fast pending notification queries
- `[to_user, delivered]` - User-specific notifications
- `[type, trigger_date]` - Type-based queries

---

## 🚀 Setup Instructions

### Step 1: Configure Email Settings

Edit `.env` file:

```env
# Mail Configuration (Using legacy SMTP settings)
MAIL_MAILER=smtp
MAIL_HOST=smtp.bizmail.yahoo.com
MAIL_PORT=587
MAIL_USERNAME=your-email@fjpwl.com
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@fjpwl.com
MAIL_FROM_NAME="TBS Container Management"
```

### Step 2: Configure Queue System

Edit `.env` file:

```env
# Queue Configuration (Use database driver for simplicity)
QUEUE_CONNECTION=database

# For production, consider Redis for better performance
# QUEUE_CONNECTION=redis
# REDIS_HOST=127.0.0.1
# REDIS_PASSWORD=null
# REDIS_PORT=6379
```

### Step 3: Run Database Migration (Already exists)

```bash
php artisan migrate
```

### Step 4: Start Queue Worker

**For Development (Windows):**
```powershell
php artisan queue:work --tries=3 --timeout=90
```

**For Production (Use Windows Service or Task Scheduler):**

Create a Windows Task Scheduler task:
- **Program:** `C:\path\to\php.exe`
- **Arguments:** `C:\path\to\artisan queue:work --tries=3 --timeout=90 --sleep=3 --max-time=3600`
- **Start in:** `C:\path\to\laravel\project`
- **Trigger:** At system startup
- **Run whether user is logged on or not**
- **Run with highest privileges**

### Step 5: Start Notification Processor

**For Development:**
```powershell
php artisan notifications:process
```

**For Production (Supervisor recommended, or Windows Service):**

Create another Windows Task Scheduler task:
- **Program:** `C:\path\to\php.exe`
- **Arguments:** `C:\path\to\artisan notifications:process`
- **Start in:** `C:\path\to\laravel\project`
- **Trigger:** At system startup
- **Run whether user is logged on or not**
- **Run with highest privileges**

### Step 6: Start Task Scheduler

**For Development:**
```powershell
php artisan schedule:work
```

**For Production (Windows Task Scheduler):**

Create a scheduled task:
- **Program:** `C:\path\to\php.exe`
- **Arguments:** `C:\path\to\artisan schedule:run`
- **Start in:** `C:\path\to\laravel\project`
- **Trigger:** Every 1 minute
- **Repeat task every:** 1 minute
- **Duration:** Indefinitely

---

## 📝 Usage Examples

### Example 1: Send Booking Confirmation Email

```php
use App\Services\NotificationService;

$notificationService = app(NotificationService::class);

$notificationService->create([
    'to_user' => 15, // Client user ID
    'type' => 'Booking Confirmation',
    'message' => "Container ABCD1234567 booked successfully.\nExpiration: 2025-01-15",
    'trigger_date' => now(), // Send immediately
    'email1' => true, // Send email
    'screen' => true, // Show on screen
    'ack_required' => false,
]);
```

### Example 2: Schedule Invoice Reminder

```php
use App\Models\ScheduledNotification;

ScheduledNotification::create([
    'from_user' => 1, // Admin
    'to_user' => 25, // Client
    'type' => 'Invoice Reminder',
    'message' => "Invoice #INV-2025-001 due on 2025-01-20\nAmount: ₱50,000.00",
    'trigger_date' => now()->addDays(3), // Send 3 days before due date
    'email1' => true,
    'email2' => true, // Send to secondary email too
    'screen' => true,
    'ack_required' => true, // Require acknowledgment
    'to_email' => 'client@example.com',
]);
```

### Example 3: Get Unread Notifications for User

```php
use App\Models\ScheduledNotification;

$unreadNotifications = ScheduledNotification::where('to_user', auth()->id())
    ->where('screen', true)
    ->where('deleted', false)
    ->whereNull('ack_date')
    ->orderBy('trigger_date', 'desc')
    ->get();
```

### Example 4: Mark Notification as Read

```php
$notification = ScheduledNotification::find($pamId);
$notification->markAsDelivered('Read by user');
```

---

## 🔧 Troubleshooting

### Queue Worker Not Processing Jobs

**Check:**
1. Queue worker is running: `ps aux | grep "queue:work"` (Linux) or Task Manager (Windows)
2. Database queue table has jobs: `SELECT * FROM jobs;`
3. Failed jobs table: `SELECT * FROM failed_jobs;`

**Restart queue worker:**
```bash
php artisan queue:restart
```

### Notifications Not Sending

**Check:**
1. Notification processor is running: `ps aux | grep "notifications:process"`
2. Email configuration in `.env`
3. Notification table: `SELECT * FROM fjp_scheduled_notifications WHERE delivered = 0;`
4. Error logs: `storage/logs/laravel.log`

**Test email manually:**
```bash
php artisan tinker
> Mail::raw('Test email', function($msg) { $msg->to('test@example.com')->subject('Test'); });
```

### Scheduler Not Running

**Check:**
1. Windows Task Scheduler task is enabled
2. Test scheduler manually: `php artisan schedule:run`
3. Check scheduled tasks: `php artisan schedule:list`

---

## 📊 Monitoring & Logs

### Application Logs
**Location:** `storage/logs/laravel.log`

**Logged Events:**
- Notification dispatched to queue
- Email sent successfully
- Email delivery failed
- Force logout executed
- Cleanup jobs completed

### Database Monitoring

**Check pending notifications:**
```sql
SELECT COUNT(*) FROM fjp_scheduled_notifications 
WHERE delivered = 0 AND deleted = 0 AND trigger_date <= NOW();
```

**Check failed notifications:**
```sql
SELECT * FROM fjp_scheduled_notifications 
WHERE retry_count >= 3 AND delivered = 0;
```

**Check recent deliveries:**
```sql
SELECT * FROM fjp_scheduled_notifications 
WHERE delivered = 1 
ORDER BY ack_date DESC 
LIMIT 20;
```

### Queue Monitoring

**Check queue jobs:**
```sql
SELECT * FROM jobs ORDER BY created_at DESC LIMIT 20;
```

**Check failed jobs:**
```sql
SELECT * FROM failed_jobs ORDER BY failed_at DESC;
```

---

## 🎯 Next Steps

### Optional Enhancements

1. **Web UI for Notifications**
   - Create Inertia page to display on-screen notifications
   - Add notification bell icon in header
   - Implement real-time notifications using Laravel Echo + Pusher

2. **Email Templates**
   - Create Blade email templates for better formatting
   - Add company logo and branding
   - HTML email support

3. **Notification Dashboard**
   - Admin page to view all notifications
   - Filter by type, user, delivery status
   - Resend failed notifications

4. **SMS Integration (if needed)**
   - Integrate SMS gateway (Twilio, Vonage, etc.)
   - Enable sms1/sms2 channel delivery

5. **Performance Optimization**
   - Switch to Redis queue driver
   - Implement queue priorities (high/normal/low)
   - Add queue monitoring dashboard

---

## ✅ Implementation Checklist

- [x] ScheduledNotification Model with relationships and scopes
- [x] NotificationService enhanced (already existed)
- [x] SendEmailNotification Job with retry logic
- [x] ProcessPendingNotifications Command (45-second loop)
- [x] ForceLogoutUsers Command
- [x] Task Scheduler configuration
- [x] Email configuration instructions
- [x] Queue setup instructions
- [x] Documentation and usage examples

---

## 🎉 Summary

The email automation and background jobs system has been **fully implemented** and is ready for production use. The system replicates the legacy PAM functionality with the following improvements:

✅ **Laravel-native implementation** (Queue, Mail, Scheduler)  
✅ **Better error handling** and retry logic  
✅ **Comprehensive logging** and monitoring  
✅ **Scalable architecture** (can switch to Redis easily)  
✅ **Backward compatible** with legacy database structure  

**Next:** Configure email settings, start queue worker and notification processor, test with real notifications.
