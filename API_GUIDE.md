# YardRover API Guide

This guide provides detailed API usage examples, configuration reference, and best practices for working with the YardRover client library.

## Client Library Overview

The YardRover client library (`client/src/`) provides a type-safe TypeScript interface for communicating with YardRover devices.

### Installation & Setup

**In the web app:**
```typescript
import { MAVLinkBridge } from '../../../client/dist/index'

// Create client instance
const client = new MAVLinkBridge('http://yardrover.local:8000')

// Client is ready to use
```

**In external projects:**
```bash
npm install @yardrover/client
```

```typescript
import { MAVLinkBridge } from '@yardrover/client'
```

## Authentication

YardRover supports three authentication methods:
- **Username/Password** - For normal users
- **PIN** (4-6 digits) - Quick login for consumer mode
- **API Key** - For automation, CLI tools, and advanced users

### Login with Username and Password

```typescript
import { MAVLinkBridge } from '../../../client/dist/index'

const client = new MAVLinkBridge('http://yardrover.local:8000')

try {
  // Login with username and password
  const response = await client.authClient.loginWithPassword('admin', 'mypassword')

  console.log('Logged in successfully')
  console.log('Token expires:', response.expires_at)
  console.log('User role:', response.role)

  // Token is automatically stored and injected on all future requests
} catch (error) {
  console.error('Login failed:', error.message)
}
```

### Login with PIN

```typescript
// Quick login with 4-6 digit PIN (consumer mode)
try {
  const response = await client.authClient.loginWithPin('1234')

  console.log('Logged in with PIN')
  console.log('User:', response.user.display_name)
} catch (error) {
  console.error('PIN login failed:', error.message)
}
```

### Login with API Key

```typescript
// Login with API key (for automation and CLI)
try {
  const response = await client.authClient.login('yr_your_api_key_here')

  console.log('Logged in with API key')
  console.log('Token expires:', response.expires_at)
  console.log('Role:', response.role)
} catch (error) {
  console.error('Login failed:', error.message)
}
```

### Check Login Status

```typescript
// Check if user is currently authenticated
if (client.authClient.isAuthenticated()) {
  console.log('User is logged in')
  console.log('Token expires at:', client.authClient.getTokenExpiry())
} else {
  console.log('User is not logged in')
}
```

### Logout

```typescript
// Logout and clear stored token
await client.authClient.logout()
```

### Change Password

```typescript
// Change user password (requires authentication)
try {
  await client.authClient.changePassword('oldpassword', 'newpassword')
  console.log('Password updated successfully')
} catch (error) {
  console.error('Failed to change password:', error.message)
}
```

### Manage PIN

```typescript
// Set or update PIN (requires password for verification)
try {
  await client.authClient.setPin('1234', 'mypassword')
  console.log('PIN set successfully')
} catch (error) {
  console.error('Failed to set PIN:', error.message)
}

// Remove PIN
try {
  await client.authClient.removePin('mypassword')
  console.log('PIN removed')
} catch (error) {
  console.error('Failed to remove PIN:', error.message)
}
```

### Setup Mode

#### Check Setup Status

```typescript
// Check if device is in setup mode
const status = await client.authClient.getSetupStatus()

if (status.in_setup_mode) {
  console.log('Device is in setup mode')
  // Redirect to setup wizard
} else {
  console.log('Device is configured')
  // Proceed to login
}
```

#### Complete Setup

```typescript
// Complete first-time setup with user account
try {
  const response = await client.authClient.completeSetup({
    device_name: 'My YardRover',
    username: 'admin',
    password: 'securepassword',
    display_name: 'Admin User',
    pin: '1234',  // Optional: 4-6 digit PIN for quick login
    admin_key_name: 'Admin API Key',  // API key created for automation
  })

  console.log('Setup complete!')
  console.log('Username:', response.username)
  console.log('User ID:', response.user_id)
  console.log('API Key (for automation):', response.api_key)
  console.log('Device name:', response.device_name)

  // IMPORTANT: Show credentials and API key to user
  // API key will never be shown again!
} catch (error) {
  console.error('Setup failed:', error.message)
}
```

## Device Status & Health

### Get Device Status

```typescript
// Get current device status
const status = await client.getStatus()

console.log('Armed:', status.armed)
console.log('Flight mode:', status.flight_mode)
console.log('GPS fix:', status.gps.fix_type)
console.log('Battery:', status.battery.voltage, 'V')
console.log('System time:', status.system_time)
```

### Get System Health

