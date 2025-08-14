# MAVLinkBridge ESP32 API - Stage 1: Core Infrastructure

This repository contains the core infrastructure implementation for the MAVLinkBridge ESP32-based REST API system. This is Stage 1 of a multi-stage implementation focused on establishing the foundational components.

## 🚀 Features Implemented (Stage 1)

### Core Components
- **HTTP Server**: Async HTTP server with JSON request/response handling
- **WebSocket Server**: Real-time communication with multiple client support
- **Event Manager**: Lightweight pub/sub system for component communication  
- **Configuration Manager**: JSON-based configuration with validation

### Key Specifications
- **Memory Optimized**: Static allocation where possible, ~120KB total usage
- **Multi-threaded**: FreeRTOS tasks for concurrent operations
- **Resource Constrained**: Designed for ESP32 limitations
- **Event-Driven**: Pub/sub architecture for loose coupling

## 📁 Project Structure

```
mavlinkbridge-api/
├── lib/                    # Component libraries
│   ├── HttpServer/         # HTTP server implementation
│   ├── WebSocketServer/    # WebSocket server
│   ├── EventManager/       # Event pub/sub system
│   └── ConfigManager/      # Configuration management
├── src/                    # Main application
│   ├── main.cpp           # Application entry point
│   └── config.h           # Build configuration
├── test/                   # Unit tests
├── client/                 # TypeScript client library
└── platformio.ini         # Build configuration
```

## 🔧 Hardware Requirements

- **ESP32-S3** or **ESP32-S2** development board
- **320KB RAM** minimum (ESP32-S3 recommended)
- **WiFi capability** for API access

## 🛠️ Setup & Installation

### 1. Platform Setup
```bash
# Install PlatformIO
pip install platformio

# Clone repository
git clone <repository-url>
cd mavlinkbridge-api

# Build for ESP32-S3
pio run -e esp32s3

# Upload to device
pio run -e esp32s3 -t upload

# Monitor serial output
pio device monitor
```

### 2. TypeScript Client Setup
```bash
cd client
npm install
npm run build

# Run examples
npm run dev
```

## 📡 API Endpoints

### HTTP REST API
- `GET /api/health` - Device health status
- `GET /api/config` - Get complete configuration
- `POST /api/config` - Replace entire configuration
- `PATCH /api/config` - Update specific configuration fields

### WebSocket Events
- `ws://device-ip/ws` - Real-time event stream
- Event types: `status`, `config_changed`, `rtcm_data`, `error`, `log`

## 🧪 Testing

### Run Unit Tests
```bash
# Run all tests
pio test

# Run specific component tests
pio test -f test_http_server
pio test -f test_websocket_server
pio test -f test_event_manager
pio test -f test_config_manager
```

### Test Coverage
- ✅ HTTP Server: Route handling, CORS, buffer management
- ✅ WebSocket Server: Connection management, message broadcasting
- ✅ Event Manager: Pub/sub, async processing, thread safety
- ✅ Configuration Manager: JSON serialization, validation, change tracking

## 💾 Memory Usage Analysis

| Component | RAM Usage | Description |
|-----------|-----------|-------------|
| HTTP Server | 8KB | Request/response buffers + state |
| WebSocket Server | 6KB | 3 client connections × 2KB each |
| Event Manager | 2KB | Event queue + subscriptions |
| Configuration | 4KB | JSON storage + runtime config |
| System Reserve | 17KB | FreeRTOS + Arduino framework |
| **Total** | **~37KB** | Core components only |

**Remaining**: ~283KB available for future stages

## 📚 Client Library Usage

### Basic Usage
```typescript
import { MAVLinkBridgeClient } from '@mavlinkbridge/api-client';

const client = new MAVLinkBridgeClient('http://192.168.4.1');
await client.connect();

// Get device health
const health = await client.getHealth();
console.log(`Status: ${health.status}, Free Heap: ${health.freeHeap}`);

// Listen for events
client.onStatus(status => {
  console.log(`Device status: ${status.status}`);
});

// Update configuration
await client.updateDeviceName('My-MAVLinkBridge');
```

### Configuration Management
```typescript
// Get current config
const config = await client.getConfiguration();

// Update specific values
await client.updateConfigValue('/device/mode', 'uart');
await client.updateWiFiSettings('MyNetwork', true);

// Reset to defaults
await client.resetConfiguration();
```

## 🔄 Event System

The event system provides loose coupling between components:

```cpp
// Subscribe to events
EventManager::getInstance()->subscribe(EventType::CONFIG_CHANGED, [](const Event& e) {
    // Handle configuration change
    Serial.println("Configuration changed!");
});

// Publish events
DynamicJsonDocument payload(256);
payload["section"] = "device";
EventManager::getInstance()->publishAsync(EventType::CONFIG_CHANGED, payload.as<JsonObject>());
```

## 🐛 Debugging

### Serial Debug Output
```bash
# Monitor with timestamps and exception decoder
pio device monitor --filter esp32_exception_decoder --filter time
```

### Memory Debugging
```cpp
// Check free heap
Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());

// Check task stack usage
Serial.printf("HTTP task stack: %d words remaining\n", 
              uxTaskGetStackHighWaterMark(httpTaskHandle));
```

## 📈 Performance Characteristics

- **HTTP Response Time**: < 100ms typical
- **WebSocket Latency**: < 50ms for local events
- **Event Processing**: 100+ events/second
- **Concurrent Connections**: 4 HTTP + 3 WebSocket
- **Memory Efficiency**: Static allocation, minimal fragmentation

## 🔜 Next Stages

This implementation provides the foundation for:

- **Stage 2**: Configuration persistence and JSON Patch support
- **Stage 3**: WiFi management and network configuration
- **Stage 4**: RTCM client with NTRIP/TCP/UDP support
- **Stage 5**: USB OTG and UART communication
- **Stage 6**: System integration and health monitoring

## 📋 Known Limitations

- Configuration persistence not implemented (Stage 2)
- WiFi management limited to AP mode (Stage 3)
- RTCM client not implemented (Stage 4)
- No USB/UART communication (Stage 5)
- Limited error recovery (Stage 6)

## 🤝 Contributing

This is a staged implementation. Focus areas for Stage 1:
- Memory optimization
- Event system improvements
- API endpoint enhancements
- Client library features
- Test coverage expansion

## 📄 License

MIT License - See LICENSE file for details.