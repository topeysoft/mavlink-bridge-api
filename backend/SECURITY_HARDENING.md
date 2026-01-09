# YardRover Security Hardening Guide

## 🔒 Quick Security Audit Checklist

Run this checklist before deploying to production:

```bash
# 1. Generate and set JWT secret
python3 -c "import secrets; print('export YARDROVER_JWT_SECRET=\"' + secrets.token_urlsafe(32) + '\"')"

# 2. Generate strong AP password
python3 -c "import secrets; print('AP Password: ' + secrets.token_urlsafe(12))"

# 3. Check current configuration
cat backend/config.yaml | grep -E "cors_origins|jwt_secret|password"

# 4. Verify authentication is enabled
curl http://localhost:8000/api/config
# Should return 401 Unauthorized if auth is working

# 5. Test rate limiting
for i in {1..150}; do curl -I http://localhost:8000/api/health; done | grep "429"
# Should see 429 responses after 100 requests
```

## 🚨 Critical Issues Found in Current Config

### Issue 1: CORS Wildcard (CRITICAL)
**Current:**
```yaml
cors_origins:
  - '*'
```

**Risk:** Any website can make requests to your API, including malicious sites.

**Fix:**
```yaml
# Development
cors_origins:
  - 'http://localhost:5173'
  - 'http://yardrover-dev.local'

# Production
cors_origins:
  - 'https://yardrover.example.com'
```

### Issue 2: No JWT Secret (CRITICAL)
**Current:** Not set (auto-generates on each restart)

**Risk:** All JWT tokens become invalid on restart, users logged out.

**Fix:**
```bash
# Generate once
SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Add to .env or config.yaml
echo "YARDROVER_JWT_SECRET=\"$SECRET\"" >> .env

# Or add to config.yaml:
security:
  jwt_secret: "generated_secret_here"
```

### Issue 3: Weak AP Password (MEDIUM)
**Current:** `yardrover123`

**Risk:** Easy to brute force, predictable.

**Fix:**
```bash
# Generate strong password
python3 -c "import secrets; print(secrets.token_urlsafe(12))"

# Update config.yaml:
network:
  ap:
    password: "generated_password_here"
```

### Issue 4: No HTTPS/TLS (CRITICAL for Production)
**Risk:** Credentials sent in plaintext, vulnerable to MITM attacks.

**Fix:** Use nginx or Caddy as reverse proxy with TLS.

## 📦 Production Deployment Steps

### Step 1: Generate Secrets

```bash
cd /Volumes/dev/yardrover-api/backend

# Create secrets file
cat > .secrets.env << 'EOF'
# Generated: $(date)
# ⚠️ KEEP THIS FILE SECURE! Add to .gitignore

# JWT Secret (generate once, never change)
YARDROVER_JWT_SECRET="$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")"

# AP Password (strong random password)
AP_PASSWORD="$(python3 -c "import secrets; print(secrets.token_urlsafe(12))")"

# WiFi Password (if needed)
WIFI_PASSWORD="your_actual_wifi_password"
EOF

# Secure permissions
chmod 600 .secrets.env

# Source it
source .secrets.env
```

### Step 2: Update Configuration

```bash
# Copy secure config template
cp config.yaml.secure config.yaml

# Update with your secrets
sed -i "s/CHANGE-ME-TO-RANDOM-SECRET/$YARDROVER_JWT_SECRET/" config.yaml
sed -i "s/CHANGE-ME-TO-STRONG-PASSWORD/$AP_PASSWORD/" config.yaml

# Update CORS for your domain
sed -i "s|http://localhost:5173|https://your-domain.com|" config.yaml
```

### Step 3: Set Up HTTPS with Caddy (Automatic TLS)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Create Caddyfile
sudo tee /etc/caddy/Caddyfile << 'EOF'
yardrover.local {
    reverse_proxy localhost:8000

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "no-referrer-when-downgrade"
    }
}
EOF

# Reload Caddy
sudo systemctl reload caddy
```

### Step 4: Configure Firewall

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 80/tcp          # HTTP (Caddy redirect)
sudo ufw allow 443/tcp         # HTTPS
sudo ufw deny 8000/tcp         # Block direct API access
sudo ufw enable

# Verify
sudo ufw status
```

### Step 5: Run as Non-Root User

```bash
# Create user
sudo useradd -r -m -s /bin/bash yardrover
sudo usermod -aG dialout yardrover  # For serial port access

# Set ownership
sudo chown -R yardrover:yardrover /opt/yardrover
sudo chown -R yardrover:yardrover /var/lib/yardrover

# Create systemd service
sudo tee /etc/systemd/system/yardrover.service << 'EOF'
[Unit]
Description=YardRover API Service
After=network.target

[Service]
Type=simple
User=yardrover
Group=yardrover
WorkingDirectory=/opt/yardrover/backend
Environment="PATH=/opt/yardrover/backend/.venv/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile=/opt/yardrover/backend/.secrets.env
ExecStart=/opt/yardrover/backend/.venv/bin/uvicorn yardrover.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5s

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/yardrover

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable yardrover
sudo systemctl start yardrover
sudo systemctl status yardrover
```

### Step 6: Set Up Monitoring & Alerting

```bash
# Install fail2ban for brute force protection
sudo apt install fail2ban

# Create YardRover filter
sudo tee /etc/fail2ban/filter.d/yardrover.conf << 'EOF'
[Definition]
failregex = ^.*authentication_failed.*ip=<HOST>.*$
            ^.*login_failed.*ip=<HOST>.*$
ignoreregex =
EOF

# Create jail
sudo tee /etc/fail2ban/jail.d/yardrover.conf << 'EOF'
[yardrover]
enabled = true
port = http,https
filter = yardrover
logpath = /var/log/yardrover/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF

# Restart fail2ban
sudo systemctl restart fail2ban
```

## 🔐 Post-Deployment Security Checklist

- [ ] JWT secret set and persisted
- [ ] CORS restricted to specific origins
- [ ] Strong AP password configured
- [ ] HTTPS/TLS enabled via reverse proxy
- [ ] Firewall configured (direct API port blocked)
- [ ] Running as non-root user
- [ ] Systemd service configured with security hardening
- [ ] Fail2ban configured for brute force protection
- [ ] Initial admin API key saved securely
- [ ] API documentation access restricted
- [ ] Regular backup strategy in place
- [ ] Monitoring and alerting configured

## 🔄 Regular Maintenance

### Weekly
- [ ] Review authentication logs
- [ ] Check for failed login attempts
- [ ] Monitor API key usage

### Monthly
- [ ] Audit active API keys
- [ ] Revoke unused keys
- [ ] Review and update CORS origins
- [ ] Check for security updates

### Quarterly
- [ ] Rotate admin API keys
- [ ] Review and update firewall rules
- [ ] Audit RBAC permissions
- [ ] Test disaster recovery procedures

## 🚨 Incident Response

### Suspected Breach
1. Immediately revoke all API keys
2. Change JWT secret (invalidates all tokens)
3. Review audit logs
4. Check for unauthorized config changes
5. Reset to setup mode if needed

### Lost Admin Key
1. Physical access to device required
2. Enable debug mode: `export YARDROVER_DEBUG=true`
3. Call reset endpoint: `POST /api/setup/reset`
4. Complete setup wizard again

## 📞 Support

For security issues:
- Create issue: https://github.com/yourusername/yardrover/issues
- Email: security@example.com (if critical)

## 📚 References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
