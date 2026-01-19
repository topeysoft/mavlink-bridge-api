"""Mission Template data models

Pydantic models for mission templates that provide pre-configured starting points
for creating missions. Templates include weather constraints, peripheral requirements,
and user-mode-aware naming.
"""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from .peripherals import PeripheralType
from .resources import MissionPriority, MissionType, ZoneType


# ============================================================================
# Template Category
# ============================================================================


class TemplateCategory(str, Enum):
    """Mission template category enumeration"""

    LAWN_CARE = "lawn_care"
    FERTILIZATION = "fertilization"
    IRRIGATION = "irrigation"
    WINTER = "winter"
    CLEANUP = "cleanup"
    SECURITY = "security"
    MONITORING = "monitoring"
    UTILITY = "utility"
    SEASONAL = "seasonal"
    SMART = "smart"


class UserMode(str, Enum):
    """User mode enumeration for template visibility"""

    CONSUMER = "consumer"
    POWER_USER = "power-user"
    DEVELOPER = "developer"


# ============================================================================
# Weather Constraints
# ============================================================================


class WeatherConstraints(BaseModel):
    """Weather safety constraints for template execution

    Defines acceptable weather conditions for safe operation.
    Templates can specify their own constraints based on the type of work.
    """

    max_wind_speed: float = Field(
        default=10.0, description="Maximum wind speed in m/s", ge=0
    )
    max_rain_rate: float = Field(
        default=2.0, description="Maximum rain rate in mm/h", ge=0
    )
    max_snow_rate: float = Field(
        default=1.0, description="Maximum snow rate in mm/h", ge=0
    )
    min_visibility: int = Field(
        default=1000, description="Minimum visibility in meters", ge=0
    )
    min_temp: float = Field(
        default=0.0, description="Minimum temperature in Celsius"
    )
    max_temp: float = Field(
        default=40.0, description="Maximum temperature in Celsius"
    )
    avoid_conditions: List[str] = Field(
        default_factory=lambda: ["Thunderstorm", "Tornado", "Hurricane"],
        description="Weather conditions to avoid",
    )
    require_dry_ground: bool = Field(
        default=False, description="Requires dry ground (no recent rain)"
    )
    dry_ground_hours: int = Field(
        default=24, description="Hours since last rain for dry ground requirement", ge=0
    )
    require_daylight: bool = Field(
        default=False, description="Must run during daylight hours"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "max_wind_speed": 12.0,
                "max_rain_rate": 0.5,
                "min_temp": 5.0,
                "max_temp": 35.0,
                "require_dry_ground": True,
                "dry_ground_hours": 24,
            }
        }


# ============================================================================
# Template Default Settings
# ============================================================================


class TemplateDefaultSettings(BaseModel):
    """Default operational settings for a template

    These settings are applied when creating a mission from the template
    and can be overridden by the user during customization.
    """

    # Mowing settings
    mowing_height: Optional[float] = Field(
        default=None, description="Default mowing height in cm", ge=1, le=15
    )
    mowing_pattern: Optional[str] = Field(
        default=None, description="Mowing pattern (stripe, spiral, random, checkerboard)"
    )
    edge_mode: Optional[str] = Field(
        default=None, description="Edge handling mode (normal, precise, skip)"
    )
    overlap_percentage: float = Field(
        default=10.0, description="Path overlap percentage", ge=0, le=50
    )

    # Speed and movement
    speed_mode: str = Field(
        default="normal", description="Speed mode (slow, normal, fast)"
    )

    # Collection
    collection_enabled: bool = Field(
        default=False, description="Whether to collect clippings/debris"
    )

    # Application settings
    spray_rate: Optional[float] = Field(
        default=None, description="Spray rate in L/m²", ge=0
    )
    spread_rate: Optional[float] = Field(
        default=None, description="Spread rate in g/m²", ge=0
    )

    # Snow settings
    clearing_height: Optional[float] = Field(
        default=None, description="Snow clearing height in cm", ge=0
    )
    salt_application: bool = Field(
        default=False, description="Apply salt after clearing"
    )

    # Patrol settings
    dwell_time: Optional[int] = Field(
        default=None, description="Dwell time at waypoints in seconds", ge=0
    )
    motion_detection: bool = Field(
        default=False, description="Enable motion detection"
    )
    recording: bool = Field(
        default=False, description="Enable video recording"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "mowing_height": 5.0,
                "mowing_pattern": "stripe",
                "speed_mode": "normal",
                "overlap_percentage": 10.0,
            }
        }


