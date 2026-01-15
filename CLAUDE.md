# YardRover Project - AI Assistant Context

## Quick Overview

YardRover is an autonomous yard utility machine with a web-based control interface. The project uses:
- **Backend**: Python/FastAPI on Raspberry Pi with MAVLink integration
- **Frontend**: Vue 3 + TypeScript with custom components (NO Quasar - see [app/CLAUDE.md](app/CLAUDE.md))
- **Client Library**: TypeScript API wrapper for type-safe communication
- **Console Tool**: CLI for device management

**Current Stage**: 3.6/10 - Auth, onboarding, and dashboard complete. Next: Machine control interface.

## Critical Architectural Decisions

### 1. NO Quasar Components

The web app uses **custom Vue 3 components** only. Never use `q-*` components, `useQuasar()`, or any Quasar imports. See [app/CLAUDE.md](app/CLAUDE.md) for details.

### 2. Client Library is Required

**ALWAYS use the client library** for device communication:

```typescript
// ✅ CORRECT - Use client library
import { MAVLinkBridge } from '../../../client/dist/index'
const client = new MAVLinkBridge(deviceUrl)
const status = await client.getStatus()

// ❌ WRONG - Never make direct fetch calls
const response = await fetch(`${deviceUrl}/api/status`)
```

**If the client library lacks features**: Extend the client library first, then use those new features in the app.

### 3. Three-Tier User Experience

The app adapts to three user modes (managed in `app/src/stores/features.ts`):

- **Consumer Mode**: Friendly language, emojis, guided wizards (e.g., "My Jobs" not "Missions")
- **Power User Mode**: Technical but accessible (e.g., "Missions", "Telemetry")
- **Developer Mode**: Full technical access (e.g., "MAVLink Stream", "Debug Mode")

Check feature flags before rendering features:
```typescript
import { useFeaturesStore } from '@/stores/features'

const featuresStore = useFeaturesStore()
if (featuresStore.isFeatureEnabled('systemMonitoring')) {
  // Show advanced monitoring
}
```

### 4. Authentication Flow

**First Boot** → Setup mode (no auth) → Create admin user account + API key → **Normal Operation** → Login required

**Three Authentication Methods:**
- **Username/Password** - For normal users
- **PIN** (4-6 digits) - Quick login for consumer mode
- **API Key** - For automation and CLI tools

**Implementation:**
- Passwords, PINs, and API keys hashed with bcrypt
- JWT tokens (30-day expiry) automatically injected on requests
- Unified SecurityContext handles both users and API keys
- Password change and PIN management in settings
- Physical device reset required if credentials lost
- Router guards protect authenticated routes

**Key Files:**
- Backend: `backend/src/yardrover/auth/users.py`, `backend/src/yardrover/api/auth.py`
- Client: `client/src/auth/AuthClient.ts` (loginWithPassword, loginWithPin, login)
- Frontend: `app/src/pages/LoginPage.vue`, `app/src/components/settings/SecuritySettings.vue`

### 5. WebSocket-First Architecture

**ALWAYS prefer WebSocket events over HTTP polling** for real-time updates:

```typescript
// ✅ CORRECT - Use WebSocket events
client.rtcm.onStatusChange((status) => {
  currentState.value = status.state
  statistics.value = status.statistics
})

// ❌ WRONG - Don't poll with setInterval
setInterval(async () => {
  const status = await client.rtcm.getStatus()
  currentState.value = status.state
}, 2000)
```

**WebSocket Event Types Available:**
- **System**: `health.update`, `status`, `log`, `error`
- **WiFi**: `wifi.connected`, `wifi.disconnected`, `wifi.signal.update`
- **MAVLink**: `mavlink.message`, `telemetry.update`, `heartbeat`
- **Resources**: `zone.created/updated/deleted`, `mission.created/updated/deleted`
- **RTCM**: `rtcm.status.changed`, `rtcm.data.received`, `rtcm.state.change`
- **Peripherals**: `peripheral.connected/disconnected`, `peripheral.telemetry`, `peripheral.status.changed`

