"""Mission template API endpoints

Provides REST API endpoints for mission template operations.
Templates are static configuration data that provide starting points for creating missions.
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from yardrover.auth import SecurityContext, require_operator, require_viewer
from yardrover.models.mission_templates import (
    MissionFromTemplateRequest,
    MissionTemplate,
    MissionTemplateDetail,
    MissionTemplateListResponse,
    MissionTemplateSummary,
    PeripheralAvailabilityStatus,
    PeripheralRequirement,
    TemplateCategory,
    TemplateCategoryInfo,
    UserMode,
    WeatherCheckResponse,
    WeatherCheckResult,
    ZoneSummary,
)
from yardrover.models.peripherals import PeripheralType
from yardrover.models.resources import (
    MissionOperationResponse,
    MissionSchedule,
    MissionType,
    ResourceResult,
    ResourceType,
    ScheduledMission,
    ZoneType,
)
from yardrover.models.template_data import (
    ALL_TEMPLATES,
    CATEGORY_METADATA,
    TEMPLATES_BY_CATEGORY,
    TEMPLATES_BY_ID,
    get_template_by_id,
)
from yardrover.resources.storage import ResourceStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mission-templates", tags=["mission-templates"])

# Global resource storage instance (will be injected during startup)
_storage: Optional[ResourceStorage] = None


def set_storage(storage: ResourceStorage) -> None:
    """Set the global resource storage instance

    Args:
        storage: Resource storage instance
    """
    global _storage
    _storage = storage


# ============================================================================
# Helper Functions
# ============================================================================


def _user_mode_to_level(mode: UserMode) -> int:
    """Convert user mode to numeric level for comparison"""
    levels = {
        UserMode.CONSUMER: 0,
        UserMode.POWER_USER: 1,
        UserMode.DEVELOPER: 2,
    }
    return levels.get(mode, 0)


def _string_to_user_mode(mode_str: str) -> UserMode:
    """Convert string to UserMode enum"""
    mode_map = {
        "consumer": UserMode.CONSUMER,
        "power-user": UserMode.POWER_USER,
        "power_user": UserMode.POWER_USER,
        "developer": UserMode.DEVELOPER,
    }
    return mode_map.get(mode_str.lower(), UserMode.CONSUMER)


def _filter_templates_by_mode(
    templates: List[MissionTemplate], user_mode: UserMode
) -> List[MissionTemplate]:
    """Filter templates based on user mode visibility"""
    user_level = _user_mode_to_level(user_mode)
    return [
        t for t in templates
        if _user_mode_to_level(t.min_user_mode) <= user_level
    ]


def _check_peripheral_availability(
    template: MissionTemplate,
    available_peripherals: Optional[List[PeripheralType]] = None,
) -> PeripheralAvailabilityStatus:
    """Check peripheral availability for a template

    Args:
        template: Mission template
        available_peripherals: List of available peripheral types (if None, assumes all available)

    Returns:
        Peripheral availability status
    """
    # Default to all peripherals available if not specified
    if available_peripherals is None:
        available_peripherals = list(PeripheralType)

    available_set = set(available_peripherals)

    required_status = []
    for ptype in template.required_peripherals:
        available = ptype in available_set
        required_status.append(
            PeripheralRequirement(
                peripheral_type=ptype,
                required=True,
                available=available,
            )
        )

    optional_status = []
    for ptype in template.optional_peripherals:
        available = ptype in available_set
        optional_status.append(
            PeripheralRequirement(
                peripheral_type=ptype,
                required=False,
                available=available,
            )
        )

    all_required_available = all(r.available for r in required_status)

    return PeripheralAvailabilityStatus(
        all_required_available=all_required_available,
        required=required_status,
        optional=optional_status,
    )


def _template_to_summary(
    template: MissionTemplate,
    available: bool = True,
    unavailable_reason: Optional[str] = None,
) -> MissionTemplateSummary:
    """Convert a template to a summary view"""
    return MissionTemplateSummary(
        id=template.id,
        name=template.name,
        consumer_name=template.consumer_name,
        description=template.description,
        consumer_description=template.consumer_description,
        emoji=template.emoji,
        category=template.category,
        estimated_time_per_acre=template.estimated_time_per_acre,
        available=available,
        unavailable_reason=unavailable_reason,
    )


def _check_weather_suitability(
    template: MissionTemplate,
) -> WeatherCheckResult:
    """Check if current weather is suitable for the template

    This is a placeholder that returns suitable=True.
    In a real implementation, this would check against actual weather data.
    """
    # TODO: Integrate with weather service
    return WeatherCheckResult(
        suitable=True,
        reasons=[],
        current_conditions=None,
    )


# ============================================================================
# API Endpoints
# ============================================================================


@router.get("", response_model=MissionTemplateListResponse)
async def list_templates(
    category: Optional[TemplateCategory] = Query(
        None, description="Filter by category"
    ),
    user_mode: str = Query(
        "consumer", description="User mode for filtering (consumer, power-user, developer)"
    ),
    include_unavailable: bool = Query(
        False, description="Include templates with missing peripherals"
    ),
    context: SecurityContext = Depends(require_viewer),
) -> MissionTemplateListResponse:
    """List all available mission templates

    Returns mission templates filtered by user mode and optionally by category.
    Templates are also filtered based on available peripherals unless
    include_unavailable is True.

    Args:
        category: Optional category filter
        user_mode: User mode for filtering template visibility
        include_unavailable: Whether to include templates with missing peripherals

    Returns:
        Template list response with summaries and category info
    """
    try:
        mode = _string_to_user_mode(user_mode)

        # Get all templates filtered by user mode
        if category:
            templates = TEMPLATES_BY_CATEGORY.get(category, [])
        else:
            templates = ALL_TEMPLATES.copy()

        filtered_templates = _filter_templates_by_mode(templates, mode)

        # Convert to summaries with availability check
        # For now, assume all peripherals are available
        # In production, this would check against actual connected peripherals
        summaries = []
        available_count = 0

        for template in filtered_templates:
            peripheral_status = _check_peripheral_availability(template)
            available = peripheral_status.all_required_available

            if available:
                available_count += 1
                summaries.append(_template_to_summary(template, available=True))
            elif include_unavailable:
                missing = [
                    r.peripheral_type.value
                    for r in peripheral_status.required
                    if not r.available
                ]
                reason = f"Missing peripherals: {', '.join(missing)}"
                summaries.append(
                    _template_to_summary(template, available=False, unavailable_reason=reason)
                )

        # Build category info
        categories = []
        for cat, meta in CATEGORY_METADATA.items():
            cat_templates = TEMPLATES_BY_CATEGORY.get(cat, [])
            cat_filtered = _filter_templates_by_mode(cat_templates, mode)

            # Count available in this category
            cat_available = sum(
                1 for t in cat_filtered
                if _check_peripheral_availability(t).all_required_available
            )

            categories.append(
                TemplateCategoryInfo(
                    category=meta.category,
                    name=meta.name,
                    consumer_name=meta.consumer_name,
                    emoji=meta.emoji,
                    template_count=len(cat_filtered),
                    available_count=cat_available,
                )
            )

        return MissionTemplateListResponse(
            templates=summaries,
            categories=categories,
            total_count=len(filtered_templates),
            available_count=available_count,
        )

    except Exception as e:
        logger.error(f"Failed to list templates: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list templates: {str(e)}",
        )


@router.get("/{template_id}", response_model=MissionTemplateDetail)
async def get_template(
    template_id: str,
    context: SecurityContext = Depends(require_viewer),
) -> MissionTemplateDetail:
    """Get detailed information about a specific template

    Returns the full template definition along with current weather
    suitability, peripheral availability, and compatible zones.

    Args:
        template_id: Template identifier

    Returns:
        Template detail with status information

    Raises:
        HTTPException: 404 if template not found
    """
    template = get_template_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found: {template_id}",
        )

    try:
        # Check peripheral availability
        peripheral_status = _check_peripheral_availability(template)

        # Check weather suitability
        weather_status = _check_weather_suitability(template)

        # Get compatible zones
        # TODO: Query actual zones from storage
        compatible_zones: List[ZoneSummary] = []

        return MissionTemplateDetail(
            template=template,
            weather_status=weather_status,
            peripheral_status=peripheral_status,
            compatible_zones=compatible_zones,
            suggested_schedule=None,
        )

    except Exception as e:
        logger.error(f"Failed to get template: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template: {str(e)}",
        )


@router.post("/{template_id}/check-weather", response_model=WeatherCheckResponse)
async def check_weather_for_template(
    template_id: str,
    scheduled_time: Optional[str] = Query(
        None, description="Scheduled time for weather check (ISO 8601)"
    ),
    context: SecurityContext = Depends(require_viewer),
) -> WeatherCheckResponse:
    """Check if weather conditions are suitable for this template

    Returns current weather suitability and suggested alternative times
    if conditions are not suitable.

    Args:
        template_id: Template identifier
        scheduled_time: Optional scheduled time (ISO 8601)

    Returns:
        Weather check response with suitability and suggestions

    Raises:
        HTTPException: 404 if template not found
    """
    template = get_template_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found: {template_id}",
        )

    try:
        # TODO: Integrate with actual weather service
        weather_result = _check_weather_suitability(template)

        return WeatherCheckResponse(
            suitable=weather_result.suitable,
            current_conditions=weather_result.current_conditions,
            reasons=weather_result.reasons,
            suggested_times=[],  # TODO: Calculate based on forecast
        )

    except Exception as e:
        logger.error(f"Failed to check weather: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check weather: {str(e)}",
        )


@router.post(
    "/{template_id}/create",
    response_model=MissionOperationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_mission_from_template(
    template_id: str,
    request: MissionFromTemplateRequest,
    context: SecurityContext = Depends(require_operator),
) -> MissionOperationResponse:
    """Create a new mission from a template

    Creates a mission using the template's default settings with user
    customizations applied. The mission is queued for storage.

    Args:
        template_id: Template identifier
        request: Mission creation request with customizations

    Returns:
        Operation response with mission ID and status

    Raises:
        HTTPException: 404 if template not found, 400 for validation errors
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    template = get_template_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found: {template_id}",
        )

    try:
        # Check peripheral availability
        peripheral_status = _check_peripheral_availability(template)
        if not peripheral_status.all_required_available:
            missing = [
                r.peripheral_type.value
                for r in peripheral_status.required
                if not r.available
            ]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required peripherals: {', '.join(missing)}",
            )

        # Check weather if not overriding
        if not request.weather_override:
            weather_result = _check_weather_suitability(template)
            if not weather_result.suitable:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Weather conditions not suitable: {'; '.join(weather_result.reasons)}. "
                    "Set weather_override=true to proceed anyway.",
                )

        # Parse start time
        try:
            start_time = datetime.fromisoformat(request.start_time.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_time format. Use ISO 8601.",
            )

        # Parse end time if provided
        end_time = None
        if request.end_time:
            try:
                end_time = datetime.fromisoformat(request.end_time.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid end_time format. Use ISO 8601.",
                )

        # Generate mission name
        timestamp_str = start_time.strftime("%Y-%m-%d")
        mission_name = request.name or f"{template.name} - {timestamp_str}"

        # Create schedule
        schedule = MissionSchedule(
            startTime=start_time,
            endTime=end_time,
            daysOfWeek=request.days_of_week,
            dayOfMonth=request.day_of_month,
        )

        # Create mission
        mission = ScheduledMission(
            name=mission_name,
            type=request.schedule_type,
            zoneIds=request.zone_ids,
            schedule=schedule,
            priority=request.priority,
            enabled=True,
        )

        # Serialize mission to JSON
        mission_json = mission.model_dump_json(by_alias=True)

        # Queue write operation
        result = await _storage.queue_write(
            resource_type=ResourceType.MISSION,
            resource_id=mission.id,
            data=mission_json,
            version=1,
        )

        if result == ResourceResult.SUCCESS:
            logger.info(f"Mission created from template {template_id}: {mission.id}")
            return MissionOperationResponse(id=mission.id, status="queued")
        elif result == ResourceResult.QUEUE_FULL:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Write queue is full, please try again later",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create mission: {result.value}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create mission from template: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create mission: {str(e)}",
        )
