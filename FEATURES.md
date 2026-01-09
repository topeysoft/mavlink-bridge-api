# YardRover Features

This document describes the features, user modes, and implementation status of YardRover.

## Current Implementation Status

**Last Updated**: 2026-01-09
**Stages Completed**: 3.6/10

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

### ✅ Stage 3.6: Unified Onboarding System (Complete)
- **Onboarding Store**: Centralized state management for setup flow
- **SetupWizard**: Unified wizard component orchestrating entire onboarding
- **Progress Tracking**: Visual progress indicator with step completion
- **Mode Selection**: Welcome screen for Consumer vs Technical mode choice
- **Step Components**: Modular connection, auth, configuration, calibration, GPS, tour steps
- **Smart Resume**: Ability to resume interrupted onboarding from last step
- **Router Integration**: Onboarding guard redirecting first-time users
- **User Experience**: Distinct flows for consumer (friendly) vs technical users

### ⏳ Next: Stage 4: Machine Control Interface
Ready to implement detailed machine control features and MAVLink command interface.

## User Experience Modes

YardRover implements a **three-tier UX mode system** to provide appropriate interfaces for different user expertise levels.

### Mode Overview

**Three User Modes** (managed in `app/src/stores/features.ts`):

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

### Mode-Specific Design Principles

**Consumer Mode:**
1. **Minimal Choices** - Show only essential options
2. **Guided Workflows** - Step-by-step wizards with progress indicators
3. **Visual Feedback** - Large emojis, color-coded status, animations
4. **Natural Language** - Avoid technical jargon completely
5. **Safety First** - Confirm destructive actions with clear warnings
6. **Hide Complexity** - No technical details unless something goes wrong

**Power User Mode:**
1. **Information Density** - Show all relevant data without clutter
2. **Efficient Workflows** - Direct access to features, fewer wizards
3. **Technical Accuracy** - Precise metrics and status information
4. **Customization** - Allow users to configure views and preferences
5. **Professional Tools** - Charts, logs, export functions
6. **Quick Actions** - Keyboard shortcuts, batch operations

**Developer Mode:**
1. **Complete Transparency** - Show all underlying system state
2. **Direct Access** - Low-level controls and raw data
3. **Debugging Tools** - Logs, message streams, API console
4. **Experimentation** - Enable beta features and custom commands
5. **Documentation** - Inline help for technical features
6. **Safety with Power** - Warnings for dangerous operations

### Language & Terminology by Mode

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

## Implemented Features by Category

### ✅ Authentication & Security
- API key-based authentication with bcrypt hashing
- JWT token management (30-day tokens)
- Role-based access control (Admin, Operator, Viewer)
- First-boot setup wizard
- Login/logout functionality
- Session timeout warnings
- Router guards for protected routes
- Automatic token injection on API requests
- TLS/HTTPS support with self-signed and Let's Encrypt certificates

### ✅ Device Management
- Device discovery via mDNS
- Connection management with health monitoring
- Saved device management with persistence
- Manual connection with URL validation
- Connection status indicators throughout app
- Multi-device support (saved devices list)

### ✅ Dashboard & Monitoring
- Real-time telemetry dashboard with draggable widgets
- System health monitoring and metrics display
- Machine status display (battery, GPS, flight mode)
- Quick action controls (arm/disarm, mode switching)
- Emergency stop functionality with safety confirmations
- Activity timeline with event logging and export
- Live data visualization charts

### ✅ UI/UX Features
- Custom dialog system (47 native dialogs converted to Vue components)
- Nature-inspired theme with SCSS variables
- Responsive design for all screen sizes
- Dark mode support (via theme toggle)
- Toast notifications for user feedback
- Modal system for forms and confirmations
- Three-tier user mode system (Consumer, Power User, Developer)
- Dynamic navigation based on enabled features

### ✅ Onboarding & Setup
- Unified onboarding wizard for first-time users
- Progress tracking and resumable flows
- Consumer vs Technical mode selection
- Connection assistance and troubleshooting
- Guided calibration wizards (consumer mode)
- GPS boost setup (RTK/NTRIP configuration)
- Optional feature tour

## Planned Features (Future Stages)

### Stage 4: Machine Control Interface (Next)
- Detailed MAVLink command interface
- Flight mode controls with safety checks
- Vehicle status management
- Waypoint creation and editing
- Manual control interface

### Stage 5: Mission Planning
- Mission template system
- Coverage area definition
- Path planning and optimization
- Schedule management
- Mission presets

### Stage 6: Advanced Features
- Geofencing with boundary editing
- Rally points for safety
- Battery management and predictions
- Weather integration
- Advanced telemetry analysis

### Stage 7: Parameter Management
- Parameter editor with validation
- Parameter sets (save/load presets)
- Group-based organization
- Export/import functionality
- Change history tracking

### Stage 8: Activity Logs & Analytics
- Session log viewer with timeline
- Statistics dashboard
- Data visualization and charts
- Export to CSV, KML, GeoJSON, JSON
- Filter and search functionality

### Stage 9: System Configuration
- Network settings management
- MAVLink connection configuration
- Storage management
- System updates
- Backup and restore

### Stage 10: Polish & Optimization
- Performance optimization
- Error handling improvements
- Accessibility enhancements
- Mobile app optimization
- Documentation completion

## Known Limitations

- Client library must be built before app build
- Health monitoring requires active device connection
- Auto-discovery only works on local network
- WebSocket reconnection may take a few seconds
- Some features require specific ArduPilot versions
- No offline mode for telemetry data

## Feature Flags & Customization

Users can customize their experience by:
- **Switching user modes** - Choose between Consumer, Power User, or Developer
- **Custom feature flags** - Override preset configurations via settings
- **Theme customization** - Light/dark mode toggle
- **Widget layout** - Drag-and-drop dashboard customization
- **Saved preferences** - Settings persist to localStorage

## File Locations

**Core Implementation:**
- Feature flags store: `app/src/stores/features.ts`
- User mode selector: `app/src/components/settings/UserModeSelector.vue`

**Mode-Specific Components:**
- Consumer connection: `app/src/components/connection/ConsumerConnection.vue`
- Technical connection: `app/src/components/connection/TechnicalConnection.vue`
- Consumer dashboard: `app/src/views/ConsumerDashboardView.vue`
- Consumer settings: `app/src/components/settings/ConsumerSettings.vue`

**Onboarding System:**
- Onboarding store: `app/src/stores/onboarding.ts`
- Setup wizard: `app/src/components/onboarding/SetupWizard.vue`
- Step components: `app/src/components/onboarding/steps/`
- Router guards: `app/src/router/guards.ts`

## Testing Across Modes

When testing new features:

1. **Consumer Mode** - Verify feature is hidden if not consumer-appropriate
2. **Power User Mode** - Ensure advanced features are accessible
3. **Developer Mode** - Confirm all debugging tools are available
4. **Mode Switching** - Test live switching between modes
5. **Feature Flags** - Verify custom feature flag overrides work correctly
