# YardRover Project - AI Assistant Context

## Quick Project Overview
YardRover is an autonomous yard utility machine controlled via a Vue 3 web application. The project consists of:
- **Backend API**: Python/FastAPI with MAVLink integration, authentication, and device management
- **Web App**: Vue 3 + TypeScript frontend with custom components (NO Quasar - see [app/CLAUDE.md](app/CLAUDE.md))
- **API Client**: TypeScript library for device communication with auth support
- **Console Tool**: CLI for device management and testing

## Current Implementation Status
**Last Updated**: 2026-01-08
**Stages Completed**: 3.5/10

### ✅ Stage 1: Project Setup & Core Infrastructure (Complete)
- Vue 3 + TypeScript with custom components (NO Quasar)
- Nature-inspired theme system with SCSS variables
- Pinia state management with composition API
- Responsive layout and routing
- Custom dialog system with `useDialog()` composable

### ✅ Stage 2: Connection & Device Management (Complete)
- Device discovery via mDNS
- Connection management with health monitoring
- Saved devices with LocalStorage
- Real-time connection status indicators

### ✅ Stage 3: Dashboard & Status Monitoring (Complete)
- Real-time telemetry dashboard with draggable widgets
- System health monitoring (CPU, memory, temperature)
- Machine status display (battery, GPS, flight mode)
- Quick action controls (arm/disarm, mode switching)
- Activity timeline with event logging
- Emergency stop functionality
- Live data visualization charts

### ✅ Stage 3.5: Authentication & Security (Complete)
- **Backend**: API key authentication with bcrypt hashing
- **Backend**: JWT token generation and validation (30-day tokens)
- **Backend**: Role-based access control (Admin, Operator, Viewer)
- **Backend**: First-boot setup mode with auto-detection
- **Backend**: Setup API endpoints for initial configuration
- **Frontend**: Auth store with Pinia for state management
- **Frontend**: Login page with API key authentication
- **Frontend**: Setup page for first-boot configuration
- **Frontend**: Router guards for protected routes
- **Frontend**: Session timeout warnings
- **Client Library**: AuthClient with token management
- **Client Library**: Automatic token injection via HttpClient
- **Security**: Rate limiting and audit logging

### ⏳ Next: Stage 4: Machine Control Interface
Ready to implement detailed machine control features and MAVLink command interface.

## Development Patterns & Conventions

### File Structure
```
app/src/
├── components/[feature]/     # Feature-based component organization
├── stores/                   # Pinia stores with composition API
├── pages/                    # Route components
├── assets/styles/           # SCSS theme system
└── services/api/            # API integration layer
```

### Code Conventions
- **Vue**: Composition API with `<script setup lang="ts">`
- **TypeScript**: Strict typing with imported client library types
- **Styling**: SCSS with `@import '@/assets/styles/variables'` for custom colors
- **State**: Pinia stores with composition API pattern
- **Imports**: Use `../../../client/dist/index` for MAVLinkBridge types
- **API Integration**:
  - **ALWAYS use the client library** (`../../../client/dist/index`) for all device REST and WebSocket API access
  - **NEVER make direct fetch/axios calls** to device endpoints - use the `MAVLinkBridge` class instead
  - **If the client library lacks required features**: Recommend or implement changes to the client library first, then use those features in the app
  - All device communication must go through the type-safe client library to ensure consistency and maintainability

### Key Architecture Decisions
- **Theme**: Nature-inspired colors (`$primary: #2C5F2D`, `$secondary: #87CEEB`)
- **Client Integration**: Local client library at `../client/dist/` for type safety
- **State Management**: Reactive stores with computed getters and async actions
- **User Feedback**: Custom toast notifications and dialog system (see `app/CLAUDE.md`)
- **NO Quasar**: All UI components are custom-built with Vue 3 and native HTML

## Authentication & Security

### Overview
YardRover uses a **secure by default** authentication system designed for owner-only access with physical reset capability.

### Security Architecture
```
┌──────────────────────────────────────────┐
│  First Boot (Setup Mode)                │
│  - Auto-detected on startup             │
│  - Creates admin API key                │
│  - No auth required for setup           │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Normal Operation                        │
│  - Login with API key                    │
│  - Receive JWT token (30 days)          │
│  - Auto token injection on requests     │
│  - Session monitoring & warnings        │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Physical Reset (if needed)              │
│  - Access device console                │
│  - Set YARDROVER_DEBUG=true             │
│  - Call /api/setup/reset endpoint       │
│  - Returns to setup mode                │
└──────────────────────────────────────────┘
```

