"""Pydantic models for health and system monitoring."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DeviceInfo(BaseModel):
    """Device information."""

    hostname: str
    name: str
    chip_model: str = Field(alias="chipModel")
    chip_revision: int = Field(alias="chipRevision")
    flash_size: int = Field(alias="flashSize")
    sdk_version: str = Field(alias="sdkVersion")
    core_count: int = Field(alias="coreCount")

    model_config = {"populate_by_name": True}


class NetworkInfo(BaseModel):
    """Network information."""

    ip_address: str = Field(alias="ipAddress")
    mac_address: str = Field(alias="macAddress")
    ssid: Optional[str] = None
    rssi: Optional[int] = None
    connected: bool

    model_config = {"populate_by_name": True}


class SystemMetrics(BaseModel):
    """System metrics."""

    cpu_usage: float = Field(alias="cpuUsage", ge=0, le=100)
    memory_used: int = Field(alias="memoryUsed", ge=0)
    memory_total: int = Field(alias="memoryTotal", ge=0)
    memory_percent: float = Field(alias="memoryPercent", ge=0, le=100)
    disk_used: int = Field(alias="diskUsed", ge=0)
    disk_total: int = Field(alias="diskTotal", ge=0)
    disk_percent: float = Field(alias="diskPercent", ge=0, le=100)
    temperature: Optional[float] = None  # CPU temperature in Celsius

    model_config = {"populate_by_name": True}


class StorageHealth(BaseModel):
    """Storage health status."""

    healthy: bool
    total_size: int = Field(alias="totalSize", ge=0)
    available_size: int = Field(alias="availableSize", ge=0)
    error: Optional[str] = None

    model_config = {"populate_by_name": True}


class MAVLinkHealth(BaseModel):
    """MAVLink connection health status."""

    healthy: bool
    connected: bool
    messages_received: int = Field(alias="messagesReceived", ge=0)
    messages_sent: int = Field(alias="messagesSent", ge=0)
    last_message_time: Optional[datetime] = Field(alias="lastMessageTime", default=None)
    error: Optional[str] = None

    model_config = {"populate_by_name": True}


class HealthResponse(BaseModel):
    """Complete health check response.

    Matches the OpenAPI spec health endpoint response.
    """

    status: str  # 'healthy', 'degraded', 'unhealthy'
    version: str = "2.0.0"  # API version
    uptime: int  # Uptime in seconds
    free_heap: int = Field(alias="freeHeap", ge=0)  # Available memory in bytes
    device: DeviceInfo
    network: NetworkInfo
    system: SystemMetrics
    storage: Optional[StorageHealth] = None
    mavlink: Optional[MAVLinkHealth] = None
    timestamp: datetime = Field(default_factory=datetime.now)

    model_config = {"populate_by_name": True}
