# YardRover API

ESP32-based MAVLink bridge with comprehensive API for drone communication and control.

## Features

- **MAVLink Processing**: Real-time MAVLink message parsing and filtering
- **Multiple Interfaces**: USB OTG and UART communication support
- **Command System**: Send MAVLink commands to flight controllers
- **WebSocket API**: Real-time bidirectional communication
- **RESTful API**: Comprehensive HTTP endpoints for configuration and control
- **Client Library**: TypeScript/JavaScript client with full type safety
- **Health Monitoring**: System health, memory usage, and error tracking
- **WiFi Management**: Connect to networks, manage credentials
- **RTCM Support**: NTRIP/TCP/UDP RTCM data routing
- **Configuration Management**: Persistent settings with backup/restore

## Quick Start

### Hardware Setup

1. Flash the ESP32 with the YardRover firmware
2. Connect flight controller via USB or UART
3. Connect to the ESP32's WiFi network or configure it to join your network

### Using the Client Library

```bash
npm install @mavlinkbridge/api-client
```

```typescript
import { MAVLinkBridgeClient, ArduPilotMode } from '@mavlinkbridge/api-client';

const client = new MAVLinkBridgeClient('http://192.168.4.1');
await client.connect();

// Send MAVLink commands to flight controller
await client.mavlink.arm();
await client.mavlink.setMode(ArduPilotMode.GUIDED);
await client.mavlink.setPositionTarget({
  x: 10,    // 10m north
  y: 5,     // 5m east 
  z: -20,   // 20m up
  yaw: 0    // face north
});
await client.mavlink.land();
```

## MAVLink Commands

The system supports comprehensive MAVLink command functionality:

### Basic Commands
- `arm()` / `disarm()` - Arm/disarm the vehicle
- `setMode(mode)` - Change flight mode
- `returnToLaunch()` - RTL command
- `land()` - Land the vehicle
- `setHomeHere()` - Set home position to current location

### Advanced Commands
- `sendCommandLong(options)` - Send generic COMMAND_LONG messages
- `sendCommandInt(options)` - Send COMMAND_INT with position data
- `setPositionTarget(options)` - Set position/velocity targets
- `takeoff(altitude)` - Takeoff to specified altitude
- `requestCapabilities()` - Request autopilot capabilities

### Example Commands

```typescript
// ARM the vehicle
await client.mavlink.arm();

// Set to Guided mode
await client.mavlink.setMode(ArduPilotMode.GUIDED);

// Navigate to position
await client.mavlink.setPositionTarget({
  x: 10.0,   // 10 meters north
  y: 5.0,    // 5 meters east
  z: -20.0,  // 20 meters up (negative in NED)
  yaw: 1.57  // 90 degrees
});

// Send custom command
await client.mavlink.sendCommandLong({
  command: 400, // MAV_CMD_COMPONENT_ARM_DISARM
  param1: 1,    // Arm
  param2: 0
});

// Return to launch
await client.mavlink.returnToLaunch();
```

## API Endpoints

### Core Endpoints
- `GET /api/health` - System health and status
- `GET /api/config` - Get device configuration  
- `POST /api/config` - Update configuration
- `POST /api/wifi/connect` - Connect to WiFi network

### MAVLink Endpoints
- `POST /api/mavlink/command` - Send MAVLink commands
- `GET /api/communication/status` - Communication interface status
- `GET /api/communication/statistics` - Data flow statistics
- `POST /api/communication/mavlink/filter` - Configure message filtering

### Command API

Send MAVLink commands via HTTP POST to `/api/mavlink/command`:

```json
{
  "commandType": "arm",
  "targetSystem": 1,
  "targetComponent": 1
}
```

Supported command types:
- `arm` / `disarm` - Vehicle arming
- `setMode` - Flight mode changes
- `commandLong` - Generic COMMAND_LONG
- `commandInt` - COMMAND_INT with coordinates
- `setPositionTarget` - Position/velocity targets

## Examples

See the `client/examples/` directory for complete examples:

- **Node.js Example**: `mavlink-commands-example.ts` - Complete command testing
- **Browser Example**: `mavlink-browser-example.html` - Interactive web interface
- **Basic Usage**: `basic-usage.ts` - Simple client setup
- **Health Monitoring**: `health-monitoring-example.ts` - System monitoring

## Development

### Building

```bash
# ESP32 firmware
pio run

# Client library
cd client
npm install
npm run build
```

### Testing

```bash
# Run client tests
cd client
npm test

# Test examples
npm run example:commands
```

## Configuration

Default configuration supports common flight controller setups:

```json
{
  "device": {
    "name": "YardRover Bridge",
    "mode": "usb_otg"
  },
  "communication": {
    "interface": "auto",
    "baudRate": 115200,
    "mavlinkProcessing": true
  }
}
```

## Architecture

- **ESP32 Core**: FreeRTOS-based firmware with ArduinoCore
- **Communication**: USB OTG and UART with automatic detection
- **MAVLink**: Official MAVLink library with custom extensions
- **Networking**: AsyncWebServer with WebSocket support
- **Storage**: SPIFFS-based configuration persistence
- **Client**: TypeScript library with full type safety

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: See `docs/` directory for detailed guides
- Examples: Check `client/examples/` for usage patterns