```typescript
// Get system health metrics
const health = await client.getHealth()

console.log('CPU usage:', health.cpu_percent, '%')
console.log('Memory usage:', health.memory.used_mb, '/', health.memory.total_mb, 'MB')
console.log('Temperature:', health.temperature, '°C')
console.log('Uptime:', health.uptime_seconds, 'seconds')
```

## Device Configuration

### Get Configuration

```typescript
// Get current device configuration
const config = await client.getConfig()

console.log('Device name:', config.device.name)
console.log('MAVLink connection:', config.mavlink.connection_type)
console.log('Security enabled:', config.security.enabled)
console.log('TLS enabled:', config.tls.enabled)
```

### Update Configuration

```typescript
// Update device configuration
const updatedConfig = await client.updateConfig({
  device: {
    name: 'New Device Name'
  }
})

console.log('Configuration updated:', updatedConfig)
```

## MAVLink Control

### Arm/Disarm Vehicle

```typescript
// Arm the vehicle
try {
  await client.arm()
  console.log('Vehicle armed')
} catch (error) {
  console.error('Failed to arm:', error.message)
}

// Disarm the vehicle
try {
  await client.disarm()
  console.log('Vehicle disarmed')
} catch (error) {
  console.error('Failed to disarm:', error.message)
}
```

### Change Flight Mode

```typescript
// Change to GUIDED mode
try {
  await client.setMode('GUIDED')
  console.log('Mode changed to GUIDED')
} catch (error) {
  console.error('Failed to change mode:', error.message)
}

// Available modes depend on vehicle type (Copter, Plane, Rover)
// Common modes: MANUAL, STABILIZE, AUTO, GUIDED, LOITER, RTL
```

### Send Custom Commands

```typescript
// Send a custom MAVLink command
const result = await client.sendCommand({
  command: 'MAV_CMD_DO_SET_HOME',
  params: [0, 0, 0, 0, 37.7749, -122.4194, 0]
})

if (result.success) {
  console.log('Command executed successfully')
} else {
  console.error('Command failed:', result.error)
}
```

## WebSocket Telemetry

### Connect to Telemetry Stream

```typescript
// Connect to real-time telemetry WebSocket
client.connectWebSocket()

// Listen for telemetry updates
client.on('telemetry', (data) => {
  console.log('Telemetry update:', data)
  console.log('Position:', data.position)
  console.log('Attitude:', data.attitude)
  console.log('Battery:', data.battery)
})

// Listen for connection events
client.on('connected', () => {
  console.log('WebSocket connected')
})

client.on('disconnected', () => {
  console.log('WebSocket disconnected')
})

client.on('error', (error) => {
  console.error('WebSocket error:', error)
})

// Disconnect when done
client.disconnectWebSocket()
```

### Filter Telemetry Messages

```typescript
// Subscribe to specific message types
client.subscribe('HEARTBEAT', (msg) => {
  console.log('Heartbeat:', msg)
})

client.subscribe('GPS_RAW_INT', (msg) => {
  console.log('GPS:', msg.lat / 1e7, msg.lon / 1e7)
})

client.subscribe('BATTERY_STATUS', (msg) => {
  console.log('Battery:', msg.voltages[0] / 1000, 'V')
})
```

## Error Handling

### Common Error Types

```typescript
try {
  await client.arm()
} catch (error) {
  if (error.code === 'UNAUTHORIZED') {
    console.error('Not authenticated - please login')
  } else if (error.code === 'FORBIDDEN') {
    console.error('Insufficient permissions')
  } else if (error.code === 'TIMEOUT') {
    console.error('Request timed out')
  } else if (error.code === 'CONNECTION_ERROR') {
    console.error('Cannot connect to device')
  } else {
    console.error('Unknown error:', error.message)
  }
}
```

### Automatic Retry

The client library automatically retries failed requests:

```typescript
// Configure retry behavior
const client = new MAVLinkBridge('http://yardrover.local:8000', {
  maxRetries: 3,
  retryDelay: 1000, // ms
  timeout: 5000, // ms
})
```

## Configuration Reference

### Environment Variables

**Backend Configuration:**

