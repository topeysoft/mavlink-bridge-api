"""
mDNS API endpoints.

Provides REST API for mDNS service advertisement and discovery.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
import structlog

from ..auth import Role, SecurityContext, require_operator, require_viewer
from ..auth.api_keys import get_api_key_manager
from ..auth.dependencies import get_optional_api_key_strict
from ..core.config import get_config_manager
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


def is_truly_in_setup_mode() -> bool:
    """Return True only when setup is genuinely incomplete.

    This mirrors setup status logic: setup is complete only when both
    security.setup_completed is true and at least one admin API key exists.
    """
    config_manager = get_config_manager()
    api_key_manager = get_api_key_manager()

    admin_keys = [key for key in api_key_manager.list_keys() if key.role == Role.ADMIN]
    has_admin_key = len(admin_keys) > 0

    setup_completed = config_manager.config.security.setup_completed and has_admin_key
    return not setup_completed


async def require_viewer_or_setup_discovery(
    context: SecurityContext | None = Depends(get_optional_api_key_strict),
) -> SecurityContext | None:
    """Allow viewer auth, or anonymous only during true setup mode.

    Anonymous access is allowed only when setup is genuinely incomplete and
    require_auth_during_setup is disabled.
    """
    if context is not None:
        return context

    config_manager = get_config_manager()
    security = config_manager.config.security

    if is_truly_in_setup_mode() and not security.require_auth_during_setup:
        return None

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide X-API-Key header or Authorization Bearer token.",
        headers={"WWW-Authenticate": 'ApiKey realm="X-API-Key"'},
    )


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
    context: SecurityContext = Depends(require_viewer),
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
    context: SecurityContext | None = Depends(require_viewer_or_setup_discovery),
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
    context: SecurityContext = Depends(require_viewer),
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
    context: SecurityContext = Depends(require_operator),
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
