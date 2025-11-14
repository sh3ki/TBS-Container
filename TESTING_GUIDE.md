# Quick Testing Guide - FJPWL System

## 🚀 Quick Start

### 1. Ensure Servers Are Running

**Backend (Laravel):**
```powershell
cd c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
php artisan serve
# Should see: Server started on http://localhost:8000
```

**Frontend (React + Vite):**
```powershell
cd c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl
npm run dev
# Should see: Local: http://localhost:5173/
```

---

## 🔐 Testing Authentication

### Test Login Endpoint (PowerShell)
```powershell
# Replace with actual username and password from legacy system
$credentials = @{
    username = "admin"
    password = "actual_password_here"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/login" `
                                   -Method POST `
                                   -Body $credentials `
                                   -ContentType "application/json"
    
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "Token: $($response.token)" -ForegroundColor Yellow
    
    # Save token for later use
    $global:authToken = $response.token
    
    Write-Output $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
}
```

---

## 📊 Testing API Endpoints

### Get Dashboard Statistics
```powershell
# Use the token from login
$headers = @{
    "Authorization" = "Bearer $global:authToken"
    "Accept" = "application/json"
}

$stats = Invoke-RestMethod -Uri "http://localhost:8000/api/dashboard/statistics" `
                            -Method GET `
                            -Headers $headers

Write-Output $stats | ConvertTo-Json -Depth 5
```

### Get Clients List
```powershell
$headers = @{
    "Authorization" = "Bearer $global:authToken"
    "Accept" = "application/json"
}

$clients = Invoke-RestMethod -Uri "http://localhost:8000/api/clients" `
                              -Method GET `
                              -Headers $headers

Write-Host "Total Clients: $($clients.data.total)" -ForegroundColor Green
Write-Output $clients | ConvertTo-Json -Depth 5
```

### Get Bookings List
```powershell
$headers = @{
    "Authorization" = "Bearer $global:authToken"
    "Accept" = "application/json"
}

$bookings = Invoke-RestMethod -Uri "http://localhost:8000/api/bookings?per_page=10" `
                               -Method GET `
                               -Headers $headers

