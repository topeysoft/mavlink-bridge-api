"""RTCM message models and configuration.

This module defines Pydantic models for RTCM3 protocol messages, NTRIP client configuration,
and RTCM output routing. Based on C++ implementation in lib/rtcm/.

RTCM3 (Radio Technical Commission for Maritime Services) is a standard for transmitting
differential GPS corrections for high-precision positioning (RTK - Real-Time Kinematic).
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Enums
# ============================================================================

class RTCMState(str, Enum):
    """RTCM client connection state."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


class OutputFormat(str, Enum):
    """RTCM data output format."""
    RAW = "raw"  # Raw RTCM bytes
    MAVLINK = "mavlink"  # Wrapped in MAVLink GPS_RTCM_DATA messages


class TransportType(str, Enum):
    """RTCM data transport type."""
    SERIAL = "serial"
    TCP = "tcp"
    UDP = "udp"


# ============================================================================
# RTCM Message Models
# ============================================================================

class RTCMMessage(BaseModel):
    """Parsed RTCM3 message."""
    message_type: int = Field(..., ge=0, le=4095, description="RTCM message type (12 bits)")
    station_id: Optional[int] = Field(None, ge=0, le=4095, description="Reference station ID")
    timestamp: Optional[int] = Field(None, description="GPS epoch time (milliseconds)")
    payload: bytes = Field(..., description="Message payload (after header)")
    payload_length: int = Field(..., ge=0, description="Payload length in bytes")
    total_length: int = Field(..., ge=6, description="Total message length including header and CRC")

    class Config:
        arbitrary_types_allowed = True


class RTCMMessageInfo(BaseModel):
    """RTCM message metadata for events and logging."""
    message_type: int = Field(..., description="RTCM message type")
    message_name: str = Field(..., description="Human-readable message type name")
    station_id: Optional[int] = Field(None, description="Reference station ID")
    length: int = Field(..., ge=6, description="Total message length in bytes")
    timestamp: Optional[int] = Field(None, description="GPS epoch time")


# ============================================================================
# NTRIP Configuration
# ============================================================================

class NTRIPPosition(BaseModel):
    """GPS position for VRS (Virtual Reference Station) NTRIP."""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in degrees")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in degrees")
    altitude: float = Field(0.0, description="Altitude in meters (MSL)")


class NTRIPConfig(BaseModel):
    """NTRIP caster connection configuration."""
    type: Literal["ntrip"] = "ntrip"
    host: str = Field(..., min_length=1, max_length=255, description="NTRIP caster hostname or IP")
    port: int = Field(2101, ge=1, le=65535, description="NTRIP caster port")
    mountpoint: str = Field(..., min_length=1, max_length=64, description="NTRIP mountpoint name")
    username: Optional[str] = Field(None, max_length=64, description="NTRIP username")
    password: Optional[str] = Field(None, max_length=64, description="NTRIP password")
    send_position: bool = Field(False, description="Send NMEA GGA position for VRS")
    position: Optional[NTRIPPosition] = Field(None, description="Position for VRS")
    user_agent: str = Field("YardRover-Python/1.0", max_length=128, description="HTTP User-Agent")
    gga_interval: int = Field(10000, ge=1000, description="GGA send interval in milliseconds")


# ============================================================================
# TCP/UDP Source Configuration
# ============================================================================

class TCPSourceConfig(BaseModel):
    """TCP RTCM source configuration."""
    type: Literal["tcp"] = "tcp"
    host: str = Field(..., min_length=1, max_length=255, description="TCP server hostname or IP")
    port: int = Field(..., ge=1, le=65535, description="TCP server port")


class UDPSourceConfig(BaseModel):
    """UDP RTCM source configuration."""
    type: Literal["udp"] = "udp"
    port: int = Field(..., ge=1, le=65535, description="Local UDP port to listen on")
    remote_host: Optional[str] = Field(None, max_length=255, description="Remote host for sending")
    remote_port: Optional[int] = Field(None, ge=1, le=65535, description="Remote port for sending")