### First-Time Setup Flow
1. **Start YardRover Backend** - Device boots in setup mode (no admin keys exist)
2. **Connect to Device** - Access web interface or check console logs for URL
3. **Visit Setup Page** - Navigate to `/setup` route
4. **Create Admin Credentials** - Enter device name and admin key name
5. **Save API Key** - Copy the generated API key (shown only once!)
6. **Login** - Use API key to authenticate and access the dashboard

### Authentication Components

**Backend (`backend/src/yardrover/`):**
- `api/auth.py` - Login, API key management endpoints
- `api/setup.py` - First-boot setup endpoints
- `auth/api_keys.py` - API key generation and verification (bcrypt)
- `auth/jwt_handler.py` - JWT token creation and validation
- `auth/dependencies.py` - FastAPI auth dependencies
- `auth/rbac.py` - Role-based access control

**Client Library (`client/src/auth/`):**
- `AuthClient.ts` - Full auth client with token management
- `AuthTypes.ts` - TypeScript types for auth (Role, Permission, etc.)

**Frontend (`app/src/`):**
- `stores/auth.ts` - Pinia auth store
- `pages/LoginPage.vue` - Login interface
- `pages/SetupPage.vue` - First-boot setup wizard
- `router/guards.ts` - Route protection logic
- `components/auth/SessionTimeout.vue` - Session expiry warnings

### Role-Based Access Control (RBAC)

**Roles:**
- `ADMIN` - Full system access (manage users, config, control)
- `OPERATOR` - Control and operate vehicle (no user management)
- `VIEWER` - Read-only access to status and telemetry

**Permissions:** Fine-grained permissions for specific actions (view, control, configure, manage)

### Security Best Practices
✅ Auth enabled by default (`security.enabled = true`)
✅ API keys hashed with bcrypt (never stored in plaintext)
✅ JWT tokens for stateless authentication (30-day default expiry)
✅ Rate limiting prevents brute force attacks
✅ CORS configured for allowed origins only
✅ Session timeout warnings (5 minutes before expiry)
✅ Automatic token injection via HttpClient
✅ Physical reset requirement for production systems

### Environment Variables
```bash
# Security settings
YARDROVER_SECURITY_ENABLED=true                 # Enable authentication
YARDROVER_JWT_SECRET=your-secret-key            # JWT signing key
YARDROVER_ACCESS_TOKEN_EXPIRE_MINUTES=43200     # 30 days
YARDROVER_SESSION_TIMEOUT_MINUTES=10080         # 7 days inactivity
YARDROVER_RATE_LIMIT_ENABLED=true               # Enable rate limiting
YARDROVER_RATE_LIMIT_REQUESTS=100               # Max requests per window
YARDROVER_CORS_ORIGINS=["*"]                    # Allowed CORS origins
```

### API Usage Examples

**Login:**
```typescript
const authClient = client.authClient
const response = await authClient.login('yr_your_api_key_here')
// Token automatically stored and injected on all requests
```

**Check Setup Status:**
```typescript
const status = await authClient.getSetupStatus()
if (status.in_setup_mode) {
  // Redirect to setup page
}
```

**Complete Setup:**
```typescript
const response = await authClient.completeSetup({
  device_name: 'My YardRover',
  admin_key_name: 'Owner',
})
console.log('Save this key:', response.api_key)
```

## Essential Commands

### Development
```bash
# Backend development
cd backend && .venv/bin/uvicorn yardrover.main:app --reload

# App development
cd app && npm run dev

# Build app
cd app && npm run build

# Build client library (required before app build)
cd client && npm run build

# Console tool
cd console && npm start

# Run backend tests
cd backend && .venv/bin/pytest
```

### Common Fixes
- **SCSS Issues**: Import variables with `@import '@/assets/styles/variables';`
- **Client Types**: Use `../../../client/dist/index` for imports
- **Build Errors**: Rebuild client library first: `cd client && npm run build`
- **Auth Errors**: Check that setup is complete via `/api/setup/status`

## User Experience Modes

YardRover implements a **three-tier UX mode system** to provide appropriate interfaces for different user expertise levels. This ensures consumers get a simple, guided experience while power users and developers have access to advanced features.

### Mode Overview

**Three User Modes** ([app/src/stores/features.ts](app/src/stores/features.ts)):

