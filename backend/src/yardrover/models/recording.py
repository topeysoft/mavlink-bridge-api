"""Zone recording models

Pydantic models for GPS waypoint recording and zone boundary creation.
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


RecordingMode = Literal["perimeter", "anchor"]


class GPSWaypoint(BaseModel):
    """GPS waypoint with position and accuracy information"""

    lat: float = Field(..., description="Latitude in decimal degrees")
    lon: float = Field(..., description="Longitude in decimal degrees")
    alt: Optional[float] = Field(None, description="Altitude in meters")
    accuracy: Optional[float] = Field(None, description="GPS accuracy in meters")
    timestamp: int = Field(..., description="Timestamp in microseconds since epoch")


class AnchorPoint(BaseModel):
    """Manually placed anchor/corner point for polygon creation"""

    lat: float = Field(..., description="Latitude in decimal degrees")
    lon: float = Field(..., description="Longitude in decimal degrees")
    index: int = Field(..., description="Order index (0-based)")
    timestamp: int = Field(..., description="Timestamp in microseconds since epoch")


class RecordingConfig(BaseModel):
    """Configuration for a recording session"""

    mode: RecordingMode = Field(
        default="perimeter", description="Recording mode (perimeter or anchor)"
    )
    sample_rate: float = Field(
        default=1.0,
        description="Minimum distance between samples in meters (perimeter mode)",
        gt=0,
        le=100,
    )
    min_accuracy: float = Field(
        default=3.0,
        description="Minimum GPS accuracy required in meters",
        gt=0,
        le=50,
    )
    auto_close: bool = Field(
        default=True, description="Automatically close polygon when returning to start"
    )
    auto_simplify: bool = Field(
        default=True, description="Simplify path after recording"
    )
    simplify_tolerance: float = Field(
        default=0.5,
        description="Douglas-Peucker simplification tolerance in meters",
        ge=0,
        le=10,
    )
    # Anchor mode settings
    auto_square: bool = Field(
        default=True,
        description="Automatically snap near-90° angles to exactly 90° (anchor mode)",
    )
    snap_angle_threshold: float = Field(
        default=10.0,
        description="Angle tolerance in degrees for auto-squaring (anchor mode)",
        ge=0,
        le=45,
    )
    min_anchors: int = Field(
        default=3,
        description="Minimum number of anchor points required (anchor mode)",
        ge=3,
        le=20,
    )
    max_anchors: int = Field(
        default=20,
        description="Maximum number of anchor points allowed (anchor mode)",
        ge=3,
        le=50,
    )


RecordingStatus = Literal["active", "paused", "completed", "failed"]


class RecordingSession(BaseModel):
    """Active recording session state"""

    session_id: str = Field(..., description="Unique session identifier")
    owner_id: str = Field(..., description="User/API key ID that owns this session")
    created_at: datetime = Field(..., description="Session creation time")
    last_activity: datetime = Field(..., description="Last activity timestamp for timeout tracking")
    config: RecordingConfig = Field(..., description="Recording configuration")
    waypoints: List[GPSWaypoint] = Field(
        default_factory=list, description="Collected waypoints (perimeter mode)"
    )
    anchors: List[AnchorPoint] = Field(
        default_factory=list, description="Anchor points (anchor mode)"
    )
    status: RecordingStatus = Field(..., description="Current session status")


class RecordingStartResponse(BaseModel):
    """Response from starting a recording session"""

    session_id: str = Field(..., description="Created session ID")
    status: RecordingStatus = Field(..., description="Initial session status")


class RecordingStatusResponse(BaseModel):
    """Current status of a recording session"""

    session_id: str = Field(..., description="Session identifier")
    status: RecordingStatus = Field(..., description="Current session status")
    mode: RecordingMode = Field(..., description="Recording mode")
    waypoint_count: int = Field(..., description="Number of waypoints recorded")
    anchor_count: int = Field(default=0, description="Number of anchor points placed")
    estimated_area: Optional[float] = Field(
        None, description="Estimated area in square meters"
    )
    estimated_perimeter: Optional[float] = Field(
        None, description="Estimated perimeter in meters"
    )
    shape_type: Optional[str] = Field(
        None, description="Detected shape type (anchor mode)"
    )


class RecordingCompleteResponse(BaseModel):
    """Response from completing a recording session"""

    session_id: str = Field(..., description="Completed session ID")
    zone_preview: dict = Field(..., description="GeoJSON preview of the zone")
    waypoint_count: int = Field(..., description="Original waypoint count")
    simplified_count: int = Field(..., description="Simplified waypoint count")
    area: float = Field(..., description="Calculated area in square meters")
    perimeter: float = Field(..., description="Calculated perimeter in meters")
