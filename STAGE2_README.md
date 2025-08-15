# ESP32 MAVLinkBridge - Stage 2: Configuration Management

This document describes the Stage 2 implementation of the ESP32 MAVLinkBridge API, focusing on comprehensive configuration management with persistent storage, versioning, and JSON Patch support.

## 🚀 Features

- **RESTful Configuration API** - Full CRUD operations via HTTP endpoints
- **JSON Patch Support** - RFC 6902 compliant patch operations (add, remove, replace)
- **Persistent Storage** - LittleFS-based storage with automatic backup/restore
- **Configuration Versioning** - Optimistic locking to prevent conflicts
- **Real-time Events** - WebSocket notifications for configuration changes
- **Comprehensive Validation** - Schema validation with detailed error reporting
- **TypeScript Client** - Full-featured client library with type safety
- **Automatic Backups** - Multiple backup versions with corruption recovery
- **Memory Efficient** - Designed for ESP32 resource constraints (4KB config limit)

## 📁 Project Structure

```
mavlinkbridge-api/
├── lib/                          # C++ Libraries
│   ├── ConfigManager/            # Enhanced configuration management
│   ├── ConfigEndpoints/          # REST API endpoints
│   ├── JsonPatch/                # JSON Patch implementation
│   ├── Storage/                  # LittleFS storage abstraction
│   ├── HttpServer/               # HTTP server (Stage 1)
│   ├── WebSocketServer/          # WebSocket server (Stage 1)
│   └── EventManager/             # Event system (Stage 1)
├── client/                       # TypeScript Client Library
│   ├── src/
│   │   ├── config/
│   │   │   ├── ConfigClient.ts   # Enhanced configuration client
│   │   │   └── ConfigTypes.ts    # Type definitions with versioning
│   │   └── ...
│   ├── examples/                 # Usage examples
│   └── test/                     # Comprehensive tests
├── test/                         # C++ Unit Tests
│   ├── test_storage/             # Storage layer tests
│   ├── test_json_patch/          # JSON Patch tests
│   └── test_config_manager_enhanced/  # Enhanced ConfigManager tests
└── examples/                     # Implementation examples
```

## 🛠️ Core Components

### 1. Storage Layer (`lib/Storage/`)

LittleFS-based persistent storage with advanced features:

- **Atomic Operations** - All writes are atomic with rollback support
- **Automatic Backups** - Up to 3 backup versions maintained automatically
- **Corruption Recovery** - Checksums and integrity validation
- **Wear Leveling** - LittleFS handles wear leveling automatically
- **Size Limits** - 4KB configuration limit for ESP32 efficiency

```cpp
Storage* storage = Storage::getInstance();
storage->begin();

// Write configuration with version
storage->writeConfig(data, size, version);

// Read with validation
uint32_t version;
size_t dataSize;
storage->readConfig(buffer, dataSize, version);

// Backup operations
storage->backupConfig();
storage->restoreFromBackup(0);
```

### 2. JSON Patch Implementation (`lib/JsonPatch/`)

RFC 6902 compliant JSON Patch processor:

- **Supported Operations** - add, remove, replace
- **Path Resolution** - Nested path support (`/device/name`, `/rtcm/source/host`)
- **Validation** - Pre-flight validation of all operations
- **Rollback Support** - Automatic rollback on operation failure
- **Memory Efficient** - Designed for ESP32 constraints

```cpp
// Create patch operations
PatchOperation patches[] = {
    JsonPatch::createReplaceOperation("/device/name", "NewName"),
    JsonPatch::createReplaceOperation("/rtcm/enabled", true)
};

// Apply patches with rollback
JsonPatchResult result = JsonPatch::apply(document, patches, 2);
```

### 3. Enhanced Configuration Manager (`lib/ConfigManager/`)

Extended with versioning and persistence:

- **Version Management** - Automatic version incrementing
- **Optimistic Locking** - Prevent concurrent modification conflicts
- **Auto-Save** - Automatic persistence on configuration changes
- **Change Events** - Real-time notifications via EventManager
- **Validation** - Comprehensive schema validation

```cpp
ConfigManager* manager = ConfigManager::getInstance();
manager->begin();

// Set with version check
manager->setConfiguration(config, expectedVersion);

// Backup and restore
manager->backupConfiguration();
manager->restoreConfiguration(0);
```

### 4. REST API Endpoints (`lib/ConfigEndpoints/`)

Complete RESTful API with advanced features:

```http
GET /api/config
- Returns current configuration with version headers
- Supports ETag headers for caching

POST /api/config
- Replace entire configuration
- Supports If-Match header for optimistic locking
- Returns 409 on version conflicts

PATCH /api/config
- Apply JSON Patch operations (RFC 6902)
- Maximum 10 operations per request
- Atomic operation with rollback on failure
```

Error Responses:
- `400` - Invalid configuration or patch operations
- `409` - Version conflict (optimistic locking)
- `507` - Insufficient storage space
- `500` - Internal storage error

## 💻 TypeScript Client Library

Enhanced client with full Stage 2 feature support:

### Installation

```bash
cd client
npm install
```

### Basic Usage

```typescript
import { MAVLinkBridgeClient } from './src/MAVLinkBridgeClient';

const client = new MAVLinkBridgeClient({
  baseUrl: 'http://192.168.1.100',
  timeout: 5000
});

// Get configuration with version
const { config, version } = await client.config.getConfigurationWithVersion();

// Update with optimistic locking
await client.config.setConfiguration(updatedConfig, { expectedVersion: version });

// Apply JSON patches
await client.config.patchConfiguration([
  { op: 'replace', path: '/device/name', value: 'NewName' },
  { op: 'replace', path: '/rtcm/enabled', value: true }
]);
```