1. **Consumer Mode** 🟢
   - **Target**: Homeowners with no technical knowledge
   - **Focus**: Simple, task-oriented interface with guided workflows
   - **Language**: Consumer-friendly terms ("My Jobs" instead of "Missions")
   - **Features**: Essential operations only (templates, scheduling, basic monitoring)

2. **Power User Mode** 🟡
   - **Target**: Experienced operators, landscaping professionals
   - **Focus**: Advanced control and detailed monitoring
   - **Language**: Technical but accessible ("Missions", "Telemetry", "Parameters")
   - **Features**: Full operational control plus analytics and diagnostics

3. **Developer Mode** 🔴
   - **Target**: Developers, advanced users, system integrators
   - **Focus**: Complete system access, debugging, and customization
   - **Language**: Technical/engineering terms ("MAVLink", "Parameter Editor", "Debug Mode")
   - **Features**: All features including low-level access and experimental tools

### Feature Matrix

The features store manages 20+ feature flags that control UI visibility:

| Feature Category | Consumer | Power User | Developer |
|-----------------|----------|------------|-----------|
| **Mission & Planning** |
| Mission Templates | ✅ | ✅ | ✅ |
| Mission Scheduling | ✅ | ✅ | ✅ |
| **Control & MAVLink** |
| Vehicle Control | ❌ | ✅ | ✅ |
| Flight Modes | ❌ | ✅ | ✅ |
| MAVLink Stream | ❌ | ✅ | ✅ |
| Parameter Configuration | ❌ | ✅ | ✅ |
| Parameter Editor | ❌ | ❌ | ✅ |
| **Monitoring & Debugging** |
| System Monitoring | ❌ | ✅ | ✅ |
| Telemetry Charts | ❌ | ✅ | ✅ |
| Activity Logs | ❌ | ✅ | ✅ |
| Log Download | ❌ | ✅ | ✅ |
| **Advanced Features** |
| Geofencing | ❌ | ✅ | ✅ |
| Rally Points | ❌ | ✅ | ✅ |
| Battery Management | ✅ | ✅ | ✅ |
| Weather Integration | ✅ | ✅ | ✅ |
| RTK/RTCM Client | ✅ | ✅ | ✅ |
| Custom Commands | ❌ | ❌ | ✅ |
| Script Execution | ❌ | ❌ | ✅ |
| **Developer Tools** |
| API Console | ❌ | ❌ | ✅ |
| Debug Mode | ❌ | ❌ | ✅ |
| Experimental Features | ❌ | ❌ | ✅ |

### Implementation Guidelines

#### 1. When to Create Mode-Specific Components

**Create separate components when:**
- User workflows differ significantly (e.g., guided wizards vs. technical forms)
- Visual hierarchy and information density vary greatly
- Language and terminology need to be fundamentally different

**Example**: Connection Page ([app/src/pages/ConnectionPage.vue](app/src/pages/ConnectionPage.vue))
```typescript
<template>
  <StandaloneLayout title="YardRover">
    <!-- Consumer Mode: Friendly guided experience -->
    <ConsumerConnection v-if="isConsumerMode" />

    <!-- Technical Mode: Detailed technical interface -->
    <TechnicalConnection v-else />
  </StandaloneLayout>
</template>
```

#### 2. When to Use Conditional Rendering

**Use v-if/feature flags when:**
- Components share the same layout but add/remove sections
- Adding optional advanced features to a shared interface
- Hiding technical details from consumer users

**Example**: Sidebar Navigation ([app/src/components/common/Sidebar.vue](app/src/components/common/Sidebar.vue))
```typescript
const navItems = computed(() => {
  const isConsumerMode = featuresStore.userMode === 'consumer'

  return allNavItems.filter(item => {
    if (!item.requiresFeature) return true
    return featuresStore.isFeatureEnabled(item.requiresFeature)
  }).map(item => ({
    ...item,
    // Use consumer-friendly label in consumer mode if available
    label: isConsumerMode && item.consumerLabel ? item.consumerLabel : item.label
  }))
})
```

#### 3. Language & Terminology Rules

**Consumer Mode:**
- ✅ "My Jobs" (not "Missions")
- ✅ "My Areas" (not "Coverage Zones")
- ✅ "Schedule" (not "Schedule & Calendar")
- ✅ "Setup" (not "Calibration")
- ✅ "GPS Boost" (not "RTK Positioning")
- ✅ Simple action verbs: "Start a Job", "View Status"
- ✅ Emoji icons for friendliness
- ✅ Step-by-step guided wizards