**Pattern for stores:**
1. Initial fetch on mount (HTTP GET)
2. Setup WebSocket listeners for updates
3. Update local state on WebSocket events
4. No polling intervals

**External APIs only:** Use polling for external services (OpenWeatherMap, etc.) where WebSocket isn't available.

### 6. File Organization

- **`app/src/pages/`** - Pre-auth standalone pages (`*Page.vue`, use `StandaloneLayout`)
- **`app/src/views/`** - Authenticated app views (`*View.vue`, show sidebar/header)
- **`app/src/components/`** - Reusable UI components (no "View" or "Page" suffix)
- **`app/src/layouts/`** - Layout wrappers (`*Layout.vue`)

## Development Patterns

### Vue Components

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useMyStore } from '@/stores/myStore'

const myStore = useMyStore()
const count = ref(0)
</script>

<template>
  <button class="btn btn-primary" @click="count++">
    Count: {{ count }}
  </button>
</template>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.btn-primary {
  background: $primary;
  color: white;
}
</style>
```

### Pinia Stores (Composition API)

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMyStore = defineStore('myStore', () => {
  const items = ref<Item[]>([])
  const itemCount = computed(() => items.value.length)

  function addItem(item: Item) {
    items.value.push(item)
  }

  return { items, itemCount, addItem }
})
```

### Dialog System

**Always use `useDialog()` instead of native browser dialogs:**

```typescript
import { useDialog } from '@/composables/useDialog'

const dialog = useDialog()

// Confirmation
const confirmed = await dialog.confirm(
  'Are you sure?',
  'Confirm Action',
  { variant: 'danger', icon: '⚠️' }
)

// Alert
await dialog.alert('Success!', 'Done', { variant: 'success' })
```

## Theme & Styling

Nature-inspired colors from `@/assets/styles/variables`:

```scss
$primary: #2C5F2D;    // Forest green
$secondary: #87CEEB;  // Sky blue
$accent: #7CB342;     // Grass green

$positive: #28a745;
$negative: #dc3545;
$warning: #ffc107;
$info: #17a2b8;
```

## Key System Features

### Unified Onboarding System

First-time users go through:
1. Welcome & mode selection (Consumer vs Technical)
2. Device connection (mDNS or manual)
3. Authentication (login or setup)
4. Configuration (device name, API key)
5. Optional: Calibration, GPS boost, feature tour

State managed in `app/src/stores/onboarding.ts` with resumable progress.

### User Modes & Feature Flags

See [FEATURES.md](FEATURES.md) for complete feature matrix. Key differences:

| Feature | Consumer | Power User | Developer |
|---------|----------|------------|-----------|
| Vehicle Control | ❌ | ✅ | ✅ |
| MAVLink Stream | ❌ | ✅ | ✅ |
| Parameter Editor | ❌ | ❌ | ✅ |
| Debug Tools | ❌ | ❌ | ✅ |

### Authentication & Security

- **Setup mode**: Auto-detected on first boot, no auth required
- **Normal operation**: API key login → JWT token → auto token injection
- **RBAC**: Admin, Operator, Viewer roles with fine-grained permissions
- **Security**: bcrypt hashing, rate limiting, CORS, session timeout warnings

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed auth flows.

## Development Commands

### Quick Start (Development Mode)

```bash
# Backend with development defaults (debug, hot reload, /docs enabled)
export YARDROVER_ENVIRONMENT=development
cd backend && .venv/bin/python -m yardrover.main

# Or use the development config template
cp backend/.env.development backend/.env
cd backend && .venv/bin/python -m yardrover.main

# App
cd app && npm run dev

# Client library (build before app)
cd client && npm run build
```

### Environment Modes

**Development Mode** (`YARDROVER_ENVIRONMENT=development`):
- ✅ Debug logging (`DEBUG`)
- ✅ Hot reload enabled
- ✅ API docs public (`/docs`)
- ✅ Rate limiting disabled
- ✅ Permissive CORS

**Production Mode** (`YARDROVER_ENVIRONMENT=production` - default):
- ❌ Info logging (`INFO`)
- ❌ Hot reload disabled
- ❌ API docs require auth
- ✅ Rate limiting enabled
- ⚠️ Strict CORS (configure `YARDROVER_CORS_ORIGINS`)

