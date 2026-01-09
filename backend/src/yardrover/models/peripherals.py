"""Peripheral/Feature data models

Pydantic models for peripheral management including auto-detection,
compatibility validation, and telemetry streaming.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Peripheral Types and Enums
# ============================================================================


class PeripheralType(str, Enum):
    """Peripheral type enumeration"""

    # Mowing and lawn care
    MOWER = "mower"
    GRASS_COLLECTOR = "grass_collector"
    MULCHER = "mulcher"
    EDGER = "edger"
    AERATOR = "aerator"
    SEEDER = "seeder"

    # Snow and winter
    SNOW_BLOWER = "snow_blower"
    SNOW_PLOW = "snow_plow"
    SALT_SPREADER = "salt_spreader"

    # Application and spraying
    SPRAYER = "sprayer"
    FERTILIZER_SPREADER = "fertilizer_spreader"

    # Collection and cleaning
    VACUUM = "vacuum"
    LEAF_BLOWER = "leaf_blower"
    DEBRIS_COLLECTOR = "debris_collector"

    # Monitoring and sensors
    CAMERA = "camera"
    ENVIRONMENTAL_SENSOR = "environmental_sensor"
    SOIL_SENSOR = "soil_sensor"
    LIDAR = "lidar"

    # Utility
    POWER_MODULE = "power_module"
    LIGHTING = "lighting"
    TRAILER_HITCH = "trailer_hitch"

    # Built-in features
    BUILTIN_GPS = "builtin_gps"
    BUILTIN_IMU = "builtin_imu"
    BUILTIN_BATTERY = "builtin_battery"

    # Custom/other
    CUSTOM = "custom"


class PeripheralState(str, Enum):
    """Peripheral connection and operational state"""

    DISCONNECTED = "disconnected"
    CONNECTED = "connected"
    INITIALIZING = "initializing"
    READY = "ready"
    ACTIVE = "active"
    ERROR = "error"
    DISABLED = "disabled"


class PeripheralHealth(str, Enum):
    """Peripheral health status"""

    HEALTHY = "healthy"
    WARNING = "warning"
    ERROR = "error"
    UNKNOWN = "unknown"


# ============================================================================
# Peripheral Capability Models
# ============================================================================


class PeripheralCapability(BaseModel):
    """Peripheral capability definition

    Describes what the peripheral can do and its requirements.
    """

    operations: List[str] = Field(
        default_factory=list,
        description="Supported operations (e.g., 'spray', 'collect', 'sense')",
    )
    power_required: float = Field(
        default=0.0, description="Power consumption in watts", ge=0
    )
    voltage: Optional[float] = Field(
        default=None, description="Required voltage (V)", ge=0
    )
    current_max: Optional[float] = Field(
        default=None, description="Maximum current draw (A)", ge=0
    )
    communication_protocol: str = Field(
        default="i2c", description="Communication protocol (i2c, uart, can, spi)"
    )
    requires_calibration: bool = Field(
        default=False, description="Whether peripheral requires calibration"
    )
    telemetry_rate_hz: float = Field(
        default=1.0, description="Telemetry update rate (Hz)", ge=0, le=100
    )

    class Config:
        json_schema_extra = {
            "example": {
                "operations": ["spray", "dispense"],
                "power_required": 50.0,
                "voltage": 12.0,
                "current_max": 5.0,
                "communication_protocol": "i2c",
                "requires_calibration": True,
                "telemetry_rate_hz": 2.0,
            }
        }


class PeripheralCompatibilityRule(BaseModel):
    """Compatibility rules for peripheral

    Defines which peripherals can/cannot operate together.
    """

    exclusive_with: List[PeripheralType] = Field(
        default_factory=list,
        description="Peripheral types that cannot be used together with this one",
    )
    requires: List[PeripheralType] = Field(
        default_factory=list,
        description="Peripheral types required for this one to operate",
    )
    compatible_with: List[PeripheralType] = Field(
        default_factory=list,
        description="Peripheral types explicitly compatible (can work together)",
    )
    max_concurrent: int = Field(
        default=1, description="Maximum number of this peripheral type that can be active", ge=1
    )

    class Config:
        json_schema_extra = {
            "example": {
                "exclusive_with": ["snow_blower", "snow_plow"],
                "requires": ["power_module"],
                "compatible_with": ["grass_collector", "environmental_sensor"],
                "max_concurrent": 1,
            }
        }


# ============================================================================
# Peripheral Metadata
# ============================================================================


class PeripheralMetadata(BaseModel):
    """Peripheral metadata from device

    Published by peripheral MCU on connection. Includes identification,
    capabilities, and compatibility information.
    """

    peripheral_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique peripheral identifier",
    )
    type: PeripheralType = Field(..., description="Peripheral type")
    name: str = Field(..., description="Human-readable peripheral name")
    manufacturer: str = Field(default="Unknown", description="Manufacturer name")
    model: str = Field(default="Unknown", description="Model number/name")
    firmware_version: str = Field(
        default="0.0.0", description="Firmware version (semver)"
    )
    hardware_version: str = Field(
        default="1.0", description="Hardware revision"
    )
    serial_number: Optional[str] = Field(
        default=None, description="Serial number if available"
    )
    capabilities: PeripheralCapability = Field(
        default_factory=PeripheralCapability,
        description="Peripheral capabilities",
    )
    compatibility: PeripheralCompatibilityRule = Field(
        default_factory=PeripheralCompatibilityRule,
        description="Compatibility rules",
    )
    description: Optional[str] = Field(
        default=None, description="Optional peripheral description"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "peripheral_id": "550e8400-e29b-41d4-a716-446655440000",
                "type": "mower",
                "name": "48-inch Rotary Mower",
                "manufacturer": "YardRover",
                "model": "MR-48",
                "firmware_version": "1.2.3",
                "hardware_version": "2.0",
                "serial_number": "MR48-20240001",
                "capabilities": {
                    "operations": ["mow", "mulch"],
                    "power_required": 500.0,
                    "voltage": 48.0,
                    "current_max": 15.0,
                },
                "compatibility": {
                    "exclusive_with": ["snow_blower"],
                    "compatible_with": ["grass_collector"],
                },
            }
        }


# ============================================================================
# Peripheral Status and Telemetry
# ============================================================================


class PeripheralStatus(BaseModel):
    """Current peripheral status

    Real-time operational status of the peripheral.
    """

    peripheral_id: str = Field(..., description="Peripheral identifier")
    state: PeripheralState = Field(..., description="Connection/operational state")
    health: PeripheralHealth = Field(default=PeripheralHealth.UNKNOWN, description="Health status")
    enabled: bool = Field(default=False, description="Whether peripheral is enabled")
    active: bool = Field(default=False, description="Whether peripheral is actively operating")
    error_message: Optional[str] = Field(
        default=None, description="Error message if in error state"
    )
    warning_message: Optional[str] = Field(
        default=None, description="Warning message if applicable"
    )
    uptime_seconds: float = Field(
        default=0.0, description="Time since peripheral connected (seconds)", ge=0
    )
    operation_hours: float = Field(
        default=0.0, description="Total operation hours", ge=0
    )
    last_seen: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last communication timestamp",
    )

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
        json_schema_extra = {
            "example": {
                "peripheral_id": "550e8400-e29b-41d4-a716-446655440000",
                "state": "active",
                "health": "healthy",
                "enabled": True,
                "active": True,
                "uptime_seconds": 3600.0,
                "operation_hours": 125.5,
                "last_seen": "2024-01-08T12:00:00Z",
            }
        }


class PeripheralTelemetry(BaseModel):
    """Generic peripheral telemetry

    Base telemetry model. Specific peripherals may extend this with
    additional fields in the 'data' dictionary.
    """

    peripheral_id: str = Field(..., description="Peripheral identifier")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Telemetry timestamp"
    )
    data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Type-specific telemetry data",
    )

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
        json_schema_extra = {
            "example": {
                "peripheral_id": "550e8400-e29b-41d4-a716-446655440000",
                "timestamp": "2024-01-08T12:00:00Z",
                "data": {
                    "blade_rpm": 3200,
                    "motor_current": 12.5,
                    "mowing_height": 3.5,
                    "temperature": 45.2,
                },
            }
        }


# ============================================================================
# Peripheral Full Model
# ============================================================================


class Peripheral(BaseModel):
    """Complete peripheral definition

    Combines metadata and current status for a peripheral.
    """

    metadata: PeripheralMetadata = Field(..., description="Peripheral metadata")
    status: PeripheralStatus = Field(..., description="Current status")
    telemetry: Optional[PeripheralTelemetry] = Field(
        default=None, description="Latest telemetry (if available)"
    )
    created: datetime = Field(
        default_factory=datetime.utcnow,
        description="First seen timestamp",
    )
    last_modified: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last status update timestamp",
        alias="lastModified",
    )

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


# ============================================================================
# API Response Models
# ============================================================================


class PeripheralListResponse(BaseModel):
    """Response model for listing peripherals"""

    peripherals: List[Peripheral] = Field(
        default_factory=list, description="List of peripherals"
    )
    count: int = Field(..., description="Number of peripherals", ge=0)
    connected_count: int = Field(
        default=0, description="Number of connected peripherals", ge=0
    )
    active_count: int = Field(
        default=0, description="Number of active peripherals", ge=0
    )

    class Config:
        json_schema_extra = {
            "example": {
                "peripherals": [],
                "count": 2,
                "connected_count": 2,
                "active_count": 1,
            }
        }


class PeripheralOperationResponse(BaseModel):
    """Response model for peripheral operations"""

    peripheral_id: str = Field(..., description="Peripheral identifier")
    status: Literal["success", "queued", "error"] = Field(
        ..., description="Operation status"
    )
    message: Optional[str] = Field(
        default=None, description="Additional message"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "peripheral_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "success",
                "message": "Peripheral enabled successfully",
            }
        }


class PeripheralCommandRequest(BaseModel):
    """Request model for sending commands to peripheral"""

    command: str = Field(..., description="Command name")
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Command parameters"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "command": "set_height",
                "parameters": {"height": 3.5},
            }
        }


class CompatibilityCheckResponse(BaseModel):
    """Response model for compatibility check"""

    compatible: bool = Field(..., description="Whether configuration is compatible")
    conflicts: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of compatibility conflicts",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Compatibility warnings",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "compatible": False,
                "conflicts": [
                    {
                        "peripheral1": "mower",
                        "peripheral2": "snow_blower",
                        "reason": "Exclusive peripherals cannot operate together",
                    }
                ],
                "warnings": ["High power consumption with current configuration"],
            }
        }
