"""MAVLink message and command models.

This module defines Pydantic models for MAVLink commands, parameters, missions,
and statistics that match the API specification.
"""

from datetime import datetime
from enum import IntEnum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ==================== Enums ====================


class MAVFrameEnum(IntEnum):
    """MAVLink coordinate frame types."""

    GLOBAL = 0
    LOCAL_NED = 1
    MISSION = 2
    GLOBAL_RELATIVE_ALT = 3
    LOCAL_ENU = 4
    GLOBAL_INT = 5
    GLOBAL_RELATIVE_ALT_INT = 6
    LOCAL_OFFSET_NED = 7
    BODY_NED = 8
    BODY_OFFSET_NED = 9
    GLOBAL_TERRAIN_ALT = 10
    GLOBAL_TERRAIN_ALT_INT = 11
    BODY_FRD = 12
    LOCAL_FLU = 13
    LOCAL_FRD = 14


class MAVCmdEnum(IntEnum):
    """MAVLink command IDs."""

    # Navigation commands
    NAV_WAYPOINT = 16
    NAV_LOITER_UNLIM = 17
    NAV_LOITER_TURNS = 18
    NAV_LOITER_TIME = 19
    NAV_RETURN_TO_LAUNCH = 20
    NAV_LAND = 21
    NAV_TAKEOFF = 22
    NAV_LAND_LOCAL = 23
    NAV_TAKEOFF_LOCAL = 24
    NAV_FOLLOW = 25
    NAV_CONTINUE_AND_CHANGE_ALT = 30
    NAV_LOITER_TO_ALT = 31

    # Conditional commands
    CONDITION_DELAY = 112
    CONDITION_CHANGE_ALT = 113
    CONDITION_DISTANCE = 114
    CONDITION_YAW = 115

    # Do commands
    DO_SET_MODE = 176
    DO_JUMP = 177
    DO_CHANGE_SPEED = 178
    DO_SET_HOME = 179
    DO_SET_RELAY = 181
    DO_REPEAT_RELAY = 182
    DO_SET_SERVO = 183
    DO_REPEAT_SERVO = 184
    DO_FLIGHTTERMINATION = 185
    DO_CHANGE_ALTITUDE = 186
    DO_LAND_START = 189
    DO_RALLY_LAND = 190
    DO_GO_AROUND = 191
    DO_REPOSITION = 192
    DO_PAUSE_CONTINUE = 193
    DO_SET_REVERSE = 194
    DO_SET_ROI_LOCATION = 195
    DO_SET_ROI_WPNEXT_OFFSET = 196
    DO_SET_ROI_NONE = 197
    DO_SET_ROI_SYSID = 198
    DO_CONTROL_VIDEO = 200
    DO_SET_ROI = 201
    DO_DIGICAM_CONFIGURE = 202
    DO_DIGICAM_CONTROL = 203
    DO_MOUNT_CONFIGURE = 204
    DO_MOUNT_CONTROL = 205
    DO_SET_CAM_TRIGG_DIST = 206
    DO_FENCE_ENABLE = 207
    DO_PARACHUTE = 208
    DO_MOTOR_TEST = 209
    DO_INVERTED_FLIGHT = 210
    DO_GRIPPER = 211
    DO_AUTOTUNE_ENABLE = 212
    DO_SET_CAM_TRIGG_INTERVAL = 214
    DO_MOUNT_CONTROL_QUAT = 220
    DO_GUIDED_MASTER = 221
    DO_GUIDED_LIMITS = 222
    DO_ENGINE_CONTROL = 223
    DO_SET_MISSION_CURRENT = 224
    DO_LAST = 240
    DO_TRIGGER_CONTROL = 2003
    DO_VTOL_TRANSITION = 3000
    DO_ARM_DISARM = 400
    DO_REPEAT_SERVO_USE_CURRENT = 2000

    # Generic commands
    COMPONENT_ARM_DISARM = 400
    GET_HOME_POSITION = 410
    START_RX_PAIR = 500
    GET_MESSAGE_INTERVAL = 510
    SET_MESSAGE_INTERVAL = 511
    REQUEST_MESSAGE = 512
    REQUEST_PROTOCOL_VERSION = 519
    REQUEST_AUTOPILOT_CAPABILITIES = 520
    REQUEST_CAMERA_INFORMATION = 521
    REQUEST_CAMERA_SETTINGS = 522
    REQUEST_STORAGE_INFORMATION = 525
    STORAGE_FORMAT = 526
    REQUEST_CAMERA_CAPTURE_STATUS = 527
    REQUEST_FLIGHT_INFORMATION = 528
    RESET_CAMERA_SETTINGS = 529
    SET_CAMERA_MODE = 530
    SET_CAMERA_ZOOM = 531
    SET_CAMERA_FOCUS = 532
    IMAGE_START_CAPTURE = 2000
    IMAGE_STOP_CAPTURE = 2001
    VIDEO_START_CAPTURE = 2500
    VIDEO_STOP_CAPTURE = 2501
    LOGGING_START = 2510
    LOGGING_STOP = 2511
    AIRFRAME_CONFIGURATION = 2520
    PANORAMA_CREATE = 2800
    DO_VTOL_TRANSITION_MAINT = 3001
    OBLIQUE_SURVEY = 260
    DO_SET_STANDARD_MODE = 262
    CONTROL_HIGH_LATENCY = 2600


