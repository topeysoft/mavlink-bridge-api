"""Zone type-specific settings models

Pydantic models for validating zone settings based on zone type.
Each zone type has its own settings schema with type-safe validation.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ============================================================================
# Mowing Zone Settings
# ============================================================================


class MowingSettings(BaseModel):
    """Settings for mowing zones"""

    mowing_height: float = Field(
        default=3.5,
        description="Mowing height in centimeters",
        ge=1.0,
        le=15.0,
    )
    pattern: Literal["stripe", "spiral", "random", "checkerboard"] = Field(
        default="stripe",
        description="Mowing pattern",
    )
    edge_mode: Literal["trim", "skip", "overlap"] = Field(
        default="trim",
        description="Edge handling mode",
    )
    overlap: float = Field(
        default=10.0,
        description="Mowing path overlap percentage",
        ge=0,
        le=50,
    )


# ============================================================================
# Patrol Zone Settings
# ============================================================================


class PatrolSettings(BaseModel):
    """Settings for patrol/security zones"""

    schedule: Optional[str] = Field(
        default=None,
        description="Cron expression for patrol schedule (e.g., '0 */2 * * *' for every 2 hours)",
    )
    dwell_time: int = Field(
        default=30,
        description="Dwell time at each waypoint in seconds",
        ge=0,
        le=300,
    )
    motion_detection: bool = Field(
        default=True,
        description="Enable motion detection during patrol",
    )
    recording_enabled: bool = Field(
        default=False,
        description="Enable video recording during patrol",
    )
    speed: float = Field(
        default=0.5,
        description="Patrol speed in m/s",
        ge=0.1,
        le=2.0,
    )


# ============================================================================
# Snow Clearing Zone Settings
# ============================================================================


class SnowClearingSettings(BaseModel):
    """Settings for snow clearing zones"""

    priority: Literal[1, 2, 3] = Field(
        default=2,
        description="Clearing priority (1=high, 2=medium, 3=low)",
    )
    clearing_height: float = Field(
        default=5.0,
        description="Snow depth threshold in centimeters to trigger clearing",
        ge=1.0,
        le=30.0,
    )
    pattern: Literal["back_and_forth", "spiral", "perimeter_first"] = Field(
        default="back_and_forth",
        description="Snow clearing pattern",
    )
    salt_application: bool = Field(
        default=False,
        description="Apply de-icing salt during clearing",
    )
    edge_clearing: bool = Field(
        default=True,
        description="Clear edges and borders",
    )


# ============================================================================
# Spraying Zone Settings
# ============================================================================


class SprayingSettings(BaseModel):
    """Settings for chemical/fertilizer spraying zones"""

    spray_rate: float = Field(
        default=1.5,
        description="Application rate in liters per square meter",
        ge=0.1,
        le=10.0,
    )
    chemical_type: str = Field(
        default="water",
        description="Chemical/fertilizer type identifier",
        max_length=100,
    )
    wind_limit: float = Field(
        default=15.0,
        description="Maximum wind speed in km/h for safe spraying",
        ge=0,
        le=30,
    )
    buffer_zone: float = Field(
        default=2.0,
        description="Buffer distance from zone edge in meters",
        ge=0,
        le=10,
    )
    nozzle_height: float = Field(
        default=30.0,
        description="Spray nozzle height in centimeters",
        ge=10.0,
        le=100.0,
    )


# ============================================================================
# Watering Zone Settings
# ============================================================================


class WateringSettings(BaseModel):
    """Settings for irrigation/watering zones"""

    schedule: Optional[str] = Field(
        default=None,
        description="Cron expression for watering schedule",
    )
    duration: int = Field(
        default=15,
        description="Watering duration in minutes",
        ge=1,
        le=60,
    )
    moisture_threshold: float = Field(
        default=30.0,
        description="Soil moisture threshold percentage to trigger watering",
        ge=0,
        le=100,
    )
    flow_rate: float = Field(
        default=2.0,
        description="Water flow rate in liters per minute",
        ge=0.1,
        le=20.0,
    )
    skip_if_rain: bool = Field(
        default=True,
        description="Skip watering if rain detected",
    )


# ============================================================================
# Collection Zone Settings
# ============================================================================


class CollectionSettings(BaseModel):
    """Settings for debris/leaf collection zones"""

    vacuum_power: int = Field(
        default=80,
        description="Vacuum power percentage",
        ge=10,
        le=100,
    )
    pattern: Literal["back_and_forth", "spiral", "perimeter_first"] = Field(
        default="back_and_forth",
        description="Collection pattern",
    )
    bag_capacity: float = Field(
        default=10.0,
        description="Collection bag capacity in liters",
        ge=1.0,
        le=50.0,
    )
    auto_return_when_full: bool = Field(
        default=True,
        description="Automatically return to dump location when bag is full",
    )


# ============================================================================
# Monitoring Zone Settings
# ============================================================================


class MonitoringSettings(BaseModel):
    """Settings for environmental monitoring zones"""

    sensors: list[str] = Field(
        default_factory=lambda: ["temperature", "humidity"],
        description="List of enabled sensors",
    )
    sample_interval: int = Field(
        default=300,
        description="Sampling interval in seconds",
        ge=10,
        le=3600,
    )
    alert_enabled: bool = Field(
        default=False,
        description="Enable alerts for threshold violations",
    )
    temperature_min: Optional[float] = Field(
        default=None,
        description="Minimum temperature alert threshold in Celsius",
    )
    temperature_max: Optional[float] = Field(
        default=None,
        description="Maximum temperature alert threshold in Celsius",
    )
    humidity_min: Optional[float] = Field(
        default=None,
        description="Minimum humidity alert threshold percentage",
        ge=0,
        le=100,
    )
    humidity_max: Optional[float] = Field(
        default=None,
        description="Maximum humidity alert threshold percentage",
        ge=0,
        le=100,
    )


# ============================================================================
# Staging Zone Settings
# ============================================================================


class StagingSettings(BaseModel):
    """Settings for staging/dumping zones"""

    max_capacity: Optional[float] = Field(
        default=None,
        description="Maximum capacity in cubic meters",
        ge=0,
    )
    material_type: str = Field(
        default="general",
        description="Type of material stored (debris, mulch, soil, etc.)",
        max_length=50,
    )
    auto_compact: bool = Field(
        default=False,
        description="Automatically compact deposited material",
    )


# ============================================================================
# Settings Type Union
# ============================================================================

# Type alias for zone settings (used for validation)
ZoneSettings = (
    MowingSettings
    | PatrolSettings
    | SnowClearingSettings
    | SprayingSettings
    | WateringSettings
    | CollectionSettings
    | MonitoringSettings
    | StagingSettings
    | dict  # Allow dict for backward compatibility and unknown types
)
