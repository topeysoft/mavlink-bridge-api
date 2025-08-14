# Stage 4: RTCM Client Implementation

## Context

You are implementing the RTCM (Radio Technical Commission for Maritime Services) client for an ESP32-MAVlink Bridge system. This enables the ESP32 to receive RTK correction data from various sources (NTRIP, TCP, UDP) and forward it to connected flight controllers either as raw RTCM or converted to MAVLink messages.

## Prerequisites

- Core infrastructure operational (Stage 1)
- Configuration system working (Stage 2)
- Network connectivity via WiFi (Stage 3)
- Understanding of RTCM3 message format
- Basic MAVLink protocol knowledge

## OpenAPI Specification Reference

Relevant endpoints:

- `POST /api/rtcm/start` - Start RTCM client
- `POST /api/rtcm/stop` - Stop RTCM client

## Task Overview

Implement complete RTCM correction system:

1. NTRIP client with authentication
2. TCP/UDP RTCM receivers
3. RTCM message parser and validator
4. MAVLink message converter
5. REST API endpoints
6. TypeScript client library

## Technical Requirements

- Support RTCM 3.x messages (focus on GPS/GLONASS/Galileo)
- Handle messages: 1005, 1006 (base position), 1074-1127 (MSM)
- Buffer size: 2KB for RTCM data
- Maximum data rate: 10KB/s
- Reconnection with exponential backoff
- Message integrity checking (CRC24)

## Implementation Details

### 1. RTCM Client Base (`/lib/RTCMClient/`)

Abstract base for all RTCM sources:

```cpp
class RTCMClient {
public:
    enum State {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,
        ERROR
    };

    struct Statistics {
        uint32_t messagesReceived;
        uint32_t bytesReceived;
        uint32_t crcErrors;
        uint32_t lastMessageTime;
        float dataRate;  // KB/s
    };

protected:
    State currentState;
    Statistics stats;
    uint8_t buffer[2048];
    size_t bufferPos;
    TaskHandle_t receiveTask;

public:
    virtual ~RTCMClient() = default;
    virtual bool connect() = 0;
    virtual void disconnect() = 0;
    State getState() const { return currentState; }
    Statistics getStatistics() const { return stats; }

protected:
    void processRTCMData(const uint8_t* data, size_t length);
    bool validateRTCMMessage(const uint8_t* message, size_t length);
    uint32_t calculateCRC24(const uint8_t* data, size_t length);
};
```

### 2. NTRIP Client (`/lib/NTRIPClient/`)

NTRIP protocol implementation:

```cpp
class NTRIPClient : public RTCMClient {
private:
    struct Config {
        char host[64];
        uint16_t port;
        char mountpoint[32];
        char username[32];
        char password[32];
        float latitude;   // For VRS
        float longitude;  // For VRS
    };

    Config config;
    WiFiClient tcpClient;

public:
    NTRIPClient(const Config& cfg);
    bool connect() override;
    void disconnect() override;

private:
    void sendNMEAPosition();  // GGA sentence for VRS
    static void ntripTaskFunction(void* parameter);
    bool authenticateHTTP();
    void parseSourceTable(const char* data);
};
```

Features:

- HTTP authentication (Basic)
- NMEA GGA position sending for VRS
- Source table parsing
- Automatic reconnection
- Header parsing for ICY/HTTP responses

### 3. TCP/UDP Receivers (`/lib/RTCMReceivers/`)

Simple TCP and UDP implementations:

```cpp
class TCPRTCMClient : public RTCMClient {
private:
    char host[64];
    uint16_t port;
    WiFiClient tcpClient;

public:
    TCPRTCMClient(const char* host, uint16_t port);
    bool connect() override;
    void disconnect() override;
};

class UDPRTCMClient : public RTCMClient {
private:
    uint16_t port;
    WiFiUDP udp;

public:
    UDPRTCMClient(uint16_t port);
    bool connect() override;
    void disconnect() override;
};
```

### 4. RTCM Parser (`/lib/RTCMParser/`)

Parse and validate RTCM messages:

```cpp
class RTCMParser {
public:
    struct RTCMMessage {
        uint16_t messageType;
        uint16_t stationId;
        uint32_t timestamp;
        uint8_t* payload;
        size_t payloadLength;
    };

    static bool parseMessage(const uint8_t* data, size_t length, RTCMMessage& message);
    static bool isCompleteMessage(const uint8_t* buffer, size_t length);
    static size_t findMessageStart(const uint8_t* buffer, size_t length);

    // Message type helpers
    static bool isPositionMessage(uint16_t messageType);
    static bool isMSMMessage(uint16_t messageType);
    static const char* getMessageTypeName(uint16_t messageType);
};
```

### 5. MAVLink Converter (`/lib/MAVLinkConverter/`)

Convert RTCM to MAVLink GPS_RTCM_DATA messages:

```cpp
class MAVLinkConverter {
private:
    uint8_t systemId;
    uint8_t componentId;
    uint8_t sequenceNumber;

public:
    MAVLinkConverter(uint8_t sysId = 1, uint8_t compId = 1);

    // Fragment RTCM data into MAVLink messages (max 180 bytes/message)
    std::vector<mavlink_message_t> convertRTCMToMAVLink(
        const uint8_t* rtcmData,
        size_t length
    );

    // Inject data to flight controller
    bool injectToFC(const mavlink_message_t& message);
};
```

### 6. RTCM Endpoints (`/lib/RTCMEndpoints/`)

REST API implementation:

```cpp
class RTCMEndpoints {
public:
    static void registerRoutes(HttpServer* server);

private:
    static void handleStart(HttpRequest& req, HttpResponse& res);
    static void handleStop(HttpRequest& req, HttpResponse& res);
    static void handleStatus(HttpRequest& req, HttpResponse& res);

    static std::unique_ptr<RTCMClient> createClient(const RTCMConfig& config);
};
```

### 7. TypeScript Client

```typescript
// src/rtcm/RTCMClient.ts
export class RTCMClient {
  constructor(
    private httpClient: HttpClient,
    private wsClient: WebSocketClient,
  ) {
    this.setupEventListeners();
  }

  async start(config: RTCMConfig): Promise<void> {}
  async stop(): Promise<void> {}
  async getStatus(): Promise<RTCMStatus> {}

  onDataReceived(callback: (data: RTCMData) => void): void {}
  onStateChange(callback: (state: RTCMState) => void): void {}

  private setupEventListeners() {
    this.wsClient.on(EventType.RTCM_DATA_RECEIVED, (data) => {
      // Handle RTCM data event
    });
  }
}

// src/rtcm/RTCMTypes.ts
export interface RTCMConfig {
  enabled: boolean;
  source: NTRIPSource | TCPSource | UDPSource;
  outputFormat: 'raw' | 'mavlink';
}

export interface NTRIPSource {
  type: 'ntrip';
  host: string;
  port: number;
  mountpoint: string;
  username?: string;
  password?: string;
  sendPosition?: boolean;
  position?: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
}

export interface RTCMStatus {
  state: RTCMState;
  connected: boolean;
  statistics: {
    messagesReceived: number;
    bytesReceived: number;
    dataRate: number;
    lastMessageTime: number;
    messageTypes: { [key: number]: number };
  };
}
```

## Data Flow

1. RTCM data received from source (NTRIP/TCP/UDP)
2. Data validated and parsed
3. Events emitted for monitoring
4. Data converted to MAVLink if configured
5. Data forwarded to flight controller via USB/UART

## Error Handling

- Connection failures with detailed reasons
- Authentication failures (401)
- Invalid mountpoint (404)
- Data corruption detection
- Buffer overflow protection
- Rate limiting

## Performance Requirements

- Message processing latency: < 10ms
- Maximum throughput: 10KB/s
- Memory usage: < 15KB including buffers
- CPU usage: < 20% at maximum data rate

## Testing Requirements

1. NTRIP authentication and connection
2. Message parsing for all supported types
3. CRC validation
4. MAVLink conversion accuracy
5. Reconnection behavior
6. Data rate limiting
7. Memory leak testing
8. Concurrent source handling

## Deliverables

1. Complete RTCM client implementation
2. Support for NTRIP, TCP, and UDP sources
3. RTCM to MAVLink converter
4. REST API endpoints
5. TypeScript client with real-time updates
6. Unit and integration tests
7. Performance benchmarks
8. RTCM message documentation