Individual settings can override environment defaults (see `backend/.env.example`).

### Other Commands

```bash
# Backend with HTTPS (self-signed cert for dev)
cd backend && ./scripts/generate_certs.sh ./certs
export YARDROVER_TLS_ENABLED=true YARDROVER_TLS_CERT_FILE=./certs/cert.pem YARDROVER_TLS_KEY_FILE=./certs/key.pem YARDROVER_TLS_PORT=8443
cd backend && .venv/bin/python -m yardrover.main

# Tests
cd backend && .venv/bin/pytest
```

## Common Patterns & Conventions

### API Integration

```typescript
import { MAVLinkBridge } from '../../../client/dist/index'

// Create client
const client = new MAVLinkBridge(deviceUrl)

// Login
await client.authClient.login('yr_api_key')

// Get status
const status = await client.getStatus()

// WebSocket telemetry
client.connectWebSocket()
client.on('telemetry', (data) => {
  console.log('Telemetry:', data)
})
```

### Component Organization

**When to create mode-specific components:**
- User workflows differ significantly (guided wizards vs technical forms)
- Visual density/hierarchy vary greatly
- Language needs to be fundamentally different

Example: `ConnectionPage.vue` loads `ConsumerConnection.vue` or `TechnicalConnection.vue` based on mode.

**When to use conditional rendering:**
- Same layout with added/removed sections
- Optional advanced features in shared interface

Example: `Sidebar.vue` filters navigation items by feature flags.

### Language Adaptation

```typescript
const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Adapt labels
const label = isConsumerMode.value ? 'My Jobs' : 'Missions'
```

## Quick File Reference

**Auth & Security:**
- Backend: `backend/src/yardrover/api/auth.py`, `backend/src/yardrover/auth/` (users.py, api_keys.py, jwt_handler.py)
- Client: `client/src/auth/AuthClient.ts` (loginWithPassword, loginWithPin, login, changePassword, setPin, removePin)
- Frontend: `app/src/stores/auth.ts`, `app/src/pages/LoginPage.vue`, `app/src/components/settings/SecuritySettings.vue`, `app/src/router/guards.ts`

**Onboarding:**
- Store: `app/src/stores/onboarding.ts`
- Wizard: `app/src/components/onboarding/SetupWizard.vue`
- Steps: `app/src/components/onboarding/steps/`

**User Modes:**
- Feature flags: `app/src/stores/features.ts`
- Mode selector: `app/src/components/settings/UserModeSelector.vue`
- Mode-specific: `app/src/components/connection/ConsumerConnection.vue`, `app/src/components/connection/TechnicalConnection.vue`

**Core UI:**
- Theme: `app/src/assets/styles/_variables.scss`
- Dialog system: `app/src/composables/useDialog.ts`
- Layout: `app/src/layouts/StandaloneLayout.vue`

## Additional Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Detailed system architecture, auth flows, TLS setup
- **[FEATURES.md](FEATURES.md)** - Complete feature matrix, user modes, implementation status
- **[API_GUIDE.md](API_GUIDE.md)** - API usage examples, configuration reference, best practices
- **[app/CLAUDE.md](app/CLAUDE.md)** - Frontend-specific development guide

## Common Issues & Fixes

- **SCSS Issues**: Import with `@import '@/assets/styles/variables';`
- **Client Types**: Use `../../../client/dist/index` for imports
- **Build Errors**: Rebuild client library: `cd client && npm run build`
- **Auth Errors**: Check setup status via `/api/setup/status`
- **Quasar Usage**: Never use Quasar - see [app/CLAUDE.md](app/CLAUDE.md) for custom component patterns

## Implementation Philosophy

1. **Consumer-first UX**: Make simple tasks simple, advanced tasks possible
2. **Type safety**: Use TypeScript strictly, leverage client library types
3. **Secure by default**: Auth enabled, physical reset for lost credentials
4. **Progressive disclosure**: Hide complexity with feature flags and user modes
5. **Maintainability**: Keep docs updated, use client library for consistency