# Union type for all source configurations
RTCMSourceConfig = Union[NTRIPConfig, TCPSourceConfig, UDPSourceConfig]


# ============================================================================
# Output Router Configuration
# ============================================================================

class SerialOutputConfig(BaseModel):
    """Serial RTCM output configuration."""
    type: Literal["serial"] = "serial"
    port: str = Field(..., description="Serial port path (e.g., /dev/ttyS0)")
    baudrate: int = Field(115200, description="Serial baud rate")


class TCPOutputConfig(BaseModel):
    """TCP RTCM output configuration."""
    type: Literal["tcp"] = "tcp"
    host: str = Field(..., description="TCP destination host")
    port: int = Field(..., ge=1, le=65535, description="TCP destination port")


class UDPOutputConfig(BaseModel):
    """UDP RTCM output configuration."""
    type: Literal["udp"] = "udp"
    host: str = Field(..., description="UDP destination host")
    port: int = Field(..., ge=1, le=65535, description="UDP destination port")


RTCMOutputConfig = Union[SerialOutputConfig, TCPOutputConfig, UDPOutputConfig]


class RTCMOutputTarget(BaseModel):
    """RTCM output routing target."""
    name: str = Field(..., min_length=1, max_length=64, description="Target name")
    enabled: bool = Field(True, description="Whether target is enabled")
    format: OutputFormat = Field(OutputFormat.RAW, description="Output data format")
    transport: RTCMOutputConfig = Field(..., description="Transport configuration")


# ============================================================================
# RTCM Client Configuration
# ============================================================================

class RTCMClientConfig(BaseModel):
    """Complete RTCM client configuration."""
    enabled: bool = Field(False, description="Whether RTCM client is enabled")
    source: RTCMSourceConfig = Field(..., description="RTCM data source configuration")
    output_format: OutputFormat = Field(OutputFormat.RAW, description="Default output format")
    outputs: list[RTCMOutputTarget] = Field(default_factory=list, description="Output routing targets")

    @field_validator("outputs")
    @classmethod
    def validate_outputs(cls, v: list[RTCMOutputTarget]) -> list[RTCMOutputTarget]:
        """Validate output target names are unique."""
        names = [target.name for target in v]
        if len(names) != len(set(names)):
            raise ValueError("Output target names must be unique")
        return v


# ============================================================================
# Statistics and Status
# ============================================================================

class RTCMStatistics(BaseModel):
    """RTCM client statistics."""
    messages_received: int = Field(0, ge=0, description="Total messages received")
    bytes_received: int = Field(0, ge=0, description="Total bytes received")
    crc_errors: int = Field(0, ge=0, description="CRC validation errors")
    data_rate: float = Field(0.0, ge=0, description="Current data rate (KB/s)")
    last_message_time: Optional[int] = Field(None, description="Last message timestamp (ms)")
    message_type_counts: Dict[int, int] = Field(default_factory=dict, description="Message type counts")
    connection_time: Optional[int] = Field(None, description="Connection duration (ms)")
    messages_sent: int = Field(0, ge=0, description="Messages routed to outputs")
    bytes_sent: int = Field(0, ge=0, description="Bytes sent to outputs")
    routing_errors: int = Field(0, ge=0, description="Output routing errors")


class RTCMStatus(BaseModel):
    """RTCM client status."""
    running: bool = Field(..., description="Whether RTCM client is running")
    state: RTCMState = Field(..., description="Connection state")
    client_type: str = Field(..., description="Client type (NTRIP/TCP/UDP)")
    connected: bool = Field(..., description="Whether connected to source")
    uptime: int = Field(0, ge=0, description="Uptime in seconds")
    statistics: RTCMStatistics = Field(..., description="Client statistics")
    last_error: Optional[str] = Field(None, description="Last error message")