class MAVModeFlag(IntEnum):
    """MAVLink mode flags."""

    CUSTOM_MODE_ENABLED = 1
    TEST_ENABLED = 2
    AUTO_ENABLED = 4
    GUIDED_ENABLED = 8
    STABILIZE_ENABLED = 16
    HIL_ENABLED = 32
    MANUAL_INPUT_ENABLED = 64
    SAFETY_ARMED = 128


class MAVMissionType(IntEnum):
    """MAVLink mission types."""

    MISSION = 0
    FENCE = 1
    RALLY = 2
    ALL = 255


class MAVParamType(IntEnum):
    """MAVLink parameter types."""

    UINT8 = 1
    INT8 = 2
    UINT16 = 3
    INT16 = 4
    UINT32 = 5
    INT32 = 6
    UINT64 = 7
    INT64 = 8
    REAL32 = 9
    REAL64 = 10


class FirmwareType(str):
    """Firmware type strings."""

    UNKNOWN = "unknown"
    ARDUPILOT = "ardupilot"
    PX4 = "px4"
    GENERIC = "generic"


# ==================== Message Models ====================


class MAVLinkMessageBase(BaseModel):
    """Base MAVLink message with common fields."""

    magic: int = Field(..., ge=0, le=255, description="Protocol magic marker")
    length: int = Field(..., ge=0, le=255, description="Payload length")
    incompat_flags: int = Field(
        0, ge=0, le=255, description="Incompatibility flags"
    )
    compat_flags: int = Field(0, ge=0, le=255, description="Compatibility flags")
    seq: int = Field(..., ge=0, le=255, description="Packet sequence number")
    sysid: int = Field(..., ge=0, le=255, description="System ID")
    compid: int = Field(..., ge=0, le=255, description="Component ID")
    msgid: int = Field(..., ge=0, description="Message ID")
    payload: bytes = Field(default=b"", description="Message payload")
    checksum: int = Field(..., ge=0, le=65535, description="CRC checksum")
    timestamp: datetime = Field(
        default_factory=datetime.now, description="Message timestamp"
    )

    class Config:
        json_encoders = {
            bytes: lambda v: v.hex(),
            datetime: lambda v: v.isoformat(),
        }


class MAVLinkMessage(MAVLinkMessageBase):
    """Full MAVLink message with validation status."""

    valid: bool = Field(default=True, description="Message validation status")


# ==================== Statistics Models ====================


