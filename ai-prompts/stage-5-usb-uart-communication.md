# Stage 5: USB OTG & UART Communication Implementation

## Context
You are implementing the communication layer between the ESP32 and flight controllers. This system supports USB OTG as the primary interface with automatic fallback to UART. The implementation must handle MAVLink protocol communication, support high data rates, and provide seamless switching between interfaces.

## Prerequisites
- Core infrastructure complete (Stages 1-4)
- Understanding of MAVLink protocol
- ESP32-S2/S3 USB OTG capabilities
- UART communication basics

## Task Overview
Implement dual communication system:
1. USB OTG CDC (Communications Device Class) driver
2. UART communication with auto-baudrate
3. MAVLink message routing
4. Automatic interface detection and switching
5. Bidirectional data flow management

## Technical Requirements
- USB OTG: CDC ACM device class
- UART: 57600, 115200, 230400, 460800, 921600 baud
- MAVLink 1.0 and 2.0 support
- Maximum throughput: 1 Mbps
- Switching time between interfaces: < 1 second
- Buffer sizes: 4KB for each interface

## Implementation Details

### 1. USB OTG Manager (`/lib/USBOTGManager/`)
USB CDC implementation for ESP32-S2/S3:
```cpp
class USBOTGManager {
public:
    enum State {
        NOT_INITIALIZED,
        INITIALIZED,
        CONNECTED,
        SUSPENDED,
        ERROR
    };
    
    struct Statistics {
        uint32_t bytesReceived;
        uint32_t bytesSent;
        uint32_t packetsReceived;
        uint32_t packetsSent;
        float dataRate;
    };
    
private:
    static USBOTGManager* instance;
    State currentState;
    Statistics stats;
    uint8_t rxBuffer[4096];
    uint8_t txBuffer[4096];
    TaskHandle_t usbTask;
    SemaphoreHandle_t txMutex;
    
public:
    static USBOTGManager* getInstance();
    bool begin();
    void end();
    State getState() const;
    
    // Data transfer
    size_t write(const uint8_t* data, size_t length);
    size_t read(uint8_t* buffer, size_t length);
    size_t available();
    
    // Callbacks
    void onConnect(std::function<void()> callback);
    void onDisconnect(std::function<void()> callback);
    void onData(std::function<void(uint8_t*, size_t)> callback);
    
private:
    static void usbTaskFunction(void* parameter);
    void handleUSBEvents();
    
    // TinyUSB callbacks
    static void cdcRxCallback(uint8_t* buffer, uint32_t length);
    static void cdcTxCompleteCallback();
    static void deviceMountCallback();
    static void deviceUnmountCallback();
};
```

Features:
- TinyUSB library integration
- Zero-copy data transfer where possible
- Flow control support
- USB suspend/resume handling
- Descriptor configuration for flight controller compatibility

### 2. UART Manager (`/lib/UARTManager/`)
High-performance UART with auto-baudrate:
```cpp
class UARTManager {
public:
    enum BaudRate {
        BAUD_57600 = 57600,
        BAUD_115200 = 115200,
        BAUD_230400 = 230400,
        BAUD_460800 = 460800,
        BAUD_921600 = 921600
    };
    
    struct Config {
        uint8_t rxPin;
        uint8_t txPin;
        BaudRate baudRate;
        bool autoBaud;
        bool flowControl;
        uint8_t rtsPin;
        uint8_t ctsPin;
    };
    
private:
    static UARTManager* instance;
    Config config;
    uint8_t rxBuffer[4096];
    uint8_t txBuffer[4096];
    TaskHandle_t uartTask;
    bool connected;
    
public:
    static UARTManager* getInstance();
    bool begin(const Config& cfg);
    void end();
    
    // Auto-baudrate detection
    BaudRate detectBaudRate();
    bool setBaudRate(BaudRate baud);
    
    // Data transfer
    size_t write(const uint8_t* data, size_t length);
    size_t read(uint8_t* buffer, size_t length);
    size_t available();
    
    // MAVLink heartbeat detection
    bool detectMAVLink();
    
private:
    static void uartTaskFunction(void* parameter);
    void processIncomingData();
};
```

Features:
- Hardware flow control support
- DMA transfers for efficiency
- Automatic MAVLink detection
- Baudrate negotiation
- Break detection for bootloader mode