# ============================================================================
# API Request/Response Models
# ============================================================================

class RTCMStartRequest(BaseModel):
    """Request to start RTCM client."""
    config: RTCMClientConfig = Field(..., description="RTCM client configuration")


class RTCMStartResponse(BaseModel):
    """Response from starting RTCM client."""
    success: bool = Field(..., description="Whether start was successful")
    message: str = Field(..., description="Status message")
    state: RTCMState = Field(..., description="Current state")


class RTCMStopResponse(BaseModel):
    """Response from stopping RTCM client."""
    success: bool = Field(..., description="Whether stop was successful")
    message: str = Field(..., description="Status message")


class RTCMAddOutputRequest(BaseModel):
    """Request to add output routing target."""
    target: RTCMOutputTarget = Field(..., description="Output target configuration")


class RTCMAddOutputResponse(BaseModel):
    """Response from adding output target."""
    success: bool = Field(..., description="Whether add was successful")
    message: str = Field(..., description="Status message")
    target_index: Optional[int] = Field(None, description="Index of added target")


class RTCMRemoveOutputRequest(BaseModel):
    """Request to remove output routing target."""
    name: str = Field(..., description="Target name to remove")


class RTCMRemoveOutputResponse(BaseModel):
    """Response from removing output target."""
    success: bool = Field(..., description="Whether remove was successful")
    message: str = Field(..., description="Status message")


class RTCMSetOutputEnabledRequest(BaseModel):
    """Request to enable/disable output target."""
    enabled: bool = Field(..., description="Whether to enable or disable")


class RTCMSetOutputEnabledResponse(BaseModel):
    """Response from setting output enabled state."""
    success: bool = Field(..., description="Whether operation was successful")
    message: str = Field(..., description="Status message")


class RTCMToggleOutputsRequest(BaseModel):
    """Request to toggle outputs on/off."""
    names: list[str] = Field(..., description="List of target names to toggle")
    enabled: bool = Field(..., description="Whether to enable or disable")


class RTCMToggleOutputsResponse(BaseModel):
    """Response from toggling outputs."""
    success: bool = Field(..., description="Whether operation was successful")
    message: str = Field(..., description="Status message")
    toggled: list[str] = Field(default_factory=list, description="Names of successfully toggled targets")
    failed: list[str] = Field(default_factory=list, description="Names of targets that failed to toggle")


# ============================================================================
# WebSocket Event Models
# ============================================================================

class RTCMDataEvent(BaseModel):
    """WebSocket event for RTCM message received."""
    type: Literal["rtcm.data"] = "rtcm.data"
    message_type: int = Field(..., description="RTCM message type")
    message_name: str = Field(..., description="Message type name")
    length: int = Field(..., description="Message length")
    station_id: Optional[int] = Field(None, description="Station ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")


class RTCMStateChangeEvent(BaseModel):
    """WebSocket event for RTCM state change."""
    type: Literal["rtcm.state"] = "rtcm.state"
    state: RTCMState = Field(..., description="New state")
    state_name: str = Field(..., description="State name")
    message: Optional[str] = Field(None, description="State change message")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")


class RTCMErrorEvent(BaseModel):
    """WebSocket event for RTCM error."""
    type: Literal["rtcm.error"] = "rtcm.error"
    error: str = Field(..., description="Error message")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")


# ============================================================================
# Helper Functions
# ============================================================================

