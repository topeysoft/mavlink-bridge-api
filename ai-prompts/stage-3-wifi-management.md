# Stage 3: WiFi Management Implementation

## Context

You are implementing the WiFi management system for an ESP32-Mavlink Bridge REST API. This builds upon the core infrastructure (Stages 1-2) and provides complete WiFi connectivity management with auto-reconnection, connection state tracking, and REST API endpoints.

## Prerequisites

- HTTP Server with routing (Stage 1)
- WebSocket Server for events (Stage 1)
- Event Manager operational (Stage 1)
- Configuration system working (Stage 2)

## OpenAPI Specification Reference

Relevant endpoints:

- `POST /api/wifi/connect` - Connect to WiFi network
- `POST /api/wifi/disconnect` - Disconnect from WiFi

## Task Overview

Implement comprehensive WiFi management:

1. WiFi connection manager with state machine
2. REST API endpoints for WiFi control
3. Auto-reconnection with exponential backoff
4. WiFi scan functionality
5. Connection quality monitoring
6. TypeScript client for WiFi operations

## Technical Requirements

- Support both STA (Station) and AP (Access Point) modes
- Store up to 5 WiFi credentials
- Implement WPA2 security
- Connection timeout: 10 seconds
- Auto-reconnect with backoff: 1s, 2s, 4s, 8s, 16s, then 30s intervals
- Signal strength monitoring
- Captive portal support in AP mode

## Implementation Details

### 1. WiFi Manager (`/lib/WiFiManager/`)

Core WiFi management with state machine:

```cpp
class WiFiManager {
public:
    enum State {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,
        AP_MODE,
        ERROR
    };

    struct ConnectionInfo {
        char ssid[33];
        uint8_t bssid[6];
        int8_t rssi;
        uint32_t ip;
        uint32_t gateway;
        uint32_t subnet;
    };

private:
    static WiFiManager* instance;
    State currentState;
    ConnectionInfo connectionInfo;
    TaskHandle_t wifiTask;
    uint8_t reconnectAttempts;
    uint32_t lastReconnectTime;

public:
    static WiFiManager* getInstance();
    void begin();
    bool connect(const char* ssid, const char* password);
    void disconnect();
    State getState() const;
    ConnectionInfo getConnectionInfo() const;
    void startAccessPoint(const char* ssid, const char* password = nullptr);
    std::vector<WiFiNetwork> scan();

private:
    static void wifiTaskFunction(void* parameter);
    void handleStateTransition();
    void attemptReconnection();
    void updateConnectionInfo();
};
```

### 2. WiFi Endpoints (`/lib/WiFiEndpoints/`)

REST API implementation:

```cpp
class WiFiEndpoints {
public:
    static void registerRoutes(HttpServer* server);

private:
    static void handleConnect(HttpRequest& req, HttpResponse& res);
    static void handleDisconnect(HttpRequest& req, HttpResponse& res);
    static void handleStatus(HttpRequest& req, HttpResponse& res);
    static void handleScan(HttpRequest& req, HttpResponse& res);
};
```

Features:

- Connection with timeout handling
- Graceful disconnection
- Current status reporting
- Network scanning with caching

### 3. Connection State Events

Emit events through Event Manager:

```cpp
// Connection state changes
EventManager::publish(EventType::WIFI_CONNECTING, {
    "ssid": "NetworkName"
});

EventManager::publish(EventType::WIFI_CONNECTED, {
    "ssid": "NetworkName",
    "ip": "192.168.1.100",
    "rssi": -45
});

EventManager::publish(EventType::WIFI_DISCONNECTED, {
    "reason": "user_request" | "connection_lost" | "auth_failed"
});

// Signal quality updates (every 30 seconds when connected)
EventManager::publish(EventType::WIFI_SIGNAL_UPDATE, {
    "rssi": -50,
    "quality": 75  // percentage
});
```

### 4. Auto-Reconnection Logic

Implement intelligent reconnection:

- Exponential backoff with jitter
- Remember last successful network
- Try saved networks in order of signal strength
- Fall back to AP mode after exhausting options

### 5. WiFi Configuration Integration

Extend configuration to store WiFi settings:

```cpp
struct SavedNetwork {
    char ssid[33];
    char password[65];
    uint8_t priority;  // 0-255, higher = preferred
};

struct WiFiConfig {
    bool autoConnect;
    bool apModeEnabled;
    char apSSID[33];
    char apPassword[65];
    SavedNetwork networks[5];
    uint8_t networkCount;
};
```

### 6. TypeScript Client Implementation

```typescript
// src/wifi/WiFiClient.ts
export class WiFiClient {
  constructor(
    private httpClient: HttpClient,
    private wsClient: WebSocketClient,
  ) {
    this.setupEventListeners();
  }

  async connect(credentials: WiFiCredentials): Promise<void> {}
  async disconnect(): Promise<void> {}
  async getStatus(): Promise<WiFiStatus> {}
  async scan(): Promise<WiFiNetwork[]> {}

  onStateChange(callback: (state: WiFiState) => void): void {}
  onSignalUpdate(callback: (quality: SignalQuality) => void): void {}

  private setupEventListeners() {
    this.wsClient.on(EventType.WIFI_CONNECTED, (data) => {
      // Handle connection event
    });
  }
}

// src/wifi/WiFiTypes.ts
export interface WiFiCredentials {
  ssid: string;
  password: string;
}

export interface WiFiStatus {
  state: WiFiState;
  connected: boolean;
  ssid?: string;
  ip?: string;
  rssi?: number;
  quality?: number;
}

export enum WiFiState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AP_MODE = 'ap_mode',
  ERROR = 'error',
}
```

## Error Handling

Handle common WiFi errors:

- Wrong password (401)
- Network not found (404)
- Connection timeout (408)
- Already connected (409)
- Hardware error (500)

## Captive Portal (AP Mode)

When in AP mode, implement:

- DNS server redirecting to ESP32
- Simple web page for network selection
- Credential input and validation
- Automatic mode switching after connection

## Unit Tests

Test scenarios:

1. Connection success/failure
2. Auto-reconnection behavior
3. State transitions
4. Multiple network handling
5. AP mode operations
6. Signal monitoring
7. Concurrent operations
8. Memory leaks during reconnection

## Performance Requirements

- Connection time: < 5 seconds (typical)
- Scan time: < 2 seconds
- State update latency: < 100ms
- Memory usage: < 20KB including buffers
- Reconnection detection: < 3 seconds

## Security Considerations

- Never log passwords
- Secure password storage (consider encryption)
- Validate SSID/password lengths
- Prevent injection attacks in AP mode
- Rate limit connection attempts

## Deliverables

1. Complete WiFi management implementation
2. REST API endpoints with error handling
3. TypeScript client with reactive state
4. Captive portal web interface
5. Unit and integration tests
6. Performance benchmarks
7. Usage examples and documentation
