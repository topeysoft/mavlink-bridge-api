# YardRover Architecture

This document describes the detailed architecture, authentication flows, and system design of the YardRover project.

## System Overview

YardRover is an autonomous yard utility machine with a distributed architecture:

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Vue 3 Web App     │────▶│  FastAPI Backend    │────▶│  MAVLink Vehicle    │
│  (Browser Client)   │ HTTP│  (Raspberry Pi)     │ UART│  (Flight Controller)│
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                           │
         │                           │
         └───────── WebSocket ───────┘
              (Real-time Telemetry)
```

### Components

1. **Backend API** (`backend/src/yardrover/`)
   - Python/FastAPI server running on Raspberry Pi
   - MAVLink integration for vehicle control
   - WebSocket server for real-time telemetry
   - REST API for configuration and control
   - Authentication and RBAC system
   - mDNS service discovery

2. **Web Application** (`app/src/`)
   - Vue 3 + TypeScript frontend
   - Custom components (NO Quasar dependency)
   - Pinia state management
   - Real-time dashboard with WebSocket integration
   - Responsive design for mobile/desktop

3. **Client Library** (`client/src/`)
   - TypeScript library for device communication
   - Type-safe API wrappers
   - WebSocket client with auto-reconnection
   - Authentication client with token management
   - Shared types between backend and frontend

4. **Console Tool** (`console/src/`)
   - CLI for device management and testing
   - Uses the same client library as web app

## Authentication & Security Architecture

### Security Model

YardRover uses **owner-only access** with physical device reset capability:

```
┌──────────────────────────────────────────┐
│  First Boot (Setup Mode)                │
│  - Auto-detected on startup             │
│  - Creates admin user account           │
│  - Creates admin API key for automation │
│  - No auth required for setup           │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Normal Operation - Three Login Methods │
│                                          │
│  1. Username/Password (for normal use)  │
│  2. PIN (4-6 digits, consumer mode)     │
│  3. API Key (automation/CLI)            │
│                                          │
│  → Receive JWT token (30 days)          │
│  → Auto token injection on requests     │
│  → Session monitoring & warnings        │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Physical Reset (if needed)              │
│  - Access device console                │
│  - Set YARDROVER_DEBUG=true             │
│  - Call /api/setup/reset endpoint       │
│  - Clears all users and API keys        │
│  - Returns to setup mode                │
└──────────────────────────────────────────┘
```

### Authentication Components

**Backend** (`backend/src/yardrover/`):
- `api/auth.py` - Login endpoints (password/PIN/API key), credential management
- `api/setup.py` - First-boot setup endpoints (creates user + API key)
- `auth/users.py` - User account management with password/PIN support
- `auth/api_keys.py` - API key generation and verification (bcrypt)
- `auth/jwt_handler.py` - JWT token creation and validation
- `auth/dependencies.py` - FastAPI auth dependencies (handles both users and API keys)
- `auth/rbac.py` - Role-based access control
- `auth/models.py` - User, APIKey, SecurityContext models

**Client Library** (`client/src/auth/`):
- `AuthClient.ts` - Full auth client with multiple login methods
- `AuthTypes.ts` - TypeScript types for auth (Role, Permission, User, etc.)

**Frontend** (`app/src/`):
- `stores/auth.ts` - Pinia auth store
- `pages/LoginPage.vue` - Mode-adaptive login interface (password/PIN/API key)
- `components/onboarding/steps/ConfigurationStep.vue` - Setup wizard with user creation
- `components/settings/SecuritySettings.vue` - Password and PIN management
- `router/guards.ts` - Route protection logic

### First-Time Setup Flow

1. **Backend boots in setup mode** (no admin users or API keys exist)
2. **User accesses web interface** at device's mDNS hostname or IP
3. **Setup wizard guides user** through:
   - Device naming
   - Creating admin user account (username + password)
   - Optionally setting a PIN (for quick consumer mode login)
4. **System creates**:
   - Admin user account with credentials
   - Admin API key for automation (shown once, user must save it)
5. **Device exits setup mode** and requires authentication
6. **User can now log in** with:
   - Username and password
   - PIN (if set during setup)
   - API key (for automation/CLI)

### Role-Based Access Control (RBAC)

**Roles:**
- **ADMIN** - Full system access (manage users, config, control)
- **OPERATOR** - Control and operate vehicle (no user management)
- **VIEWER** - Read-only access to status and telemetry

**Permissions:** Fine-grained permissions for specific actions (view, control, configure, manage)

### Security Features

- ✅ Multiple authentication methods (password/PIN/API key)
- ✅ Passwords and PINs hashed with bcrypt (never stored in plaintext)
- ✅ API keys hashed with bcrypt (never stored in plaintext)
- ✅ JWT tokens for stateless authentication (30-day default expiry)
- ✅ Unified SecurityContext for both users and API keys
- ✅ Rate limiting to prevent brute force attacks
- ✅ CORS configured for allowed origins only
- ✅ Session timeout warnings (5 minutes before expiry)
- ✅ Automatic token injection via HttpClient
- ✅ Physical reset requirement for lost credentials
- ✅ Password change functionality
- ✅ PIN management (set/remove) for consumer mode

## Onboarding System Architecture

The onboarding system provides a unified wizard for first-time users.

### Onboarding Flow

```
┌──────────────────────────────────────────┐
│  1. Welcome & Mode Selection            │
│     Choose: Consumer or Technical mode   │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  2. Connection                           │
│     Discover device via mDNS or manual   │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  3. Authentication                       │
│     Login or proceed to setup            │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  4. Configuration                        │
│     Name device & create admin account   │
│     (username/password + optional PIN)   │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  5. Optional: Calibration (Consumer)     │
│     Sensor & compass calibration         │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  6. Optional: GPS Boost                  │
│     RTK/NTRIP configuration              │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  7. Optional: Quick Tour                 │
│     Feature overview                     │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  8. Completion                           │
│     Ready to use!                        │
└──────────────────────────────────────────┘
```

### Key Components

- **OnboardingStore** (`app/src/stores/onboarding.ts`) - Centralized state management
- **SetupWizard** (`app/src/components/onboarding/SetupWizard.vue`) - Main wizard orchestrator
- **Step Components** (`app/src/components/onboarding/steps/`) - Modular steps for each phase
- **Router Guards** (`app/src/router/guards.ts`) - Redirect first-time users to onboarding

### Features

**Progress Persistence:**
- State saved to localStorage
- Users can resume interrupted onboarding
- Step completion tracked
- Optional steps can be skipped

**Error Recovery:**
- Connection loss handling
- Graceful error messages with recovery options
- Ability to go back to previous steps

**Mode Adaptation:**
- Consumer mode: Friendly language, emojis, guided wizards
- Technical mode: Technical terminology, detailed status, direct access

## TLS/HTTPS Configuration

YardRover supports secure HTTPS/TLS communication.

### Setup Options

**Option A: Development with Self-Signed Certificates**
```bash
cd backend
./scripts/generate_certs.sh ./certs
export YARDROVER_TLS_ENABLED=true
export YARDROVER_TLS_CERT_FILE=./certs/cert.pem
export YARDROVER_TLS_KEY_FILE=./certs/key.pem
export YARDROVER_TLS_PORT=8443
```

**Option B: Production with Let's Encrypt (Raspberry Pi)**
```bash
sudo apt-get install certbot
sudo certbot certonly --standalone -d yardrover.yourdomain.com
export YARDROVER_TLS_ENABLED=true
export YARDROVER_TLS_CERT_FILE=/etc/letsencrypt/live/yardrover.yourdomain.com/fullchain.pem
export YARDROVER_TLS_KEY_FILE=/etc/letsencrypt/live/yardrover.yourdomain.com/privkey.pem
export YARDROVER_TLS_PORT=443
```

**Option C: Production with Reverse Proxy (Recommended)**

Use Nginx or Caddy as HTTPS termination proxy:

```nginx
server {
    listen 443 ssl http2;
    server_name yardrover.local;

    ssl_certificate /etc/ssl/certs/yardrover.crt;
    ssl_certificate_key /etc/ssl/private/yardrover.key;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### mDNS Service Discovery

When TLS is enabled:
- Service type changes from `_http._tcp` to `_https._tcp`
- TXT record includes `tls=true` for client detection
- Port advertised matches configured TLS port

### Best Practices

⚠️ **Self-signed certificates** will trigger browser security warnings. For production, use certificates from a trusted CA.

✅ **Recommended**: Use a reverse proxy (Nginx/Caddy) for production. Benefits:
- Automatic certificate management and renewal
- Additional security headers and rate limiting
- Better performance with HTTP/2 and caching
- Easier certificate updates without backend restarts

## Data Flow

### Real-time Telemetry

```
MAVLink Vehicle ────▶ Backend (UART) ────▶ Backend Parser
                                                │
                                                ▼
                                         WebSocket Server
                                                │
                                                ▼
                                         Web App Dashboard
                                                │
                                                ▼
                                         Pinia Stores
                                                │
                                                ▼
                                         Vue Components
```

### Command Execution

```
User Action (Web App)
    │
    ▼
API Call (Client Library)
    │
    ▼
FastAPI Endpoint
    │
    ▼
MAVLink Command Builder
    │
    ▼
UART → Flight Controller
```

## State Management

### Frontend State (Pinia Stores)

- `authStore` - Authentication state and tokens
- `connectionStore` - Device connection management
- `devicesStore` - Saved devices and discovery
- `telemetryStore` - Real-time telemetry data
- `featuresStore` - User mode and feature flags
- `onboardingStore` - Onboarding progress and state

### Backend State

- In-memory storage for:
  - User accounts (username, hashed password, hashed PIN)
  - API keys (hashed)
  - Connection tracking
- (Future: SQLite database for persistent data):
  - User accounts
  - API keys
  - Device configuration
  - User preferences
  - Activity logs

## Configuration System

### Environment Modes (Recommended)

**Quick development setup:**

```bash
# Single variable enables all dev-friendly defaults
YARDROVER_ENVIRONMENT=development
```

This automatically configures:
- `log_level=DEBUG` (verbose logging)
- `debug=true` (debug mode)
- `reload=true` (hot reload)
- `allow_anonymous_docs=true` (public /docs endpoint)
- `rate_limit_enabled=false` (no rate limiting)

**Production mode** (default):

```bash
YARDROVER_ENVIRONMENT=production  # Secure defaults
```

### Environment Variables

All environment variables are prefixed with `YARDROVER_`:

```bash
# Environment Mode
YARDROVER_ENVIRONMENT=development  # or production (default)

# Security
YARDROVER_SECURITY_ENABLED=true
YARDROVER_JWT_SECRET=your-secret-key
YARDROVER_ACCESS_TOKEN_EXPIRE_MINUTES=43200

# Development (optional - auto-set by YARDROVER_ENVIRONMENT)
YARDROVER_DEBUG=false
YARDROVER_RELOAD=false
YARDROVER_LOG_LEVEL=INFO
YARDROVER_ALLOW_ANONYMOUS_DOCS=false

# TLS
YARDROVER_TLS_ENABLED=true
YARDROVER_TLS_CERT_FILE=/path/to/cert.pem
YARDROVER_TLS_KEY_FILE=/path/to/key.pem

# Network
YARDROVER_HOST=0.0.0.0
YARDROVER_PORT=8000
YARDROVER_CORS_ORIGINS=["*"]

# MAVLink
YARDROVER_SERIAL_PORT=/dev/ttyAMA0
YARDROVER_SERIAL_BAUDRATE=57600
```

### Config File (`backend/config.yaml`)

YAML configuration with same structure as environment variables. Environment variables take precedence.

**Template files:**
- `backend/.env.example` - Production defaults with documentation
- `backend/.env.development` - Pre-configured development settings

## Network Architecture

### Service Discovery (mDNS)

- Service type: `_yardrover._tcp` (HTTP) or `_yardrover._tcp` (HTTPS)
- TXT records include:
  - `version=1.0.0`
  - `model=YardRover`
  - `tls=true/false`
  - `auth_required=true/false`

### API Endpoints

**Authentication:**
- `POST /api/auth/login` - Login with API key
- `POST /api/auth/login/password` - Login with username/password
- `POST /api/auth/login/pin` - Login with PIN
- `POST /api/auth/logout` - Logout and invalidate token
- `POST /api/auth/password/change` - Change password
- `POST /api/auth/pin/set` - Set or update PIN
- `POST /api/auth/pin/remove` - Remove PIN
- `GET /api/auth/users` - List users (admin only)
- `POST /api/auth/users` - Create new user (admin only)
- `GET /api/auth/keys` - List API keys (admin only)
- `POST /api/auth/keys` - Create new API key (admin only)

**Setup:**
- `GET /api/setup/status` - Check setup mode status
- `POST /api/setup/complete` - Complete first-time setup

**Device Management:**
- `GET /api/status` - Device status and health
- `GET /api/config` - Device configuration
- `PUT /api/config` - Update configuration

**MAVLink Control:**
- `POST /api/mavlink/arm` - Arm/disarm vehicle
- `POST /api/mavlink/mode` - Change flight mode
- `POST /api/mavlink/command` - Send custom MAVLink command

**WebSocket:**
- `WS /ws/telemetry` - Real-time telemetry stream

## Development Architecture

### Frontend Build Pipeline

```
TypeScript/Vue Files → Vite → Transpile → Bundle → Optimized JS/CSS
                                   │
                                   ▼
                              Type Check
                                   │
                                   ▼
                              SCSS Compilation
```

### Backend Development

- FastAPI with Uvicorn for development
- Auto-reload on code changes
- OpenAPI/Swagger docs at `/docs`
- Type hints and Pydantic validation

### Client Library

- Built with TypeScript
- Generates type definitions for frontend
- Must be rebuilt when types change

## Testing Strategy

### Backend Tests
- Unit tests with pytest
- Integration tests for API endpoints
- MAVLink message parsing tests
- Authentication flow tests

### Frontend Tests
- Component tests (planned)
- E2E tests (planned)
- Manual testing with real devices

## Deployment Architecture

### Production Deployment (Raspberry Pi)

```
┌─────────────────────────────────────────┐
│  Raspberry Pi                           │
│                                         │
│  ┌────────────┐      ┌────────────┐   │
│  │   Nginx    │─────▶│  YardRover │   │
│  │ (HTTPS/443)│      │ Backend    │   │
│  └────────────┘      │ (HTTP/8000)│   │
│                      └────────────┘   │
│                           │            │
│                           ▼            │
│                      ┌────────────┐   │
│                      │  MAVLink   │   │
│                      │  /dev/ttyX │   │
│                      └────────────┘   │
└─────────────────────────────────────────┘
```

### Systemd Service

YardRover runs as a systemd service for:
- Auto-start on boot
- Process management
- Logging to journalctl
- Automatic restart on failure

## Performance Considerations

- **WebSocket Throttling**: Telemetry updates limited to 10Hz to prevent frontend overload
- **Connection Pooling**: Backend maintains single MAVLink connection, multiplexed to clients
- **State Debouncing**: Frontend debounces rapid state updates
- **Lazy Loading**: Dashboard widgets loaded on-demand
- **Code Splitting**: Vue components split for faster initial load

## Security Considerations

- **No Plaintext Secrets**: All API keys hashed with bcrypt
- **HTTPS-Only in Production**: Self-signed certs acceptable for local network
- **CORS Restrictions**: Configured for specific origins in production
- **Rate Limiting**: Prevents brute force attacks on auth endpoints
- **Input Validation**: Pydantic models validate all API inputs
- **SQL Injection Prevention**: ORM-based database access
- **XSS Prevention**: Vue's automatic escaping

## Future Architecture Enhancements

- [ ] Multi-device support (manage multiple YardRovers)
- [ ] Cloud synchronization for mission data
- [ ] Mobile app with native client
- [ ] Video streaming integration
- [ ] Advanced mission planning with AI assistance
- [ ] Fleet management capabilities
