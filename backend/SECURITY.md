# YardRover Security Guide

This document describes the authentication, authorization, and security features of the YardRover Python API.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [Authorization & RBAC](#authorization--rbac)
4. [Configuration](#configuration)
5. [API Key Management](#api-key-management)
6. [JWT Tokens](#jwt-tokens)
7. [Rate Limiting](#rate-limiting)
8. [CORS & Security Headers](#cors--security-headers)
9. [Deployment Best Practices](#deployment-best-practices)
10. [Audit Logging](#audit-logging)

## Overview

YardRover implements a multi-layered security approach suitable for IoT/robotics deployments:

- **API Key Authentication**: Stateless, bcrypt-hashed API keys for machine-to-machine communication
- **JWT Tokens**: Short-lived tokens for session management (optional)
- **Role-Based Access Control (RBAC)**: Three roles (viewer, operator, admin) with fine-grained permissions
- **Rate Limiting**: Protection against abuse and DoS attacks
- **Audit Logging**: Structured logging of all authentication and authorization events

## Authentication Methods

### 1. API Key Authentication

API keys are the primary authentication method for YardRover.

**Headers:**
```http
X-API-Key: yr_abc123...
```

**Features:**
- Bcrypt-hashed storage
- No expiration by default (configurable)
- Secure random generation (64 hex characters + prefix)
- Per-key role assignment

### 2. JWT Token Authentication

JWT tokens can be obtained by exchanging an API key for a time-limited token.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Features:**
- Time-limited (30 days default)
- Contains role and permissions
- Stateless validation
- HS256 algorithm by default

## Authorization & RBAC

### Roles

| Role | Description | Use Case |
|------|-------------|----------|
| **viewer** | Read-only access to status and telemetry | Monitoring dashboards, mobile apps (view-only) |
| **operator** | Control operations, MAVLink commands, resource management | Remote control, mission execution |
| **admin** | Full system access, configuration changes, user management | System administration, setup |

### Permissions

Fine-grained permissions are automatically assigned based on roles:

**Viewer Permissions:**
- `config:read` - Read configuration
- `mavlink:read` - Read MAVLink telemetry
- `resource:read` - Read zones, missions, tasks
- `network:read` - Read network status
- `rtcm:read` - Read RTCM status
- `system:read` - Read system health

**Operator Permissions:** (includes all viewer permissions plus:)
- `mavlink:write` - Send MAVLink commands
- `mavlink:arm` - Arm vehicle
- `mavlink:disarm` - Disarm vehicle
- `resource:write` - Create/update zones and missions
- `resource:delete` - Delete zones and missions
- `rtcm:write` - Configure RTCM

**Admin Permissions:** (includes all operator permissions plus:)
- `config:write` - Modify configuration
- `network:write` - Configure WiFi and network
- `system:restart` - Restart system
- `user:read` - List API keys
- `user:write` - Create API keys
- `user:delete` - Delete API keys

### Protected Endpoints

Examples of protected endpoints:

| Endpoint | Required Role | Permission |
|----------|--------------|------------|
| `GET /api/config` | viewer | `config:read` |
| `POST /api/config` | admin | `config:write` |
| `POST /api/mavlink/arm` | operator | `mavlink:arm` |
| `POST /api/auth/api-keys` | admin | `user:write` |
| `GET /api/health` | none (public) | none |

## Configuration

### Environment Variables

```bash
# Security settings
export YARDROVER_SECURITY_ENABLED=true
export YARDROVER_JWT_SECRET="your-secret-key-here"
export YARDROVER_JWT_ALGORITHM="HS256"
export YARDROVER_ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 days

# Rate limiting
export YARDROVER_RATE_LIMIT_ENABLED=true
export YARDROVER_RATE_LIMIT_REQUESTS=100
export YARDROVER_RATE_LIMIT_WINDOW_SECONDS=60

# CORS
export YARDROVER_CORS_ORIGINS='["http://localhost:3000", "https://yardrover.local"]'

# Anonymous access
export YARDROVER_ALLOW_ANONYMOUS_HEALTH=true
export YARDROVER_ALLOW_ANONYMOUS_DOCS=false
```

### Configuration File (config.yaml)

```yaml
security:
  enabled: true
  jwt_secret: "your-secret-key-here"  # Optional, will be auto-generated
  jwt_algorithm: "HS256"
  access_token_expire_minutes: 43200  # 30 days
  api_key_header: "X-API-Key"
  allow_anonymous_health: true
  allow_anonymous_docs: false
  rate_limit_enabled: true
  rate_limit_requests: 100
  rate_limit_window_seconds: 60
  cors_origins:
    - "http://localhost:3000"
    - "https://yardrover.local"
```

## API Key Management

### First Startup

On first startup with authentication enabled, YardRover automatically creates a default admin API key:

```
[WARNING] default_admin_key_created
api_key=yr_abc123...
note=SAVE THIS KEY! It will not be shown again.
```

**⚠️ SAVE THIS KEY IMMEDIATELY!** You cannot retrieve it later.

### Creating API Keys

**Via API (requires admin role):**

```bash
# Create an operator key
curl -X POST http://yardrover.local:8000/api/auth/api-keys \
  -H "X-API-Key: yr_admin_key..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App",
    "role": "operator",
    "description": "API key for mobile app control",
    "expires_in_days": 365
  }'

# Response includes the plaintext key (shown only once!)
{
  "key_id": "uuid...",
  "name": "Mobile App",
  "api_key": "yr_newkey123...",
  "role": "operator",
  "created_at": "2025-01-08T00:00:00Z",
  "expires_at": "2026-01-08T00:00:00Z"
}
```

### Listing API Keys

```bash
curl http://yardrover.local:8000/api/auth/api-keys \
  -H "X-API-Key: yr_admin_key..."
```

### Revoking API Keys

```bash
curl -X PATCH http://yardrover.local:8000/api/auth/api-keys/{key_id}/revoke \
  -H "X-API-Key: yr_admin_key..."
```

### Deleting API Keys

```bash
curl -X DELETE http://yardrover.local:8000/api/auth/api-keys/{key_id} \
  -H "X-API-Key: yr_admin_key..."
```

## JWT Tokens

### Obtaining a Token

Exchange an API key for a JWT token:

```bash
curl -X POST http://yardrover.local:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "yr_your_key..."
  }'

# Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 2592000,  # 30 days in seconds
  "role": "admin"
}
```

### Using a JWT Token

```bash
curl http://yardrover.local:8000/api/config \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Token Payload

```json
{
  "sub": "api_key_id",
  "role": "admin",
  "permissions": ["config:read", "config:write", ...],
  "exp": 1704672000,
  "iat": 1704585600
}
```

## Rate Limiting

Rate limiting protects against abuse and DoS attacks.

**Default Limits:**
- 100 requests per minute per IP address
- Configurable via environment variables or config.yaml

**Response when rate limited:**
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704585660

{
  "detail": "Rate limit exceeded: 100 per 1 minute"
}
```

## CORS & Security Headers

### CORS Configuration

**Development (permissive):**
```yaml
security:
  cors_origins:
    - "*"
```

**Production (restrictive):**
```yaml
security:
  cors_origins:
    - "https://yardrover.example.com"
    - "https://app.yardrover.example.com"
```

### Security Headers

YardRover automatically includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'self'`

## Deployment Best Practices

### 1. Use HTTPS/TLS

**Never deploy without TLS in production.** Use a reverse proxy like nginx or Caddy:

**Nginx example:**
```nginx
server {
    listen 443 ssl http2;
    server_name yardrover.local;

    ssl_certificate /etc/ssl/certs/yardrover.crt;
    ssl_certificate_key /etc/ssl/private/yardrover.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Caddy example (automatic HTTPS):**
```
yardrover.local {
    reverse_proxy localhost:8000
}
```

### 2. Set a Strong JWT Secret

```bash
# Generate a secure random secret
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Set in environment
export YARDROVER_JWT_SECRET="generated_secret_here"
```

### 3. Restrict CORS Origins

```bash
export YARDROVER_CORS_ORIGINS='["https://yardrover.example.com"]'
```

### 4. Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 443/tcp         # HTTPS (via reverse proxy)
sudo ufw deny 8000/tcp         # Block direct access to API
sudo ufw enable

# iptables
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 8000 -j DROP
```

### 5. Run as Non-Root User

```bash
# Create dedicated user
sudo useradd -r -s /bin/false yardrover

# Run with systemd as non-root
sudo nano /etc/systemd/system/yardrover.service
```

```ini
[Service]
User=yardrover
Group=yardrover
WorkingDirectory=/opt/yardrover
ExecStart=/opt/yardrover/.venv/bin/python -m yardrover.main
```

### 6. Disable API Documentation in Production

```bash
export YARDROVER_ALLOW_ANONYMOUS_DOCS=false
```

Access via authenticated request:
```bash
curl -H "X-API-Key: yr_key..." https://yardrover.local/docs
```

### 7. Monitor & Rotate API Keys

- Regularly audit API key usage via `/api/auth/api-keys`
- Revoke unused keys
- Set expiration dates for temporary access
- Rotate admin keys periodically

### 8. Backup Configuration Securely

```bash
# Backup configuration (contains sensitive data!)
sudo cp /var/lib/yardrover/config.yaml /secure/backup/location/
sudo chmod 600 /secure/backup/location/config.yaml
```

## Audit Logging

All authentication and authorization events are logged using structured logging.

**Authentication Events:**
```json
{
  "event": "api_key_authentication_successful",
  "key_id": "uuid...",
  "key_name": "Mobile App",
  "role": "operator",
  "timestamp": "2025-01-08T12:00:00Z"
}
```

**Authorization Events:**
```json
{
  "event": "permission_denied",
  "key_id": "uuid...",
  "key_name": "Read Only App",
  "role": "viewer",
  "required_permission": "config:write",
  "timestamp": "2025-01-08T12:01:00Z"
}
```

**Configuration Changes:**
```json
{
  "event": "config_updated",
  "fields": ["network.wifi.ssid"],
  "user": "Admin User",
  "role": "admin",
  "timestamp": "2025-01-08T12:02:00Z"
}
```

**Viewing Logs:**
```bash
# Systemd journal
sudo journalctl -u yardrover -f

# Filter for security events
sudo journalctl -u yardrover | grep -E "auth|permission"
```

## Troubleshooting

### Authentication Failed

**Symptom:** `401 Unauthorized`

**Solutions:**
1. Verify API key is correct (case-sensitive)
2. Check if key is enabled: `GET /api/auth/api-keys`
3. Check if key is expired
4. Ensure header name matches config (`X-API-Key` by default)

### Permission Denied

**Symptom:** `403 Forbidden`

**Solutions:**
1. Check your role: `GET /api/auth/me`
2. Verify required permission for endpoint (see documentation)
3. Request admin to upgrade your role if needed

### Rate Limited

**Symptom:** `429 Too Many Requests`

**Solutions:**
1. Wait for rate limit window to reset (default: 60 seconds)
2. Reduce request frequency
3. Contact admin to increase rate limits if legitimate use case

### JWT Token Expired

**Symptom:** `401 Unauthorized` with "Invalid or expired token"

**Solutions:**
1. Re-authenticate to get a new token: `POST /api/auth/login`
2. Use API key authentication instead (no expiration)

## Security Checklist

- [ ] HTTPS/TLS enabled (never use HTTP in production)
- [ ] Strong JWT secret set (`YARDROVER_JWT_SECRET`)
- [ ] CORS origins restricted to known domains
- [ ] Rate limiting enabled
- [ ] API documentation access restricted (`YARDROVER_ALLOW_ANONYMOUS_DOCS=false`)
- [ ] Firewall configured to block direct API port access
- [ ] Running as non-root user
- [ ] Default admin API key saved securely
- [ ] Additional API keys created for different users/apps
- [ ] Unused API keys revoked
- [ ] Audit logging enabled and monitored
- [ ] Regular backup of configuration
- [ ] Regular security updates applied

## Support

For security-related questions or to report vulnerabilities:
- **Issues**: https://github.com/yourusername/yardrover/issues
- **Security Contact**: security@yourproject.example.com (create a security contact)

## License

MIT License - See LICENSE file for details
