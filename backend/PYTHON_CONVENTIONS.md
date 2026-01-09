# Python Code Conventions

## Overview
This document defines coding standards and conventions for the YardRover Python backend to ensure consistency, maintainability, and type safety.

**Last Updated**: 2026-01-07

---

## General Principles

1. **Type Safety First**: Use Pyright in strict mode; all code must type-check
2. **Async by Default**: All I/O operations must be async
3. **Explicit over Implicit**: Prefer clarity over cleverness
4. **Fail Fast**: Validate inputs early, use type hints to catch errors
5. **Test-Driven**: Write tests alongside code, aim for 80%+ coverage

---

## Naming Conventions

### General Rules

```python
# snake_case for variables, functions, methods, modules
user_count = 10
def calculate_distance(lat1: float, lon1: float) -> float: ...

# PascalCase for classes
class ConfigManager: ...
class MAVLinkProcessor: ...

# UPPER_SNAKE_CASE for constants
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT = 30.0

# _leading_underscore for private/internal
_internal_cache = {}
def _validate_input(data: dict) -> bool: ...

# __double_leading for name mangling (rare)
class Secret:
    def __private_method(self): ...
```

### Module Names

```python
# Short, descriptive, snake_case
config.py           # ✓ Good
configuration.py    # ✗ Too verbose
cfg.py             # ✗ Too abbreviated
```

### API Compatibility

```python
# Use Pydantic's alias feature for camelCase API compatibility
from pydantic import BaseModel, Field

class DeviceInfo(BaseModel):
    chip_model: str = Field(alias="chipModel")  # Accept both chipModel and chip_model
    chip_revision: int = Field(alias="chipRevision")

    class Config:
        populate_by_name = True  # Allow both naming styles
```

---

## Type Annotations

### Required Type Hints

```python
# All function signatures MUST have type hints
def process_message(msg: MAVLinkMessage) -> ProcessResult:  # ✓ Good
    ...

def process_message(msg):  # ✗ Missing types
    ...

# Use `None` for no return value
async def send_event(event: str, data: dict) -> None:  # ✓ Good
    ...

# Use `Any` sparingly and document why
from typing import Any

def legacy_handler(data: Any) -> dict:  # Document: accepts unstructured JSON
    ...
```

### Complex Types

```python
from typing import (
    Optional, List, Dict, Tuple, Set,
    Union, Literal, TypedDict, Protocol,
    Callable, Awaitable, AsyncIterator
)

# Optional for nullable values
def get_config(key: str) -> Optional[dict]:
    ...

# Union for multiple types
def parse_value(value: Union[str, int, float]) -> float:
    ...

# Literal for constrained strings
ZoneType = Literal["mowing", "exclusion", "charging"]

# TypedDict for structured dicts
class MAVLinkMessage(TypedDict):
    message_id: int
    system_id: int
    component_id: int

# Protocol for duck typing
class Serializable(Protocol):
    def to_dict(self) -> dict: ...
    def from_dict(self, data: dict) -> None: ...

# Callable for function types
EventHandler = Callable[[str, dict], Awaitable[None]]
```

### Generic Types

```python
from typing import TypeVar, Generic

T = TypeVar('T')

class Cache(Generic[T]):
    def get(self, key: str) -> Optional[T]:
        ...

    def set(self, key: str, value: T) -> None:
        ...

# Usage
zone_cache: Cache[Zone] = Cache()
```

---

## Async Patterns

### Async Function Definition

```python
# Always use `async def` for I/O operations
async def read_file(path: str) -> str:  # ✓ Good
    async with aiofiles.open(path) as f:
        return await f.read()

def read_file(path: str) -> str:  # ✗ Should be async
    with open(path) as f:
        return f.read()
```

### Async Context Managers

```python
from contextlib import asynccontextmanager
from typing import AsyncIterator

@asynccontextmanager
async def database_connection() -> AsyncIterator[Database]:
    db = Database()
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()

# Usage
async with database_connection() as db:
    await db.query("SELECT ...")
```

### Async Iteration

```python
from typing import AsyncIterator

async def read_lines(path: str) -> AsyncIterator[str]:
    """Async generator for line-by-line reading"""
    async with aiofiles.open(path) as f:
        async for line in f:
            yield line.strip()

# Usage
async for line in read_lines("data.txt"):
    await process_line(line)
```

### Error Handling in Async

```python
import asyncio

async def fetch_with_retry(url: str, max_retries: int = 3) -> bytes:
    """Retry pattern for async operations"""
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.content
        except httpx.HTTPError as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)  # Exponential backoff
    raise RuntimeError("Unreachable")
```

