# Cloudflare Tunnel Setup Guide

## Overview
Cloudflare Tunnel (cloudflared) allows you to expose your local Docker application to the internet with HTTPS **completely FREE** with unlimited bandwidth.

## Quick Start

### 1. Download and Setup
```powershell
.\cloudflare-tunnel-setup.ps1
```

### 2. Start Your Docker Application
Make sure your Docker containers are running:
```powershell
docker ps
```

### 3. Start the Tunnel
```powershell
.\start-tunnel.ps1
```

The script will:
- Automatically detect your application's port
- Create a temporary public HTTPS URL (e.g., https://random-name.trycloudflare.com)
- Display the URL in the terminal

### 4. Share the URL
Once the tunnel is running, you'll see output like:
```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://your-random-subdomain.trycloudflare.com
```

Share this URL with anyone - it's publicly accessible and HTTPS secured!

## Manual Usage

If you want more control, use cloudflared directly:

```powershell
# For port 8000 (default Laravel)
.\cloudflared.exe tunnel --url http://localhost:8000

# For a different port
.\cloudflared.exe tunnel --url http://localhost:3000
```

## Features

✅ **FREE** - No cost, no credit card required
✅ **HTTPS** - Automatic SSL/TLS encryption
✅ **No Port Forwarding** - Works behind NAT/firewalls
✅ **No DNS Setup** - Get instant subdomain
✅ **Unlimited Bandwidth** - No traffic limits for personal use
✅ **Temporary URLs** - Perfect for demos and testing

## Important Notes

1. **Temporary URLs**: Each time you restart the tunnel, you get a new random URL
2. **Keep Running**: The tunnel only works while the terminal is open
3. **Laravel Trust**: You may need to configure Laravel to trust the proxy

### Laravel Configuration (if needed)

If you encounter issues, add the tunnel domain to your `.env`:

```env
APP_URL=https://your-tunnel-url.trycloudflare.com
SESSION_DOMAIN=.trycloudflare.com
SANCTUM_STATEFUL_DOMAINS=your-tunnel-url.trycloudflare.com
```

Or update `TrustProxies` middleware to trust all proxies:

```php
// app/Http/Middleware/TrustProxies.php
protected $proxies = '*';
```

## Permanent Tunnel (Optional)

For a permanent tunnel with a custom subdomain (still free):

1. Create a Cloudflare account
2. Login via cloudflared:
   ```powershell
   .\cloudflared.exe tunnel login
   ```
3. Create a named tunnel:
   ```powershell
   .\cloudflared.exe tunnel create my-app
   ```
4. Configure and run it with a config file

## Troubleshooting

### "Cannot connect to tunnel"
- Ensure your Docker container is running
- Verify the port is correct (docker ps)
- Check firewall settings

### "Connection refused"
- Your application might not be listening on 0.0.0.0
- Try accessing localhost:8000 first to verify it works locally

### "Too many redirects"
- Update your `.env` file APP_URL to use the cloudflare URL
- Clear Laravel cache: `php artisan config:clear`

## Stopping the Tunnel

Press `Ctrl+C` in the terminal where cloudflared is running.

## Alternative: Use Docker Compose

You can also add cloudflared as a service in your docker-compose.yml:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate --url http://your-app-service:8000
    depends_on:
      - your-app-service
```

---

**Need help?** Check the Cloudflare Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