# ============================================================================
# Mission Template
# ============================================================================


class MissionTemplate(BaseModel):
    """Mission template definition

    A template provides a pre-configured starting point for creating missions.
    Users select a template, customize it one-time during creation, and it
    becomes a regular mission.
    """

    id: str = Field(..., description="Unique template identifier")
    name: str = Field(..., description="Technical template name")
    consumer_name: str = Field(..., description="Consumer-friendly name")
    description: str = Field(..., description="Technical description")
    consumer_description: str = Field(..., description="Consumer-friendly description")
    emoji: str = Field(..., description="Template icon emoji")
    category: TemplateCategory = Field(..., description="Template category")

    # Requirements
    required_peripherals: List[PeripheralType] = Field(
        default_factory=list,
        description="Peripherals required for this template",
    )
    optional_peripherals: List[PeripheralType] = Field(
        default_factory=list,
        description="Optional peripherals that enhance the template",
    )
    compatible_zone_types: List[ZoneType] = Field(
        default_factory=list,
        description="Zone types compatible with this template",
    )

    # Weather constraints
    weather_constraints: WeatherConstraints = Field(
        default_factory=WeatherConstraints,
        description="Weather safety constraints",
    )

    # Defaults
    default_settings: TemplateDefaultSettings = Field(
        default_factory=TemplateDefaultSettings,
        description="Default operational settings",
    )
    estimated_time_per_acre: int = Field(
        default=45, description="Estimated time per acre in minutes", ge=1
    )
    default_schedule_type: MissionType = Field(
        default=MissionType.ONCE,
        description="Default schedule type",
    )
    default_priority: MissionPriority = Field(
        default=MissionPriority.NORMAL,
        description="Default mission priority",
    )

    # Access control
    required_feature: Optional[str] = Field(
        default=None, description="Feature flag required to use this template"
    )
    min_user_mode: UserMode = Field(
        default=UserMode.CONSUMER,
        description="Minimum user mode required to see this template",
    )

    # Seasonal constraints
    seasons: Optional[List[str]] = Field(
        default=None,
        description="Applicable seasons (spring, summer, fall, winter)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "basic_mowing",
                "name": "Basic Mowing",
                "consumer_name": "Quick Mow",
                "description": "Standard lawn mowing with configurable height and pattern",
                "consumer_description": "A quick trim for your lawn",
                "emoji": "🌱",
                "category": "lawn_care",
                "required_peripherals": ["mower"],
                "compatible_zone_types": ["mowing"],
                "weather_constraints": {
                    "max_wind_speed": 12.0,
                    "max_rain_rate": 0.5,
                    "require_dry_ground": True,
                },
                "default_settings": {
                    "mowing_height": 5.0,
                    "mowing_pattern": "stripe",
                },
                "estimated_time_per_acre": 45,
            }
        }


# ============================================================================
# API Response Models
# ============================================================================


class MissionTemplateSummary(BaseModel):
    """Summary view of a mission template for listing"""

    id: str = Field(..., description="Template identifier")
    name: str = Field(..., description="Technical template name")
    consumer_name: str = Field(..., description="Consumer-friendly name")
    description: str = Field(..., description="Technical description")
    consumer_description: str = Field(..., description="Consumer-friendly description")
    emoji: str = Field(..., description="Template icon emoji")
    category: TemplateCategory = Field(..., description="Template category")
    estimated_time_per_acre: int = Field(..., description="Estimated time per acre in minutes")
    available: bool = Field(
        default=True, description="Whether template can be used (has required peripherals)"
    )
    unavailable_reason: Optional[str] = Field(
        default=None, description="Reason template is unavailable"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "basic_mowing",
                "name": "Basic Mowing",
                "consumer_name": "Quick Mow",
                "description": "Standard lawn mowing",
                "consumer_description": "A quick trim for your lawn",
                "emoji": "🌱",
                "category": "lawn_care",
                "estimated_time_per_acre": 45,
                "available": True,
            }
        }