Write-Host "Total Bookings: $($bookings.data.total)" -ForegroundColor Green
Write-Output $bookings | ConvertTo-Json -Depth 3
```

### Create New Client
```powershell
$newClient = @{
    client_code = "TEST001"
    client_name = "Test Company Ltd"
    contact_person = "John Doe"
    contact_number = "09171234567"
    email = "test@company.com"
    address = "123 Test Street, Manila"
    status = "active"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $global:authToken"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

try {
    $result = Invoke-RestMethod -Uri "http://localhost:8000/api/clients" `
                                 -Method POST `
                                 -Body $newClient `
                                 -Headers $headers
    
    Write-Host "✅ Client created successfully!" -ForegroundColor Green
    Write-Output $result | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ Failed to create client" -ForegroundColor Red
    Write-Output $_.ErrorDetails.Message
}
```

---

## 🌐 Testing Frontend

### 1. Open Browser
```
Navigate to: http://localhost:5173
```

### 2. Test Login
1. Should see a login form
2. Enter username and password from legacy system
3. Click "Login"
4. Should redirect to dashboard if credentials are correct

### 3. Test Dashboard
- Should display statistics (total clients, bookings, users)
- Should show recent activities
- Should display charts/graphs

### 4. Test Client Management
1. Click on "Clients" in navigation
2. Should see list of all clients
3. Click "Add New Client" button
4. Fill in client details
5. Submit form
6. Should see new client in the list

### 5. Test Booking Management
1. Click on "Bookings" in navigation
2. Should see list of bookings
3. Click "Create Booking" button
4. Fill in booking details
5. Submit form
6. Should see new booking in the list

---

## 🔍 Checking Database Directly

### Using Artisan Tinker
```powershell
cd c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl

# Count users
php artisan tinker --execute="echo 'Active Users: ' . App\Models\User::where('archived', 0)->count() . PHP_EOL;"

# Count clients
php artisan tinker --execute="echo 'Total Clients: ' . App\Models\Client::count() . PHP_EOL;"

# Count bookings
php artisan tinker --execute="echo 'Total Bookings: ' . App\Models\Booking::count() . PHP_EOL;"

# Get user details
php artisan tinker --execute="print_r(App\Models\User::with('privilege')->where('username', 'admin')->first()->toArray());"

# Get recent bookings
php artisan tinker --execute="print_r(App\Models\Booking::orderBy('created_at', 'desc')->take(5)->get()->toArray());"
```

### Using Raw SQL
```powershell
# Check users table
php artisan tinker --execute="print_r(DB::select('SELECT user_id, username, full_name, email, archived FROM fjp_users LIMIT 5'));"

# Check clients table
php artisan tinker --execute="print_r(DB::select('SELECT client_id, client_code, client_name, status FROM fjp_clients LIMIT 5'));"

# Check bookings table
php artisan tinker --execute="print_r(DB::select('SELECT booking_id, booking_number, client_id, container_no FROM fjp_bookings ORDER BY booking_id DESC LIMIT 5'));"
```

---

## 🐛 Debugging

### Check Logs
```powershell
# View latest errors
Get-Content c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\storage\logs\laravel.log -Tail 50

# Search for specific errors
Select-String -Path "c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\storage\logs\laravel.log" -Pattern "ERROR" -Context 0,3 | Select-Object -Last 5
```

### Check Server Status
```powershell
# Check if backend is running
curl http://localhost:8000

# Check API health
curl http://localhost:8000/up

# Check frontend is running
curl http://localhost:5173
```

### Clear Cache (if needed)
```powershell
cd c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl

php artisan config:clear
php artisan route:clear
php artisan cache:clear
php artisan view:clear
```

---

## 📝 Common Issues & Solutions

### Issue: "SQLSTATE[42S02]: Table not found"
**Solution:** Check that the table name has the correct prefix `fjp_`
```powershell
php artisan tinker --execute="print_r(DB::select('SHOW TABLES'));"
```

### Issue: "Authentication failed" (401)
**Solution:** Check that you're using correct username/password from legacy system
```powershell
# Verify user exists and is active
php artisan tinker --execute="print_r(DB::select('SELECT username, archived FROM fjp_users WHERE username = ?', ['admin']));"
```

### Issue: Frontend shows white screen
**Solution:** 
1. Check browser console for errors (F12)
2. Restart Vite dev server
3. Clear browser cache
4. Check that backend API is running

### Issue: "Column not found" error
**Solution:** The model doesn't match the actual database table structure
```powershell
# Check actual table structure
php artisan tinker --execute="print_r(DB::select('SHOW COLUMNS FROM fjp_[table_name]'));"
```

---

## ✅ Success Checklist

Before considering migration complete, verify:

- [ ] Backend server starts without errors
- [ ] Frontend server starts without errors
- [ ] Login with real credentials works
- [ ] Dashboard loads and shows correct statistics
- [ ] Can view list of clients
- [ ] Can create new client
- [ ] Can edit existing client
- [ ] Can view list of bookings
- [ ] Can create new booking
- [ ] Can view audit logs
- [ ] All API endpoints return expected data
- [ ] No errors in Laravel log file

---

## 🎯 Quick Test Script

Run this PowerShell script to test everything at once:

```powershell
# FJPWL System Quick Test Script
Write-Host "`n=== FJPWL SYSTEM TESTING ===" -ForegroundColor Cyan

# Test 1: Backend Health Check
Write-Host "`n[1/6] Testing Backend Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/up"
    Write-Host "✅ Backend is healthy" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running" -ForegroundColor Red
    exit
}

# Test 2: API Root
Write-Host "`n[2/6] Testing API Root..." -ForegroundColor Yellow
try {
    $root = Invoke-RestMethod -Uri "http://localhost:8000"
    Write-Host "✅ API is operational - Version: $($root.version)" -ForegroundColor Green
} catch {
    Write-Host "❌ API root endpoint failed" -ForegroundColor Red
}

# Test 3: Database Connection
Write-Host "`n[3/6] Testing Database Connection..." -ForegroundColor Yellow
try {
    $userCount = php artisan tinker --execute="echo App\Models\User::count();" 2>$null
    Write-Host "✅ Database connected - Users: $userCount" -ForegroundColor Green
} catch {
    Write-Host "❌ Database connection failed" -ForegroundColor Red
}

# Test 4: Login Endpoint (with wrong credentials - should return 401)
Write-Host "`n[4/6] Testing Login Endpoint..." -ForegroundColor Yellow
try {
    $login = Invoke-RestMethod -Uri "http://localhost:8000/api/login" -Method POST -Body '{"username":"test","password":"test"}' -ContentType "application/json"
    Write-Host "⚠️  Login accepted wrong credentials" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✅ Login endpoint working (correctly rejected invalid credentials)" -ForegroundColor Green
    } else {
        Write-Host "❌ Login endpoint error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 5: Frontend
Write-Host "`n[5/6] Testing Frontend..." -ForegroundColor Yellow
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -UseBasicParsing
    Write-Host "✅ Frontend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend is not running" -ForegroundColor Red
}

# Test 6: Check for errors in log
Write-Host "`n[6/6] Checking Recent Errors..." -ForegroundColor Yellow
$recentErrors = Select-String -Path "c:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\storage\logs\laravel.log" -Pattern "local.ERROR" | Select-Object -Last 3
if ($recentErrors) {
    Write-Host "⚠️  Found recent errors in log - check storage\logs\laravel.log" -ForegroundColor Yellow
} else {
    Write-Host "✅ No recent errors found" -ForegroundColor Green
}

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Cyan
Write-Host "Next step: Test login with real credentials from legacy system`n" -ForegroundColor White
```

---

## 📚 Additional Resources

- Laravel Documentation: https://laravel.com/docs/11.x
- React Documentation: https://react.dev
- Inertia.js Documentation: https://inertiajs.com
- Tailwind CSS: https://tailwindcss.com
- Laravel Sanctum: https://laravel.com/docs/11.x/sanctum

---

**Created:** October 20, 2025  
**System:** FJPWL Logistics Management System  
**Migration:** Legacy PHP → Laravel 11 + React 19