### Advanced Features

```typescript
// Automatic retry on version conflicts
await client.config.updateConfigurationWithRetry((config) => ({
  ...config,
  device: { ...config.device, name: 'RetryExample' }
}), 3);

// Batch operations (automatically chunked)
await client.config.batchUpdate(manyOperations);

// Create patches from configuration differences
const patches = client.config.createConfigurationPatch(oldConfig, newConfig);
```

### Error Handling

```typescript
try {
  await client.config.setConfiguration(config);
} catch (error) {
  if (error instanceof VersionConflictError) {
    // Handle version conflict
  } else if (error instanceof ConfigValidationError) {
    // Handle validation errors
    console.log(error.errors);
  } else if (error instanceof StorageError) {
    // Handle storage issues
  }
}
```

## 🧪 Testing

### C++ Unit Tests

Run comprehensive C++ tests:

```bash
pio test -e native
```

Test Coverage:
- **Storage Layer** - Atomic operations, backup/restore, corruption handling
- **JSON Patch** - All operations, edge cases, rollback scenarios
- **Configuration Manager** - Versioning, persistence, validation
- **Memory Usage** - Ensure efficient memory usage under load

### TypeScript Tests

Run TypeScript client tests:

```bash
cd client
npm test
```

Test Coverage:
- **API Integration** - All endpoint interactions
- **Error Handling** - Version conflicts, validation errors
- **Retry Logic** - Automatic retry mechanisms
- **Batch Operations** - Large operation handling

## 📊 Performance Metrics

Performance targets for ESP32-S3:

| Operation | Target Time | Memory Usage |
|-----------|-------------|--------------|
| Configuration Read | < 50ms | < 2KB |
| Configuration Write | < 200ms | < 2KB |
| JSON Patch Apply | < 100ms | < 2KB |
| Storage Backup | < 500ms | < 1KB |

## 🔧 Configuration Schema

Complete configuration structure with versioning:

```json
{
  "version": 1,
  "device": {
    "name": "ESP32-MAVLinkBridge",
    "mode": "usb_otg"
  },
  "connection": {
    "type": "wifi",
    "wifi": {
      "ssid": "NetworkName",
      "autoConnect": true
    }
  },
  "rtcm": {
    "enabled": false,
    "source": {
      "type": "ntrip",
      "host": "rtcm.example.com",
      "port": 2101,
      "mountpoint": "MOUNT01",
      "username": "user",
      "password": "pass"
    }
  }
}
```

## 🔍 Monitoring and Debugging

### System Status Endpoint

```http
GET /api/status
```

Returns comprehensive system information:

```json
{
  "status": "running",
  "stage": "Stage 2: Configuration Management",
  "uptime": 3600,
  "freeHeap": 145280,
  "configVersion": 5,
  "storage": {
    "total": 1048576,
    "used": 4096,
    "free": 1044480,
    "backups": 2
  },
  "wifi": {
    "connected": true,
    "ip": "192.168.1.100",
    "rssi": -45
  }
}
```

### Health Check Endpoint

```http
GET /api/health
```

Returns health status with detailed metrics for monitoring systems.

### Real-time Events

WebSocket events for real-time monitoring:

```javascript
const ws = new WebSocket('ws://192.168.1.100/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'CONFIG_CHANGED') {
    console.log('Configuration changed:', data.payload);
  }
};
```

## 🚀 Getting Started

### 1. Flash the ESP32

```bash
pio run --target upload --environment esp32s3
```

### 2. Monitor Serial Output

```bash
pio device monitor
```

### 3. Connect to WiFi AP

- SSID: `MAVLinkBridge-Setup`
- Password: `mavlinkbridge123`
- IP: `192.168.4.1`

### 4. Test the API

```bash
# Get current configuration
curl http://192.168.4.1/api/config

# Update device name
curl -X PATCH http://192.168.4.1/api/config \
  -H "Content-Type: application/json" \
  -d '[{"op": "replace", "path": "/device/name", "value": "MyMAVLinkBridge"}]'
```

### 5. Use TypeScript Client

```bash
cd client
npm install
npm run build
node examples/config-management-example.js
```

## 🔄 Migration from Stage 1

Stage 2 is fully backward compatible with Stage 1. The enhanced ConfigManager will automatically:

1. Load existing configurations from memory
2. Migrate to versioned format (version 1)
3. Save to persistent storage
4. Create initial backup

## 🛡️ Security Considerations

- **Input Validation** - All configuration inputs are validated
- **Size Limits** - Configuration limited to 4KB to prevent DoS
- **Operation Limits** - Maximum 10 patch operations per request
- **Error Information** - Detailed errors only in development mode

## 🔮 Next Steps (Stage 3)

Stage 3 will build upon Stage 2 to add:

- **WiFi Management** - Advanced WiFi configuration and connection handling
- **Network Discovery** - mDNS and network service discovery
- **Connection Profiles** - Multiple WiFi network profiles
- **Captive Portal** - Web-based configuration interface

## 📚 References

- [RFC 6902 - JSON Patch](https://tools.ietf.org/html/rfc6902)
- [LittleFS Documentation](https://github.com/littlefs-project/littlefs)
- [ESP32-S3 Technical Reference](https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf)

---

**Stage 2 Implementation Complete** ✅

The ESP32 MAVLinkBridge now features a production-ready configuration management system with persistent storage, versioning, JSON Patch support, and comprehensive validation. The system is designed for reliability, performance, and ease of use while maintaining efficient resource usage on the ESP32 platform.