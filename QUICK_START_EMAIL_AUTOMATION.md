# 🚀 Quick Start - Email Automation & Background Jobs

## For Development (Right Now)

### 1. Configure Email in .env

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.bizmail.yahoo.com
MAIL_PORT=587
MAIL_USERNAME=your-email@fjpwl.com
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@fjpwl.com
MAIL_FROM_NAME="TBS Container Management"

QUEUE_CONNECTION=database
```

### 2. Start Queue Worker (Terminal 1)

```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
php artisan queue:work --tries=3
```

**Keep this terminal open!**

### 3. Start Notification Processor (Terminal 2)

```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
php artisan notifications:process
```

**Keep this terminal open!** This runs the 45-second loop like legacy jPAM.

### 4. Start Scheduler (Terminal 3) - Optional

```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
php artisan schedule:work
```

**Keep this terminal open!** This runs scheduled tasks like force logout.

### 5. Test Notification (Terminal 4)

```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
php artisan tinker
```

```php
use App\Models\ScheduledNotification;

// Create test notification
ScheduledNotification::create([
    'to_user' => 1,
    'type' => 'Test Email',
    'message' => 'This is a test notification from TBS!',
    'trigger_date' => now(),
    'email1' => true,
    'delivered' => false,
    'to_email' => 'your-email@example.com', // Change this to your email
]);

// Expected: Within 45 seconds, Terminal 2 will show "Notification #X dispatched to queue"
//           Then Terminal 1 will process the email job and send it
```

### 6. Watch It Work! 👀

**Terminal 2 (Notification Processor):** Will show something like:
```
[2025-01-14 10:30:00] Found 1 pending notification(s)
  ✓ Notification #1 dispatched to queue
Processed 1 notification(s) in 45ms
  - Dispatched: 1
```

**Terminal 1 (Queue Worker):** Will show:
```
[2025-01-14 10:30:01] Processing: App\Jobs\SendEmailNotification
[2025-01-14 10:30:03] Processed:  App\Jobs\SendEmailNotification
```

**Your Email:** Should receive the test email! 📧

---

## Testing Force Logout

```powershell
# Dry run to see what would happen
php artisan users:force-logout --dry-run

# Actually force logout users
php artisan users:force-logout
```

---

## Quick Reference

### Useful Commands

```powershell
# View scheduled tasks
php artisan schedule:list

# Check queue jobs
php artisan db:table jobs

# Check failed jobs
php artisan db:table failed_jobs

# Retry failed jobs
php artisan queue:retry all

# Check pending notifications
php artisan db
> SELECT * FROM fjp_scheduled_notifications WHERE delivered = 0;
```

### File Locations

- **Queue Worker:** `app/Jobs/SendEmailNotification.php`
- **Notification Processor:** `app/Console/Commands/ProcessPendingNotifications.php`
- **Force Logout:** `app/Console/Commands/ForceLogoutUsers.php`
- **Model:** `app/Models/ScheduledNotification.php`
- **Service:** `app/Services/NotificationService.php` (already exists)
- **Scheduler:** `routes/console.php`

### Database Tables

- `fjp_scheduled_notifications` - All notifications
- `jobs` - Queued jobs
- `failed_jobs` - Failed jobs
- `fjp_audit_logs` - Audit trail

---

## For Production

See: **`WINDOWS_PRODUCTION_SETUP.md`** for complete Windows Task Scheduler setup.

---

## Need Help?

**Logs:** `storage/logs/laravel.log`

**Watch logs in real-time:**
```powershell
Get-Content -Path "storage\logs\laravel.log" -Wait -Tail 50
```

---

## 🎉 That's It!

You now have:
- ✅ Email notifications working like legacy PAM
- ✅ 45-second background processor (jPAM equivalent)
- ✅ Force logout background job
- ✅ Queue-based email sending with retry logic
- ✅ Scheduled tasks for cleanup

**Next:** Configure production setup with Windows Task Scheduler (see `WINDOWS_PRODUCTION_SETUP.md`)