```bash
# Security settings
YARDROVER_SECURITY_ENABLED=true
YARDROVER_JWT_SECRET=your-secret-key-min-32-chars
YARDROVER_ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 days
YARDROVER_SESSION_TIMEOUT_MINUTES=10080      # 7 days
YARDROVER_RATE_LIMIT_ENABLED=true
YARDROVER_RATE_LIMIT_REQUESTS=100
YARDROVER_CORS_ORIGINS=["http://localhost:5173"]

# TLS/HTTPS settings
YARDROVER_TLS_ENABLED=false
YARDROVER_TLS_CERT_FILE=./certs/cert.pem
YARDROVER_TLS_KEY_FILE=./certs/key.pem
YARDROVER_TLS_CA_CERTS=./certs/ca.pem
YARDROVER_TLS_PORT=443

# Network settings
YARDROVER_HOST=0.0.0.0
YARDROVER_PORT=8000
YARDROVER_MDNS_ENABLED=true

# MAVLink settings
YARDROVER_MAVLINK_CONNECTION=serial
YARDROVER_MAVLINK_PORT=/dev/ttyAMA0
YARDROVER_MAVLINK_BAUDRATE=57600
YARDROVER_MAVLINK_DIALECT=ardupilotmega

# Logging
YARDROVER_LOG_LEVEL=INFO
YARDROVER_LOG_FILE=/var/log/yardrover/yardrover.log

# Storage
YARDROVER_DATA_DIR=/var/lib/yardrover
YARDROVER_DB_PATH=/var/lib/yardrover/yardrover.db
```

### Config File Format

**config.yaml:**

```yaml
# Device information
device:
  name: My YardRover
  model: YardRover v1.0

# Security configuration
security:
  enabled: true
  jwt_secret: your-secret-key-min-32-chars
  access_token_expire_minutes: 43200
  session_timeout_minutes: 10080
  rate_limit:
    enabled: true
    requests: 100
    window_seconds: 60

# TLS/HTTPS configuration
tls:
  enabled: false
  cert_file: /etc/yardrover/certs/cert.pem
  key_file: /etc/yardrover/certs/key.pem
  ca_certs: null
  port: 443

# Network configuration
network:
  host: 0.0.0.0
  port: 8000
  cors_origins:
    - http://localhost:5173
    - http://localhost:3000
  mdns:
    enabled: true
    service_name: yardrover
    hostname: yardrover.local

# MAVLink configuration
mavlink:
  connection_type: serial  # serial, tcp, udp
  port: /dev/ttyAMA0
  baudrate: 57600
  dialect: ardupilotmega
  source_system: 255
  source_component: 1

# Storage configuration
storage:
  data_dir: /var/lib/yardrover
  db_path: /var/lib/yardrover/yardrover.db
  max_log_size_mb: 100
  log_retention_days: 30

# Logging configuration
logging:
  level: INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
  file: /var/log/yardrover/yardrover.log
  max_file_size_mb: 10
  backup_count: 5
```

## API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Login with API key | No |
| POST | `/api/auth/login/password` | Login with username/password | No |
| POST | `/api/auth/login/pin` | Login with PIN | No |
| POST | `/api/auth/logout` | Logout and invalidate token | Yes |
| GET | `/api/auth/me` | Get current user info | Yes |
| POST | `/api/auth/password/change` | Change password | Yes |
| POST | `/api/auth/pin/set` | Set or update PIN | Yes |
| POST | `/api/auth/pin/remove` | Remove PIN | Yes |
| GET | `/api/auth/keys` | List API keys | Yes (Admin) |
| POST | `/api/auth/keys` | Create new API key | Yes (Admin) |
| DELETE | `/api/auth/keys/{key_id}` | Delete API key | Yes (Admin) |
| GET | `/api/auth/users` | List users | Yes (Admin) |
| POST | `/api/auth/users` | Create new user | Yes (Admin) |
| DELETE | `/api/auth/users/{user_id}` | Delete user | Yes (Admin) |

### Setup Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/setup/status` | Check setup mode status | No |
| POST | `/api/setup/complete` | Complete first-time setup | No |
| POST | `/api/setup/reset` | Reset to setup mode | No (Debug mode) |

### Device Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/status` | Get device status | Yes |
| GET | `/api/health` | Get system health | Yes |
| GET | `/api/config` | Get configuration | Yes |
| PUT | `/api/config` | Update configuration | Yes (Admin) |

### MAVLink Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/mavlink/arm` | Arm vehicle | Yes (Operator+) |
| POST | `/api/mavlink/disarm` | Disarm vehicle | Yes (Operator+) |
| POST | `/api/mavlink/mode` | Change flight mode | Yes (Operator+) |
| POST | `/api/mavlink/command` | Send MAVLink command | Yes (Operator+) |
| GET | `/api/mavlink/parameters` | Get all parameters | Yes |
| GET | `/api/mavlink/parameters/{name}` | Get parameter | Yes |
| PUT | `/api/mavlink/parameters/{name}` | Set parameter | Yes (Operator+) |

### WebSocket Endpoints

| Endpoint | Description | Auth Required |
|----------|-------------|---------------|
| WS `/ws/telemetry` | Real-time telemetry stream | Yes |
| WS `/ws/logs` | Real-time log stream | Yes |

## Best Practices

### 1. Always Use the Client Library