---

## Pydantic Models

### Model Definition

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime

class Zone(BaseModel):
    """Zone model with validation and API compatibility"""

    # Required fields
    id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=128)
    type: Literal["mowing", "exclusion", "charging"]
    coordinates: List[List[float]] = Field(..., min_items=3)
    color: str = Field(..., pattern=r'^#[0-9A-Fa-f]{6}$')
    area: float = Field(..., gt=0)

    # Optional fields with defaults
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created: datetime = Field(default_factory=datetime.now)
    last_modified: datetime = Field(default_factory=datetime.now, alias="lastModified")

    # Field validator
    @field_validator('coordinates')
    @classmethod
    def validate_coordinates(cls, v: List[List[float]]) -> List[List[float]]:
        for coord in v:
            if len(coord) != 2:
                raise ValueError("Each coordinate must be [lon, lat]")
            lon, lat = coord
            if not (-180 <= lon <= 180):
                raise ValueError(f"Invalid longitude: {lon}")
            if not (-90 <= lat <= 90):
                raise ValueError(f"Invalid latitude: {lat}")
        return v

    # Model validator (cross-field validation)
    @model_validator(mode='after')
    def validate_polygon_closed(self) -> 'Zone':
        if self.coordinates[0] != self.coordinates[-1]:
            # Auto-close polygon
            self.coordinates.append(self.coordinates[0])
        return self

    class Config:
        populate_by_name = True  # Allow both camelCase and snake_case
        json_schema_extra = {
            "example": {
                "id": "zone-123",
                "name": "Front Lawn",
                "type": "mowing",
                "coordinates": [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.0, 0.0]],
                "color": "#2C5F2D",
                "area": 100.5
            }
        }
```

### Settings with Pydantic

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings with environment variable support"""

    model_config = SettingsConfigDict(
        env_file='.env',
        env_prefix='YARDROVER_',
        case_sensitive=False,
        extra='ignore'  # Ignore unknown env vars
    )

    # Typed settings
    device_name: str = "YardRover"
    serial_port: str = "/dev/ttyS0"
    serial_baudrate: int = Field(default=57600, ge=9600, le=115200)
    storage_path: Path = Path("/var/lib/yardrover")

    # Optional settings
    ntrip_host: Optional[str] = None
    ntrip_port: int = 2101

    @field_validator('storage_path')
    @classmethod
    def create_storage_path(cls, v: Path) -> Path:
        v.mkdir(parents=True, exist_ok=True)
        return v
```

---

## Error Handling

### Exception Hierarchy

```python
class YardRoverError(Exception):
    """Base exception for all YardRover errors"""
    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.code = code

class ConfigurationError(YardRoverError):
    """Configuration-related errors"""
    pass

class StorageError(YardRoverError):
    """Storage operation errors"""
    pass

class MAVLinkError(YardRoverError):
    """MAVLink communication errors"""
    pass

# Usage
raise ConfigurationError("Invalid SSID format", code="INVALID_SSID")
```

### Exception Handling Patterns

```python
# Specific exceptions first
try:
    data = await storage.read("config")
except FileNotFoundError:
    logger.warning("Config file not found, using defaults")
    data = default_config
except PermissionError:
    logger.error("Permission denied reading config")
    raise StorageError("Cannot read configuration file")
except Exception as e:
    logger.exception("Unexpected error reading config")
    raise StorageError(f"Failed to read config: {e}") from e

# Context managers for cleanup
from contextlib import suppress

with suppress(FileNotFoundError):
    await storage.delete("temp_file")
```

### FastAPI Exception Handlers

```python
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

@app.exception_handler(YardRoverError)
async def yardrover_exception_handler(
    request: Request,
    exc: YardRoverError
) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "code": exc.code
        }
    )
```

---

## Logging

### Logging Configuration

```python
import logging
import structlog

# Configure structlog for structured logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()
```

### Logging Patterns

```python
# Structured logging with context
logger.info(
    "mavlink_message_received",
    message_id=msg.get_msgId(),
    system_id=msg.get_srcSystem(),
    component_id=msg.get_srcComponent(),
    timestamp=msg.get_timestamp()
)

# Error logging with exception info
try:
    await risky_operation()
except Exception:
    logger.exception(
        "operation_failed",
        operation="risky_operation",
        context={"param": value}
    )

# Performance logging
import time

start = time.perf_counter()
result = await expensive_operation()
duration = time.perf_counter() - start

logger.info(
    "operation_completed",
    operation="expensive_operation",
    duration_ms=duration * 1000,
    result_size=len(result)
)
```

