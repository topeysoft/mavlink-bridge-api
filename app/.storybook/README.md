# YardRover Storybook

This directory contains the Storybook configuration for the YardRover Vue.js application.

## Usage

```bash
# Start Storybook development server
npm run storybook

# Build static Storybook
npm run build-storybook
```

## Configuration Files

- `main.js` - Main Storybook configuration with Vite integration
- `preview.js` - Global decorators and parameters for all stories

## Features

- Vue 3 + Quasar component support
- Pinia store integration for stateful components
- Custom SCSS theme integration
- Material Icons support
- Interactive controls and documentation

## Available Stories

All 14 existing YardRover components have comprehensive stories:

### Common Components
- AppLogo - Logo variations and animations
- ConnectionIndicator - Connection status states
- LoadingSpinner - Loading indicators

### Connection Components  
- ConnectionDialog - Manual connection interface
- ConnectionStatus - Detailed connection display
- DeviceCard - Individual device cards
- SavedDevicesList - Device management list

### Dashboard Widgets
- EmergencyStop - Emergency stop dialog
- ActivityWidget - Activity timeline
- MachineStatusWidget - Machine status display
- QuickActionsWidget - Control actions
- SystemHealthWidget - System metrics
- TelemetryWidget - Live telemetry charts

### Layout Components
- NavItem - Navigation menu items

Each component includes multiple story variants demonstrating different states and configurations.