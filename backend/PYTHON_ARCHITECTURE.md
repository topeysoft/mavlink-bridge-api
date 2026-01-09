# Python Backend Architecture

## Overview
This document defines the architecture for the Python-based YardRover backend, providing a reference for migrating from ESP32 C++ to Raspberry Pi Python.

**Last Updated**: 2026-01-07

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Vue 3 Web Application                   │
│              (TypeScript - No Changes Required)             │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP REST API + WebSocket
                   │ (Same interface as ESP32)
┌──────────────────▼──────────────────────────────────────────┐
│                     FastAPI Application                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              API Routes (OpenAPI Spec)                 │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌──────────┬──────────┬──────────┬──────────┬───────────┐ │
│  │  Core    │ Network  │ MAVLink  │ Resource │   RTCM    │ │
│  │  Layer   │  Layer   │  Layer   │  Layer   │   Layer   │ │
│  └──────────┴──────────┴──────────┴──────────┴───────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                  System Integration Layer                    │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐  │
│  │  Serial  │  Network │  Storage │  System Resources    │  │
│  │  Port    │  Manager │  Files   │  (CPU, Memory, GPIO) │  │
│  └──────────┴──────────┴──────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Structure

### Package Organization

```
src/yardrover/
├── __init__.py                 # Package initialization
├── main.py                     # FastAPI app entry point
│
├── core/                       # Core system modules
│   ├── __init__.py
│   ├── config.py              # Configuration management (Pydantic)
│   ├── storage.py             # File-based storage abstraction
│   ├── events.py              # Async event system
│   ├── errors.py              # Error handling and custom exceptions
│   ├── health.py              # System health monitoring
│   ├── memory.py              # Memory management utilities
│   └── logging.py             # Logging configuration
│
├── network/                    # Network layer
│   ├── __init__.py
│   ├── wifi.py                # WiFi management (NetworkManager)
│   ├── mdns.py                # mDNS service (zeroconf)
│   ├── websocket.py           # WebSocket management
│   └── middleware.py          # FastAPI middleware
│
├── mavlink/                    # MAVLink integration
│   ├── __init__.py
│   ├── processor.py           # MAVLink message processor
│   ├── converter.py           # Message conversion utilities
│   ├── router.py              # Message routing (DataRouter)
│   ├── commands.py            # MAVLink command handlers
│   ├── parameters.py          # Parameter management
│   ├── missions.py            # Mission protocol handler
│   └── serial_manager.py      # Serial port management
│
├── resources/                  # Resource management
│   ├── __init__.py
│   ├── storage.py             # Resource storage layer
│   ├── zones.py               # Zone models and logic
│   ├── missions.py            # Scheduled mission models
│   ├── sync.py                # Incremental sync logic
│   └── events.py              # Resource event broadcasting
│
├── rtcm/                       # RTCM support
│   ├── __init__.py
│   ├── parser.py              # RTCM message parser
│   ├── ntrip_client.py        # NTRIP client implementation
│   ├── client.py              # RTCM client management
│   └── router.py              # RTCM output routing
│
├── api/                        # API route definitions
│   ├── __init__.py
│   ├── health.py              # Health endpoints
│   ├── config.py              # Configuration endpoints
│   ├── wifi.py                # WiFi endpoints
│   ├── mdns.py                # mDNS endpoints
│   ├── mavlink.py             # MAVLink endpoints
│   ├── communication.py       # Communication system endpoints
│   ├── resources.py           # Zones/missions endpoints
│   ├── rtcm.py                # RTCM endpoints
│   └── websocket.py           # WebSocket endpoint
│
├── models/                     # Pydantic models (OpenAPI schemas)
│   ├── __init__.py
│   ├── config.py              # Configuration models
│   ├── health.py              # Health and system models
│   ├── network.py             # Network-related models
│   ├── mavlink.py             # MAVLink models
│   ├── resources.py           # Zone and mission models
│   └── rtcm.py                # RTCM models
│
└── utils/                      # Utility functions
    ├── __init__.py
    ├── async_helpers.py       # Async utilities
    ├── validation.py          # Validation helpers
    └── formatting.py          # Data formatting utilities
```