---

## Code Organization

### Module Structure

```python
"""
Module docstring explaining purpose.

This module provides configuration management for YardRover.
"""

# Standard library imports
import asyncio
import json
from pathlib import Path
from typing import Optional, Dict, Any

# Third-party imports
from pydantic import BaseModel, Field
import aiofiles

# Local imports
from yardrover.core.events import EventBus
from yardrover.core.errors import ConfigurationError
from yardrover.models.config import Configuration

# Module-level constants
DEFAULT_CONFIG_PATH = Path("/etc/yardrover/config.yaml")
MAX_CONFIG_SIZE = 1024 * 1024  # 1MB

# Public API
__all__ = [
    "ConfigManager",
    "Configuration",
    "DEFAULT_CONFIG_PATH"
]

# Implementation
class ConfigManager:
    ...
```

### Class Organization

```python
class ConfigManager:
    """Configuration manager with validation and persistence.

    Manages application configuration with file-based persistence,
    validation using Pydantic models, and event notifications.

    Attributes:
        config: Current configuration object
        config_path: Path to configuration file
        event_bus: Event bus for change notifications
    """

    # Class constants
    DEFAULT_FILENAME = "config.yaml"

    def __init__(
        self,
        config_path: Path,
        event_bus: EventBus
    ) -> None:
        """Initialize configuration manager.

        Args:
            config_path: Path to configuration file
            event_bus: Event bus for notifications
        """
        self.config_path = config_path
        self.event_bus = event_bus
        self._config: Optional[Configuration] = None

    # Public methods
    async def load(self) -> Configuration:
        """Load configuration from file."""
        ...

    async def save(self) -> None:
        """Save configuration to file."""
        ...

    # Properties
    @property
    def config(self) -> Configuration:
        """Get current configuration."""
        if self._config is None:
            raise ConfigurationError("Configuration not loaded")
        return self._config

    # Private methods
    async def _validate_config(self, config: dict) -> Configuration:
        """Validate configuration data."""
        ...
```

---

## Testing

### Test File Naming

```python
# tests/unit/core/test_config.py
# tests/integration/test_api_config.py
# tests/performance/test_storage_latency.py
```

### Test Structure

```python
import pytest
from yardrover.core.config import ConfigManager

class TestConfigManager:
    """Tests for ConfigManager class"""

    @pytest.fixture
    async def config_manager(self, tmp_path, event_bus):
        """Create config manager for testing"""
        config_path = tmp_path / "config.yaml"
        return ConfigManager(config_path, event_bus)

    async def test_load_default_config(self, config_manager):
        """Test loading default configuration"""
        config = await config_manager.load()
        assert config.device.name == "YardRover"

    async def test_save_config(self, config_manager):
        """Test saving configuration to file"""
        config = await config_manager.load()
        config.device.name = "TestDevice"
        await config_manager.save()

        # Verify saved
        new_manager = ConfigManager(config_manager.config_path, event_bus)
        loaded_config = await new_manager.load()
        assert loaded_config.device.name == "TestDevice"

    @pytest.mark.parametrize("invalid_name", ["", " ", "a" * 256])
    async def test_invalid_device_name(self, config_manager, invalid_name):
        """Test validation of invalid device names"""
        with pytest.raises(ValidationError):
            config = await config_manager.load()
            config.device.name = invalid_name
            await config_manager.save()
```

### Async Test Fixtures

```python
import pytest
import asyncio

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def storage(tmp_path):
    """Create temporary storage for testing"""
    storage = Storage(base_path=tmp_path)
    await storage.initialize()
    yield storage
    await storage.cleanup()

@pytest.fixture
async def mock_mavlink():
    """Create mock MAVLink processor"""
    processor = MockMAVLinkProcessor()
    await processor.start()
    yield processor
    await processor.stop()
```

---

## Documentation

### Docstring Style (Google Style)

```python
async def process_mavlink_message(
    message: MAVLinkMessage,
    filters: Optional[List[int]] = None
) -> ProcessResult:
    """Process incoming MAVLink message.

    Processes a MAVLink message, optionally filtering by message ID,
    and routes it to appropriate handlers.

    Args:
        message: MAVLink message to process
        filters: Optional list of message IDs to accept (None = accept all)

    Returns:
        ProcessResult containing processing status and any generated events

    Raises:
        MAVLinkError: If message parsing fails
        ValueError: If message ID is invalid

    Example:
        >>> result = await process_mavlink_message(msg, filters=[0, 1])
        >>> print(result.status)
        'success'
    """
    ...
```