def get_message_type_name(message_type: int) -> str:
    """Get human-readable name for RTCM message type.

    Args:
        message_type: RTCM message type (0-4095)

    Returns:
        Human-readable message type name
    """
    # GPS messages
    message_names = {
        1001: "GPS L1-Only RTK",
        1002: "GPS Extended L1-Only RTK",
        1003: "GPS L1&L2 RTK",
        1004: "GPS Extended L1&L2 RTK",
        1005: "Station ARP",
        1006: "Station ARP with Height",
        1007: "Antenna Descriptor",
        1008: "Antenna Descriptor & Serial",
        # GLONASS messages
        1009: "GLONASS L1-Only RTK",
        1010: "GLONASS Extended L1-Only RTK",
        1011: "GLONASS L1&L2 RTK",
        1012: "GLONASS Extended L1&L2 RTK",
        # GPS MSM
        1071: "GPS MSM1", 1072: "GPS MSM2", 1073: "GPS MSM3",
        1074: "GPS MSM4", 1075: "GPS MSM5", 1076: "GPS MSM6", 1077: "GPS MSM7",
        # GLONASS MSM
        1081: "GLONASS MSM1", 1082: "GLONASS MSM2", 1083: "GLONASS MSM3",
        1084: "GLONASS MSM4", 1085: "GLONASS MSM5", 1086: "GLONASS MSM6", 1087: "GLONASS MSM7",
        # Galileo MSM
        1091: "Galileo MSM1", 1092: "Galileo MSM2", 1093: "Galileo MSM3",
        1094: "Galileo MSM4", 1095: "Galileo MSM5", 1096: "Galileo MSM6", 1097: "Galileo MSM7",
        # SBAS MSM
        1101: "SBAS MSM1", 1102: "SBAS MSM2", 1103: "SBAS MSM3",
        1104: "SBAS MSM4", 1105: "SBAS MSM5", 1106: "SBAS MSM6", 1107: "SBAS MSM7",
        # QZSS MSM
        1111: "QZSS MSM1", 1112: "QZSS MSM2", 1113: "QZSS MSM3",
        1114: "QZSS MSM4", 1115: "QZSS MSM5", 1116: "QZSS MSM6", 1117: "QZSS MSM7",
        # BeiDou MSM
        1121: "BDS MSM1", 1122: "BDS MSM2", 1123: "BDS MSM3",
        1124: "BDS MSM4", 1125: "BDS MSM5", 1126: "BDS MSM6", 1127: "BDS MSM7",
        # Other
        1230: "GLONASS Code-Phase Biases",
    }
    return message_names.get(message_type, f"Unknown ({message_type})")


def get_message_description(message_type: int) -> str:
    """Get detailed description for RTCM message type.

    Args:
        message_type: RTCM message type (0-4095)

    Returns:
        Detailed message description
    """
    # MSM level descriptions
    if 1071 <= message_type <= 1127:
        msm_level = ((message_type - 1071) % 10) + 1
        msm_descriptions = {
            1: "Compact pseudoranges",
            2: "Compact pseudoranges and phaseranges",
            3: "Compact pseudoranges and carrier phases",
            4: "Full pseudoranges and carrier phases plus CNR",
            5: "Full pseudoranges, carrier phases, Doppler and CNR",
            6: "Full pseudoranges and carrier phases plus CNR (high resolution)",
            7: "Full pseudoranges, carrier phases, Doppler and CNR (high resolution)",
        }
        return msm_descriptions.get(msm_level, "")

    # Specific message descriptions
    descriptions = {
        1005: "Stationary RTK reference station ARP",
        1006: "Stationary RTK reference station ARP with antenna height",
        1007: "Antenna descriptor",
        1008: "Antenna descriptor & serial number",
        1230: "GLONASS L1 and L2 Code-Phase biases",
    }
    return descriptions.get(message_type, "")


def is_position_message(message_type: int) -> bool:
    """Check if message type is a position message."""
    return message_type in (1005, 1006)


def is_msm_message(message_type: int) -> bool:
    """Check if message type is a Multi-Signal Message (MSM)."""
    return 1071 <= message_type <= 1127


def is_observation_message(message_type: int) -> bool:
    """Check if message type is an observation message."""
    return (
        (1001 <= message_type <= 1004) or
        (1009 <= message_type <= 1012) or
        is_msm_message(message_type)
    )
