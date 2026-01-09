# Secure YardRover Authentication Implementation Plan

## Current State Analysis

✅ **Already Implemented:**

- API key-based authentication with bcrypt hashing
- JWT token generation and validation
- Role-based access control (RBAC): Admin, Operator, Viewer
- Rate limiting and WebSocket security
- Security configuration (enabled by default)
- Auto-generated admin key on first boot
- Protected API endpoints with dependency injection

❌ **Missing for Secure Owner Access:**

- Frontend authentication UI (login page)
- Token storage and auto-refresh in frontend
- First-boot setup flow for initial password/key creation
- Physical reset mechanism documentation
- HTTPS/TLS support
- Session timeout warnings

## Implementation Plan

### Phase 1: Backend Enhancements

1. **Setup Mode Controller** (`backend/src/yardrover/api/setup.py`)
   - Add setup mode state (first boot detection)
   - Create setup completion endpoint
   - Store setup completion flag in config

2. **Enhanced Security Config** (update `models/config.py`)
   - Add `setup_completed` flag
   - Add `require_auth_for_setup` option
   - Add session timeout settings

3. **Update Main Application** (`backend/src/yardrover/main.py`)
   - Detect first boot (no API keys + setup not completed)
   - Log clear instructions for accessing setup mode
   - Optionally disable auth during setup (configurable)

### Phase 2: TypeScript Client Library Updates

4. **Auth Client** (`client/src/auth/AuthClient.ts` - NEW)
   - Login endpoint integration
   - Token storage management
   - Token refresh logic
   - Logout functionality

2. **Update HttpClient** (`client/src/core/HttpClient.ts`)
   - Add token injection interceptor
   - Add 401 handling with token refresh
   - Add auth error detection

3. **Export Auth Types** (`client/src/auth/AuthTypes.ts` - NEW)
   - LoginRequest, LoginResponse
   - AuthState, TokenData
   - Role and Permission enums

### Phase 3: Frontend Authentication UI

7. **Auth Store** (`app/src/stores/auth.ts` - NEW)
   - Token state management
   - Login/logout actions
   - Auto-refresh timer
   - Session timeout detection

2. **Login Page** (`app/src/pages/LoginPage.vue` - NEW)
   - API key input or password field
   - "Remember me" option
   - Error handling
   - Redirect to setup on first boot

3. **Setup Page** (`app/src/pages/SetupPage.vue` - NEW)
   - Welcome screen
   - Create admin credentials
   - Device name configuration
   - Setup completion

4. **Auth Guard** (`app/src/router/guards.ts` - NEW)
    - Route protection
    - Redirect to login if unauthenticated
    - Allow setup page access

5. **Update Router** (`app/src/router/index.ts`)
    - Add auth guard to protected routes
    - Add login and setup routes

6. **Session Timeout Component** (`app/src/components/auth/SessionTimeout.vue` - NEW)
    - Warning dialog before expiration
    - Auto-logout on timeout

### Phase 4: Security Best Practices

13. **Documentation** (update `CLAUDE.md`)
    - Authentication flow documentation
    - First-boot setup instructions
    - Physical reset procedure
    - Security best practices

2. **Environment Variables** (update `.env.example`)
    - Document all security settings
    - Add HTTPS configuration options

3. **Testing**
    - Unit tests for auth endpoints
    - Integration tests for login flow
    - E2E tests for setup flow

## Recommended Security Architecture

```
┌─────────────────────────────────────┐
│  First Boot Setup                   │
│  1. Device generates JWT secret     │
│  2. User accesses setup page        │
│  3. Creates admin API key           │
│  4. Setup marked complete           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Normal Operation                   │
│  1. User logs in with API key       │
│  2. Receives JWT token (30 days)    │
│  3. Token auto-refreshes            │
│  4. All requests include token      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Physical Reset (if needed)         │
│  1. Hold button for 10s on device   │
│  2. Clears all API keys             │
│  3. Returns to setup mode           │
└─────────────────────────────────────┘
```

## Key Features

✅ Secure by default (auth enabled)
✅ Simple first-boot setup experience
✅ Long-lived tokens (30 days) for convenience
✅ Physical reset fallback
✅ Local network only (no internet exposure)
✅ Rate limiting prevents brute force
✅ RBAC for multi-user scenarios

## Files to Create/Modify

**New Files (15):**

- `backend/src/yardrover/api/setup.py`
- `client/src/auth/AuthClient.ts`
- `client/src/auth/AuthTypes.ts`
- `client/src/auth/index.ts`
- `app/src/stores/auth.ts`
- `app/src/pages/LoginPage.vue`
- `app/src/pages/SetupPage.vue`
- `app/src/router/guards.ts`
- `app/src/components/auth/SessionTimeout.vue`
- `backend/tests/unit/api/test_setup_api.py`
- `backend/tests/integration/test_auth_flow.py`

**Modified Files (6):**

- `backend/src/yardrover/models/config.py`
- `backend/src/yardrover/main.py`
- `client/src/core/HttpClient.ts`
- `client/src/index.ts`
- `app/src/router/index.ts`
- `CLAUDE.md`