---

## C++ to Python Module Mapping

### Core Layer Mapping

| C++ Component | Python Module | Key Differences |
|---------------|---------------|-----------------|
| `ConfigManager` | `core.config` | Pydantic Settings instead of NVS |
| `NVSManager` | `core.config` | JSON/YAML file-based |
| `Storage` | `core.storage` | aiofiles instead of LittleFS |
| `EventManager` | `core.events` | asyncio.Event instead of FreeRTOS queues |
| `ErrorHandler` | `core.errors` | Python logging + custom exceptions |
| `HealthMonitor` | `core.health` | psutil for system metrics |
| `MemoryManager` | `core.memory` | Different memory model (GC) |
| `TaskManager` | `asyncio.create_task` | Native async tasks |
| `ResourceStorage` | `resources.storage` | File-based JSON storage |

### Network Layer Mapping

| C++ Component | Python Module | Key Differences |
|---------------|---------------|-----------------|
| `HttpServer` | `FastAPI` | Built-in web framework |
| `WebSocketServer` | `network.websocket` | FastAPI WebSocket support |
| `WiFiManager` | `network.wifi` | NetworkManager D-Bus/nmcli |
| `MDNSManager` | `network.mdns` | zeroconf library |
| `ConfigEndpoints` | `api.config` | FastAPI routes |
| `WiFiEndpoints` | `api.wifi` | FastAPI routes |
| `MDNSEndpoints` | `api.mdns` | FastAPI routes |
| `ResourceEndpoints` | `api.resources` | FastAPI routes |

### MAVLink Layer Mapping

| C++ Component | Python Module | Key Differences |
|---------------|---------------|-----------------|
| `MAVLinkProcessor` | `mavlink.processor` | pymavlink instead of c_library_v2 |
| `MAVLinkConverter` | `mavlink.converter` | pymavlink message objects |
| `DataRouter` | `mavlink.router` | Async message routing |
| `UARTManager` | `mavlink.serial_manager` | pyserial-asyncio |
| `USBOTGManager` | N/A or `mavlink.serial_manager` | May not be needed on Pi |
| `MissionProtocolHandler` | `mavlink.missions` | Mission protocol state machine |
| `CommunicationEndpoints` | `api.communication` | FastAPI routes |

### RTCM Layer Mapping

| C++ Component | Python Module | Key Differences |
|---------------|---------------|-----------------|
| `RTCMParser` | `rtcm.parser` | RTCM message parsing |
| `NTRIPClient` | `rtcm.ntrip_client` | Async HTTP client |
| `RTCMClient` | `rtcm.client` | Client management |
| `RTCMEndpoints` | `api.rtcm` | FastAPI routes |
| `RTCMOutputRouter` | `rtcm.router` | Output routing |

---

## Data Flow Diagrams

### Configuration Management Flow

```
┌──────────────┐
│  API Request │
│  PATCH /api/ │
│    config    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Pydantic Model   │  Validation
│  Validation      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ ConfigManager    │  Update in-memory config
│  .update()       │
└──────┬───────────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ Save to File │   │ Emit Event   │
│ (JSON/YAML)  │   │ config_changed│
└──────────────┘   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ Event        │
                   │ Subscribers  │
                   │ (WiFi, etc.) │
                   └──────────────┘
```

### MAVLink Message Flow

```
┌──────────────┐
│ Serial Port  │
│  (UART/USB)  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ pymavlink        │  Parse bytes → MAVLink message
│  mav.parse_char()│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ MAVLinkProcessor │  Process message
│  .handle_message()│
└──────┬───────────┘
       │
       ├──────────────┬──────────────┬──────────────┐
       ▼              ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ DataRouter│   │ Telemetry│   │ Parameter│   │ Mission  │
│  (filter) │   │  Store   │   │  Store   │   │  Handler │
└──────┬───┘   └──────┬───┘   └──────┬───┘   └──────┬───┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌──────────────────────────────────────────────────────┐
│              WebSocket Broadcast                      │
│           (to connected web clients)                  │
└───────────────────────────────────────────────────────┘
```

