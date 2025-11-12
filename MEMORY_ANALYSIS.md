# Memory Usage Analysis - Stage 1 Core Infrastructure

## Overview

This document provides a detailed analysis of memory usage for the Stage 1 core infrastructure implementation. The ESP32-S3 has approximately 320KB of SRAM available for application use after system overhead.

## Component Memory Allocation

### Static Memory Allocations

| Component | Size | Usage | Location |
|-----------|------|-------|----------|
| HTTP Server Buffer | 1,024 bytes | Request/response JSON processing | HttpServer.cpp |
| WebSocket Message Buffer | 512 bytes | WebSocket message handling | WebSocketServer.cpp |
| Configuration Buffer | 2,048 bytes | JSON configuration storage | ConfigManager.cpp |
| Event Queue | 10 × 256 bytes | Event storage in FreeRTOS queue | EventManager.cpp |
| **Total Static** | **6,144 bytes** | **~6KB** | |

### Dynamic Allocations (ArduinoJson)

| Component | Capacity | Usage | Notes |
|-----------|----------|-------|--------|
| HTTP Request Doc | 1,024 bytes | JSON parsing for HTTP requests | Allocated once, reused |
| HTTP Response Doc | 1,024 bytes | JSON generation for HTTP responses | Allocated once, reused |
| WebSocket Message Doc | 512 bytes | WebSocket message processing | Allocated once, reused |
| Config JSON Doc | 2,048 bytes | Configuration serialization | Allocated once, reused |
| Event Payload Docs | 10 × 256 bytes | Event payloads in queue | Allocated as needed |
| **Total Dynamic** | **7,680 bytes** | **~7.5KB** | |

### FreeRTOS Task Stacks

| Task | Stack Size | Priority | Purpose |
|------|------------|----------|---------|
| HTTP Task | 2,048 bytes | 1 | HTTP server processing |
| WebSocket Task | 2,048 bytes | 1 | WebSocket client management |
| Event Task | 2,048 bytes | 1 | Event processing (internal to EventManager) |
| Main Loop | 8,192 bytes | 1 | Arduino main task (default) |
| **Total Stacks** | **14,336 bytes** | **~14KB** | |

### Connection State Storage

| Resource | Count | Size Each | Total |
|----------|--------|-----------|--------|
| HTTP Connections | 4 | 512 bytes | 2,048 bytes |
| WebSocket Clients | 3 | 128 bytes | 384 bytes |
| Event Subscriptions | 32 | 32 bytes | 1,024 bytes |
| Route Storage | 16 | 48 bytes | 768 bytes |
| **Total State** | | | **4,224 bytes (~4KB)** |

## Memory Usage Summary

| Category | Allocation | Percentage of 320KB |
|----------|------------|---------------------|
| Static Buffers | 6KB | 1.9% |
| JSON Documents | 7.5KB | 2.3% |
| FreeRTOS Stacks | 14KB | 4.4% |
| Connection State | 4KB | 1.3% |
| **Core Infrastructure** | **31.5KB** | **9.8%** |
| System Reserve | 20KB | 6.3% |
| **Total Used** | **51.5KB** | **16.1%** |
| **Available** | **268.5KB** | **83.9%** |

## Peak Memory Usage Scenarios

### Scenario 1: Maximum HTTP Load
- 4 concurrent HTTP connections with 1KB requests each
- Peak additional usage: ~4KB
- Total peak: 55.5KB (17.3% of total)

### Scenario 2: Maximum WebSocket Activity
- 3 WebSocket clients with active message queues
- Peak additional usage: ~1.5KB
- Total peak: 53KB (16.6% of total)

### Scenario 3: Event System Under Load
- 10 queued events with maximum payloads
- Peak additional usage: ~2.5KB (already accounted in dynamic allocation)
- Total peak: 51.5KB (baseline)

### Scenario 4: Configuration Operations
- Large configuration updates with validation
- Peak additional usage: ~1KB (temporary)
- Total peak: 52.5KB (16.4% of total)

## Memory Efficiency Optimizations

### Implemented Optimizations

1. **Static Buffer Reuse**: All JSON processing uses pre-allocated buffers
2. **Singleton Pattern**: Single instance of each component prevents duplication
3. **Event Queue Limits**: Maximum 10 events prevents unbounded growth
4. **Connection Limits**: Fixed maximum connections prevent memory exhaustion
5. **Stack Size Tuning**: Minimal stack sizes based on actual usage

### Buffer Management Strategy

```cpp
// Shared buffer approach in HttpServer
char buffer[BUFFER_SIZE];  // Static allocation
DynamicJsonDocument requestDoc(BUFFER_SIZE);  // Reused for all requests
DynamicJsonDocument responseDoc(BUFFER_SIZE); // Reused for all responses
```

### Memory Pool Usage

All dynamic allocations use ArduinoJson's controlled allocation:
- Predictable memory usage
- No fragmentation from ArduinoJson operations
- Controlled growth with capacity limits

## Future Stage Impact Projections

### Stage 2: Configuration Persistence
- **Additional**: ~8KB for SPIFFS/NVS operations
- **New Total**: ~59.5KB (18.6%)

### Stage 3: WiFi Management
- **Additional**: ~12KB for WiFi scan results and credentials
- **New Total**: ~71.5KB (22.3%)

### Stage 4: RTCM Client
- **Additional**: ~32KB for RTCM buffers and networking
- **New Total**: ~103.5KB (32.3%)

### Stage 5: USB/UART Communication
- **Additional**: ~40KB for communication buffers
- **New Total**: ~143.5KB (44.8%)

### Stage 6: System Integration
- **Additional**: ~16KB for monitoring and logging
- **Final Total**: ~159.5KB (49.8%)

## Monitoring and Debugging

### Runtime Memory Monitoring

```cpp
// Heap monitoring
size_t freeHeap = ESP.getFreeHeap();
size_t minFreeHeap = ESP.getMinFreeHeap();
size_t heapSize = ESP.getHeapSize();

// Stack monitoring
UBaseType_t stackRemaining = uxTaskGetStackHighWaterMark(taskHandle);
```

### Memory Leak Detection

- Monitor `ESP.getMinFreeHeap()` over time
- Check for consistent decrease indicating leaks
- Use task stack high water marks to detect stack growth

### Debug Output Example

```
=== Memory Status ===
Total Heap: 327680 bytes
Free Heap: 268544 bytes (81.9%)
Min Free Heap: 268544 bytes
Used: 59136 bytes (18.1%)

=== Task Stack Usage ===
HTTP Task: 1234/2048 words used
WebSocket Task: 987/2048 words used
Event Task: 456/2048 words used
```

## Recommendations

### Current Status (Stage 1)
✅ **Excellent** - Only 16.1% memory usage leaves ample room for growth

### Optimization Opportunities
1. **Buffer Size Tuning**: Monitor actual usage and adjust buffer sizes
2. **Stack Optimization**: Reduce task stack sizes based on high water marks
3. **Connection Pooling**: Reuse connection objects instead of allocation/deallocation

### Risk Mitigation
1. **Memory Guards**: Implement low memory detection and warnings
2. **Graceful Degradation**: Reduce functionality when memory is low
3. **Emergency Recovery**: Reset system if memory becomes critically low

### Monitoring Strategy
1. **Regular Reporting**: Include memory stats in health endpoint
2. **Alerting**: WebSocket events for memory warnings
3. **Logging**: Track memory usage patterns over time

## Conclusion

The Stage 1 implementation demonstrates excellent memory efficiency with only 16.1% of available RAM used. The architecture provides a solid foundation with ample headroom for the remaining implementation stages while maintaining predictable and controlled memory usage patterns.