class TemplateCategoryInfo(BaseModel):
    """Category information with template counts"""

    category: TemplateCategory = Field(..., description="Category identifier")
    name: str = Field(..., description="Technical category name")
    consumer_name: str = Field(..., description="Consumer-friendly category name")
    emoji: str = Field(..., description="Category icon emoji")
    template_count: int = Field(..., description="Total templates in category", ge=0)
    available_count: int = Field(..., description="Available templates in category", ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "category": "lawn_care",
                "name": "Lawn Care",
                "consumer_name": "Lawn Jobs",
                "emoji": "🌱",
                "template_count": 6,
                "available_count": 4,
            }
        }


class MissionTemplateListResponse(BaseModel):
    """Response model for listing mission templates"""

    templates: List[MissionTemplateSummary] = Field(
        default_factory=list, description="List of template summaries"
    )
    categories: List[TemplateCategoryInfo] = Field(
        default_factory=list, description="Category information"
    )
    total_count: int = Field(..., description="Total number of templates", ge=0)
    available_count: int = Field(..., description="Number of available templates", ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "templates": [],
                "categories": [],
                "total_count": 42,
                "available_count": 15,
            }
        }


class PeripheralRequirement(BaseModel):
    """Peripheral requirement status for a template"""

    peripheral_type: PeripheralType = Field(..., description="Peripheral type")
    required: bool = Field(..., description="Whether peripheral is required")
    available: bool = Field(..., description="Whether peripheral is available")
    peripheral_id: Optional[str] = Field(
        default=None, description="ID of available peripheral"
    )
    peripheral_name: Optional[str] = Field(
        default=None, description="Name of available peripheral"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "peripheral_type": "mower",
                "required": True,
                "available": True,
                "peripheral_id": "550e8400-e29b-41d4-a716-446655440000",
                "peripheral_name": "48-inch Rotary Mower",
            }
        }


class PeripheralAvailabilityStatus(BaseModel):
    """Peripheral availability status for a template"""

    all_required_available: bool = Field(
        ..., description="Whether all required peripherals are available"
    )
    required: List[PeripheralRequirement] = Field(
        default_factory=list, description="Required peripheral statuses"
    )
    optional: List[PeripheralRequirement] = Field(
        default_factory=list, description="Optional peripheral statuses"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "all_required_available": True,
                "required": [
                    {
                        "peripheral_type": "mower",
                        "required": True,
                        "available": True,
                    }
                ],
                "optional": [],
            }
        }


class WeatherSummary(BaseModel):
    """Current weather summary"""

    temperature: float = Field(..., description="Temperature in Celsius")
    wind_speed: float = Field(..., description="Wind speed in m/s")
    condition: str = Field(..., description="Weather condition (e.g., Clear, Rain)")
    rain_rate: Optional[float] = Field(default=None, description="Rain rate in mm/h")
    visibility: Optional[int] = Field(default=None, description="Visibility in meters")
    hours_since_rain: Optional[int] = Field(
        default=None, description="Hours since last rain"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "temperature": 22.5,
                "wind_speed": 5.2,
                "condition": "Clear",
                "rain_rate": None,
                "visibility": 10000,
                "hours_since_rain": 48,
            }
        }


class WeatherCheckResult(BaseModel):
    """Result of weather suitability check"""

    suitable: bool = Field(..., description="Whether weather is suitable for template")
    reasons: List[str] = Field(
        default_factory=list, description="Reasons if not suitable"
    )
    current_conditions: Optional[WeatherSummary] = Field(
        default=None, description="Current weather conditions"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "suitable": False,
                "reasons": ["Wind too high: 15.2 m/s (max: 12.0)"],
                "current_conditions": {
                    "temperature": 22.5,
                    "wind_speed": 15.2,
                    "condition": "Clear",
                },
            }
        }


