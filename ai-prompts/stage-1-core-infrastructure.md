# Stage 1: Core Infrastructure Implementation

## Context
You are implementing the core infrastructure for an ESP32-based REST API system. The ESP32 has limited resources, so memory efficiency is crucial. The system uses FreeRTOS for task management and should follow event-driven architecture patterns.

## OpenAPI Specification
[Include the full OpenAPI specification from api-spec.yaml here]

## Task Overview
Implement the foundational components for the REST API system:
1. HTTP Server with async request handling
2. WebSocket Server for real-time communication
3. Event Manager for pub/sub messaging
4. Base Configuration Manager

## Technical Requirements
- Platform: ESP32 with Arduino framework or ESP-IDF
- Use static memory allocation where possible
- Implement efficient buffer management
- Follow the file structure: `/lib/ComponentName/ComponentName.h` and `.cpp`
- Each component should be a singleton
- Use FreeRTOS tasks with while(true) loops
- Minimize dynamic memory allocation

## Implementation Details

### 1. HTTP Server (`/lib/HttpServer/`)
Create an async HTTP server wrapper that:
- Supports GET, POST, PATCH methods
- Handles JSON request/response
- Implements request routing
- Uses a single shared buffer for request/response
- Provides middleware support for CORS
- Maximum concurrent connections: 4

Example structure:
```cpp
class HttpServer {
private:
    static HttpServer* instance;
    static const size_t BUFFER_SIZE = 1024;
    char buffer[BUFFER_SIZE];
    
public:
    static HttpServer* getInstance();
    void begin(uint16_t port = 80);
    void addRoute(const char* path, HttpMethod method, RouteHandler handler);
    void handleRequest();
};
```

### 2. WebSocket Server (`/lib/WebSocketServer/`)
Implement WebSocket server that:
- Supports multiple concurrent connections (max 3)
- Handles JSON message framing
- Integrates with Event Manager for broadcasting
- Implements ping/pong for connection health
- Auto-disconnects idle clients after 30 seconds

### 3. Event Manager (`/lib/EventManager/`)
Create a lightweight pub/sub system that:
- Supports typed events (see event contracts)
- Allows multiple subscribers per event
- Implements event queuing (max 10 events)
- Provides both sync and async event dispatch
- Uses static memory for event storage

Example usage:
```cpp
EventManager::getInstance()->subscribe(EventType::CONFIG_CHANGED, [](const Event& e) {
    // Handle config change
});

EventManager::getInstance()->publish(EventType::CONFIG_CHANGED, configPayload);
```

### 4. Configuration Manager (`/lib/ConfigManager/`)
Base configuration system that:
- Stores configuration in JSON format
- Provides typed getters/setters
- Supports configuration validation
- Implements dirty tracking for changes
- Prepares for persistence (actual storage in Stage 2)

## Unit Tests
For each component, create comprehensive unit tests that verify:
- Basic functionality
- Error handling
- Memory usage
- Thread safety
- Edge cases

## TypeScript Client Library Structure
Create the foundation for the TypeScript client:
```typescript
// src/core/HttpClient.ts
export class HttpClient {
    constructor(private baseUrl: string) {}
    async get<T>(path: string): Promise<T> {}
    async post<T>(path: string, data: any): Promise<T> {}
    async patch<T>(path: string, patch: any): Promise<T> {}
}

// src/core/WebSocketClient.ts
export class WebSocketClient {
    constructor(private url: string) {}
    connect(): Promise<void> {}
    disconnect(): void {}
    on(event: EventType, handler: EventHandler): void {}
    send(message: any): void {}
}

// src/core/EventTypes.ts
export enum EventType {
    CONFIG_CHANGED = "config_changed",
    // ... other events
}
```

## Deliverables
1. Complete C++ implementation of all 4 components
2. Header files with clear documentation
3. Unit tests for each component
4. Basic TypeScript client structure
5. Example usage code
6. Memory usage analysis

## Success Criteria
- All components compile without warnings
- Unit tests pass with 100% success rate
- Memory usage stays within ESP32 constraints
- WebSocket can handle 3 concurrent connections
- HTTP server responds within 100ms
- Event system processes 100 events/second