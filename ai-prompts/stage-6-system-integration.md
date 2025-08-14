# Stage 6: System Integration & Optimization

## Context

You are completing the final integration stage of the ESP32 MAVLink Bridge REST API system. All individual components have been implemented in previous stages. This stage focuses on system-wide integration, health monitoring, memory optimization, and creating a comprehensive TypeScript client library.

## Prerequisites

- All previous stages (1-5) implemented and tested
- Individual components working in isolation
- Basic TypeScript client structure exists

## Task Overview

Complete system integration with:

1. System health monitoring and reporting
2. FreeRTOS task management wrapper
3. Memory optimization and monitoring
4. Complete TypeScript client library
5. System-wide error handling
6. Integration testing framework

## Technical Requirements

- Total RAM usage: < 120KB (leaving headroom)
- Task stack sizes optimized
- Watchdog timer integration
- Graceful degradation under load
- Comprehensive error recovery
- Real-time metrics reporting

## Implementation Details

### 1. Health Monitor (`/lib/HealthMonitor/`)

System-wide health tracking:

```cpp
class HealthMonitor {
public:
    struct SystemHealth {
        uint32_t uptime;
        uint32_t freeHeap;
        uint32_t minFreeHeap;
        uint32_t largestFreeBlock;
        float cpuUsage;
        float temperature;
        bool lowMemoryWarning;

        struct TaskInfo {
            const char* name;
            uint32_t stackHighWaterMark;
            uint32_t runtime;
            uint8_t priority;
            eTaskState state;
        };
        std::vector<TaskInfo> tasks;

        struct ComponentHealth {
            const char* name;
            bool healthy;
            const char* status;
            uint32_t lastUpdate;
        };
        std::vector<ComponentHealth> components;
    };

private:
    static HealthMonitor* instance;
    SystemHealth health;
    TaskHandle_t monitorTask;
    uint32_t checkInterval;

public:
    static HealthMonitor* getInstance();
    void begin(uint32_t intervalMs = 5000);

    // Health checks
    SystemHealth getSystemHealth() const;
    bool isSystemHealthy() const;
    void registerComponent(const char* name, std::function<bool()> healthCheck);

    // Thresholds
    void setMemoryThreshold(uint32_t minFreeBytes);
    void setCPUThreshold(float maxUsage);

    // Alerts
    void onLowMemory(std::function<void(uint32_t)> callback);
    void onHighCPU(std::function<void(float)> callback);
    void onComponentFailure(std::function<void(const char*)> callback);

private:
    static void monitorTaskFunction(void* parameter);
    void updateSystemMetrics();
    void checkThresholds();
    void publishHealthEvents();
};
```

Features:

- Real-time heap monitoring
- Task stack usage tracking
- CPU usage calculation
- Temperature monitoring (if available)
- Component health aggregation
- Automatic alert generation

### 2. Task Manager (`/lib/TaskManager/`)

FreeRTOS task wrapper with monitoring:

```cpp
class TaskManager {
public:
    struct TaskConfig {
        const char* name;
        uint32_t stackSize;
        UBaseType_t priority;
        uint32_t watchdogTimeout;  // 0 = disabled
        bool startImmediately;
    };

    class ManagedTask {
    protected:
        TaskHandle_t taskHandle;
        TaskConfig config;
        bool running;
        uint32_t lastWatchdogFeed;

    public:
        ManagedTask(const TaskConfig& cfg);
        virtual ~ManagedTask();

        bool start();
        void stop();
        bool isRunning() const;

        // Override this in derived classes
        virtual void run() = 0;

    protected:
        void feedWatchdog();
        void yield();
        void delay(uint32_t ms);
    };

private:
    static TaskManager* instance;
    std::vector<ManagedTask*> tasks;
    TaskHandle_t watchdogTask;

public:
    static TaskManager* getInstance();
    void registerTask(ManagedTask* task);
    void startAll();
    void stopAll();

    // Monitoring
    void printTaskStats();
    size_t getTaskCount() const;

private:
    static void watchdogTaskFunction(void* parameter);
    void checkWatchdogs();
};
```

Example usage:

```cpp
class WiFiTask : public TaskManager::ManagedTask {
public:
    WiFiTask() : ManagedTask({
        .name = "WiFi",
        .stackSize = 4096,
        .priority = 2,
        .watchdogTimeout = 30000
    }) {}

    void run() override {
        while (running) {
            // WiFi management logic
            feedWatchdog();
            delay(100);
        }
    }
};
```

### 3. Memory Manager (`/lib/MemoryManager/`)

Memory optimization utilities:

```cpp
class MemoryManager {
public:
    struct MemoryStats {
        uint32_t totalHeap;
        uint32_t freeHeap;
        uint32_t minFreeHeap;
        uint32_t largestFreeBlock;
        uint32_t allocations;
        uint32_t frees;
        float fragmentation;  // percentage
    };

    // Memory pools for frequently allocated objects
    template<typename T, size_t PoolSize>
    class MemoryPool {
    private:
        alignas(T) uint8_t buffer[sizeof(T) * PoolSize];
        bool used[PoolSize];

    public:
        T* allocate();
        void deallocate(T* ptr);
        size_t getFreeSlots() const;
    };

private:
    static MemoryManager* instance;
    MemoryStats stats;

public:
    static MemoryManager* getInstance();

    // Statistics
    MemoryStats getStats() const;
    void printMemoryMap();

    // Optimization
    void defragment();  // Trigger heap defragmentation
    void emergencyCleanup();  // Free non-critical resources

    // Allocation tracking (debug mode)
    void enableTracking(bool enable);
    void printAllocationReport();
};
```

