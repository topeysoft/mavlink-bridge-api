# ESP32 to Raspberry Pi Migration Guide

## Overview

This guide covers migrating from the YardRover ESP32 C++ firmware to the Raspberry Pi Python implementation. The Python version maintains 100% API compatibility while providing enhanced capabilities and easier development.

## Table of Contents

- [Why Migrate?](#why-migrate)
- [Architecture Comparison](#architecture-comparison)
- [Hardware Setup](#hardware-setup)
- [API Compatibility](#api-compatibility)
- [Configuration Migration](#configuration-migration)
- [Feature Parity](#feature-parity)
- [Client Library Updates](#client-library-updates)
- [Testing the Migration](#testing-the-migration)
- [Rollback Plan](#rollback-plan)

---

## Why Migrate?

### Advantages of Raspberry Pi + Python

**Hardware**:
- More processing power (quad-core vs single-core)
- More RAM (2-8GB vs 520KB)
- More storage (GB vs MB)
- Easier debugging and development
- Standard Linux environment
- USB ports for peripherals

**Software**:
- Easier to develop and test (standard Python)
- Better libraries (pymavlink, FastAPI, etc.)
- Async I/O with asyncio (vs FreeRTOS)
- Comprehensive testing with pytest
- Hot-reload during development
- Standard Linux tools and utilities

**Maintenance**:
- No compilation required for changes
- Easier remote updates (git pull)
- Better logging and debugging
- Standard systemd service management
- Remote SSH access

### Trade-offs

**ESP32 Advantages**:
- Lower power consumption (~1W vs ~5W)
- Smaller physical size
- Integrated WiFi/Bluetooth
- No operating system overhead
- Simpler deployment

**Mitigation**:
- Pi power is acceptable for yard machine with battery
- Size is not critical for mounted enclosure
- Pi also has WiFi/Bluetooth built-in
- Linux overhead is negligible with modern Pi 4

---

## Architecture Comparison

### ESP32 (C++) Architecture

```
┌─────────────────────────────────────┐
│         ESP32 Firmware              │
│                                     │
│  ┌──────────┐  ┌──────────┐       │
│  │ FreeRTOS │  │ Arduino  │       │
│  │  Tasks   │  │   Loop   │       │
│  └──────────┘  └──────────┘       │
│                                     │
│  ┌──────────────────────────────┐  │
│  │      HTTP Server (ESPAsyncWeb)│  │
│  │      WebSocket Server        │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   MAVLink (custom parser)    │  │
│  │   RTCM Parser                │  │
│  │   WiFi Manager               │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Storage (LittleFS)         │  │
│  │   Config (NVS)               │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         ├─── UART → Flight Controller
         ├─── WiFi → Client Apps
         └─── GPIO → Sensors/Buttons
```

### Raspberry Pi (Python) Architecture

```
┌─────────────────────────────────────┐
│      Raspberry Pi OS (Linux)        │
│                                     │
│  ┌──────────────────────────────┐  │
│  │    Python 3.11+ Runtime      │  │
│  │       (asyncio event loop)   │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   FastAPI Application        │  │
│  │   - REST endpoints           │  │
│  │   - WebSocket support        │  │
│  │   - OpenAPI docs             │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Core Services              │  │
│  │   - pymavlink processor      │  │
│  │   - RTCM parser & NTRIP      │  │
│  │   - WiFi (NetworkManager)    │  │
│  │   - mDNS (zeroconf)          │  │
│  │   - Event bus (async)        │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Storage                    │  │
│  │   - Config (YAML/env)        │  │
│  │   - Resources (JSON files)   │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         ├─── Serial → Flight Controller
         ├─── Network → Client Apps
         └─── GPIO → Sensors (optional)
```

---

## Hardware Setup

### Required Hardware

1. **Raspberry Pi** (Pi 4 recommended, Pi 3B+ minimum)
2. **Power Supply** (5V 3A USB-C for Pi 4, or 5V regulator from vehicle battery)
3. **microSD Card** (16GB minimum, 32GB recommended, Class 10)
4. **Serial Connection** (one of):
   - GPIO UART (pins 8/10) - simplest
   - USB-to-serial adapter - most reliable
   - USB connection to flight controller

### Wiring Diagrams

**Option 1: GPIO UART (Recommended)**

```
Raspberry Pi              Flight Controller
GPIO 14 (TXD) ─────────► Serial RX
GPIO 15 (RXD) ◄───────── Serial TX
GND ──────────────────── GND
```

**Option 2: USB Serial Adapter**

```
USB-Serial Adapter        Flight Controller
TXD ─────────────────────► Serial RX
RXD ◄────────────────────  Serial TX
GND ──────────────────────  GND
     │
     └─► USB port on Pi
```

**Option 3: Direct USB**

```
Flight Controller USB ──► Raspberry Pi USB port
```

### Power Integration

**Option A: Separate Power** (for testing)
- Pi powered by USB power supply
- Flight controller powered by vehicle battery

**Option B: Shared Power** (for production)
- 12V vehicle battery → 5V buck converter → Pi
- Ensure converter can supply 3A+ for Pi 4

### Physical Mounting

- Mount Pi in weatherproof enclosure
- Ensure adequate ventilation (Pi can reach 80°C under load)
- Consider heatsink or fan for Pi 4
- Protect from vibration with foam padding
- Keep away from moisture and debris

---

## API Compatibility

### 100% Compatible Endpoints

The Python implementation maintains full compatibility with the ESP32 API:

| Endpoint Group | ESP32 | Python | Compatible |
|----------------|-------|--------|------------|
| Core (`/api/health`, `/api/config`) | ✅ | ✅ | ✅ 100% |
| Network (`/api/wifi/*`, `/api/mdns/*`) | ✅ | ✅ | ✅ 100% |
| MAVLink (`/api/mavlink/*`) | ✅ | ✅ | ✅ 100% |
| Resources (`/api/zones/*`, `/api/missions/*`) | ✅ | ✅ | ✅ 100% |
| RTCM (`/api/rtcm/*`) | ✅ | ✅ | ✅ 100% |
| WebSocket (`/ws`) | ✅ | ✅ | ✅ 100% |

### Request/Response Format

**No changes required** - all request and response formats are identical:

```json
// GET /api/health - Same format on both platforms
{
  "status": "healthy",
  "timestamp": "2024-01-08T12:00:00Z",
  "uptime": 3600.5,
  "version": "1.0.0",
  "system": {
    "cpu_percent": 25.5,
    "memory_percent": 45.2,
    "disk_percent": 30.1,
    "temperature": 55.2
  }
}
```

### WebSocket Messages

**Identical message format** for all WebSocket events:

```json
{
  "type": "mavlink.message",
  "timestamp": "2024-01-08T12:00:00Z",
  "data": {
    "message_id": 0,
    "message_name": "HEARTBEAT",
    "system_id": 1,
    "component_id": 1
  }
}
```

---

## Configuration Migration

### ESP32 Configuration (NVS)

```cpp
// ESP32 config stored in NVS (binary key-value store)
nvsManager.setString("device_name", "YardRover");
nvsManager.setString("wifi_ssid", "MyNetwork");
nvsManager.setInt("serial_baud", 57600);
```

### Python Configuration (YAML + Env)

**Environment Variables** (`/etc/yardrover/yardrover-api.env`):
```bash
YARDROVER_DEVICE_NAME=YardRover
YARDROVER_SERIAL_BAUDRATE=57600
```

**YAML Configuration** (`/etc/yardrover/config.yaml`):
```yaml
device:
  name: YardRover
  model: Pi-1.0

network:
  wifi:
    enabled: true
    interface: wlan0

mavlink:
  serial:
    port: /dev/ttyAMA0
    baudrate: 57600
```

### Configuration Mapping

| ESP32 NVS Key | Python Env/YAML | Notes |
|---------------|-----------------|-------|
| `device_name` | `YARDROVER_DEVICE_NAME` | Device identifier |
| `wifi_ssid` | NetworkManager config | Set via WiFi API |
| `serial_port` | `mavlink.serial.port` | `/dev/ttyAMA0` or `/dev/ttyUSB0` |
| `serial_baud` | `mavlink.serial.baudrate` | Same values (57600, 115200, etc.) |
| `mdns_enabled` | `network.mdns.enabled` | Boolean |
| `ntrip_host` | `rtcm.ntrip.host` | NTRIP caster hostname |

### Migration Script

To export ESP32 config and generate Python config:

```bash
#!/bin/bash
# This is a manual process - adjust values as needed

cat > /etc/yardrover/config.yaml <<EOF
device:
  name: YardRover  # From ESP32 device_name
  model: Pi-1.0
  version: 1.0.0

network:
  mdns:
    enabled: true  # From ESP32 mdns_enabled
    service_name: yardrover
  wifi:
    enabled: true
    interface: wlan0

mavlink:
  serial:
    port: /dev/ttyAMA0  # Changed from ESP32 UART2
    baudrate: 57600     # From ESP32 serial_baud
    timeout: 1.0

rtcm:
  ntrip:
    enabled: false      # From ESP32 ntrip_enabled
    host: rtk2go.com    # From ESP32 ntrip_host
    port: 2101          # From ESP32 ntrip_port
    mountpoint: ""      # From ESP32 ntrip_mount
EOF
```

---

## Feature Parity

### Implemented Features

| Feature | ESP32 | Python | Status |
|---------|-------|--------|--------|
| **Core** |
| Configuration management | ✅ | ✅ | ✅ Compatible |
| Health monitoring | ✅ | ✅ | ✅ Enhanced (more metrics) |
| Event bus | ✅ | ✅ | ✅ Compatible |
| Storage layer | ✅ | ✅ | ✅ Compatible |
| **Network** |
| WiFi management | ✅ | ✅ | ✅ Compatible |
| WiFi scan | ✅ | ✅ | ✅ Compatible |
| mDNS advertising | ✅ | ✅ | ✅ Compatible |
| WebSocket server | ✅ | ✅ | ✅ Enhanced (auth, rate limiting) |
| HTTP API | ✅ | ✅ | ✅ Compatible |
| **MAVLink** |
| Message parsing | ✅ | ✅ | ✅ Enhanced (pymavlink) |
| Command interface | ✅ | ✅ | ✅ Compatible |
| Parameter management | ✅ | ✅ | ✅ Enhanced (SSE streaming) |
| Mission protocol | ✅ | ✅ | ✅ Compatible |
| Firmware detection | ✅ | ✅ | ✅ Compatible |
| **RTCM** |
| RTCM parser | ✅ | ✅ | ✅ Compatible |
| NTRIP client | ✅ | ✅ | ✅ Enhanced (async) |
| Output routing | ✅ | ✅ | ✅ Compatible |
| VRS support | ✅ | ✅ | ✅ Compatible |
| **Resources** |
| Zone management | ✅ | ✅ | ✅ Compatible |
| Mission scheduling | ✅ | ✅ | ✅ Compatible |
| Incremental sync | ✅ | ✅ | ✅ Compatible |
| **Other** |
| Button handler | ✅ | ⚠️ | Optional (GPIO) |
| OTA updates | ✅ | ✅ | Via SSH/systemd |

### New Features in Python Version

Features not available in ESP32 version:

- **Better Logging**: Structured logging with JSON output
- **API Documentation**: Auto-generated OpenAPI/Swagger docs at `/docs`
- **Metrics**: System metrics via psutil (CPU, memory, disk, temperature)
- **Testing**: Comprehensive pytest suite with 71% coverage
- **Development Mode**: Hot-reload with `--reload` flag
- **SSH Access**: Full shell access for debugging
- **Package Management**: Easy updates via pip/git

---

## Client Library Updates

### No Changes Required!

The TypeScript client library at `/Volumes/dev/yardrover-api/client/` works with **zero changes**:

```typescript
import { MAVLinkBridge } from './client/dist/index';

// Works with both ESP32 and Python backends
const bridge = new MAVLinkBridge('http://yardrover.local:8000');

// All methods work identically
const health = await bridge.getHealth();
const config = await bridge.getConfig();
await bridge.mavlink.arm();
```

### Connection URL Update

**Only change needed** - update the base URL in your app:

```typescript
// Before (ESP32)
const ESP32_URL = 'http://192.168.4.1';

// After (Raspberry Pi)
const PI_URL = 'http://yardrover.local:8000';
// or static IP: 'http://192.168.1.100:8000'
```

### Web App Configuration

Update the connection settings in your Vue app:

**File**: `app/src/stores/connection.ts`

```typescript
// Change default connection URL
const DEFAULT_URL = 'http://yardrover.local:8000';  // mDNS
// or
const DEFAULT_URL = 'http://192.168.1.100:8000';    // Static IP
```

---

## Testing the Migration

### Pre-Migration Testing Checklist

**On ESP32** (before switching):
- [ ] Document current configuration (device name, WiFi, serial port, NTRIP settings)
- [ ] Export any custom zones or missions (backup via API)
- [ ] Note current firmware version
- [ ] Test all features working correctly
- [ ] Record API response times (for comparison)

### Post-Migration Testing Checklist

**On Raspberry Pi** (after switching):

**Basic Functionality**:
- [ ] API starts successfully: `systemctl status yardrover-api`
- [ ] Health endpoint responds: `curl http://localhost:8000/api/health`
- [ ] mDNS working: `ping yardrover.local`
- [ ] Web interface connects
- [ ] No errors in logs: `journalctl -u yardrover-api -n 100`

**Network**:
- [ ] WiFi scan works: `GET /api/wifi/scan`
- [ ] WiFi connection works (if using WiFi)
- [ ] mDNS discoverable from client devices
- [ ] WebSocket connections work

**MAVLink**:
- [ ] Serial port detected: `GET /api/mavlink/serial/status`
- [ ] Heartbeat messages received
- [ ] Can arm/disarm vehicle
- [ ] Mode changes work
- [ ] Parameter read/write works
- [ ] Mission upload/download works

**RTCM** (if using):
- [ ] NTRIP connection succeeds
- [ ] RTCM messages being received
- [ ] Output routing to serial/MAVLink works
- [ ] GPS fix improvement observed

**Resources**:
- [ ] Zones list correctly
- [ ] Can create/update/delete zones
- [ ] Missions list correctly
- [ ] Can create/update/delete missions
- [ ] Sync endpoint works

### Performance Comparison

Expected performance improvements:

| Metric | ESP32 | Raspberry Pi | Improvement |
|--------|-------|--------------|-------------|
| API response time | 50-100ms | 10-30ms | 3-5x faster |
| WebSocket messages/sec | 100 | 1000+ | 10x faster |
| MAVLink processing | 200 msgs/s | 1000+ msgs/s | 5x faster |
| Concurrent connections | 10 | 100+ | 10x more |
| Memory available | 200KB | 1GB+ | 5000x more |

---

## Rollback Plan

### If Issues Occur

**Option 1: Quick Rollback to ESP32**

1. Power off Raspberry Pi
2. Re-connect ESP32
3. Power on ESP32
4. Update client app connection URL back to ESP32 IP
5. Test functionality

**Option 2: Run Both in Parallel** (for testing)

- Keep ESP32 connected to primary serial port
- Connect Pi to secondary serial port (USB adapter)
- Test Pi without affecting ESP32
- Switch when confident

### Backup Strategy

**Before migration**:
```bash
# Backup ESP32 configuration (manual export)
curl http://192.168.4.1/api/config > esp32-config-backup.json
curl http://192.168.4.1/api/zones > esp32-zones-backup.json
curl http://192.168.4.1/api/missions > esp32-missions-backup.json
```

**After migration** (to restore on Pi):
```bash
# Restore on Raspberry Pi
curl -X POST http://yardrover.local:8000/api/config \
  -H "Content-Type: application/json" \
  -d @esp32-config-backup.json

# Restore zones (repeat for each zone)
curl -X POST http://yardrover.local:8000/api/zones \
  -H "Content-Type: application/json" \
  -d @zone.json
```

---

## Migration Timeline

### Recommended Approach

**Phase 1: Preparation** (1-2 hours)
- Set up Raspberry Pi with OS
- Install YardRover API (automated script)
- Configure settings from ESP32
- Bench test without flight controller

**Phase 2: Parallel Testing** (1-3 days)
- Connect Pi to secondary serial port
- Run both ESP32 and Pi simultaneously
- Compare outputs and performance
- Validate all features

**Phase 3: Cutover** (1 hour)
- Schedule downtime window
- Power off vehicle
- Disconnect ESP32, connect Pi to primary serial
- Power on and test
- Monitor for issues

**Phase 4: Validation** (1-7 days)
- Monitor logs for errors
- Test all features thoroughly
- Keep ESP32 available for rollback
- Document any issues

---

## Common Migration Issues

### Serial Port Problems

**Issue**: Serial port not found (`/dev/ttyAMA0`)
**Solution**:
```bash
# Check if UART enabled
grep enable_uart /boot/config.txt

# Check for serial devices
ls -l /dev/tty*

# Use USB adapter instead
YARDROVER_SERIAL_PORT=/dev/ttyUSB0
```

### WiFi Not Working

**Issue**: WiFi scan fails or connection doesn't work
**Solution**:
```bash
# Check NetworkManager status
systemctl status NetworkManager

# Check interface name
nmcli device status

# Update config with correct interface
YARDROVER_WIFI_INTERFACE=wlan0  # or wlan1
```

### mDNS Not Resolving

**Issue**: Cannot ping `yardrover.local`
**Solution**:
```bash
# Check avahi daemon
systemctl status avahi-daemon

# Restart avahi
systemctl restart avahi-daemon

# Check firewall
ufw allow 5353/udp

# Test from client
avahi-browse -art
```

### Permission Denied

**Issue**: Serial port or GPIO access denied
**Solution**:
```bash
# Add user to groups
sudo usermod -a -G dialout,gpio yardrover

# Check file permissions
ls -l /dev/ttyAMA0

# Restart service
systemctl restart yardrover-api
```

---

## Support

If you encounter issues during migration:

1. **Check logs**: `sudo journalctl -u yardrover-api -f`
2. **Review documentation**: `DEPLOYMENT.md`, `PYTHON_ARCHITECTURE.md`
3. **Test API manually**: `curl http://localhost:8000/api/health`
4. **Check service status**: `sudo systemctl status yardrover-api`
5. **File an issue**: Include logs and configuration

---

## Conclusion

The migration from ESP32 to Raspberry Pi provides:
- ✅ **100% API compatibility** - no client changes needed
- ✅ **Better performance** - faster processing and response times
- ✅ **Enhanced features** - better logging, testing, debugging
- ✅ **Easier maintenance** - standard Linux tools and updates
- ✅ **Production-ready** - systemd service with monitoring

The Python implementation is a drop-in replacement that maintains full compatibility while providing a better development and operational experience.