### Resource Sync Flow

```
┌──────────────┐
│ API Request  │
│ GET /api/    │
│ zones?since=T│
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ ResourceManager  │
│  .get_zones()    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Check Timestamps │  Compare with 'since' param
└──────┬───────────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Modified │   │ Deleted  │   │ Unchanged│
│  Zones   │   │  Zone IDs│   │ (skip)   │
└──────┬───┘   └──────┬───┘   └──────────┘
       │              │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ JSON Response│
       │  {zones:[],  │
       │   deleted:[]}│
       └──────────────┘
```

---

## Async Patterns

### Event-Driven Architecture

```python
from typing import Callable, Dict, List
import asyncio

class EventBus:
    """Async event bus for system-wide events"""

    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}

    async def emit(self, event: str, data: Any) -> None:
        """Emit event to all subscribers"""
        if event in self._subscribers:
            tasks = [handler(data) for handler in self._subscribers[event]]
            await asyncio.gather(*tasks, return_exceptions=True)

    def subscribe(self, event: str, handler: Callable) -> None:
        """Subscribe to event"""
        if event not in self._subscribers:
            self._subscribers[event] = []
        self._subscribers[event].append(handler)
```

### Background Task Pattern

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    background_tasks = []

    # Start health monitoring
    health_task = asyncio.create_task(health_monitor.run())
    background_tasks.append(health_task)

    # Start serial reader
    serial_task = asyncio.create_task(serial_manager.read_loop())
    background_tasks.append(serial_task)

    yield

    # Shutdown
    for task in background_tasks:
        task.cancel()
    await asyncio.gather(*background_tasks, return_exceptions=True)
```

### Serial Communication Pattern

```python
import asyncio
from serial_asyncio import create_serial_connection

class SerialManager:
    """Async serial port management"""

    async def connect(self, port: str, baudrate: int = 57600):
        """Connect to serial port"""
        self.reader, self.writer = await create_serial_connection(
            asyncio.get_event_loop(),
            asyncio.Protocol,
            port,
            baudrate=baudrate
        )

    async def read_loop(self):
        """Continuous read loop"""
        while True:
            data = await self.reader.read(1024)
            if data:
                await self.process_data(data)
```

---

## Type System

### Pydantic Models (API Schemas)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DeviceInfo(BaseModel):
    """Device information model (matches OpenAPI spec)"""
    hostname: str
    name: str
    chip_model: str = Field(alias="chipModel")
    chip_revision: int = Field(alias="chipRevision")
    flash_size: int = Field(alias="flashSize")
    sdk_version: str = Field(alias="sdkVersion")
    core_count: int = Field(alias="coreCount")

    class Config:
        populate_by_name = True  # Allow both snake_case and camelCase

class Zone(BaseModel):
    """Zone model (matches OpenAPI spec)"""
    id: str
    name: str
    type: str  # 'mowing' | 'exclusion' | 'charging'
    coordinates: List[List[float]]
    color: str
    area: float
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    created: datetime
    last_modified: datetime = Field(alias="lastModified")
    settings: Optional[dict] = None

    class Config:
        populate_by_name = True
```

### Type Hints Best Practices

```python
from typing import Protocol, TypedDict, Callable, Awaitable

# Protocol for dependency injection
class StorageProvider(Protocol):
    async def read(self, key: str) -> Optional[dict]: ...
    async def write(self, key: str, value: dict) -> None: ...

# TypedDict for structured dicts
class MAVLinkMessage(TypedDict):
    message_id: int
    system_id: int
    component_id: int
    payload: dict

# Callback type hints
EventHandler = Callable[[str, Any], Awaitable[None]]
```

---

## Configuration System

