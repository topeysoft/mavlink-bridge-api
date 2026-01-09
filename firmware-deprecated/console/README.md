# YardRover Console Manager

An interactive command-line interface for managing MAVLinkBridge ESP32 devices. This console application provides comprehensive control over device configuration, WiFi management, MAVLink communication, task execution, and system monitoring.

## Features

### 🔌 Device Management
- Device discovery and connection
- Connection testing and diagnostics
- Device information and status
- Real-time system monitoring

### ⚙️ Configuration Management
- View and edit device configuration
- Configuration backup and restore
- Factory reset functionality
- Settings validation

### 📡 WiFi Management
- Network scanning and connection
- Saved network management
- Access Point configuration
- Connection status monitoring

### 🚁 MAVLink Control
- Vehicle status monitoring
- Flight control commands (arm/disarm, mode changes)
- Parameter management with search and validation
- Mission planning and execution
- Real-time telemetry streaming

### 📋 Task Management
- Create custom tasks (mowing, survey, navigation)
- Task execution and monitoring
- Task templates and history
- Progress tracking

### 🛠️ Tools & Utilities
- Debug mode toggle
- Data export capabilities
- System diagnostics
- Performance monitoring

## Installation

### Prerequisites
- Node.js 18+ with ES modules support
- TypeScript 5.0+
- Access to a MAVLinkBridge ESP32 device

### Setup
```bash
cd /Volumes/dev/yardrover-api/console
npm install
```

### Build
```bash
npm run build
```

## Usage

### Development Mode
```bash
npm run dev
# or
npm run console
```

### Production Mode
```bash
npm start
# or
npm run build && node dist/index.js
```

### Global Installation
```bash
npm install -g .
yardrover-console
```

## User Interface

The console uses an intuitive menu-driven interface with:

- **Color-coded output** for better readability
- **Interactive prompts** with validation
- **Progress indicators** for long-running operations
- **Tabular data display** for structured information
- **Keyboard shortcuts** and navigation aids
- **Real-time monitoring** capabilities

## Menu Structure

```
Main Menu
├── 🔌 Device Management
│   ├── Discover Devices
│   ├── Connect to Device
│   ├── Test Connection
│   ├── Device Info
│   └── Disconnect
├── 💚 Health & Monitoring
│   ├── System Status
│   ├── System Metrics
│   ├── Real-time Monitoring
│   └── View Logs
├── ⚙️ Configuration
│   ├── View Configuration
│   ├── Edit Configuration
│   ├── Backup Configuration
│   ├── Restore Configuration
│   └── Reset to Defaults
├── 📡 WiFi Management
│   ├── WiFi Status
│   ├── Scan Networks
│   ├── Connect to Network
│   ├── Disconnect WiFi
│   ├── Saved Networks
│   └── Access Point Mode
├── 🚁 MAVLink Control
│   ├── Vehicle Status
│   ├── Flight Control
│   ├── Parameters
│   ├── Mission Planning
│   └── Telemetry Stream
├── 📋 Task Management
│   ├── List Tasks
│   ├── Create Task
│   ├── Execute Task
│   ├── Task Status
│   ├── Task Templates
│   └── Task History
└── 🛠️ Tools & Utilities
    ├── Debug Mode
    ├── Export Data
    └── Update Firmware
```

## Configuration

The console application uses the client library configuration. Set environment variables or modify the default connection settings:

```typescript
// Default connection settings
const client = createClient(deviceUrl, {
  httpTimeout: 10000,
  maxReconnectAttempts: 3,
  reconnectDelay: 2000,
  autoConnectWebSocket: true
});
```

## Environment Variables

- `DEBUG=true` - Enable debug output and verbose logging
- `NODE_ENV=development` - Enable development mode features

## Device Discovery

The console supports multiple device discovery methods:

1. **Automatic Discovery** - Scans network for MAVLinkBridge devices
2. **Manual Connection** - Connect using IP address or hostname
3. **Common Addresses** - Quick access to typical device addresses:
   - `http://192.168.4.1` (AP mode)
   - `http://192.168.1.100` (Station mode)
   - `http://yardrover.local` (mDNS)

## Task Types

### 🚁 Mowing Tasks
- Define mowing area with center point and dimensions
- Configure line spacing and flight altitude
- Automatic pattern generation

### 📍 Survey Tasks
- Grid pattern surveys
- Perimeter surveys
- Point of interest mapping
- Image overlap configuration

### 🛣️ Waypoint Navigation
- Custom waypoint sequences
- Multiple waypoint actions (hover, photo, land)
- Altitude and action configuration

### 🏠 Return to Home
- Simple RTH command
- Automatic failsafe tasks

### 🔧 Custom Tasks
- User-defined parameters
- Flexible task configuration
- Advanced automation support

## Safety Features

- **Connection validation** before critical operations
- **Confirmation prompts** for dangerous actions
- **Emergency stop** capabilities
- **Real-time monitoring** during task execution
- **Error handling** and recovery procedures

## Troubleshooting

### Connection Issues
1. Check device IP address and network connectivity
2. Verify device is powered on and responding
3. Try different connection methods (AP mode vs Station mode)
4. Check firewall and network settings

### Task Execution Issues
1. Verify MAVLink connection to flight controller
2. Check GPS status and positioning
3. Ensure vehicle is armed and in appropriate mode
4. Monitor system health and battery levels

### Performance Issues
1. Enable debug mode to see detailed logs
2. Check device memory and CPU usage
3. Monitor network latency and stability
4. Verify task parameters are reasonable

## Development

### Project Structure
```
src/
├── core/           # Core application framework
├── commands/       # Command implementations
├── ui/            # User interface components
├── utils/         # Utility functions and helpers
├── types/         # TypeScript type definitions
└── index.ts       # Main entry point
```

### Contributing
1. Follow the existing code structure and patterns
2. Add proper TypeScript types for all functions
3. Include error handling and user feedback
4. Test thoroughly with real devices
5. Update documentation for new features

## License

MIT License - see the project root for details.