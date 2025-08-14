# ESP32 MAVLinkBridge API Project Structure

## Overview
This document defines the complete project structure for the ESP32 REST API implementation.

## Directory Structure
```
mavlinkbridge-api/
├── src/                              # Main application
│   ├── main.cpp                      # Application entry point
│   └── config.h                      # Build configuration
├── lib/                              # Component libraries
│   ├── HttpServer/                   # Stage 1
│   │   ├── HttpServer.h
│   │   └── HttpServer.cpp
│   ├── WebSocketServer/              # Stage 1
│   │   ├── WebSocketServer.h
│   │   └── WebSocketServer.cpp
│   ├── EventManager/                 # Stage 1
│   │   ├── EventManager.h
│   │   └── EventManager.cpp
│   ├── ConfigManager/                # Stage 1-2
│   │   ├── ConfigManager.h
│   │   └── ConfigManager.cpp
│   ├── ConfigEndpoints/              # Stage 2
│   │   ├── ConfigEndpoints.h
│   │   └── ConfigEndpoints.cpp
│   ├── JsonPatch/                    # Stage 2
│   │   ├── JsonPatch.h
│   │   └── JsonPatch.cpp
│   ├── Storage/                      # Stage 2
│   │   ├── Storage.h
│   │   └── Storage.cpp
│   ├── WiFiManager/                  # Stage 3
│   │   ├── WiFiManager.h
│   │   └── WiFiManager.cpp
│   ├── WiFiEndpoints/                # Stage 3
│   │   ├── WiFiEndpoints.h
│   │   └── WiFiEndpoints.cpp
│   ├── RTCMClient/                   # Stage 4
│   │   ├── RTCMClient.h
│   │   └── RTCMClient.cpp
│   ├── NTRIPClient/                  # Stage 4
│   │   ├── NTRIPClient.h
│   │   └── NTRIPClient.cpp
│   ├── RTCMParser/                   # Stage 4
│   │   ├── RTCMParser.h
│   │   └── RTCMParser.cpp
│   ├── MAVLinkConverter/             # Stage 4
│   │   ├── MAVLinkConverter.h
│   │   └── MAVLinkConverter.cpp
│   ├── RTCMEndpoints/                # Stage 4
│   │   ├── RTCMEndpoints.h
│   │   └── RTCMEndpoints.cpp
│   ├── USBOTGManager/                # Stage 5
│   │   ├── USBOTGManager.h
│   │   └── USBOTGManager.cpp
│   ├── UARTManager/                  # Stage 5
│   │   ├── UARTManager.h
│   │   └── UARTManager.cpp
│   ├── DataRouter/                   # Stage 5
│   │   ├── DataRouter.h
│   │   └── DataRouter.cpp
│   ├── MAVLinkProcessor/             # Stage 5
│   │   ├── MAVLinkProcessor.h
│   │   └── MAVLinkProcessor.cpp
│   ├── HealthMonitor/                # Stage 6
│   │   ├── HealthMonitor.h
│   │   └── HealthMonitor.cpp
│   ├── TaskManager/                  # Stage 6
│   │   ├── TaskManager.h
│   │   └── TaskManager.cpp
│   ├── MemoryManager/                # Stage 6
│   │   ├── MemoryManager.h
│   │   └── MemoryManager.cpp
│   └── ErrorHandler/                 # Stage 6
│       ├── ErrorHandler.h
│       └── ErrorHandler.cpp
├── test/                             # Unit tests
│   ├── test_http_server/
│   ├── test_websocket_server/
│   ├── test_event_manager/
│   ├── test_config_manager/
│   ├── test_json_patch/
│   ├── test_wifi_manager/
│   ├── test_rtcm_client/
│   └── test_integration/
├── client/                           # TypeScript client library
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                  # Main export
│   │   ├── MAVLinkBridgeClient.ts    # Main client class
│   │   ├── core/
│   │   │   ├── HttpClient.ts
│   │   │   ├── WebSocketClient.ts
│   │   │   └── EventTypes.ts
│   │   ├── config/
│   │   │   ├── ConfigClient.ts
│   │   │   └── ConfigTypes.ts
│   │   ├── wifi/
│   │   │   ├── WiFiClient.ts
│   │   │   └── WiFiTypes.ts
│   │   ├── rtcm/
│   │   │   ├── RTCMClient.ts
│   │   │   └── RTCMTypes.ts
│   │   ├── communication/
│   │   │   ├── CommunicationClient.ts
│   │   │   └── CommunicationTypes.ts
│   │   └── health/
│   │       ├── HealthClient.ts
│   │       └── HealthTypes.ts
│   ├── examples/
│   │   ├── basic-usage.ts
│   │   ├── configuration.ts
│   │   ├── wifi-management.ts
│   │   └── rtcm-setup.ts
│   └── test/
│       ├── unit/
│       └── integration/
├── docs/                             # Documentation
│   ├── api-reference.md
│   ├── hardware-setup.md
│   ├── configuration-guide.md
│   ├── troubleshooting.md
│   └── examples/
├── data/                             # Web assets and configs
│   ├── www/                          # Static web files
│   └── config.json                   # Default configuration
├── platformio.ini                    # PlatformIO configuration
├── api-spec.yaml                     # OpenAPI specification
├── implementation-plan.md            # Implementation roadmap
└── README.md                         # Project overview
```

## Configuration Files

### platformio.ini
```ini
[env:esp32s3]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
monitor_speed = 115200
lib_deps = 
    bblanchon/ArduinoJson@^6.21.2
    esphome/AsyncTCP-esphome@^2.0.1
    me-no-dev/ESP Async WebServer@^1.2.3
    mavlink/c_library_v2@^3.0.0
    pstolarz/OneWireNg@^0.12.1

build_flags =
    -DCORE_DEBUG_LEVEL=1
    -DBOARD_HAS_PSRAM
    -DUSB_CDC_ON_BOOT=1
    -DARDUINO_USB_MODE=1
    -DARDUINO_USB_CDC_ON_BOOT=1

[env:esp32s2]
platform = espressif32
board = esp32-s2-saola-1
framework = arduino
monitor_speed = 115200
lib_deps = ${env:esp32s3.lib_deps}
build_flags = ${env:esp32s3.build_flags}
```

### client/package.json
```json
{
  "name": "@mavlinkbridge/api-client",
  "version": "1.0.0",
  "description": "TypeScript client library for MAVLinkBridge ESP32 API",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "docs": "typedoc src"
  },
  "dependencies": {
    "ws": "^8.13.0",
    "fast-json-patch": "^3.1.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0",
    "typedoc": "^0.24.0"
  }
}
```

## Memory Allocation Plan
- **HTTP Server**: 8KB (buffers + state)
- **WebSocket Server**: 6KB (3 connections × 2KB)
- **Event Manager**: 2KB (event queue)
- **Configuration**: 4KB (storage + runtime)
- **WiFi Manager**: 4KB (scan results + state)
- **RTCM Client**: 12KB (buffers + processing)
- **USB/UART**: 16KB (RX/TX buffers)
- **Data Router**: 8KB (routing buffers)
- **Health Monitor**: 3KB (metrics + logs)
- **Task Stacks**: 40KB (estimated total)
- **System Reserve**: 17KB
- **Total**: ~120KB of 320KB available

## Build Targets
- **Development**: Full debugging, serial output
- **Production**: Optimized, minimal logging
- **Testing**: Unit test framework enabled