class MessageFilter(BaseModel):
    """MAVLink message filter configuration."""

    allowed_message_ids: List[int] = Field(
        default_factory=list, description="Allowed message IDs"
    )
    allowed_system_ids: List[int] = Field(
        default_factory=list, description="Allowed system IDs"
    )
    allowed_component_ids: List[int] = Field(
        default_factory=list, description="Allowed component IDs"
    )
    enable_filter: bool = Field(default=False, description="Enable message filtering")


class MAVLinkStatistics(BaseModel):
    """MAVLink processor statistics."""

    total_messages: int = Field(default=0, description="Total messages processed")
    valid_messages: int = Field(default=0, description="Valid messages")
    crc_errors: int = Field(default=0, description="CRC validation errors")
    parse_errors: int = Field(default=0, description="Parsing errors")
    sequence_errors: int = Field(default=0, description="Sequence errors")
    message_types: Dict[int, int] = Field(
        default_factory=dict, description="Message type counts"
    )
    last_update: datetime = Field(
        default_factory=datetime.now, description="Last statistics update"
    )
    firmware_type: str = Field(default=FirmwareType.UNKNOWN, description="Detected firmware type")
    heartbeat_count: int = Field(default=0, description="Heartbeat message count")

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class SerialStatistics(BaseModel):
    """Serial communication statistics."""

    bytes_received: int = Field(default=0, description="Total bytes received")
    bytes_sent: int = Field(default=0, description="Total bytes sent")
    packets_received: int = Field(default=0, description="Total packets received")
    packets_sent: int = Field(default=0, description="Total packets sent")
    data_rate: float = Field(default=0.0, description="Current data rate (bytes/sec)")
    last_update: datetime = Field(
        default_factory=datetime.now, description="Last statistics update"
    )
    crc_errors: int = Field(default=0, description="CRC errors")
    framing_errors: int = Field(default=0, description="Framing errors")

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ==================== Command Models ====================


class MAVLinkCommand(BaseModel):
    """Generic MAVLink command request."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    command: int = Field(..., description="MAVLink command ID")
    param1: float = Field(default=0.0, description="Command parameter 1")
    param2: float = Field(default=0.0, description="Command parameter 2")
    param3: float = Field(default=0.0, description="Command parameter 3")
    param4: float = Field(default=0.0, description="Command parameter 4")
    param5: float = Field(default=0.0, description="Command parameter 5")
    param6: float = Field(default=0.0, description="Command parameter 6")
    param7: float = Field(default=0.0, description="Command parameter 7")


class ArmDisarmCommand(BaseModel):
    """Arm/disarm command request."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    arm: bool = Field(..., description="True to arm, False to disarm")
    force: bool = Field(default=False, description="Force arm/disarm")


class SetModeCommand(BaseModel):
    """Set flight mode command request."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    custom_mode: int = Field(..., description="Custom mode value")
    base_mode: int = Field(default=0, description="Base mode flags")


class MAVLinkCommandResponse(BaseModel):
    """MAVLink command response."""

    success: bool = Field(..., description="Command accepted")
    message: str = Field(default="", description="Response message")
    sequence_number: Optional[int] = Field(
        None, description="Command sequence number"
    )


# ==================== Parameter Models ====================


class ParameterRequest(BaseModel):
    """Parameter request by name or index."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    param_id: Optional[str] = Field(
        None, max_length=16, description="Parameter ID (name)"
    )
    param_index: Optional[int] = Field(
        None, ge=-1, description="Parameter index (-1 for by name)"
    )

    @field_validator("param_id", "param_index")
    @classmethod
    def validate_param_identifier(cls, v: Any, info: Any) -> Any:
        """Ensure either param_id or param_index is provided."""
        # This will be properly validated in the router logic
        return v


class ParameterSetRequest(BaseModel):
    """Set parameter value request."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    param_id: str = Field(..., max_length=16, description="Parameter ID")
    param_value: float = Field(..., description="Parameter value")
    param_type: int = Field(..., description="Parameter type (MAVParamType)")


class ParameterListRequest(BaseModel):
    """Request parameter list."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )


class ParameterValue(BaseModel):
    """Parameter value response."""

    param_id: str = Field(..., description="Parameter ID")
    param_value: float = Field(..., description="Parameter value")
    param_type: int = Field(..., description="Parameter type")
    param_count: int = Field(..., description="Total parameter count")
    param_index: int = Field(..., description="Parameter index")


# ==================== Mission Models ====================


class MissionItem(BaseModel):
    """MAVLink mission item (waypoint)."""

    seq: int = Field(..., ge=0, description="Waypoint sequence number")
    frame: int = Field(..., description="Coordinate frame (MAVFrameEnum)")
    command: int = Field(..., description="MAVLink command ID")
    current: int = Field(default=0, ge=0, le=1, description="Current waypoint flag")
    autocontinue: int = Field(default=1, ge=0, le=1, description="Autocontinue flag")
    param1: float = Field(default=0.0, description="Command parameter 1")
    param2: float = Field(default=0.0, description="Command parameter 2")
    param3: float = Field(default=0.0, description="Command parameter 3")
    param4: float = Field(default=0.0, description="Command parameter 4")
    x: float = Field(..., description="Latitude or local X")
    y: float = Field(..., description="Longitude or local Y")
    z: float = Field(..., description="Altitude or local Z")
    mission_type: int = Field(
        default=MAVMissionType.MISSION, description="Mission type"
    )


class MissionUploadRequest(BaseModel):
    """Upload mission to flight controller."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    mission_items: List[MissionItem] = Field(..., description="Mission waypoints")
    mission_type: int = Field(
        default=MAVMissionType.MISSION, description="Mission type"
    )


class MissionDownloadRequest(BaseModel):
    """Download mission from flight controller."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    mission_type: int = Field(
        default=MAVMissionType.MISSION, description="Mission type"
    )


class MissionClearRequest(BaseModel):
    """Clear all missions from flight controller."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    mission_type: int = Field(
        default=MAVMissionType.MISSION, description="Mission type"
    )


class MissionSetCurrentRequest(BaseModel):
    """Set current mission item."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )
    seq: int = Field(..., ge=0, description="Mission item sequence number")


class MissionStatusRequest(BaseModel):
    """Get mission status."""

    target_system: int = Field(..., ge=1, le=255, description="Target system ID")
    target_component: int = Field(
        ..., ge=1, le=255, description="Target component ID"
    )


class MissionResponse(BaseModel):
    """Mission operation response."""

    success: bool = Field(..., description="Operation successful")
    message: str = Field(default="", description="Response message")
    mission_items: Optional[List[MissionItem]] = Field(
        None, description="Downloaded mission items"
    )
    current_seq: Optional[int] = Field(
        None, description="Current mission item sequence"
    )
    total_count: Optional[int] = Field(None, description="Total mission items")


# ==================== Serial Configuration Models ====================


class SerialConfig(BaseModel):
    """Serial port configuration."""

    port: str = Field(..., description="Serial port device path")
    baudrate: int = Field(
        default=57600,
        description="Baud rate",
        examples=[57600, 115200, 230400, 460800, 921600],
    )
    auto_baud: bool = Field(default=False, description="Enable auto-baud detection")
    flow_control: bool = Field(default=False, description="Enable hardware flow control")
    rts_pin: Optional[int] = Field(None, description="RTS GPIO pin (if flow control)")
    cts_pin: Optional[int] = Field(None, description="CTS GPIO pin (if flow control)")


class SerialStatus(BaseModel):
    """Serial port status."""

    connected: bool = Field(..., description="Serial port connected")
    port: str = Field(..., description="Serial port device path")
    baudrate: int = Field(..., description="Current baud rate")
    statistics: SerialStatistics = Field(..., description="Communication statistics")
