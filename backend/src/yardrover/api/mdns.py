"""
mDNS API endpoints.

Provides REST API for mDNS service advertisement and discovery.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
import structlog

from ..core.errors import NetworkError
from ..models.network import (
    MDNSConfig,
    MDNSDiscoverRequest,
    MDNSDiscoverResponse,
    MDNSStatus,
)
from ..network.mdns import MDNSManager

logger = structlog.get_logger(__name__)

# Create router
router = APIRouter(prefix="/api/mdns", tags=["mdns"])


# Dependency to get mDNS manager from app state
def get_mdns_manager(request: Request) -> MDNSManager:
    """Get mDNS manager from app state."""
    mdns_manager = request.app.state.mdns_manager
    if mdns_manager is None:
        raise NetworkError(
            "mDNS manager not available"
        )
    return mdns_manager


@router.get("/status", response_model=MDNSStatus)
async def get_mdns_status(
    mdns_manager: Annotated[MDNSManager, Depends(get_mdns_manager)],
) -> MDNSStatus:
    """
    Get mDNS service status.

    Returns the current mDNS status including advertised and discovered services.
    """
    config = mdns_manager.get_config()
    advertised = mdns_manager.get_advertised_services()
    discovered = mdns_manager.get_discovered_services()

    return MDNSStatus(
        enabled=config.enabled,
        hostname=config.hostname,
        advertised_services=advertised,
        discovered_services=discovered,
    )


@router.post("/discover", response_model=MDNSDiscoverResponse)
async def discover_services(
    request_body: MDNSDiscoverRequest,
    mdns_manager: Annotated[MDNSManager, Depends(get_mdns_manager)],
) -> MDNSDiscoverResponse:
    """
    Trigger mDNS service discovery.

    Manually trigger mDNS service discovery for specific service types
    (default: RTK base stations).
    """
    logger.info(
        "api_mdns_discover",
        service_type=request_body.service_type,
        timeout=request_body.timeout,
    )

    try:
        services = await mdns_manager.discover(
            service_type=request_body.service_type,
            timeout=request_body.timeout,
        )

        return MDNSDiscoverResponse(
            service_type=request_body.service_type,
            services=services,
        )

    except NetworkError as e:
        logger.error(
            "api_mdns_discover_failed",
            service_type=request_body.service_type,
            error=str(e),
        )
        raise


@router.get("/config", response_model=MDNSConfig)
async def get_mdns_config(
    mdns_manager: Annotated[MDNSManager, Depends(get_mdns_manager)],
) -> MDNSConfig:
    """
    Get mDNS configuration.

    Returns the current mDNS configuration settings.
    """
    return mdns_manager.get_config()


@router.patch("/config", response_model=MDNSConfig)
async def update_mdns_config(
    config: MDNSConfig,
    mdns_manager: Annotated[MDNSManager, Depends(get_mdns_manager)],
) -> MDNSConfig:
    """
    Update mDNS configuration.

    Updates mDNS configuration settings. Changes to enabled state will
    start/stop the mDNS service automatically.
    """
    logger.info(
        "api_mdns_config_update",
        enabled=config.enabled,
        hostname=config.hostname,
    )

    try:
        await mdns_manager.set_config(config)
        return mdns_manager.get_config()

    except Exception as e:
        logger.error("api_mdns_config_update_failed", error=str(e))
        raise NetworkError(f"Failed to update mDNS config: {str(e)}")
