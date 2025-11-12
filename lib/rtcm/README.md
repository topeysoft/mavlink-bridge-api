# RTCM Data Transmission Protocol System

## Overview

Flexible RTCM data routing system with configurable protocol formatters and transport layers. Allows receiving RTCM data from various sources (NTRIP, TCP, UDP) and sending it to multiple destinations simultaneously with different protocols and transports.

## Architecture

```
┌──────────────┐
│ RTCM Source  │  (NTRIP/TCP/UDP)
│   Receivers  │
└──────┬───────┘
       │ Raw RTCM Data
       ▼
┌──────────────────┐
│ Output Router    │
└──────┬───────────┘
       │
       ├──────────────────────┬────────────────────┬───────────────────┐
       ▼                      ▼                    ▼                   ▼
  ┌─────────┐           ┌─────────┐         ┌─────────┐        ┌─────────┐
  │Formatter│           │Formatter│         │Formatter│        │Formatter│
  │  (Raw)  │           │(MAVLink)│         │  (Raw)  │        │(MAVLink)│
  └────┬────┘           └────┬────┘         └────┬────┘        └────┬────┘
       ▼                     ▼                    ▼                  ▼
  ┌─────────┐           ┌─────────┐         ┌─────────┐        ┌─────────┐
  │Transport│           │Transport│         │Transport│        │Transport│
  │  (UDP)  │           │ (Serial)│         │ (TCP)   │        │(ESP-NOW)│
  └────┬────┘           └────┬────┘         └────┬────┘        └────┬────┘
       │                     │                    │                  │
       ▼                     ▼                    ▼                  ▼
   Network             Flight Controller     TCP Clients        ESP32 Peers
```

## Components

### 1. Formatters (Protocol Layer)

Transform raw RTCM data into different protocols.

#### RawRTCMFormatter
- **Type**: `raw`
- **Description**: Pass-through formatter, sends RTCM data unchanged
- **Use Case**: Direct RTCM streaming to compatible receivers

#### MAVLinkRTCMFormatter
- **Type**: `mavlink`
- **Description**: Wraps RTCM in MAVLink `GPS_RTCM_DATA` messages
- **Fragmentation**: Automatically fragments large RTCM messages (>180 bytes)
- **Use Case**: Sending RTCM to ArduPilot/PX4 flight controllers
- **Configuration**:
  ```json
  {
    "protocol": "mavlink",
    "params": {
      "systemId": 1,
      "componentId": 1
    }
  }
  ```

### 2. Transports (Delivery Layer)

Handle actual data transmission.

#### SerialRTCMTransport
- **Type**: `serial`
- **Description**: Sends data via USB/UART through DataRouter
- **Use Case**: Flight controller communication
- **Configuration**:
  ```json
  {
    "transport": "serial",
    "params": {
      "interface": "usb"  // "usb", "uart", or "auto"
    }
  }
  ```

#### UDPRTCMTransport
- **Type**: `udp`
- **Description**: Sends data via UDP (broadcast or unicast)
- **Use Case**: Network-based RTCM distribution
- **Configuration**:
  ```json
  {
    "transport": "udp",
    "params": {
      "port": 14550,
      "broadcast": true,
      "targets": ["192.168.1.100:14550", "192.168.1.101:14550"]
    }
  }
  ```

#### TCPRTCMTransport
- **Type**: `tcp`
- **Description**: TCP server accepting multiple client connections
- **Use Case**: RTCM server for multiple TCP clients
- **Configuration**:
  ```json
  {
    "transport": "tcp",
    "params": {
      "port": 5015
    }
  }
  ```

#### ESPNowRTCMTransport
- **Type**: `espnow`
- **Description**: Peer-to-peer ESP-NOW communication
- **Use Case**: Direct ESP32-to-ESP32 RTCM distribution
- **Max Payload**: 250 bytes per packet
- **Configuration**:
  ```json
  {
    "transport": "espnow",
    "params": {
      "channel": 1,
      "broadcast": false,
      "peers": ["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"]
    }
  }
  ```

### 3. Output Router

Manages multiple output targets and routes RTCM data.

**Features**:
- Multiple simultaneous outputs
- Per-target enable/disable
- Statistics tracking
- Thread-safe operation

## Configuration

### Complete Example

