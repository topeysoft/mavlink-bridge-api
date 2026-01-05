# YardRover Project - AI Assistant Context

## Quick Project Overview
YardRover is an autonomous yard utility machine controlled via a Vue 3 web application. The project consists of:
- **ESP32 Device**: C++ firmware with MAVLink integration, WiFi, RTCM, and task management
- **Web App**: Vue 3 + TypeScript frontend with custom components (NO Quasar - see [app/CLAUDE.md](app/CLAUDE.md))
- **API Client**: TypeScript library for device communication
- **Console Tool**: CLI for device management and testing

## Current Implementation Status
**Last Updated**: 2025-09-02  
**Stages Completed**: 3/10

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

## Essential Commands

### Development
```bash
# App development
cd app && npm run dev

# Build app
cd app && npm run build

# Build client library (required before app build)
cd client && npm run build

# Console tool
cd console && npm start
```

### Common Fixes
- **SCSS Issues**: Import variables with `@import '@/assets/styles/variables';`
- **Client Types**: Use `../../../client/dist/index` for imports
- **Build Errors**: Rebuild client library first: `cd client && npm run build`

## Current Working Features
- ✅ Device discovery and connection management
- ✅ Real-time connection monitoring
- ✅ Saved device management with persistence
- ✅ Manual connection with URL validation
- ✅ Connection status indicators throughout app
- ✅ Real-time telemetry dashboard with draggable widgets
- ✅ System health monitoring and metrics display
- ✅ Emergency stop functionality with safety confirmations
- ✅ Activity timeline with event logging and export
- ✅ Live data visualization charts
- ✅ Custom dialog system (47 native dialogs converted to Vue components)

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