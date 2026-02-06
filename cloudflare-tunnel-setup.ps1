# Cloudflare Tunnel Setup Script for Windows
# This script will download and set up cloudflared to expose your Docker application

Write-Host "=== Cloudflare Tunnel Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Download cloudflared
$cloudflaredPath = "$PSScriptRoot\cloudflared.exe"

if (Test-Path $cloudflaredPath) {
    Write-Host "cloudflared already exists" -ForegroundColor Green
} else {
    Write-Host "Downloading cloudflared..." -ForegroundColor Yellow
    $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflaredPath
    Write-Host "Downloaded cloudflared successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start the tunnel, run:" -ForegroundColor Cyan
Write-Host "  .\start-tunnel.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Or manually with:" -ForegroundColor Cyan
Write-Host "  .\cloudflared.exe tunnel --url http://localhost:8000" -ForegroundColor Yellow
Write-Host ""
