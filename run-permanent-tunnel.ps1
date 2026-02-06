# Run Permanent Cloudflare Tunnel
# This starts your permanent tunnel with unlimited bandwidth

Write-Host "=== Starting Permanent Cloudflare Tunnel ===" -ForegroundColor Cyan
Write-Host ""

# Start Laravel Server
Write-Host "Starting Laravel (port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD'
Write-Host '=== Laravel Development Server ===' -ForegroundColor Green
php artisan serve
"@

Start-Sleep -Seconds 3

# Start Vite Dev Server  
Write-Host "Starting Vite (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD'
Write-Host '=== Vite Development Server ===' -ForegroundColor Green
npm run dev
"@

Start-Sleep -Seconds 3

# Start Cloudflare Tunnel
Write-Host "Starting Cloudflare Tunnel..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Your application will be available at:" -ForegroundColor Green
Write-Host "  https://tbs-container.cfargotunnel.com" -ForegroundColor Cyan
Write-Host ""
Write-Host "OR if you set up DNS:" -ForegroundColor Green
Write-Host "  https://your-custom-domain.com" -ForegroundColor Cyan
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD'
Write-Host '=== Cloudflare Tunnel ===' -ForegroundColor Green
Write-Host 'Tunnel is running...' -ForegroundColor Cyan
Write-Host ''
.\cloudflared.exe tunnel --config cloudflare-config.yml run tbs-container
"@

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Three windows opened:" -ForegroundColor White
Write-Host "  1. Laravel Server" -ForegroundColor Gray
Write-Host "  2. Vite Dev Server" -ForegroundColor Gray  
Write-Host "  3. Cloudflare Tunnel" -ForegroundColor Gray
Write-Host ""