**✅ DO:**
```typescript
import { MAVLinkBridge } from '../../../client/dist/index'
const client = new MAVLinkBridge(deviceUrl)
const status = await client.getStatus()
```

**❌ DON'T:**
```typescript
// Don't make direct fetch calls
const response = await fetch(`${deviceUrl}/api/status`)
const status = await response.json()
```

### 2. Handle Authentication Properly

```typescript
// Check authentication before making requests
if (!client.authClient.isAuthenticated()) {
  // Redirect to login
  router.push({ name: 'login' })
  return
}

// Handle token expiry
client.on('token-expired', () => {
  // Show session timeout warning
  showSessionTimeoutDialog()
})
```

### 3. Manage WebSocket Lifecycle

```typescript
// Connect when component mounts
onMounted(() => {
  client.connectWebSocket()
})

// Disconnect when component unmounts
onUnmounted(() => {
  client.disconnectWebSocket()
})

// Handle reconnection
client.on('disconnected', () => {
  console.log('Disconnected, will auto-reconnect')
})
```

### 4. Use TypeScript Types

```typescript
import type { DeviceStatus, TelemetryData } from '../../../client/dist/index'

// Type-safe state
const status = ref<DeviceStatus | null>(null)
const telemetry = ref<TelemetryData | null>(null)

// Type-safe functions
async function fetchStatus(): Promise<DeviceStatus> {
  return await client.getStatus()
}
```

### 5. Error Handling

```typescript
// Always wrap API calls in try-catch
try {
  await client.arm()
  showToast('Vehicle armed successfully')
} catch (error) {
  console.error('Failed to arm:', error)
  showToast(`Failed to arm: ${error.message}`, 'error')
}
```

## Development vs Production

### Quick Setup with Environment Modes

**Development Mode** (one variable sets all dev-friendly defaults):

```bash
# Single variable enables: debug, hot reload, /docs, DEBUG logging, no rate limits
YARDROVER_ENVIRONMENT=development

# Alternatively, copy the dev template
cp backend/.env.development backend/.env
```

**Production Mode** (default - secure by default):

```bash
# Default mode (or explicitly set)
YARDROVER_ENVIRONMENT=production

# Recommended production settings
YARDROVER_TLS_ENABLED=true
YARDROVER_TLS_CERT_FILE=/etc/letsencrypt/live/yardrover.local/fullchain.pem
YARDROVER_TLS_KEY_FILE=/etc/letsencrypt/live/yardrover.local/privkey.pem
YARDROVER_CORS_ORIGINS=["https://yardrover.local"]
```

### Environment Mode Defaults

| Setting | Development | Production |
|---------|-------------|------------|
| `log_level` | `DEBUG` | `INFO` |
| `debug` | `true` | `false` |
| `reload` | `true` | `false` |
| `allow_anonymous_docs` | `true` | `false` |
| `rate_limit_enabled` | `false` | `true` |
| `cors_origins` | `["*"]` | `["*"]` (configure for prod) |

All defaults can be overridden by setting the specific environment variable.

### Legacy Configuration (Still Supported)

```bash
# Manual configuration (individual flags)
YARDROVER_TLS_ENABLED=false
YARDROVER_PORT=8000
YARDROVER_CORS_ORIGINS=["http://localhost:5173"]
YARDROVER_LOG_LEVEL=DEBUG
YARDROVER_DEBUG=true
YARDROVER_RELOAD=true
YARDROVER_ALLOW_ANONYMOUS_DOCS=true
```

## Troubleshooting

### Cannot Connect to Device

1. **Check device is powered on and network is reachable**
2. **Verify mDNS is working**: `dns-sd -B _yardrover._tcp`
3. **Try direct IP connection**: `http://192.168.1.100:8000`
4. **Check CORS settings** if accessing from different origin

### Authentication Fails

1. **Verify credentials are correct** (username/password or PIN)
2. **For API keys**: Verify key starts with `yr_` and is valid
3. **Check setup mode status**: Device may need initial setup
4. **Verify security is enabled** in backend config
5. **Check token expiry** - may need to re-login
6. **For PIN**: Ensure PIN was set (not all users have PIN enabled)

### WebSocket Not Connecting

1. **Verify authentication** - WebSocket requires valid token
2. **Check firewall rules** - Ensure WebSocket port is open
3. **Try direct connection** - Test with tool like `wscat`
4. **Check backend logs** for connection errors

### Commands Not Working

1. **Verify user role** - Some commands require Operator or Admin role
2. **Check vehicle state** - Vehicle may need to be armed first
3. **Verify MAVLink connection** - Check backend has connection to flight controller
4. **Check backend logs** for MAVLink errors
