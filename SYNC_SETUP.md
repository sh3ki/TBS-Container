# Laravel to Legacy Database Synchronization

Laravel is authoritative. The local legacy PHP database remains fully writable; local changes are not sent back to Laravel and may be overwritten by the next Laravel change for the same record.

## Deploy Laravel changes

Push the code and run the normal Hostinger deployment. The migration creates `fjp_sync_events` and MySQL triggers for the 15 synchronized tables.

On Hostinger, verify the migration:

```bash
cd /var/www/tbscontainermnl
php artisan migrate --force
php artisan route:cache
php artisan sync:create-token YOUR_LARAVEL_USERNAME
```

Copy the token once. It is not displayed again.

## Configure the Windows computer

In an elevated PowerShell window, set the two environment variables. Replace the token with the value generated above:

```powershell
setx FJPWL_SYNC_URL "https://tbscontainermnl.com/api/sync"
setx FJPWL_SYNC_TOKEN "PASTE_TOKEN_HERE"
```

Open a new terminal after using `setx`.

## Verify the existing baseline

Because the local database was manually copied from Laravel, first compare schemas, row counts, and deterministic record fingerprints:

```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\VANILLA\fjpwl_system
C:\xampp\php\php.exe tools\sync_from_laravel.php --check
```

Only if every table reports `[OK]`, establish the future-change cursor:

```powershell
C:\xampp\php\php.exe tools\sync_from_laravel.php --bootstrap
```

`--bootstrap` does not copy old data. It records the current Laravel event ID so synchronization starts with future changes.

## Test synchronization manually

```powershell
C:\xampp\php\php.exe tools\sync_from_laravel.php --run
```

Create or update a test record in Laravel, then run the command again. Confirm the corresponding local record changed.

## Schedule every minute

Create a Windows Task Scheduler task with:

- Program: `C:\xampp\php\php.exe`
- Arguments: `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\VANILLA\fjpwl_system\tools\sync_from_laravel.php --run`
- Start in: `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\VANILLA\fjpwl_system`
- Trigger: repeat every 1 minute indefinitely
- Setting: do not start a new instance if one is already running

The script is transactional and resumes from its last successful cursor if the computer or internet connection is unavailable.