### 3. Data Router (`/lib/DataRouter/`)
Intelligent routing between interfaces:
```cpp
class DataRouter {
public:
    enum Interface {
        NONE,
        USB_OTG,
        UART
    };
    
    enum RoutingMode {
        AUTO,           // Automatic selection
        USB_PRIORITY,   // Prefer USB, fallback to UART
        UART_ONLY,      // Force UART
        USB_ONLY        // Force USB
    };
    
private:
    static DataRouter* instance;
    Interface activeInterface;
    RoutingMode mode;
    MAVLinkProcessor* mavlinkProcessor;
    
    // Circular buffers for each direction
    CircularBuffer<uint8_t, 8192> upstreamBuffer;   // FC -> Network
    CircularBuffer<uint8_t, 8192> downstreamBuffer; // Network -> FC
    
public:
    static DataRouter* getInstance();
    void begin(RoutingMode mode = AUTO);
    
    // Interface management
    void setRoutingMode(RoutingMode mode);
    Interface getActiveInterface() const;
    bool switchInterface(Interface iface);
    
    // Data routing
    void routeUpstream(const uint8_t* data, size_t length);
    void routeDownstream(const uint8_t* data, size_t length);
    
    // MAVLink processing
    void enableMAVLinkProcessing(bool enable);
    void setMAVLinkFilter(const MAVLinkFilter& filter);
    
private:
    void detectActiveInterface();
    void handleInterfaceSwitch();
    bool validateMAVLinkStream(const uint8_t* data, size_t length);
};
```

### 4. MAVLink Processor (`/lib/MAVLinkProcessor/`)
MAVLink message handling:
```cpp
class MAVLinkProcessor {
public:
    struct MessageStats {
        uint32_t totalMessages;
        uint32_t crcErrors;
        std::map<uint32_t, uint32_t> messageTypes;  // msgId -> count
    };
    
private:
    mavlink_message_t rxMessage;
    mavlink_status_t rxStatus;
    MessageStats stats;
    
public:
    // Process incoming data stream
    std::vector<mavlink_message_t> processData(const uint8_t* data, size_t length);
    
    // Message filtering
    void setMessageFilter(const std::vector<uint32_t>& allowedMessageIds);
    
    // Statistics
    MessageStats getStatistics() const;
    
    // Utility functions
    static bool isMAVLinkData(const uint8_t* data, size_t length);
    static void injectMessage(mavlink_message_t& message, uint8_t* buffer, size_t& length);
};
```

### 5. Connection Events
Emit events for interface changes:
```cpp
EventManager::publish(EventType::USB_CONNECTED, {
    "interface": "usb_otg",
    "speed": "full_speed"  // or "high_speed"
});

EventManager::publish(EventType::UART_CONNECTED, {
    "interface": "uart",
    "baudrate": 921600,
    "mavlink_detected": true
});

EventManager::publish(EventType::INTERFACE_SWITCHED, {
    "from": "uart",
    "to": "usb_otg",
    "reason": "usb_detected"
});
```

### 6. TypeScript Client
```typescript
// src/communication/CommunicationClient.ts
export class CommunicationClient {
    constructor(private wsClient: WebSocketClient) {
        this.setupEventListeners();
    }
    
    onInterfaceChange(callback: (event: InterfaceChangeEvent) => void): void {}
    onDataFlow(callback: (stats: DataFlowStats) => void): void {}
    
    getActiveInterface(): Interface {}
    getStatistics(): CommunicationStats {}
}

// src/communication/CommunicationTypes.ts
export enum Interface {
    NONE = 'none',
    USB_OTG = 'usb_otg',
    UART = 'uart'
}

export interface InterfaceChangeEvent {
    from: Interface;
    to: Interface;
    reason: string;
    timestamp: number;
}

export interface DataFlowStats {
    interface: Interface;
    upstreamRate: number;  // bytes/sec
    downstreamRate: number;
    packetsReceived: number;
    packetsSent: number;
}
```

## Performance Optimization
1. Use DMA for UART transfers
2. Zero-copy buffers where possible
3. Interrupt-driven I/O
4. Separate tasks for RX/TX
5. Priority-based task scheduling

## Testing Requirements
1. USB enumeration and communication
2. UART at all supported baudrates
3. Automatic baudrate detection
4. Interface switching scenarios
5. MAVLink message integrity
6. Throughput benchmarks
7. Latency measurements
8. Error recovery testing

## Error Handling
- USB disconnect/reconnect
- UART framing errors
- Buffer overflows
- Invalid MAVLink messages
- Interface initialization failures

## Deliverables
1. Complete USB OTG implementation
2. UART manager with auto-baudrate
3. Data router with intelligent switching
4. MAVLink processor
5. TypeScript client for monitoring
6. Unit and integration tests
7. Performance benchmarks
8. Hardware setup documentation