**Power User Mode:**
- ✅ "Missions" (technical but accessible)
- ✅ "Coverage Zones", "Telemetry", "Parameters"
- ✅ "Live Monitoring", "Activity Logs"
- ✅ Technical icons with labels
- ✅ Detailed status displays
- ✅ Advanced configuration options

**Developer Mode:**
- ✅ "MAVLink Stream", "Parameter Editor", "Debug Mode"
- ✅ "API Console", "Custom Commands"
- ✅ Raw data views and hex dumps
- ✅ Full technical terminology
- ✅ Experimental and beta features

#### 4. Component Design Patterns

**Consumer Components:**
```vue
<!-- Large, colorful cards with emojis and friendly language -->
<div class="consumer-card">
  <div class="emoji-icon">🌱</div>
  <h3>Start a Job</h3>
  <p>Create and start a new job with easy setup</p>
  <button class="btn-large">Let's Go!</button>
</div>
```

**Power User Components:**
```vue
<!-- Compact, data-dense layouts with technical metrics -->
<div class="monitoring-panel">
  <h4>System Telemetry</h4>
  <MetricRow label="CPU Usage" :value="cpuPercent" unit="%" />
  <MetricRow label="Memory" :value="memUsed" :max="memTotal" />
  <Chart :data="telemetryData" />
</div>
```

**Developer Components:**
```vue
<!-- Technical layouts with raw data and debugging info -->
<div class="debug-panel">
  <h4>MAVLink Message Stream</h4>
  <pre class="message-log">{{ rawMessages }}</pre>
  <button @click="exportLogs">Export Raw Data</button>
</div>
```

#### 5. Feature Flag Usage

**Always check feature flags before rendering:**
```typescript
import { useFeaturesStore } from '@/stores/features'

const featuresStore = useFeaturesStore()

// Hide entire sections
if (featuresStore.isFeatureEnabled('systemMonitoring')) {
  // Show monitoring dashboard
}

// Control navigation
const navItems = computed(() =>
  allItems.filter(item =>
    !item.requiresFeature ||
    featuresStore.isFeatureEnabled(item.requiresFeature)
  )
)

// Adapt UI complexity
const showAdvanced = computed(() =>
  featuresStore.userMode !== 'consumer'
)
```

#### 6. Mode Switching

Users can switch modes at any time via Settings:
- Mode selector in [app/src/components/settings/UserModeSelector.vue](app/src/components/settings/UserModeSelector.vue)
- Settings persist to localStorage
- Custom feature flags can override preset configurations
- Immediate UI updates via reactive store

### Design Principles by Mode

**Consumer Mode Principles:**
1. **Minimal Choices**: Show only essential options
2. **Guided Workflows**: Step-by-step wizards with progress indicators
3. **Visual Feedback**: Large emojis, color-coded status, animations
4. **Natural Language**: Avoid technical jargon completely
5. **Safety First**: Confirm destructive actions with clear warnings
6. **Hide Complexity**: No technical details unless something goes wrong

**Power User Mode Principles:**
1. **Information Density**: Show all relevant data without clutter
2. **Efficient Workflows**: Direct access to features, fewer wizards
3. **Technical Accuracy**: Precise metrics and status information
4. **Customization**: Allow users to configure views and preferences
5. **Professional Tools**: Charts, logs, export functions
6. **Quick Actions**: Keyboard shortcuts, batch operations

**Developer Mode Principles:**
1. **Complete Transparency**: Show all underlying system state
2. **Direct Access**: Low-level controls and raw data
3. **Debugging Tools**: Logs, message streams, API console
4. **Experimentation**: Enable beta features and custom commands
5. **Documentation**: Inline help for technical features
6. **Safety with Power**: Warnings for dangerous operations

### Code Examples

**Check User Mode:**
```typescript
import { useFeaturesStore } from '@/stores/features'

const featuresStore = useFeaturesStore()
const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')
const isPowerUser = computed(() => featuresStore.userMode === 'power-user')
const isDeveloper = computed(() => featuresStore.userMode === 'developer')
```

**Conditional Component Loading:**
```vue
<template>
  <!-- Auto-discover only in technical modes -->
  <div v-if="!isConsumerMode">
    <AutoDiscovery @device-found="handleDevice" />
  </div>

  <!-- Simple guided experience for consumers -->
  <div v-else>
    <GuidedSetup />
  </div>
</template>
```

