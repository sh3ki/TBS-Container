# Start Laravel App and Cloudflare Tunnel
# This script starts Laravel (artisan serve), Vite dev server, and Cloudflare tunnel

Write-Host "=== Starting TBS Container System ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Start Laravel Server
Write-Host "1. Starting Laravel Artisan Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD'
Write-Host '=== Laravel Artisan Server ===' -ForegroundColor Green
Write-Host 'Server: http://localhost:8000' -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop' -ForegroundColor Yellow
Write-Host ''
php artisan serve
"@

Start-Sleep -Seconds 3

# Step 2: Start Vite Dev Server
Write-Host "2. Starting Vite Development Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD'
Write-Host '=== Vite Dev Server ===' -ForegroundColor Green
Write-Host 'Hot module reloading enabled' -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop' -ForegroundColor Yellow
Write-Host ''
npm run dev
"@

Start-Sleep -Seconds 5

# Step 3: Start Cloudflare Tunnel
Write-Host "3. Starting Cloudflare Tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD'
Write-Host '=== Cloudflare Tunnel ===' -ForegroundColor Green
Write-Host 'Creating secure HTTPS tunnel...' -ForegroundColor Cyan
Write-Host 'Look for the public URL below!' -ForegroundColor Yellow
Write-Host ''
.\cloudflared.exe tunnel --url http://localhost:8000
"@

Write-Host ""
Write-Host "✅ All Services Starting!" -ForegroundColor Green
Write-Host ""
Write-Host "Three windows have been opened:" -ForegroundColor Cyan
Write-Host "  1. Laravel Artisan Server (http://localhost:8000)" -ForegroundColor White
Write-Host "  2. Vite Dev Server (Hot reload for React/JS)" -ForegroundColor White
Write-Host "  3. Cloudflare Tunnel (Public HTTPS access)" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Look in the Cloudflare Tunnel window for your public URL!" -ForegroundColor Yellow
Write-Host "   It will look like: https://something-random.trycloudflare.com" -ForegroundColor Yellow
Write-Host ""
Write-Host "Share that URL with anyone to give them access!" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