### Settings Management

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class AppSettings(BaseSettings):
    """Application settings with environment variable support"""

    model_config = SettingsConfigDict(
        env_file='.env',
        env_prefix='YARDROVER_',
        case_sensitive=False
    )

    # Device settings
    device_name: str = "YardRover"
    device_hostname: str = "yardrover-pi"

    # Network settings
    wifi_auto_connect: bool = True
    ap_mode_enabled: bool = True
    mdns_enabled: bool = True

    # Serial settings
    serial_port: str = "/dev/ttyS0"
    serial_baudrate: int = 57600

    # Storage settings
    storage_path: str = "/var/lib/yardrover"
    resource_storage_path: str = "/var/lib/yardrover/resources"

    # RTCM settings
    rtcm_enabled: bool = False
    ntrip_host: Optional[str] = None
    ntrip_port: int = 2101

# Global settings instance
settings = AppSettings()
```

### Configuration File Structure

```yaml
# config.yaml
device:
  name: "YardRover Pi"
  hostname: "yardrover-pi"

network:
  wifi:
    auto_connect: true
    ssid: null  # Set via API
    password: null
  ap:
    enabled: true
    ssid: "YardRover-Setup"
    password: "yardrover123"
  mdns:
    enabled: true
    hostname: "yardrover-pi"

serial:
  port: "/dev/ttyS0"
  baudrate: 57600
  timeout: 1.0

storage:
  base_path: "/var/lib/yardrover"
  resources_path: "/var/lib/yardrover/resources"

rtcm:
  enabled: false
  source:
    type: "ntrip"
    host: null
    port: 2101
```

---

## Dependency Injection

### FastAPI Dependencies

```python
from fastapi import Depends
from typing import Annotated

# Dependency providers
async def get_event_bus() -> EventBus:
    return event_bus

async def get_config() -> ConfigManager:
    return config_manager

async def get_mavlink() -> MAVLinkProcessor:
    return mavlink_processor

# Type aliases for cleaner signatures
EventBusDep = Annotated[EventBus, Depends(get_event_bus)]
ConfigDep = Annotated[ConfigManager, Depends(get_config)]
MAVLinkDep = Annotated[MAVLinkProcessor, Depends(get_mavlink)]

# Usage in routes
@router.post("/mavlink/command")
async def send_mavlink_command(
    command: MAVLinkCommand,
    mavlink: MAVLinkDep,
    events: EventBusDep
) -> MAVLinkCommandResponse:
    result = await mavlink.send_command(command)
    await events.emit("mavlink_command_sent", command)
    return result
```

---

## Error Handling

### Exception Hierarchy

```python
class YardRoverError(Exception):
    """Base exception for all YardRover errors"""
    pass

class ConfigurationError(YardRoverError):
    """Configuration-related errors"""
    pass

class StorageError(YardRoverError):
    """Storage operation errors"""
    pass

class MAVLinkError(YardRoverError):
    """MAVLink communication errors"""
    pass

class NetworkError(YardRoverError):
    """Network operation errors"""
    pass
```

### Exception Handlers

```python
from fastapi import Request, status
from fastapi.responses import JSONResponse

@app.exception_handler(YardRoverError)
async def yardrover_error_handler(request: Request, exc: YardRoverError):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": exc.__class__.__name__,
            "message": str(exc)
        }
    )
```

---

## Testing Architecture

### Test Structure

```
tests/
├── unit/
│   ├── core/
│   │   ├── test_config.py
│   │   ├── test_storage.py
│   │   └── test_events.py
│   ├── network/
│   │   ├── test_wifi.py
│   │   └── test_mdns.py
│   ├── mavlink/
│   │   ├── test_processor.py
│   │   └── test_router.py
│   └── resources/
│       ├── test_zones.py
│       └── test_missions.py
│
├── integration/
│   ├── test_api_endpoints.py
│   ├── test_websocket.py
│   ├── test_mavlink_protocol.py
│   └── test_resource_sync.py
│
├── performance/
│   ├── test_api_latency.py
│   ├── test_websocket_throughput.py
│   └── test_mavlink_processing.py
│
└── conftest.py  # Shared fixtures
```

### Test Fixtures

```python
import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient

@pytest.fixture
async def test_client():
    """Async test client"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
def mock_mavlink():
    """Mock MAVLink processor"""
    return MockMAVLinkProcessor()

@pytest.fixture
async def test_storage(tmp_path):
    """Temporary storage for tests"""
    storage = Storage(base_path=tmp_path)
    await storage.initialize()
    yield storage
    await storage.cleanup()
```

---

## Deployment Architecture

### Systemd Service

```ini
[Unit]
Description=YardRover API Service
After=network.target

[Service]
Type=notify
User=yardrover
Group=yardrover
WorkingDirectory=/opt/yardrover
Environment="YARDROVER_ENV=production"
ExecStart=/opt/yardrover/venv/bin/uvicorn yardrover.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### Directory Structure (Production)

```
/opt/yardrover/              # Application root
├── venv/                    # Virtual environment
├── src/                     # Source code
├── config.yaml              # Configuration file
└── logs/                    # Application logs

/var/lib/yardrover/          # Data directory
├── resources/               # Zones, missions
│   ├── zones/
│   └── missions/
└── backups/                 # Backup files

/var/log/yardrover/          # Log files
└── yardrover.log
```

---

## Performance Considerations

### Optimization Strategies

1. **Async I/O**: All file and network operations use async
2. **Connection Pooling**: Reuse HTTP connections for NTRIP
3. **Message Batching**: Batch WebSocket messages when possible
4. **Caching**: Cache configuration and metadata in memory
5. **Lazy Loading**: Load resources on-demand

### Resource Limits

```python
# FastAPI configuration
app = FastAPI(
    title="YardRover API",
    version="2.0.0",
    max_concurrent_requests=100,
    timeout=30.0
)

# Uvicorn configuration
uvicorn.run(
    app,
    host="0.0.0.0",
    port=8000,
    workers=2,  # Multi-process on Pi 4+
    limit_concurrency=100,
    limit_max_requests=10000,
    timeout_keep_alive=5
)
```

---

## Security Considerations

### API Security

```python
from fastapi import Security
from fastapi.security import HTTPBearer

security = HTTPBearer()

@app.post("/api/mavlink/command")
async def send_command(
    command: MAVLinkCommand,
    token: str = Security(security)
):
    # Validate token
    if not validate_token(token):
        raise HTTPException(status_code=401)
    # ...
```

### File System Security

```python
# Restrict file operations to allowed paths
ALLOWED_PATHS = [
    Path("/var/lib/yardrover"),
    Path("/etc/yardrover")
]

def validate_path(path: Path) -> bool:
    return any(
        path.resolve().is_relative_to(allowed)
        for allowed in ALLOWED_PATHS
    )
```

---

## Monitoring & Observability

### Health Check Endpoint

```python
@router.get("/api/health")
async def health_check(
    config: ConfigDep,
    storage: StorageDep,
    mavlink: MAVLinkDep
) -> HealthResponse:
    """Comprehensive health check"""

    system_health = await get_system_metrics()
    storage_health = await storage.get_health()
    mavlink_health = await mavlink.get_health()

    status = "healthy"
    if not all([system_health.healthy, storage_health.healthy]):
        status = "degraded"

    return HealthResponse(
        status=status,
        uptime=get_uptime(),
        free_heap=get_memory_info().available,
        device=get_device_info(),
        network=get_network_info(),
        system=system_health,
        storage=storage_health,
        mavlink=mavlink_health
    )
```

### Logging Strategy

```python
import logging
import structlog

# Structured logging
logger = structlog.get_logger()

logger.info(
    "mavlink_message_received",
    message_id=msg.get_msgId(),
    system_id=msg.get_srcSystem(),
    component_id=msg.get_srcComponent()
)
```

---

## Migration Checklist

### Pre-Migration
- [ ] Review C++ implementation for business logic
- [ ] Document all configuration parameters
- [ ] List all external dependencies
- [ ] Identify Pi-specific hardware needs

### During Migration
- [ ] Maintain API compatibility with OpenAPI spec
- [ ] Write tests alongside code
- [ ] Document deviations from C++ implementation
- [ ] Performance test on target hardware

### Post-Migration
- [ ] Integration test with Vue app
- [ ] Load testing on Raspberry Pi
- [ ] Create deployment documentation
- [ ] Performance comparison with ESP32