**Feature-Specific Navigation:**
```typescript
interface NavItem {
  name: ViewName
  label: string
  icon: string
  consumerLabel?: string      // Override label in consumer mode
  requiresFeature?: keyof FeatureFlags  // Hide if feature disabled
}

const navItems: NavItem[] = [
  {
    name: 'missions',
    label: 'Missions',
    consumerLabel: 'My Jobs',  // Friendly name for consumers
    icon: 'assignment',
    requiresFeature: 'missionTemplates'
  },
  {
    name: 'parameters',
    label: 'Parameters',
    icon: 'tune',
    requiresFeature: 'parameterConfiguration'  // Hidden in consumer mode
  }
]
```

### Testing Across Modes

When implementing new features, test in all three modes:

1. **Consumer Mode**: Verify feature is hidden if not consumer-appropriate
2. **Power User Mode**: Ensure advanced features are accessible
3. **Developer Mode**: Confirm all debugging tools are available
4. **Mode Switching**: Test live switching between modes

### Related Files

**Core Implementation:**
- [app/src/stores/features.ts](app/src/stores/features.ts) - Feature flags and mode management
- [app/src/components/settings/UserModeSelector.vue](app/src/components/settings/UserModeSelector.vue) - Mode switching UI

**Mode-Specific Components:**
- [app/src/components/connection/ConsumerConnection.vue](app/src/components/connection/ConsumerConnection.vue) - Consumer connection flow
- [app/src/components/connection/TechnicalConnection.vue](app/src/components/connection/TechnicalConnection.vue) - Technical connection interface
- [app/src/views/ConsumerDashboardView.vue](app/src/views/ConsumerDashboardView.vue) - Consumer-focused dashboard
- [app/src/components/settings/ConsumerSettings.vue](app/src/components/settings/ConsumerSettings.vue) - Simplified settings

**Examples:**
- [app/src/pages/ConnectionPage.vue](app/src/pages/ConnectionPage.vue) - Mode-based component switching
- [app/src/components/common/Sidebar.vue](app/src/components/common/Sidebar.vue) - Feature flag filtering and label adaptation

## Current Working Features
- ✅ **User Experience Modes**
  - Three-tier mode system (Consumer, Power User, Developer)
  - 20+ feature flags for granular control
  - Mode-specific components and workflows
  - Consumer-friendly language adaptation
  - Dynamic navigation based on enabled features
  - Persistent mode selection with localStorage
- ✅ **Authentication & Security**
  - API key-based authentication with bcrypt hashing
  - JWT token management (30-day tokens)
  - Role-based access control (Admin, Operator, Viewer)
  - First-boot setup wizard
  - Login/logout functionality
  - Session timeout warnings
  - Router guards for protected routes
  - Automatic token injection on API requests
- ✅ **Device Management**
  - Device discovery via mDNS
  - Connection management with health monitoring
  - Saved device management with persistence
  - Manual connection with URL validation
  - Connection status indicators throughout app
- ✅ **Dashboard & Monitoring**
  - Real-time telemetry dashboard with draggable widgets
  - System health monitoring and metrics display
  - Machine status display (battery, GPS, flight mode)
  - Quick action controls (arm/disarm, mode switching)
  - Emergency stop functionality with safety confirmations
  - Activity timeline with event logging and export
  - Live data visualization charts
- ✅ **UI/UX**
  - Custom dialog system (47 native dialogs converted to Vue components)
  - Nature-inspired theme with SCSS variables
  - Responsive design for all screen sizes

## Known Issues & Notes
- Client library must be built before app build
- Uses local client library imports for better type safety
- Health monitoring requires active device connection
- Auto-discovery runs on connection page load

## Next Implementation Priority
Focus on **Stage 4: Machine Control Interface** - implement detailed MAVLink command interface, flight mode controls, and vehicle status management for precise YardRover control.

## File Locations for Quick Reference
- **Connection Store**: `app/src/stores/connection.ts`
- **Devices Store**: `app/src/stores/devices.ts`
- **Connection Page**: `app/src/pages/ConnectionPage.vue`
- **Connection Components**: `app/src/components/connection/`
- **Theme Variables**: `app/src/assets/styles/_variables.scss`
- **API Client**: `client/src/` (build to `client/dist/`)
- **Progress Tracking**: `PROGRESS.md`