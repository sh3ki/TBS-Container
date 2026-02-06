# Start Cloudflare Tunnel
# This will create a temporary public HTTPS URL for your Laravel application

Write-Host "=== Starting Cloudflare Tunnel ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your Laravel application will be accessible via a public HTTPS URL" -ForegroundColor Green
Write-Host "The tunnel will remain active until you press Ctrl+C" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting tunnel to http://localhost:8000..." -ForegroundColor Cyan
Write-Host ""

# Check what port your application is running on
Write-Host "Checking for running applications..." -ForegroundColor Yellow

$ports = @(8000, 8001, 3000, 80)
$foundPort = $null

foreach ($port in $ports) {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-Host "Found application running on port $port" -ForegroundColor Green
            $foundPort = $port
            break
        }
    } catch {
        continue
    }
}

if (-not $foundPort) {
    Write-Host "No application found running on common ports (8000, 8001, 3000, 80)" -ForegroundColor Red
    Write-Host "Please start your Docker container first!" -ForegroundColor Yellow
    Write-Host ""
    $customPort = Read-Host "Or enter your custom port number"
    if ($customPort) {
        $foundPort = $customPort
    } else {
        exit 1
    }
}

$tunnelUrl = "http://localhost:$foundPort"
Write-Host ""
Write-Host "Tunneling: $tunnelUrl" -ForegroundColor Cyan
Write-Host ""

# Start the tunnel
& "$PSScriptRoot\cloudflared.exe" tunnel --url $tunnelUrl
