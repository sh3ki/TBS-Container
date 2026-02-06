# Complete Setup for Cloudflare Tunnel with Laravel + Vite
# UNLIMITED & FREE with permanent URL

Write-Host "=== Cloudflare Tunnel - Permanent Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if already logged in
if (Test-Path "$PSScriptRoot\.cloudflared") {
    Write-Host "Already logged in to Cloudflare!" -ForegroundColor Green
} else {
    Write-Host "Step 1: Login to Cloudflare" -ForegroundColor Yellow
    Write-Host "This will open your browser. Login or create a FREE account." -ForegroundColor White
    Write-Host ""
    
    .\cloudflared.exe tunnel login
    
    if (-not (Test-Path "$PSScriptRoot\.cloudflared")) {
        Write-Host "Login failed or cancelled." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 2: Create permanent tunnel" -ForegroundColor Yellow

# Check if tunnel already exists
$tunnelList = .\cloudflared.exe tunnel list 2>&1 | Out-String
if ($tunnelList -match "tbs-container") {
    Write-Host "Tunnel 'tbs-container' already exists!" -ForegroundColor Green
} else {
    .\cloudflared.exe tunnel create tbs-container
}

Write-Host ""
Write-Host "Step 3: Get your tunnel ID" -ForegroundColor Yellow
$tunnelInfo = .\cloudflared.exe tunnel list | Select-String "tbs-container"
Write-Host "Tunnel Info: $tunnelInfo" -ForegroundColor White

Write-Host ""
Write-Host "Step 4: Setup DNS" -ForegroundColor Yellow
Write-Host "Run this command with YOUR domain:" -ForegroundColor White
Write-Host "  .\cloudflared.exe tunnel route dns tbs-container tbs.yourdomain.com" -ForegroundColor Yellow
Write-Host ""
Write-Host "OR use a Cloudflare subdomain (instant):" -ForegroundColor White
Write-Host "  Your tunnel URL will be: https://tbs-container.cfargotunnel.com" -ForegroundColor Cyan
Write-Host ""

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the tunnel: .\run-permanent-tunnel.ps1" -ForegroundColor Cyan
