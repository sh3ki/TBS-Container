# Database Upload & Import Guide

This guide helps you upload and import the large `tbs_db.sql` file (100MB+) to your VPS server.

---

## Option 1: Using PowerShell Script (Recommended for Windows)

### Step 1: Run the Upload Script

Open PowerShell and run:
```powershell
cd C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
.\upload-database.ps1
```

Enter the server password when prompted: `Shekisheki5726.`

### Step 2: SSH and Import

```bash
ssh root@72.60.42.105
cd /var/www/tbscontainermnl
chmod +x import-database.sh
./import-database.sh
```

---

## Option 2: Manual Upload & Import

### Step 1: Upload Database File

**From your local machine (PowerShell):**
```powershell
scp C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\tbs_db.sql root@72.60.42.105:/tmp/tbs_db.sql
```

### Step 2: Import Database

**SSH into server:**
```bash
ssh root@72.60.42.105
```

**Import the database:**
```bash
mysql -u tbs_user -p tbs_container < /tmp/tbs_db.sql
# Enter password: TbsSecure2025!
```

**Clean up:**
```bash
rm /tmp/tbs_db.sql
```

### Step 3: Run Specific Migrations

```bash
cd /var/www/tbscontainermnl

# Migration 1: Change audit_logs description to TEXT
php artisan migrate --path=/database/migrations/2025_11_14_000002_change_audit_logs_description_to_text.php --force

# Migration 2: Add all database indexes
php artisan migrate --path=/database/migrations/2025_11_14_100000_add_all_database_indexes.php --force
```

---

## Option 3: Using SFTP Client (FileZilla, WinSCP)

If SCP is not available, use an SFTP client:

1. **Download FileZilla or WinSCP** (free tools)

2. **Connect to server:**
   - Host: `sftp://72.60.42.105`
   - Username: `root`
   - Password: `Shekisheki5726.`
   - Port: `22`

3. **Upload file:**
   - Local: `C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\tbs_db.sql`
   - Remote: `/tmp/tbs_db.sql`

4. **Import via SSH** (see Step 2 above)

---

## Verification

After importing, verify the database:

```bash
# SSH into server
ssh root@72.60.42.105

# Connect to MySQL
mysql -u tbs_user -p tbs_container

# Show tables
SHOW TABLES;

# Count records in a table (example)
SELECT COUNT(*) FROM inventory;

# Exit MySQL
EXIT;
```

---

## Troubleshooting

### Upload is very slow
Large files can take time. For a 100MB+ file over internet, expect 5-15 minutes depending on your connection speed.

### "Permission denied" error
Make sure you're using the correct password: `Shekisheki5726.`

### Database import fails
Check if there's enough disk space:
```bash
df -h
```

Check MySQL is running:
```bash
systemctl status mysql
```

### "Table already exists" error
If you need to re-import:
```bash
# Drop and recreate database
mysql -u root -p
DROP DATABASE tbs_container;
CREATE DATABASE tbs_container;
GRANT ALL PRIVILEGES ON tbs_container.* TO 'tbs_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Then import again
mysql -u tbs_user -p tbs_container < /tmp/tbs_db.sql
```

---

## Important Notes

1. **Database file is NOT in GitHub** - It's too large (100MB+), so you must upload it manually
2. **Only 2 migrations needed** - The database already has all tables, we just need:
   - Change audit_logs description column to TEXT
   - Add all database indexes for performance
3. **Security** - Delete the SQL file from `/tmp/` after import
4. **Backup** - Keep a backup of `tbs_db.sql` on your local machine

---

## Quick Reference

```bash
# Local (PowerShell)
scp C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\tbs_db.sql root@72.60.42.105:/tmp/tbs_db.sql

# Server
ssh root@72.60.42.105
mysql -u tbs_user -p tbs_container < /tmp/tbs_db.sql
rm /tmp/tbs_db.sql

# Migrations
cd /var/www/tbscontainermnl
php artisan migrate --path=/database/migrations/2025_11_14_000002_change_audit_logs_description_to_text.php --force
php artisan migrate --path=/database/migrations/2025_11_14_100000_add_all_database_indexes.php --force
```
