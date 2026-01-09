"""Health check API endpoints."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends

from yardrover.core.health import HealthMonitor, get_health_monitor
from yardrover.models.health import HealthResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api", tags=["health"])

# Dependency injection type
HealthMonitorDep = Annotated[HealthMonitor, Depends(get_health_monitor)]


@router.get("/health", response_model=HealthResponse)
async def health_check(health_monitor: HealthMonitorDep) -> HealthResponse:
    """Get comprehensive system health status.

    Returns detailed health information including:
    - System metrics (CPU, memory, disk)
    - Device information
    - Network status
    - Storage health
    - MAVLink connection status

    Returns:
        HealthResponse: Complete health status
    """
    logger.debug("health_check_requested")
    health = await health_monitor.get_health()
    return health