class SuggestedTimeSlot(BaseModel):
    """Suggested time slot for mission execution"""

    start_time: str = Field(..., description="Start time (ISO 8601)")
    end_time: str = Field(..., description="End time (ISO 8601)")
    weather_score: float = Field(
        ..., description="Weather suitability score (0-100)", ge=0, le=100
    )
    conditions_summary: str = Field(..., description="Summary of expected conditions")

    class Config:
        json_schema_extra = {
            "example": {
                "start_time": "2024-01-08T10:00:00Z",
                "end_time": "2024-01-08T14:00:00Z",
                "weather_score": 95.0,
                "conditions_summary": "Clear skies, light wind (3 m/s), 22°C",
            }
        }


class SuggestedSchedule(BaseModel):
    """Suggested schedule based on weather forecast"""

    best_time: Optional[SuggestedTimeSlot] = Field(
        default=None, description="Best suggested time"
    )
    alternative_times: List[SuggestedTimeSlot] = Field(
        default_factory=list, description="Alternative good times"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "best_time": {
                    "start_time": "2024-01-08T10:00:00Z",
                    "end_time": "2024-01-08T14:00:00Z",
                    "weather_score": 95.0,
                    "conditions_summary": "Clear skies, light wind",
                },
                "alternative_times": [],
            }
        }


class ZoneSummary(BaseModel):
    """Summary of a compatible zone"""

    id: str = Field(..., description="Zone identifier")
    name: str = Field(..., description="Zone name")
    type: ZoneType = Field(..., description="Zone type")
    area: float = Field(..., description="Zone area in square meters")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Front Lawn",
                "type": "mowing",
                "area": 1000.5,
            }
        }


class MissionTemplateDetail(BaseModel):
    """Detailed template response with status information"""

    template: MissionTemplate = Field(..., description="Full template definition")
    weather_status: WeatherCheckResult = Field(
        ..., description="Current weather suitability"
    )
    peripheral_status: PeripheralAvailabilityStatus = Field(
        ..., description="Peripheral availability"
    )
    compatible_zones: List[ZoneSummary] = Field(
        default_factory=list, description="Compatible zones"
    )
    suggested_schedule: Optional[SuggestedSchedule] = Field(
        default=None, description="Suggested schedule based on weather"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "template": {},
                "weather_status": {"suitable": True, "reasons": []},
                "peripheral_status": {"all_required_available": True},
                "compatible_zones": [],
                "suggested_schedule": None,
            }
        }


class WeatherCheckResponse(BaseModel):
    """Response for weather check endpoint"""

    suitable: bool = Field(..., description="Whether weather is suitable")
    current_conditions: Optional[WeatherSummary] = Field(
        default=None, description="Current conditions"
    )
    reasons: List[str] = Field(
        default_factory=list, description="Reasons if not suitable"
    )
    suggested_times: List[SuggestedTimeSlot] = Field(
        default_factory=list, description="Suggested alternative times"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "suitable": True,
                "reasons": [],
                "suggested_times": [],
            }
        }


class MissionFromTemplateRequest(BaseModel):
    """Request to create a mission from a template"""

    name: Optional[str] = Field(
        default=None,
        description="Custom mission name (defaults to template name + timestamp)",
        max_length=100,
    )
    zone_ids: List[str] = Field(
        ...,
        description="Zone IDs to include in the mission",
        min_length=1,
    )
    schedule_type: MissionType = Field(
        default=MissionType.ONCE,
        description="Mission schedule type",
    )
    start_time: str = Field(
        ...,
        description="Start time (ISO 8601)",
    )
    end_time: Optional[str] = Field(
        default=None,
        description="End time for recurring missions (ISO 8601)",
    )
    days_of_week: List[int] = Field(
        default_factory=list,
        description="Days of week for weekly missions (0=Sunday)",
    )
    day_of_month: Optional[int] = Field(
        default=None,
        description="Day of month for monthly missions",
        ge=1,
        le=31,
    )
    priority: MissionPriority = Field(
        default=MissionPriority.NORMAL,
        description="Mission priority",
    )
    settings_overrides: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Settings to override from template defaults",
    )
    weather_override: bool = Field(
        default=False,
        description="Force creation despite weather warnings",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "zone_ids": ["550e8400-e29b-41d4-a716-446655440000"],
                "schedule_type": "weekly",
                "start_time": "2024-01-08T10:00:00Z",
                "days_of_week": [1, 3, 5],
                "priority": "normal",
            }
        }
