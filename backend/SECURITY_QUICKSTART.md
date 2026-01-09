# Security Quick Start Guide

Get YardRover secured in 5 minutes.

## Step 1: Generate JWT Secret

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output and add to `.env`:

```bash
echo "YARDROVER_JWT_SECRET=your_generated_secret_here" >> .env
```

## Step 2: First Startup & Save Admin Key

```bash
cd /Volumes/dev/yardrover-api-python
source .venv/bin/activate
python -m yardrover.main
```

Look for this message in the logs:
```
[WARNING] default_admin_key_created
api_key=yr_abc123...
note=SAVE THIS KEY! It will not be shown again.
```

**⚠️ SAVE THE API KEY IMMEDIATELY!** Store it in a password manager.

## Step 3: Test Authentication

```bash
# Test with your admin key
curl http://localhost:8000/api/config \
  -H "X-API-Key: yr_YOUR_ADMIN_KEY_HERE"

# Should return config JSON

# Test without key (should fail)
curl http://localhost:8000/api/config
# Should return 401 Unauthorized
```

## Step 4: Create Additional API Keys

### Create an operator key (for mobile app/remote control):
```bash
curl -X POST http://localhost:8000/api/auth/api-keys \
  -H "X-API-Key: yr_YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App",
    "role": "operator",
    "description": "Control operations from mobile app"
  }'
```

### Create a viewer key (for dashboards):
```bash
curl -X POST http://localhost:8000/api/auth/api-keys \
  -H "X-API-Key: yr_YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dashboard",
    "role": "viewer",
    "description": "Read-only access for monitoring"
  }'
```

## Step 5: Configure for Production

Update `.env` or `config.yaml`:

```bash
# Restrict CORS to your frontend URL
export YARDROVER_CORS_ORIGINS='["https://yardrover.yourdomain.com"]'

# Disable anonymous API docs
export YARDROVER_ALLOW_ANONYMOUS_DOCS=false

# Enable rate limiting (already on by default)
export YARDROVER_RATE_LIMIT_ENABLED=true
export YARDROVER_RATE_LIMIT_REQUESTS=100
```

## Step 6: Set Up HTTPS (Production Only)

### Option A: Using Caddy (Easiest)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure Caddy
sudo nano /etc/caddy/Caddyfile
```

```
yardrover.yourdomain.com {
    reverse_proxy localhost:8000
}
```

```bash
# Restart Caddy (automatic HTTPS!)
sudo systemctl reload caddy
```

### Option B: Using Nginx

```bash
# Install nginx and certbot
sudo apt install nginx certbot python3-certbot-nginx

# Configure nginx
sudo nano /etc/nginx/sites-available/yardrover
```

```nginx
server {
    listen 80;
    server_name yardrover.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/yardrover /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d yardrover.yourdomain.com
```

## Step 7: Firewall Setup

```bash
# Allow SSH and HTTPS, block direct API access
sudo ufw allow 22/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8000/tcp
sudo ufw enable
```

## Done! 🎉

Your YardRover API is now secured with:
- ✅ API key authentication
- ✅ Role-based access control
- ✅ JWT token support
- ✅ Rate limiting
- ✅ CORS protection
- ✅ HTTPS (if production)

## Quick Reference

### Authentication Header Formats

**API Key:**
```bash
curl -H "X-API-Key: yr_your_key..." https://yardrover.local/api/endpoint
```

**JWT Token:**
```bash
# Get token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"api_key": "yr_your_key..."}' | jq -r '.access_token')

# Use token
curl -H "Authorization: Bearer $TOKEN" https://yardrover.local/api/endpoint
```

### Common Commands

**List API keys:**
```bash
curl -H "X-API-Key: yr_admin_key..." http://localhost:8000/api/auth/api-keys
```

**Revoke a key:**
```bash
curl -X PATCH -H "X-API-Key: yr_admin_key..." \
  http://localhost:8000/api/auth/api-keys/{key_id}/revoke
```

**Check your info:**
```bash
curl -H "X-API-Key: yr_your_key..." http://localhost:8000/api/auth/me
```

## Roles Quick Reference

| Role | Can Do |
|------|--------|
| **viewer** | View status, telemetry, configuration (read-only) |
| **operator** | Control vehicle, create missions, modify zones |
| **admin** | Everything + user management + config changes |

## Troubleshooting

**Can't access with API key:**
- Check key is correct (case-sensitive)
- Verify header name: `X-API-Key` (with dashes, not underscores)
- Check logs: `sudo journalctl -u yardrover -f`

**Rate limited:**
- Wait 60 seconds
- Reduce request frequency
- Check rate limit config

**403 Forbidden:**
- Check your role: `curl -H "X-API-Key: ..." http://localhost:8000/api/auth/me`
- You may need operator or admin role for that endpoint

## Next Steps

- Read [SECURITY.md](SECURITY.md) for complete documentation
- Set up audit log monitoring
- Configure automatic backups
- Set up alerting for failed auth attempts
- Rotate admin API key periodically
