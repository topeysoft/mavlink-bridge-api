"""WebSocket message models.

This module defines the message types and payloads for WebSocket communication.
Matches the C++ implementation's WebSocket message format.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional, Union

from pydantic import BaseModel, Field, field_validator


class MessageType(str, Enum):
    """WebSocket message types.

    Note: Uses dot notation for event names (e.g., 'wifi.connected', 'health.update')
    for better readability and consistency with web standards.
    """

    # System events
    HEARTBEAT = "heartbeat"
    HEALTH_UPDATE = "health.update"
    CONFIG_CHANGED = "config.changed"
    ERROR = "error"
    STATUS = "status"
    LOG = "log"
    MEMORY_EVENT = "memory.event"
    TASK_EVENT = "task.event"

    # Network events - WiFi
    WIFI_STATUS_CHANGED = "wifi.status.changed"
    WIFI_SCAN_RESULT = "wifi.scan.result"
    WIFI_CONNECTING = "wifi.connecting"
    WIFI_CONNECTED = "wifi.connected"
    WIFI_DISCONNECTED = "wifi.disconnected"
    WIFI_SIGNAL_UPDATE = "wifi.signal.update"
    WIFI_AP_MODE_STARTED = "wifi.ap.mode.started"
    WIFI_AP_MODE_STOPPED = "wifi.ap.mode.stopped"
    WIFI_SCAN_COMPLETED = "wifi.scan.completed"

    # Network events - mDNS
    MDNS_SERVICE_DISCOVERED = "mdns.service.discovered"

    # Communication events
    USB_CONNECTED = "usb.connected"
    USB_DISCONNECTED = "usb.disconnected"
    UART_CONNECTED = "uart.connected"
    UART_DISCONNECTED = "uart.disconnected"
    INTERFACE_SWITCHED = "interface.switched"
    COMMUNICATION_STATS = "communication.stats"

    # MAVLink events
    MAVLINK_MESSAGE = "mavlink.message"
    MAVLINK_HEARTBEAT = "mavlink.heartbeat"
    TELEMETRY_UPDATE = "telemetry.update"
    FLIGHT_MODE_CHANGED = "flight.mode.changed"

    # Resource events
    ZONE_CREATED = "zone.created"
    ZONE_UPDATED = "zone.updated"
    ZONE_DELETED = "zone.deleted"
    MISSION_CREATED = "mission.created"
    MISSION_UPDATED = "mission.updated"
    MISSION_DELETED = "mission.deleted"
    RESOURCE_SYNCED = "resource.synced"

    # RTCM events
    RTCM_STATUS_CHANGED = "rtcm.status.changed"
    RTCM_DATA = "rtcm.data"
    RTCM_DATA_RECEIVED = "rtcm.data.received"
    RTCM_STATE_CHANGE = "rtcm.state.change"

    # Mission protocol events
    MISSION_CURRENT = "mission.current"
    MISSION_ITEM_REACHED = "mission.item.reached"
    MISSION_ACK = "mission.ack"
    MISSION_COUNT = "mission.count"
    MISSION_PROGRESS = "mission.progress"

    # Task execution events
    TASK_CREATED = "task.created"
    TASK_UPDATED = "task.updated"
    TASK_DELETED = "task.deleted"
    TASK_EXECUTION_STARTED = "task.execution.started"
    TASK_EXECUTION_PROGRESS = "task.execution.progress"
    TASK_EXECUTION_PAUSED = "task.execution.paused"
    TASK_EXECUTION_RESUMED = "task.execution.resumed"
    TASK_EXECUTION_COMPLETED = "task.execution.completed"
    TASK_EXECUTION_FAILED = "task.execution.failed"
    TASK_EXECUTION_CANCELLED = "task.execution.cancelled"

    # Peripheral events
    PERIPHERAL_CONNECTED = "peripheral.connected"
    PERIPHERAL_DISCONNECTED = "peripheral.disconnected"
    PERIPHERAL_STATUS_CHANGED = "peripheral.status.changed"
    PERIPHERAL_TELEMETRY = "peripheral.telemetry"
    PERIPHERAL_ERROR = "peripheral.error"
    PERIPHERAL_ENABLED = "peripheral.enabled"
    PERIPHERAL_DISABLED = "peripheral.disabled"
    PERIPHERAL_COMMAND_SENT = "peripheral.command.sent"
    PERIPHERAL_COMMAND_RESPONSE = "peripheral.command.response"

    # Client commands
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    PING = "ping"
    PONG = "pong"


class WebSocketMessage(BaseModel):
    """Base WebSocket message structure."""

    type: MessageType = Field(..., description="Message type identifier")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Message timestamp in UTC"
    )
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Message payload data"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class SubscribeMessage(BaseModel):
    """Client subscription request."""

    topics: list[str] = Field(
        ...,
        description="List of event topics to subscribe to (supports wildcards)"
    )

    @field_validator("topics")
    @classmethod
    def validate_topics(cls, v: list[str]) -> list[str]:
        """Validate topic patterns."""
        if not v:
            raise ValueError("At least one topic must be specified")
        return v


class UnsubscribeMessage(BaseModel):
    """Client unsubscription request."""

    topics: list[str] = Field(
        ...,
        description="List of event topics to unsubscribe from"
    )


class HeartbeatMessage(BaseModel):
    """Heartbeat message for connection keepalive."""

    sequence: int = Field(..., description="Heartbeat sequence number")
    uptime: float = Field(..., description="System uptime in seconds")


class ErrorMessage(BaseModel):
    """Error notification message."""

    code: str = Field(..., description="Error code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional error details"
    )


class HealthUpdateMessage(BaseModel):
    """Health status update message."""

    status: str = Field(..., description="Overall health status")
    cpu_percent: float = Field(..., description="CPU usage percentage")
    memory_percent: float = Field(..., description="Memory usage percentage")
    temperature: Optional[float] = Field(
        default=None,
        description="CPU temperature in Celsius"
    )


class WiFiStatusMessage(BaseModel):
    """WiFi status change notification."""

    connected: bool = Field(..., description="WiFi connection status")
    ssid: Optional[str] = Field(default=None, description="Connected SSID")
    signal_strength: Optional[int] = Field(
        default=None,
        description="Signal strength (0-100)"
    )
    ip_address: Optional[str] = Field(
        default=None,
        description="IP address if connected"
    )


class MAVLinkMessageData(BaseModel):
    """MAVLink message data payload."""

    message_id: int = Field(..., description="MAVLink message ID")
    message_name: str = Field(..., description="MAVLink message name")
    system_id: int = Field(..., description="Source system ID")
    component_id: int = Field(..., description="Source component ID")
    payload: Dict[str, Any] = Field(..., description="Message payload fields")


class TelemetryUpdateMessage(BaseModel):
    """Telemetry data update."""

    latitude: Optional[float] = Field(default=None, description="Latitude")
    longitude: Optional[float] = Field(default=None, description="Longitude")
    altitude: Optional[float] = Field(default=None, description="Altitude MSL (m)")
    heading: Optional[float] = Field(default=None, description="Heading (degrees)")
    speed: Optional[float] = Field(default=None, description="Ground speed (m/s)")
    battery_voltage: Optional[float] = Field(
        default=None,
        description="Battery voltage (V)"
    )
    battery_remaining: Optional[int] = Field(
        default=None,
        description="Battery remaining (%)"
    )


class ResourceEventMessage(BaseModel):
    """Resource change notification (zones/missions)."""

    resource_type: str = Field(..., description="Resource type (zone/mission)")
    resource_id: str = Field(..., description="Resource UUID")
    action: str = Field(..., description="Action (created/updated/deleted)")
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Resource data (omitted for delete)"
    )


class PeripheralEventMessage(BaseModel):
    """Peripheral event notification (connection, status change, etc.)."""

    peripheral_id: str = Field(..., description="Peripheral identifier")
    peripheral_type: str = Field(..., description="Peripheral type")
    event: str = Field(..., description="Event type (connected/disconnected/etc.)")
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Event-specific data"
    )


class PeripheralTelemetryMessage(BaseModel):
    """Peripheral telemetry data update."""

    peripheral_id: str = Field(..., description="Peripheral identifier")
    peripheral_type: str = Field(..., description="Peripheral type")
    telemetry: Dict[str, Any] = Field(..., description="Telemetry data")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Telemetry timestamp"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ConnectionInfo(BaseModel):
    """WebSocket connection information."""

    connection_id: str = Field(..., description="Unique connection identifier")
    connected_at: datetime = Field(..., description="Connection timestamp")
    remote_address: str = Field(..., description="Client IP address")
    subscriptions: list[str] = Field(
        default_factory=list,
        description="Active topic subscriptions"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class WebSocketStats(BaseModel):
    """WebSocket server statistics."""

    active_connections: int = Field(..., description="Number of active connections")
    total_connections: int = Field(..., description="Total connections since startup")
    messages_sent: int = Field(..., description="Total messages sent")
    messages_received: int = Field(..., description="Total messages received")
    uptime: float = Field(..., description="WebSocket server uptime in seconds")


# Type alias for all message data types
MessageData = Union[
    SubscribeMessage,
    UnsubscribeMessage,
    HeartbeatMessage,
    ErrorMessage,
    HealthUpdateMessage,
    WiFiStatusMessage,
    MAVLinkMessageData,
    TelemetryUpdateMessage,
    ResourceEventMessage,
    PeripheralEventMessage,
    PeripheralTelemetryMessage,
    Dict[str, Any],
]
