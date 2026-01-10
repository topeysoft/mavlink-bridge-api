"""Resource data models (Zones, Scheduled Missions, etc.)

Pydantic models for resource management including zones and scheduled missions.
Matches the OpenAPI schema definitions in api-spec.yaml.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Resource Types and Results
# ============================================================================


class ResourceType(str, Enum):
    """Resource type enumeration"""

    ZONE = "zone"
    MISSION = "mission"
    USER_SETTINGS = "user_settings"


class ResourceResult(str, Enum):
    """Resource operation result enumeration"""

    SUCCESS = "success"
    NOT_FOUND = "not_found"
    WRITE_FAILED = "write_failed"
    READ_FAILED = "read_failed"
    PARSE_ERROR = "parse_error"
    INVALID_DATA = "invalid_data"
    STORAGE_FULL = "storage_full"
    QUEUE_FULL = "queue_full"
    TIMEOUT = "timeout"


# ============================================================================
# Zone Models
# ============================================================================


class ZoneType(str, Enum):
    """Zone type enumeration"""

    # Core types
    MOWING = "mowing"
    EXCLUSION = "exclusion"
    CHARGING = "charging"

    # Operational types
    PATROL = "patrol"
    SNOW_CLEARING = "snow_clearing"
    STAGING = "staging"

    # Agricultural/maintenance types
    SPRAYING = "spraying"
    WATERING = "watering"
    COLLECTION = "collection"
    MONITORING = "monitoring"


class Zone(BaseModel):
    """Zone definition model

    Represents a geographic zone with coordinates, type, and metadata.
    Zones are used to define areas for mowing, exclusion, or charging.
    """

    id: str = Field(
        default_factory=lambda: str(uuid4()), description="Unique zone identifier (UUID)"
    )
    name: str = Field(..., description="Zone name", min_length=1, max_length=100)
    type: ZoneType = Field(..., description="Zone type")
    coordinates: list[tuple[float, float]] = Field(
        ...,
        description="Array of (longitude, latitude) coordinate pairs",
        min_length=3,  # Minimum polygon
    )
    color: str = Field(
        ...,
        description="Hex color code for zone visualization",
        pattern=r"^#[0-9A-Fa-f]{6}$",
    )
    area: float = Field(..., description="Zone area in square meters", ge=0)
    description: Optional[str] = Field(
        None, description="Optional zone description", max_length=500
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Optional tags for categorization",
        max_length=20,
    )
    created: datetime = Field(
        default_factory=datetime.utcnow, description="Creation timestamp (ISO 8601)"
    )
    last_modified: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last modification timestamp (ISO 8601)",
        alias="lastModified",
    )
    settings: dict[str, Any] = Field(
        default_factory=dict,
        description="Zone-specific settings (e.g., mowing height, pattern)",
    )

    @field_validator("coordinates", mode="before")
    @classmethod
    def validate_coordinates(cls, v: Any) -> list[tuple[float, float]]:
        """Validate and convert coordinates to list of tuples"""
        if isinstance(v, list):
            result = []
            for coord in v:
                if isinstance(coord, (list, tuple)) and len(coord) == 2:
                    result.append((float(coord[0]), float(coord[1])))
                else:
                    raise ValueError(
                        "Each coordinate must be a [longitude, latitude] pair"
                    )
            return result
        raise ValueError("Coordinates must be an array of coordinate pairs")

    class Config:
        """Pydantic configuration"""

        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Front Lawn",
                "type": "mowing",
                "coordinates": [
                    [-122.4194, 37.7749],
                    [-122.4184, 37.7749],
                    [-122.4184, 37.7739],
                    [-122.4194, 37.7739],
                ],
                "color": "#2C5F2D",
                "area": 1000.5,
                "description": "Main front lawn area",
                "tags": ["front", "primary"],
                "settings": {"mowing_height": 3.5, "pattern": "stripe"},
            }
        }


class ZoneMetadata(BaseModel):
    """Zone metadata for incremental sync

    Lightweight metadata used for incremental sync operations.
    Contains only essential information about the zone without full data.
    """

    id: str = Field(..., description="Zone identifier")
    version: int = Field(..., description="Zone version number", ge=0)
    timestamp: int = Field(
        ..., description="Last modification timestamp (microseconds since epoch)", ge=0
    )
    size: int = Field(..., description="Zone data size in bytes", ge=0)

    class Config:
        """Pydantic configuration"""

        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "version": 1,
                "timestamp": 1704722400000000,
                "size": 512,
            }
        }


class ZoneListResponse(BaseModel):
    """Response model for listing zones

    Returns zone metadata and sync information for incremental updates.
    """

    zones: list[ZoneMetadata] = Field(..., description="Array of zone metadata")
    deleted: list[str] = Field(
        default_factory=list,
        description="Array of deleted zone IDs (for incremental sync)",
    )
    version: int = Field(
        ..., description="Current server version timestamp (microseconds)", ge=0
    )
    count: int = Field(..., description="Number of zones returned", ge=0)

    class Config:
        """Pydantic configuration"""

        json_schema_extra = {
            "example": {
                "zones": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "version": 1,
                        "timestamp": 1704722400000000,
                        "size": 512,
                    }
                ],
                "deleted": [],
                "version": 1704722400000000,
                "count": 1,
            }
        }


class ZoneOperationResponse(BaseModel):
    """Response model for zone operations

    Returns the result of zone create/update/delete operations.
    """

    id: str = Field(..., description="Zone identifier")
    status: Literal["queued", "success"] = Field(..., description="Operation status")

    class Config:
        """Pydantic configuration"""

        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "success",
            }
        }


# ============================================================================
# Scheduled Mission Models
# ============================================================================


class MissionType(str, Enum):
    """Mission schedule type enumeration"""

    ONCE = "once"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class MissionPriority(str, Enum):
    """Mission priority enumeration"""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class MissionSchedule(BaseModel):
    """Mission schedule configuration

    Defines when and how often a mission should run.
    """

    start_time: datetime = Field(
        ..., description="Scheduled start time (ISO 8601)", alias="startTime"
    )
    end_time: Optional[datetime] = Field(
        None,
        description="Optional end time for recurring missions",
        alias="endTime",
    )
    days_of_week: list[int] = Field(
        default_factory=list,
        description="Days of week (0=Sunday, 6=Saturday) for weekly missions",
        alias="daysOfWeek",
    )
    day_of_month: Optional[int] = Field(
        None,
        description="Day of month for monthly missions",
        ge=1,
        le=31,
        alias="dayOfMonth",
    )

    @field_validator("days_of_week")
    @classmethod
    def validate_days_of_week(cls, v: list[int]) -> list[int]:
        """Validate days of week are in range 0-6"""
        for day in v:
            if not 0 <= day <= 6:
                raise ValueError("Days of week must be between 0 (Sunday) and 6 (Saturday)")
        return v

    class Config:
        """Pydantic configuration"""

        populate_by_name = True
        json_schema_extra = {
            "example": {
                "startTime": "2024-01-08T10:00:00Z",
                "endTime": "2024-12-31T23:59:59Z",
                "daysOfWeek": [1, 3, 5],  # Monday, Wednesday, Friday
            }
        }


class ScheduledMission(BaseModel):
    """Scheduled mission model

    Represents a mission that runs on a schedule and executes zones in order.
    """

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique mission identifier (UUID)",
    )
    name: str = Field(..., description="Mission name", min_length=1, max_length=100)
    type: MissionType = Field(..., description="Mission schedule type")
    zone_ids: list[str] = Field(
        ...,
        description="Array of zone IDs to execute in order",
        min_length=1,
        alias="zoneIds",
    )
    schedule: MissionSchedule = Field(..., description="Mission schedule configuration")
    priority: MissionPriority = Field(
        default=MissionPriority.NORMAL, description="Mission priority"
    )
    enabled: bool = Field(default=True, description="Whether mission is enabled")
    created: datetime = Field(
        default_factory=datetime.utcnow, description="Creation timestamp (ISO 8601)"
    )
    last_modified: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last modification timestamp (ISO 8601)",
        alias="lastModified",
    )
    last_run: Optional[datetime] = Field(
        None, description="Last execution timestamp (ISO 8601)", alias="lastRun"
    )
    next_run: Optional[datetime] = Field(
        None, description="Next scheduled execution (ISO 8601)", alias="nextRun"
    )

    class Config:
        """Pydantic configuration"""

        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": "660e8400-e29b-41d4-a716-446655440001",
                "name": "Weekly Lawn Mowing",
                "type": "weekly",
                "zoneIds": [
                    "550e8400-e29b-41d4-a716-446655440000",
                    "550e8400-e29b-41d4-a716-446655440002",
                ],
                "schedule": {
                    "startTime": "2024-01-08T10:00:00Z",
                    "daysOfWeek": [1, 3, 5],
                },
                "priority": "normal",
                "enabled": True,
            }
        }


class MissionMetadata(BaseModel):
    """Mission metadata for incremental sync

    Lightweight metadata used for incremental sync operations.
    """

    id: str = Field(..., description="Mission identifier")
    version: int = Field(..., description="Mission version number", ge=0)
    timestamp: int = Field(
        ..., description="Last modification timestamp (microseconds since epoch)", ge=0
    )
    size: int = Field(..., description="Mission data size in bytes", ge=0)

    class Config:
        """Pydantic configuration"""

        json_schema_extra = {
            "example": {
                "id": "660e8400-e29b-41d4-a716-446655440001",
                "version": 1,
                "timestamp": 1704722400000000,
                "size": 384,
            }
        }


class MissionListResponse(BaseModel):
    """Response model for listing missions

    Returns mission metadata and sync information for incremental updates.
    """

    missions: list[MissionMetadata] = Field(..., description="Array of mission metadata")
    deleted: list[str] = Field(
        default_factory=list,
        description="Array of deleted mission IDs (for incremental sync)",
    )
    version: int = Field(
        ..., description="Current server version timestamp (microseconds)", ge=0
    )
    count: int = Field(..., description="Number of missions returned", ge=0)

    class Config:
        """Pydantic configuration"""

        json_schema_extra = {
            "example": {
                "missions": [
                    {
                        "id": "660e8400-e29b-41d4-a716-446655440001",
                        "version": 1,
                        "timestamp": 1704722400000000,
                        "size": 384,
                    }
                ],
                "deleted": [],
                "version": 1704722400000000,
                "count": 1,
            }
        }


class MissionOperationResponse(BaseModel):
    """Response model for mission operations

    Returns the result of mission create/update/delete operations.
    """

    id: str = Field(..., description="Mission identifier")
    status: Literal["queued", "success"] = Field(..., description="Operation status")

    class Config:
        """Pydantic configuration"""

        json_schema_extra = {
            "example": {
                "id": "660e8400-e29b-41d4-a716-446655440001",
                "status": "success",
            }
        }


# ============================================================================
# Resource Sync Models
# ============================================================================


class ResourceSyncResponse(BaseModel):
    """Response model for resource sync endpoint

    Returns metadata for all resources to enable incremental sync.
    """

    version: int = Field(
        ..., description="Current server version timestamp (microseconds)", ge=0
    )
    timestamp: datetime = Field(..., description="Current server timestamp (ISO 8601)")
    zones: list[ZoneMetadata] = Field(default_factory=list, description="Zone metadata")
    missions: list[MissionMetadata] = Field(
        default_factory=list, description="Mission metadata"
    )
    deleted_zones: list[str] = Field(
        default_factory=list, description="Deleted zone IDs", alias="deletedZones"
    )
    deleted_missions: list[str] = Field(
        default_factory=list, description="Deleted mission IDs", alias="deletedMissions"
    )

    class Config:
        """Pydantic configuration"""

        populate_by_name = True
        json_schema_extra = {
            "example": {
                "version": 1704722400000000,
                "timestamp": "2024-01-08T12:00:00Z",
                "zones": [],
                "missions": [],
                "deletedZones": [],
                "deletedMissions": [],
            }
        }