### Type Stubs

```python
# For third-party libraries without type hints
# stubs/some_library.pyi
from typing import Any, Optional

class SomeClass:
    def __init__(self, param: str) -> None: ...
    def method(self, value: int) -> Optional[str]: ...
```

---

## FastAPI Patterns

### Route Definition

```python
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated

router = APIRouter(prefix="/api/zones", tags=["zones"])

# Dependency injection
ConfigDep = Annotated[ConfigManager, Depends(get_config)]
StorageDep = Annotated[Storage, Depends(get_storage)]

@router.get("/", response_model=ZoneListResponse)
async def list_zones(
    since: Optional[int] = None,
    storage: StorageDep = None
) -> ZoneListResponse:
    """List all zones with optional incremental sync.

    Args:
        since: Timestamp for incremental sync (microseconds since epoch)
        storage: Storage dependency (injected)

    Returns:
        ZoneListResponse with zones and deleted IDs
    """
    zones = await storage.get_zones(since=since)
    deleted = await storage.get_deleted_zone_ids(since=since)

    return ZoneListResponse(
        zones=zones,
        deleted=deleted,
        version=int(time.time() * 1_000_000),
        count=len(zones)
    )

@router.post("/", status_code=status.HTTP_202_ACCEPTED)
async def create_zone(
    zone: Zone,
    storage: StorageDep = None
) -> ZoneOperationResponse:
    """Create a new zone."""
    await storage.create_zone(zone)
    return ZoneOperationResponse(id=zone.id, status="queued")
```

### WebSocket Pattern

```python
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time events"""
    await websocket.accept()

    # Subscribe to events
    async def send_event(event: str, data: dict) -> None:
        await websocket.send_json({"type": event, "payload": data})

    event_bus.subscribe("*", send_event)

    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_json()
            await handle_client_message(data)
    except WebSocketDisconnect:
        logger.info("websocket_disconnected")
    finally:
        event_bus.unsubscribe("*", send_event)
```

---

## Code Quality Tools

### Pyright Configuration (pyproject.toml)

```toml
[tool.pyright]
pythonVersion = "3.11"
typeCheckingMode = "strict"
reportMissingTypeStubs = false
reportUnknownMemberType = false
reportUnknownVariableType = false
reportUnknownArgumentType = false
```

### Ruff Configuration

```toml
[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
]
ignore = [
    "E501",  # line too long (handled by black)
]
```

### Black Configuration

```toml
[tool.black]
line-length = 100
target-version = ['py311']
include = '\.pyi?$'
```

---

## Performance Best Practices

### Async Batching

```python
async def process_messages_batch(messages: List[MAVLinkMessage]) -> None:
    """Process multiple messages efficiently"""
    tasks = [process_message(msg) for msg in messages]
    await asyncio.gather(*tasks, return_exceptions=True)
```

### Caching

```python
from functools import lru_cache
from cachetools import TTLCache

# Sync caching
@lru_cache(maxsize=128)
def parse_message_id(msg_id: int) -> str:
    return MESSAGE_ID_MAP.get(msg_id, f"UNKNOWN_{msg_id}")

# Async caching with TTL
cache: TTLCache = TTLCache(maxsize=100, ttl=300)  # 5 minutes

async def get_cached_data(key: str) -> Optional[dict]:
    if key in cache:
        return cache[key]

    data = await fetch_data(key)
    cache[key] = data
    return data
```

### Connection Pooling

```python
from contextlib import asynccontextmanager

class SerialConnectionPool:
    """Pool of serial connections"""

    def __init__(self, port: str, pool_size: int = 5):
        self.port = port
        self.pool_size = pool_size
        self._pool: asyncio.Queue = asyncio.Queue(pool_size)

    @asynccontextmanager
    async def acquire(self):
        """Acquire connection from pool"""
        conn = await self._pool.get()
        try:
            yield conn
        finally:
            await self._pool.put(conn)
```

---

## Summary Checklist

- [ ] All functions have type hints
- [ ] All public APIs have docstrings
- [ ] snake_case for variables/functions, PascalCase for classes
- [ ] async/await for all I/O operations
- [ ] Pydantic models for data validation
- [ ] Structured logging with context
- [ ] Exception handling with specific exceptions
- [ ] Tests written alongside code
- [ ] Code passes pyright strict mode
- [ ] Code formatted with black and ruff