```json
{
  "rtcm": {
    "enabled": true,
    "source": {
      "type": "ntrip",
      "host": "rtk2go.com",
      "port": 2101,
      "mountpoint": "MyMount",
      "username": "user",
      "password": "pass"
    },
    "outputs": [
      {
        "name": "Flight Controller",
        "protocol": "mavlink",
        "transport": "serial",
        "enabled": true,
        "params": {
          "interface": "usb",
          "systemId": 1,
          "componentId": 1
        }
      },
      {
        "name": "UDP Broadcast",
        "protocol": "raw",
        "transport": "udp",
        "enabled": true,
        "params": {
          "port": 14550,
          "broadcast": true
        }
      },
      {
        "name": "ESP-NOW Peer",
        "protocol": "raw",
        "transport": "espnow",
        "enabled": true,
        "params": {
          "channel": 1,
          "peers": ["AA:BB:CC:DD:EE:FF"]
        }
      },
      {
        "name": "TCP Server",
        "protocol": "raw",
        "transport": "tcp",
        "enabled": false,
        "params": {
          "port": 5015
        }
      }
    ]
  }
}
```

## Usage Example

### Initialization

```cpp
#include <RTCMOutputRouter/RTCMOutputRouter.h>

// Create router
RTCMOutputRouter router;

// Load configuration
DynamicJsonDocument config(4096);
// ... load config from file or API ...

// Initialize with output targets
JsonArray outputs = config["rtcm"]["outputs"];
router.begin(outputs);
```

### Routing Data

```cpp
// When RTCM data is received
void onRTCMData(const uint8_t* data, size_t length) {
    // Route to all configured outputs
    router.route(data, length);
}
```

### Runtime Control

```cpp
// Disable specific output
router.setTargetEnabled(0, false);

// Get statistics
auto stats = router.getStatistics();
Serial.printf("Routed %d messages to %d targets\n",
              stats.messagesRouted, stats.activeTargets);

// Get target details
JsonDocument targetInfo = router.getTargetInfo();
serializeJsonPretty(targetInfo, Serial);
```

## Common Use Cases

### 1. Flight Controller Only
```json
{
  "outputs": [{
    "name": "ArduPilot",
    "protocol": "mavlink",
    "transport": "serial",
    "params": { "interface": "usb" }
  }]
}
```

### 2. Network Broadcasting
```json
{
  "outputs": [{
    "name": "UDP Broadcast",
    "protocol": "raw",
    "transport": "udp",
    "params": {
      "port": 14550,
      "broadcast": true
    }
  }]
}
```

### 3. Multi-Target Setup
```json
{
  "outputs": [
    {
      "name": "Flight Controller",
      "protocol": "mavlink",
      "transport": "serial",
      "params": { "interface": "usb" }
    },
    {
      "name": "Ground Station",
      "protocol": "raw",
      "transport": "udp",
      "params": {
        "port": 14550,
        "targets": ["192.168.1.100:14550"]
      }
    },
    {
      "name": "Backup ESP32",
      "protocol": "raw",
      "transport": "espnow",
      "params": {
        "peers": ["AA:BB:CC:DD:EE:FF"]
      }
    }
  ]
}
```

## API Endpoints

### Get Output Configuration
```
GET /api/rtcm/outputs
```

### Update Output Configuration
```
POST /api/rtcm/outputs
Content-Type: application/json

{
  "outputs": [ ... ]
}
```

### Enable/Disable Output
```
POST /api/rtcm/outputs/{index}/enable
Content-Type: application/json

{
  "enabled": true
}
```

### Get Output Statistics
```
GET /api/rtcm/outputs/stats
```

## Performance Considerations

1. **Fragmentation**: MAVLink formatter fragments large RTCM messages (>180 bytes)
2. **ESP-NOW Limit**: Maximum 250 bytes per packet
3. **TCP Clients**: Maximum 5 concurrent clients by default
4. **Thread Safety**: All operations are mutex-protected
5. **Memory**: Each output target ~500 bytes + buffer overhead

## Troubleshooting

### No Data Sent to Serial
- Check DataRouter is initialized
- Verify interface selection (usb/uart)
- Ensure flight controller is connected

### UDP Broadcast Not Working
- Verify WiFi is connected
- Check firewall settings
- Confirm broadcast is enabled on network

### ESP-NOW Send Failures
- Verify MAC addresses are correct
- Check WiFi channel matches
- Ensure ESP-NOW is initialized

### TCP Clients Disconnecting
- Check network stability
- Verify client implementation
- Monitor server logs for errors

## Future Enhancements

- [ ] WebSocket transport
- [ ] MQTT transport
- [ ] Data compression
- [ ] Rate limiting per transport
- [ ] Custom protocol formatters
- [ ] Output priority/fallback
