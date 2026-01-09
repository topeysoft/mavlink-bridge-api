"""
WiFi API endpoints.

Provides REST API for WiFi network management including connection,
disconnection, scanning, and status monitoring.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
import structlog

from ..core.errors import NetworkError
from ..models.network import (
    WiFiConnectResponse,
    WiFiCredentials,
    WiFiScanResponse,
    WiFiStatus,
)
from ..network.wifi import WiFiManager

logger = structlog.get_logger(__name__)

# Create router
router = APIRouter(prefix="/api/wifi", tags=["wifi"])


# Dependency to get WiFi manager from app state
def get_wifi_manager(request: Request) -> WiFiManager:
    """Get WiFi manager from app state."""
    wifi_manager = request.app.state.wifi_manager
    if wifi_manager is None:
        raise NetworkError(
            "WiFi manager not available (requires NetworkManager on Raspberry Pi)"
        )
    return wifi_manager


@router.post("/connect", response_model=WiFiConnectResponse)
async def connect_wifi(
    credentials: WiFiCredentials,
    wifi_manager: Annotated[WiFiManager, Depends(get_wifi_manager)],
) -> WiFiConnectResponse:
    """
    Connect to a WiFi network.

    The network credentials are automatically saved and will be used for
    auto-connect on boot.
    """
    logger.info("api_wifi_connect", ssid=credentials.ssid)

    try:
        state = await wifi_manager.connect(credentials, save=True)

        return WiFiConnectResponse(
            success=True,
            message=f"Connected to {credentials.ssid}",
            state=state,
        )

    except NetworkError as e:
        logger.error("api_wifi_connect_failed", ssid=credentials.ssid, error=str(e))
        status = await wifi_manager.get_status()
        return WiFiConnectResponse(
            success=False,
            message=str(e),
            state=status.state,
        )


@router.post("/disconnect")
async def disconnect_wifi(
    wifi_manager: Annotated[WiFiManager, Depends(get_wifi_manager)],
) -> dict[str, str]:
    """Disconnect from current WiFi network."""
    logger.info("api_wifi_disconnect")

    try:
        await wifi_manager.disconnect()
        return {"message": "Disconnected from WiFi"}

    except NetworkError as e:
        logger.error("api_wifi_disconnect_failed", error=str(e))
        raise


@router.get("/status", response_model=WiFiStatus)
async def get_wifi_status(
    wifi_manager: Annotated[WiFiManager, Depends(get_wifi_manager)],
) -> WiFiStatus:
    """Get current WiFi connection status."""
    return await wifi_manager.get_status()


@router.get("/scan", response_model=WiFiScanResponse)
async def scan_wifi(
    wifi_manager: Annotated[WiFiManager, Depends(get_wifi_manager)],
    force: Annotated[bool, Query(description="Force new scan")] = False,
) -> WiFiScanResponse:
    """
    Scan for available WiFi networks.

    By default, returns cached scan results. Use force=true to request a new scan.
    """
    logger.info("api_wifi_scan", force=force)

    try:
        networks = await wifi_manager.scan(force=force)
        return WiFiScanResponse(networks=networks)

    except NetworkError as e:
        logger.error("api_wifi_scan_failed", error=str(e))
        raise
