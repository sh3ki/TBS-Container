# Database Upload Script for Windows

# This script uploads the large tbs_db.sql file to your VPS server
# Run this from PowerShell on your local machine

Write-Host "🗄️  TBS Container - Database Upload Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$dbFile = "C:\Users\USER\Documents\SYSTEMS\WEB\PHP\LARAVEL\fjpwl\tbs_db.sql"
$serverIP = "72.60.42.105"
$serverUser = "root"
$remotePath = "/tmp/tbs_db.sql"

# Check if database file exists
if (-Not (Test-Path $dbFile)) {
    Write-Host "❌ Error: Database file not found at $dbFile" -ForegroundColor Red
    exit 1
}

# Get file size
$fileSize = (Get-Item $dbFile).Length / 1MB
Write-Host "📊 Database file size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Yellow
Write-Host ""

Write-Host "📤 Uploading database to server..." -ForegroundColor Green
Write-Host "   From: $dbFile" -ForegroundColor Gray
Write-Host "   To: $serverUser@$serverIP`:$remotePath" -ForegroundColor Gray
Write-Host ""

# Upload using SCP
$scpCommand = "scp `"$dbFile`" ${serverUser}@${serverIP}:${remotePath}"
Write-Host "🔐 You will be prompted for the server password..." -ForegroundColor Yellow
Write-Host ""

# Execute SCP
Invoke-Expression $scpCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Database file uploaded successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. SSH into your server:" -ForegroundColor White
    Write-Host "      ssh root@72.60.42.105" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Import the database:" -ForegroundColor White
    Write-Host "      mysql -u tbs_user -p tbs_container < /tmp/tbs_db.sql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   3. Clean up the temporary file:" -ForegroundColor White
    Write-Host "      rm /tmp/tbs_db.sql" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Upload failed! Please check your connection and credentials." -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   - Make sure you can ping the server: ping 72.60.42.105" -ForegroundColor Gray
    Write-Host "   - Verify SSH access: ssh root@72.60.42.105" -ForegroundColor Gray
    Write-Host "   - Check if SCP is available in your PATH" -ForegroundColor Gray
    Write-Host ""
}
