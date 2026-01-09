"""RTCM API endpoints.

This module provides REST API endpoints for RTCM client management,
NTRIP connection control, and output routing configuration.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status

from yardrover.models.rtcm import (
    NTRIPConfig,
    RTCMAddOutputRequest,
    RTCMAddOutputResponse,
    RTCMRemoveOutputRequest,
    RTCMRemoveOutputResponse,
    RTCMSetOutputEnabledRequest,
    RTCMSetOutputEnabledResponse,
    RTCMStartRequest,
    RTCMStartResponse,
    RTCMState,
    RTCMStatus,
    RTCMStopResponse,
    RTCMToggleOutputsRequest,
    RTCMToggleOutputsResponse,
)
from yardrover.rtcm.ntrip import NTRIPClient
from yardrover.rtcm.router import RTCMOutputRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rtcm", tags=["rtcm"])

# Global instances (will be set during app startup)
_ntrip_client: Optional[NTRIPClient] = None
_output_router: Optional[RTCMOutputRouter] = None


def get_ntrip_client() -> NTRIPClient:
    """Get the global NTRIPClient instance.

    Returns:
        NTRIPClient instance

    Raises:
        HTTPException: If client not initialized
    """
    if _ntrip_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RTCM client not initialized"
        )
    return _ntrip_client


def get_output_router() -> RTCMOutputRouter:
    """Get the global RTCMOutputRouter instance.

    Returns:
        RTCMOutputRouter instance

    Raises:
        HTTPException: If router not initialized
    """
    if _output_router is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RTCM output router not initialized"
        )
    return _output_router


def set_ntrip_client(client: Optional[NTRIPClient]) -> None:
    """Set the global NTRIPClient instance.

    Args:
        client: NTRIPClient instance or None
    """
    global _ntrip_client
    _ntrip_client = client


def set_output_router(router_instance: Optional[RTCMOutputRouter]) -> None:
    """Set the global RTCMOutputRouter instance.

    Args:
        router_instance: RTCMOutputRouter instance or None
    """
    global _output_router
    _output_router = router_instance


# ============================================================================
# RTCM Client Control Endpoints
# ============================================================================

@router.post("/start", response_model=RTCMStartResponse)
async def start_rtcm_client(request: RTCMStartRequest) -> RTCMStartResponse:
    """Start RTCM client with given configuration.

    This endpoint starts the NTRIP client connection and begins receiving
    RTCM correction data. The client will attempt to connect to the specified
    caster and authenticate.

    Args:
        request: RTCM start request with configuration

    Returns:
        RTCMStartResponse with status and state

    Raises:
        HTTPException: If client already running or start fails
    """
    global _ntrip_client, _output_router

    # Stop existing client if running
    if _ntrip_client:
        await _ntrip_client.stop()
        _ntrip_client = None

    # Clear existing router
    if _output_router:
        await _output_router.close()
        _output_router = None

    try:
        # Create output router
        output_router = RTCMOutputRouter()

        # Add configured output targets
        for target in request.config.outputs:
            await output_router.add_target(target)

        # Create NTRIP client (only NTRIP is supported for now)
        if not isinstance(request.config.source, NTRIPConfig):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only NTRIP source is currently supported"
            )

        # Data callback routes RTCM data to outputs
        async def data_callback(data: bytes) -> None:
            await output_router.route(data)

        ntrip_client = NTRIPClient(
            config=request.config.source,
            data_callback=lambda data: asyncio.create_task(data_callback(data))
        )

        # Start client
        success = await ntrip_client.start()

        if success:
            _ntrip_client = ntrip_client
            _output_router = output_router

            return RTCMStartResponse(
                success=True,
                message="RTCM client started successfully",
                state=ntrip_client.state
            )
        else:
            return RTCMStartResponse(
                success=False,
                message="Failed to start RTCM client",
                state=RTCMState.ERROR
            )

    except Exception as e:
        logger.error(f"Error starting RTCM client: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start RTCM client: {str(e)}"
        )


@router.post("/stop", response_model=RTCMStopResponse)
async def stop_rtcm_client() -> RTCMStopResponse:
    """Stop RTCM client.

    This endpoint stops the NTRIP client connection and ceases receiving
    RTCM correction data. All output targets are also stopped.

    Returns:
        RTCMStopResponse with status

    Raises:
        HTTPException: If client not running
    """
    global _ntrip_client, _output_router

    if not _ntrip_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RTCM client not running"
        )

    try:
        await _ntrip_client.stop()
        _ntrip_client = None

        if _output_router:
            await _output_router.close()
            _output_router = None

        return RTCMStopResponse(
            success=True,
            message="RTCM client stopped successfully"
        )

    except Exception as e:
        logger.error(f"Error stopping RTCM client: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop RTCM client: {str(e)}"
        )


@router.get("/status", response_model=RTCMStatus)
async def get_rtcm_status() -> RTCMStatus:
    """Get RTCM client status.

    Returns current connection state, statistics, and uptime information.

    Returns:
        RTCMStatus with current status

    Raises:
        HTTPException: If client not initialized
    """
    client = get_ntrip_client()

    try:
        return RTCMStatus(
            running=True,
            state=client.state,
            client_type="NTRIP",
            connected=client.is_connected,
            uptime=0,  # TODO: Track uptime
            statistics=client.statistics,
            last_error=None,
        )

    except Exception as e:
        logger.error(f"Error getting RTCM status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get RTCM status: {str(e)}"
        )


@router.get("/statistics")
async def get_rtcm_statistics() -> dict:
    """Get RTCM statistics.

    Returns detailed statistics about RTCM client and output router.

    Returns:
        Dictionary with statistics

    Raises:
        HTTPException: If client not initialized
    """
    client = get_ntrip_client()
    router_instance = get_output_router()

    try:
        return {
            "client": client.statistics.model_dump(),
            "router": router_instance.get_statistics(),
        }

    except Exception as e:
        logger.error(f"Error getting RTCM statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get RTCM statistics: {str(e)}"
        )


@router.post("/statistics/reset")
async def reset_rtcm_statistics() -> dict:
    """Reset RTCM statistics.

    Resets all counters and statistics to zero.

    Returns:
        Success message

    Raises:
        HTTPException: If router not initialized
    """
    router_instance = get_output_router()

    try:
        router_instance.reset_statistics()
        return {"success": True, "message": "Statistics reset successfully"}

    except Exception as e:
        logger.error(f"Error resetting RTCM statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset RTCM statistics: {str(e)}"
        )


# ============================================================================
# Configuration Endpoints
# ============================================================================

@router.get("/config")
async def get_rtcm_config() -> dict:
    """Get current RTCM configuration.

    Returns the current runtime RTCM configuration including source settings
    and all configured output targets.

    Returns:
        Dictionary with RTCM configuration

    Raises:
        HTTPException: If client or router not initialized
    """
    client = get_ntrip_client()
    router_instance = get_output_router()

    try:
        # Build configuration from current client and router state
        return {
            "enabled": True,  # If we have a client, it's enabled
            "source": {
                "type": "ntrip",
                "host": client.config.host,
                "port": client.config.port,
                "mountpoint": client.config.mountpoint,
                "username": client.config.username,
                "send_position": client.config.send_position,
                "user_agent": client.config.user_agent,
                "gga_interval": client.config.gga_interval,
            },
            "outputs": router_instance.get_target_info(),
        }

    except Exception as e:
        logger.error(f"Error getting RTCM config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get RTCM config: {str(e)}"
        )


# ============================================================================
# Output Router Endpoints
# ============================================================================

@router.get("/outputs")
async def get_outputs() -> dict:
    """Get all configured output targets.

    Returns:
        Dictionary with output target information

    Raises:
        HTTPException: If router not initialized
    """
    router_instance = get_output_router()

    try:
        return {
            "targets": router_instance.get_target_info(),
            "total_targets": router_instance.get_target_count(),
            "active_targets": router_instance.get_active_target_count(),
        }

    except Exception as e:
        logger.error(f"Error getting outputs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get outputs: {str(e)}"
        )


@router.post("/outputs", response_model=RTCMAddOutputResponse)
async def add_output(request: RTCMAddOutputRequest) -> RTCMAddOutputResponse:
    """Add a new output routing target.

    Args:
        request: Add output request with target configuration

    Returns:
        RTCMAddOutputResponse with status

    Raises:
        HTTPException: If router not initialized or add fails
    """
    router_instance = get_output_router()

    try:
        success = await router_instance.add_target(request.target)

        if success:
            return RTCMAddOutputResponse(
                success=True,
                message=f"Output target '{request.target.name}' added successfully",
                target_index=router_instance.get_target_count() - 1
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to add output target '{request.target.name}'"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding output: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add output: {str(e)}"
        )


@router.delete("/outputs/{name}", response_model=RTCMRemoveOutputResponse)
async def remove_output(name: str) -> RTCMRemoveOutputResponse:
    """Remove an output routing target.

    Args:
        name: Target name to remove

    Returns:
        RTCMRemoveOutputResponse with status

    Raises:
        HTTPException: If router not initialized or target not found
    """
    router_instance = get_output_router()

    try:
        success = await router_instance.remove_target(name)

        if success:
            return RTCMRemoveOutputResponse(
                success=True,
                message=f"Output target '{name}' removed successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Output target '{name}' not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing output: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove output: {str(e)}"
        )


@router.patch("/outputs/{name}/enabled", response_model=RTCMSetOutputEnabledResponse)
async def set_output_enabled(name: str, request: RTCMSetOutputEnabledRequest) -> RTCMSetOutputEnabledResponse:
    """Enable or disable an output target.

    Args:
        name: Target name
        request: Request with enabled state

    Returns:
        RTCMSetOutputEnabledResponse with status

    Raises:
        HTTPException: If router not initialized or target not found
    """
    router_instance = get_output_router()

    try:
        success = await router_instance.set_target_enabled(name, request.enabled)

        if success:
            action = "enabled" if request.enabled else "disabled"
            return RTCMSetOutputEnabledResponse(
                success=True,
                message=f"Output target '{name}' {action} successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Output target '{name}' not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting output enabled: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set output enabled: {str(e)}"
        )


@router.post("/outputs/toggle", response_model=RTCMToggleOutputsResponse)
async def toggle_outputs(request: RTCMToggleOutputsRequest) -> RTCMToggleOutputsResponse:
    """Toggle multiple output targets on or off.

    This endpoint allows bulk enabling/disabling of multiple output targets
    in a single operation. Useful for quickly controlling data flow.

    Args:
        request: Request with target names and desired enabled state

    Returns:
        RTCMToggleOutputsResponse with status and results

    Raises:
        HTTPException: If router not initialized
    """
    router_instance = get_output_router()

    try:
        toggled = []
        failed = []

        for name in request.names:
            success = await router_instance.set_target_enabled(name, request.enabled)
            if success:
                toggled.append(name)
            else:
                failed.append(name)

        # Build response message
        action = "enabled" if request.enabled else "disabled"
        if not failed:
            message = f"Successfully {action} {len(toggled)} output target(s)"
        else:
            message = f"{action.capitalize()} {len(toggled)} target(s), {len(failed)} failed"

        return RTCMToggleOutputsResponse(
            success=len(failed) == 0,
            message=message,
            toggled=toggled,
            failed=failed
        )

    except Exception as e:
        logger.error(f"Error toggling outputs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle outputs: {str(e)}"
        )


# Import asyncio for async task creation
import asyncio