### 4. Error Handler (`/lib/ErrorHandler/`)

Centralized error management:

```cpp
class ErrorHandler {
public:
    enum ErrorLevel {
        INFO,
        WARNING,
        ERROR,
        CRITICAL
    };

    struct ErrorInfo {
        ErrorLevel level;
        const char* component;
        const char* message;
        uint32_t code;
        uint32_t timestamp;
        uint32_t count;  // Occurrence count
    };

private:
    static ErrorHandler* instance;
    CircularBuffer<ErrorInfo, 50> errorLog;
    std::map<uint32_t, uint32_t> errorCounts;

public:
    static ErrorHandler* getInstance();

    void logError(ErrorLevel level, const char* component,
                  const char* message, uint32_t code = 0);

    // Error retrieval
    std::vector<ErrorInfo> getRecentErrors(size_t count = 10);
    std::vector<ErrorInfo> getErrorsByComponent(const char* component);

    // Recovery actions
    void registerRecoveryAction(uint32_t errorCode,
                               std::function<void()> action);

    // System-wide error handling
    void onCriticalError(std::function<void(const ErrorInfo&)> callback);
    void setPanicHandler(std::function<void()> handler);
};

// Convenience macros
#define LOG_ERROR(component, message, code) \
    ErrorHandler::getInstance()->logError(ErrorHandler::ERROR, component, message, code)

#define LOG_WARNING(component, message) \
    ErrorHandler::getInstance()->logError(ErrorHandler::WARNING, component, message, 0)
```

### 5. Complete TypeScript Client Library

Integrate all modules into cohesive client:

```typescript
// src/MAVLinkBridgeClient.ts
export class MAVLinkBridgeClient {
  private httpClient: HttpClient;
  private wsClient: WebSocketClient;
  private configClient: ConfigClient;
  private wifiClient: WiFiClient;
  private rtcmClient: RTCMClient;
  private commClient: CommunicationClient;
  private healthClient: HealthClient;

  constructor(baseUrl: string) {
    // Initialize all sub-clients
    this.httpClient = new HttpClient(baseUrl);
    this.wsClient = new WebSocketClient(`ws://${baseUrl}/ws`);
    this.configClient = new ConfigClient(this.httpClient);
    // ... initialize others

    this.setupGlobalEventHandlers();
  }

  async connect(): Promise<void> {
    await this.wsClient.connect();
    await this.syncInitialState();
  }

  disconnect(): void {
    this.wsClient.disconnect();
  }

  // Convenience methods
  get config() {
    return this.configClient;
  }
  get wifi() {
    return this.wifiClient;
  }
  get rtcm() {
    return this.rtcmClient;
  }
  get communication() {
    return this.commClient;
  }
  get health() {
    return this.healthClient;
  }

  // Global event handling
  on(event: GlobalEvent, handler: EventHandler): void {}
  off(event: GlobalEvent, handler: EventHandler): void {}

  // System-wide operations
  async getSystemStatus(): Promise<SystemStatus> {}
  async reboot(): Promise<void> {}
  async factoryReset(): Promise<void> {}

  private setupGlobalEventHandlers() {
    // Handle reconnection, errors, etc.
  }

  private async syncInitialState() {
    // Fetch initial configuration and status
  }
}

// src/index.ts - Main export
export { MAVLinkBridgeClient } from './MAVLinkBridgeClient';
export * from './types';
export * from './config';
export * from './wifi';
export * from './rtcm';
export * from './communication';
export * from './health';
```

### 6. Integration Test Framework

```cpp
class IntegrationTest {
public:
    struct TestResult {
        const char* name;
        bool passed;
        uint32_t duration;
        const char* failureReason;
    };

    static void runAllTests();
    static void runSystemTests();
    static void runStressTests();
    static void runMemoryTests();

private:
    // Test scenarios
    static TestResult testWiFiReconnection();
    static TestResult testRTCMDataFlow();
    static TestResult testUSBUARTSwitching();
    static TestResult testMemoryUnderLoad();
    static TestResult testConfigPersistence();
    static TestResult testWebSocketReconnection();
    static TestResult testConcurrentRequests();
};
```

## System Optimization Checklist

1. **Memory Optimization**

   - Static allocation for critical buffers
   - Memory pools for frequent allocations
   - String deduplication
   - Minimize heap fragmentation

2. **Performance Optimization**

   - Task priorities tuned
   - Interrupt priorities set correctly
   - DMA usage maximized
   - CPU frequency scaling

3. **Power Optimization**

   - Light sleep when idle
   - Peripheral power management
   - WiFi power save mode
   - Dynamic frequency scaling

4. **Reliability**
   - Watchdog timers enabled
   - Brown-out detection
   - Stack overflow detection
   - Exception handlers

## Final Testing Requirements

1. 24-hour stability test
2. Memory leak verification
3. Maximum connection stress test
4. Power cycle resilience
5. Concurrent operation testing
6. Error injection testing
7. Performance benchmarks
8. TypeScript client integration tests

## Documentation Requirements

1. API reference documentation
2. TypeScript client documentation
3. Hardware setup guide
4. Configuration guide
5. Troubleshooting guide
6. Performance tuning guide
7. Example applications

## Deliverables

1. Complete integrated system
2. Health monitoring implementation
3. Task management framework
4. Memory optimization utilities
5. Error handling system
6. Complete TypeScript client library
7. Integration test suite
8. Comprehensive documentation
9. Performance analysis report
10. Deployment guide
