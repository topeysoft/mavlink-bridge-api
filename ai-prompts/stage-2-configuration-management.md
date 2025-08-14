# Stage 2: Configuration Management Implementation

## Context
You are implementing the configuration management system for an ESP32-based REST API. This builds upon the core infrastructure from Stage 1 (HTTP Server, WebSocket Server, Event Manager, and base Configuration Manager). The ESP32 has limited resources, so efficient storage and memory usage are critical.

## Prerequisites
- Stage 1 components are implemented and tested
- HTTP Server is functional with routing
- Event Manager is operational
- Base Configuration Manager structure exists

## OpenAPI Specification Reference
Relevant endpoints from the API spec:
- `GET /api/config` - Get complete configuration
- `POST /api/config` - Replace entire configuration
- `PATCH /api/config` - Update specific fields using JSON Patch

## Task Overview
Implement a complete configuration management system with:
1. REST API endpoints for configuration CRUD
2. JSON Patch support for granular updates
3. Persistent storage using SPIFFS/LittleFS
4. Configuration validation and schema enforcement
5. TypeScript client library for configuration management

## Technical Requirements
- Use SPIFFS or LittleFS for persistent storage (prefer LittleFS)
- Implement RFC 6902 JSON Patch subset (add, remove, replace operations)
- Configuration file size limit: 4KB
- Support atomic configuration updates
- Implement configuration versioning
- Maximum patch operations per request: 10

## Implementation Details

### 1. Configuration Endpoints (`/lib/ConfigEndpoints/`)
Implement REST endpoints that:
- Handle GET/POST/PATCH operations
- Validate incoming configuration against schema
- Emit configuration change events
- Support configuration export/import
- Implement optimistic locking with version numbers

Example implementation:
```cpp
class ConfigEndpoints {
public:
    static void registerRoutes(HttpServer* server);
    
private:
    static void handleGetConfig(HttpRequest& req, HttpResponse& res);
    static void handlePostConfig(HttpRequest& req, HttpResponse& res);
    static void handlePatchConfig(HttpRequest& req, HttpResponse& res);
    static bool validateConfiguration(const JsonDocument& doc);
};
```

### 2. JSON Patch Implementation (`/lib/JsonPatch/`)
Create a lightweight JSON Patch processor that:
- Supports "add", "remove", "replace" operations
- Validates patch operations before applying
- Provides rollback on failure
- Uses minimal memory during patching
- Handles nested path resolution (e.g., "/device/name")

Example usage:
```cpp
JsonDocument config;
JsonArray patches;
// patches = [{"op": "replace", "path": "/device/name", "value": "NewName"}]

JsonPatch::apply(config, patches);
```

### 3. Storage Abstraction (`/lib/Storage/`)
Implement file system abstraction that:
- Provides async read/write operations
- Implements wear leveling strategy
- Handles file corruption gracefully
- Supports configuration backups
- Implements size-efficient JSON serialization

Features:
- Auto-backup before write
- Checksum validation
- Compression support (optional)
- Maximum 3 backup versions

### 4. Configuration Schema & Validation
Define configuration schema based on OpenAPI spec:
```cpp
struct DeviceConfig {
    char name[33];  // Max 32 chars + null
    enum Mode { USB_OTG, UART } mode;
};

struct WiFiConfig {
    char ssid[33];
    bool autoConnect;
};

struct Configuration {
    uint32_t version;
    DeviceConfig device;
    ConnectionConfig connection;
    RTCMConfig rtcm;
    
    bool validate() const;
    size_t serialize(char* buffer, size_t bufferSize) const;
    bool deserialize(const char* buffer, size_t length);
};
```

### 5. TypeScript Client Implementation
Extend the client library with configuration management:
```typescript
// src/config/ConfigClient.ts
export class ConfigClient {
    constructor(private httpClient: HttpClient) {}
    
    async getConfig(): Promise<Configuration> {}
    async setConfig(config: Configuration): Promise<void> {}
    async patchConfig(patches: JsonPatch[]): Promise<void> {}
    
    // Helper methods
    validateConfig(config: Partial<Configuration>): ValidationResult {}
    createPatch(oldConfig: Configuration, newConfig: Configuration): JsonPatch[] {}
}

// src/config/ConfigTypes.ts
export interface Configuration {
    version: number;
    device: DeviceConfig;
    connection: ConnectionConfig;
    rtcm: RTCMConfig;
}

export interface JsonPatch {
    op: 'add' | 'remove' | 'replace';
    path: string;
    value?: any;
}
```

## Unit Tests Requirements
Create comprehensive tests for:
1. Configuration validation (valid/invalid configs)
2. JSON Patch operations (all operations, edge cases)
3. Storage reliability (corruption handling, backup/restore)
4. Concurrent access (multiple readers/writers)
5. Memory usage under load
6. TypeScript client functionality

## Integration Examples
Provide examples showing:
```cpp
// C++ Usage
auto config = ConfigManager::getInstance()->getConfig();
config.device.name = "MyESP32";
ConfigManager::getInstance()->saveConfig(config);

// TypeScript Usage
const client = new ConfigClient(httpClient);
const config = await client.getConfig();
await client.patchConfig([
    { op: 'replace', path: '/device/name', value: 'MyESP32' }
]);
```

## Error Handling
Implement proper error codes:
- 400: Invalid configuration or patch
- 409: Version conflict (optimistic locking)
- 507: Storage full
- 500: Storage error

## Performance Requirements
- Configuration read: < 50ms
- Configuration write: < 200ms
- Patch application: < 100ms
- Storage usage: < 10% of SPIFFS/LittleFS

## Deliverables
1. Complete implementation of all configuration components
2. Unit tests with > 90% coverage
3. TypeScript client with full type safety
4. Configuration migration utilities
5. Performance benchmarks
6. Usage documentation with examples