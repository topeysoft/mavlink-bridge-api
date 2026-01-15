"""RTCM API endpoints.

This module provides REST API endpoints for RTCM client management,
NTRIP connection control, and output routing configuration.
"""

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from yardrover.auth import SecurityContext, require_operator, require_viewer
from yardrover.core.events import get_event_bus
from yardrover.core.logging import get_logger
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
    TCPSourceConfig,
    UDPSourceConfig,
)
from yardrover.rtcm.ntrip import NTRIPClient
from yardrover.rtcm.router import RTCMOutputRouter
from yardrover.rtcm.storage import get_rtcm_config_store
from yardrover.rtcm.tcp_client import TCPClient
from yardrover.rtcm.udp_client import UDPClient

logger = get_logger(__name__)

router = APIRouter(prefix="/api/rtcm", tags=["rtcm"])


def is_fc_output(target) -> bool:
    """Check if output target is intended for Flight Controller.

    Detects FC outputs by checking for:
    - Name contains "flight", "controller", or "fc" (case insensitive)
    - Transport type is "serial"

    Args:
        target: RTCMOutputTarget to check

    Returns:
        True if target appears to be for Flight Controller
    """
    name_lower = target.name.lower()
    is_fc_name = 'flight' in name_lower or 'controller' in name_lower or 'fc' in name_lower
    is_serial = target.transport.type == 'serial'
    return is_fc_name and is_serial

# Global instances (will be set during app startup)
_ntrip_client: Optional[NTRIPClient] = None
_output_router: Optional[RTCMOutputRouter] = None
_stats_broadcast_task: Optional[asyncio.Task] = None


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


async def _broadcast_rtcm_status_with_router_stats(event_bus: EventBus) -> None:
    """Background task to broadcast RTCM status with router statistics every 2 seconds."""
    global _ntrip_client, _output_router

    logger.info("Starting unified RTCM status broadcast loop")

    try:
        while True:
            await asyncio.sleep(2.0)

            if not _ntrip_client or not _output_router:
                continue

            try:
                # Determine client type
                client_type = "NTRIP"
                if isinstance(_ntrip_client, TCPClient):
                    client_type = "TCP"
                elif isinstance(_ntrip_client, UDPClient):
                    client_type = "UDP"

                # Get client statistics
                stats = _ntrip_client.statistics

                # Merge router statistics
                router_stats = _output_router.get_statistics()
                stats.messages_sent = router_stats.get("messages_routed", 0)
                stats.bytes_sent = router_stats.get("bytes_routed", 0)
                stats.routing_errors = router_stats.get("routing_errors", 0)
                stats.total_targets = router_stats.get("total_targets", 0)
                stats.active_targets = router_stats.get("active_targets", 0)

                # Add per-target statistics
                from yardrover.models.rtcm import RTCMOutputTargetStats
                stats.output_targets = [
                    RTCMOutputTargetStats(**target_stat)
                    for target_stat in router_stats.get("targets", [])
                ]

                # Publish complete status via WebSocket
                status_data = {
                    "running": True,
                    "state": _ntrip_client.state.value,
                    "client_type": client_type,
                    "connected": _ntrip_client.is_connected,
                    "statistics": stats.model_dump(),
                }

                logger.debug(f"Broadcasting RTCM status with {len(stats.output_targets)} output targets")
                await event_bus.publish("rtcm.status.changed", status_data)

            except Exception as e:
                logger.error("rtcm_status_broadcast_error", error=str(e))

    except asyncio.CancelledError:
        logger.info("Unified RTCM status broadcast loop cancelled")
        raise


# ============================================================================
# RTCM Client Control Endpoints
# ============================================================================

@router.post("/start", response_model=RTCMStartResponse)
async def start_rtcm_client(
    request: RTCMStartRequest,
    context: SecurityContext = Depends(require_operator),
) -> RTCMStartResponse:
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
    global _ntrip_client, _output_router, _stats_broadcast_task

    # Stop existing client if running
    if _ntrip_client:
        await _ntrip_client.stop()
        _ntrip_client = None

    # Stop existing stats broadcast task
    if _stats_broadcast_task and not _stats_broadcast_task.done():
        _stats_broadcast_task.cancel()
        try:
            await _stats_broadcast_task
        except asyncio.CancelledError:
            pass
        _stats_broadcast_task = None

    # Clear existing router
    if _output_router:
        await _output_router.close()
        _output_router = None
        # Give OS time to release serial port and other resources
        # This prevents "address already in use" or "port busy" errors
        # when switching between different RTCM client types
        # UDP needs extra time for socket cleanup
        await asyncio.sleep(0.25)

    try:
        # Get event bus for WebSocket event publishing
        event_bus = get_event_bus()

        # Create output router with event bus
        output_router = RTCMOutputRouter(event_bus=event_bus)

        # Handle Flight Controller output routing
        from yardrover.core.config import get_config_manager
        from yardrover.models.rtcm import OutputFormat, SerialOutputConfig, RTCMOutputTarget

        config_manager = get_config_manager()

        # Determine which outputs to use
        if config_manager.config.rtcm.output_to_fc:
            # Add backend-configured FC output (uses YARDROVER_SERIAL_PORT)
            fc_output = RTCMOutputTarget(
                name="flight_controller",
                enabled=True,
                format=OutputFormat.MAVLINK,
                transport=SerialOutputConfig(
                    port=config_manager.config.serial.port,
                    baudrate=config_manager.config.serial.baudrate,
                ),
            )
            await output_router.add_target(fc_output)
            logger.info(
                "rtcm_fc_output_added",
                serial_port=config_manager.config.serial.port,
                baudrate=config_manager.config.serial.baudrate,
            )

            # Filter out user-provided FC outputs (they use hardcoded ports)
            user_outputs = [t for t in request.config.outputs if not is_fc_output(t)]
            filtered_count = len(request.config.outputs) - len(user_outputs)
            if filtered_count > 0:
                logger.info(
                    "rtcm_user_fc_outputs_filtered",
                    count=filtered_count,
                    reason="output_to_fc enabled, using backend serial port config",
                )
        else:
            # Use all user-provided outputs as-is
            user_outputs = request.config.outputs
            logger.info("rtcm_fc_output_disabled", note="Using user-provided outputs only")

        # Add user-configured output targets (non-FC outputs)
        logger.info(f"Adding {len(user_outputs)} user-configured output targets")
        for target in user_outputs:
            logger.info(f"Adding output target: {target.name} ({target.transport.type})")
            await output_router.add_target(target)

        # Data callback routes RTCM data to outputs
        async def data_callback(data: bytes) -> None:
            await output_router.route(data)

        # Create client based on source type
        client = None
        client_type = "Unknown"

        if isinstance(request.config.source, NTRIPConfig):
            # NTRIP client (disable internal stats broadcast, we handle it here with router stats)
            client = NTRIPClient(
                config=request.config.source,
                event_bus=event_bus,
                data_callback=lambda data: asyncio.create_task(data_callback(data)),
                enable_stats_broadcast=False  # We broadcast stats with router data
            )
            client_type = "NTRIP"

        elif isinstance(request.config.source, TCPSourceConfig):
            # TCP client (disable internal stats broadcast, we handle it here with router stats)
            client = TCPClient(
                config=request.config.source,
                event_bus=event_bus,
                data_callback=lambda data: asyncio.create_task(data_callback(data)),
                enable_stats_broadcast=False  # We broadcast stats with router data
            )
            client_type = "TCP"

        elif isinstance(request.config.source, UDPSourceConfig):
            # UDP client (disable internal stats broadcast, we handle it here with router stats)
            client = UDPClient(
                config=request.config.source,
                event_bus=event_bus,
                data_callback=lambda data: asyncio.create_task(data_callback(data)),
                enable_stats_broadcast=False  # We broadcast stats with router data
            )
            client_type = "UDP"

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported RTCM source type: {type(request.config.source).__name__}"
            )

        # Start client
        success = await client.start()

        if success:
            _ntrip_client = client
            _output_router = output_router

            # Start unified stats broadcast task (combines client + router stats)
            _stats_broadcast_task = asyncio.create_task(
                _broadcast_rtcm_status_with_router_stats(event_bus)
            )

            # Save configuration for persistence
            try:
                config_store = get_rtcm_config_store()
                await config_store.save_config(request.config)
                logger.info("rtcm_config_persisted")
            except Exception as e:
                logger.warning("rtcm_config_persistence_failed", error=str(e))
                # Continue anyway - persistence failure shouldn't prevent operation

            return RTCMStartResponse(
                success=True,
                message=f"RTCM {client_type} client started successfully",
                state=client.state
            )
        else:
            # Client failed to start - get detailed error from client
            last_error = client.last_error if hasattr(client, 'last_error') and client.last_error else None

            if last_error:
                # Use the detailed error message from the client
                error_msg = f"Failed to start RTCM {client_type} client: {last_error}"
            else:
                # Fallback to generic error if last_error not available
                error_msg = f"Failed to start RTCM {client_type} client"
                if client_type == "TCP":
                    error_msg += f" - Unable to connect to {request.config.source.host}:{request.config.source.port}"
                elif client_type == "UDP":
                    error_msg += f" - Unable to bind to port {request.config.source.port}"
                elif client_type == "NTRIP":
                    error_msg += f" - Unable to connect to {request.config.source.host}:{request.config.source.port}{request.config.source.mountpoint}"

            logger.error(
                "rtcm_client_start_failed",
                client_type=client_type,
                error=error_msg,
                last_error=last_error,
            )

            # Clean up router since client failed
            if output_router:
                await output_router.close()
                _output_router = None

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

    except HTTPException:
        # Re-raise HTTP exceptions (from our own error handling above)
        raise
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(
            "rtcm_start_exception",
            error_type=error_type,
            error=error_msg,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start RTCM client: {error_type} - {error_msg}"
        )


@router.post("/stop", response_model=RTCMStopResponse)
async def stop_rtcm_client(
    context: SecurityContext = Depends(require_operator),
) -> RTCMStopResponse:
    """Stop RTCM client.

    This endpoint stops the NTRIP client connection and ceases receiving
    RTCM correction data. All output targets are also stopped.

    Returns:
        RTCMStopResponse with status

    Raises:
        HTTPException: If client not running
    """
    global _ntrip_client, _output_router, _stats_broadcast_task

    if not _ntrip_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RTCM client not running"
        )

    try:
        await _ntrip_client.stop()
        _ntrip_client = None

        # Stop stats broadcast task
        if _stats_broadcast_task and not _stats_broadcast_task.done():
            _stats_broadcast_task.cancel()
            try:
                await _stats_broadcast_task
            except asyncio.CancelledError:
                pass
            _stats_broadcast_task = None

        if _output_router:
            await _output_router.close()
            _output_router = None

        return RTCMStopResponse(
            success=True,
            message="RTCM client stopped successfully"
        )

    except Exception as e:
        error_type = type(e).__name__
        logger.error(
            "rtcm_stop_exception",
            error_type=error_type,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop RTCM client: {str(e)}"
        )


@router.get("/status", response_model=RTCMStatus)
async def get_rtcm_status(
    context: SecurityContext = Depends(require_viewer),
) -> RTCMStatus:
    """Get RTCM client status.

    Returns current connection state, statistics, and uptime information.

    Returns:
        RTCMStatus with current status

    Raises:
        HTTPException: If client not initialized
    """
    client = get_ntrip_client()
    router_instance = get_output_router()

    try:
        # Determine client type
        client_type = "NTRIP"
        if isinstance(client, TCPClient):
            client_type = "TCP"
        elif isinstance(client, UDPClient):
            client_type = "UDP"

        # Get client statistics
        stats = client.statistics

        # Merge router statistics into client statistics
        router_stats = router_instance.get_statistics()
        stats.messages_sent = router_stats.get("messages_routed", 0)
        stats.bytes_sent = router_stats.get("bytes_routed", 0)
        stats.routing_errors = router_stats.get("routing_errors", 0)
        stats.total_targets = router_stats.get("total_targets", 0)
        stats.active_targets = router_stats.get("active_targets", 0)

        # Add per-target statistics
        from yardrover.models.rtcm import RTCMOutputTargetStats
        stats.output_targets = [
            RTCMOutputTargetStats(**target_stat)
            for target_stat in router_stats.get("targets", [])
        ]

        logger.debug(f"RTCM status - router has {stats.total_targets} total targets, {stats.active_targets} active, {len(stats.output_targets)} in output_targets array")

        return RTCMStatus(
            running=True,
            state=client.state,
            client_type=client_type,
            connected=client.is_connected,
            uptime=0,  # TODO: Track uptime
            statistics=stats,
            last_error=None,
        )

    except Exception as e:
        error_type = type(e).__name__
        logger.error(
            "rtcm_get_status_exception",
            error_type=error_type,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get RTCM status: {str(e)}"
        )


@router.get("/statistics")
async def get_rtcm_statistics(
    context: SecurityContext = Depends(require_viewer),
) -> dict:
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
        logger.error("rtcm_get_statistics_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get RTCM statistics: {str(e)}"
        )


@router.post("/statistics/reset")
async def reset_rtcm_statistics(
    context: SecurityContext = Depends(require_operator),
) -> dict:
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
        logger.error("rtcm_reset_statistics_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset RTCM statistics: {str(e)}"
        )


# ============================================================================
# Configuration Endpoints
# ============================================================================

@router.get("/config")
async def get_rtcm_config(
    context: SecurityContext = Depends(require_viewer),
) -> dict:
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
        source_config = {}

        if isinstance(client, NTRIPClient):
            source_config = {
                "type": "ntrip",
                "host": client.config.host,
                "port": client.config.port,
                "mountpoint": client.config.mountpoint,
                "username": client.config.username,
                "send_position": client.config.send_position,
                "user_agent": client.config.user_agent,
                "gga_interval": client.config.gga_interval,
            }
        elif isinstance(client, TCPClient):
            source_config = {
                "type": "tcp",
                "host": client.config.host,
                "port": client.config.port,
            }
        elif isinstance(client, UDPClient):
            source_config = {
                "type": "udp",
                "port": client.config.port,
            }

        return {
            "enabled": True,  # If we have a client, it's enabled
            "source": source_config,
            "outputs": router_instance.get_target_info(),
        }

    except Exception as e:
        logger.error("rtcm_get_config_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get RTCM config: {str(e)}"
        )


# ============================================================================
# Output Router Endpoints
# ============================================================================

@router.get("/outputs")
async def get_outputs(
    context: SecurityContext = Depends(require_viewer),
) -> dict:
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
        logger.error("rtcm_get_outputs_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get outputs: {str(e)}"
        )


@router.post("/outputs", response_model=RTCMAddOutputResponse)
async def add_output(
    request: RTCMAddOutputRequest,
    context: SecurityContext = Depends(require_operator),
) -> RTCMAddOutputResponse:
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
        logger.error("rtcm_add_output_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add output: {str(e)}"
        )


@router.delete("/outputs/{name}", response_model=RTCMRemoveOutputResponse)
async def remove_output(
    name: str,
    context: SecurityContext = Depends(require_operator),
) -> RTCMRemoveOutputResponse:
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
        logger.error("rtcm_remove_output_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove output: {str(e)}"
        )


@router.patch("/outputs/{name}/enabled", response_model=RTCMSetOutputEnabledResponse)
async def set_output_enabled(
    name: str,
    request: RTCMSetOutputEnabledRequest,
    context: SecurityContext = Depends(require_operator),
) -> RTCMSetOutputEnabledResponse:
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
        logger.error("rtcm_set_output_enabled_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set output enabled: {str(e)}"
        )


@router.post("/outputs/toggle", response_model=RTCMToggleOutputsResponse)
async def toggle_outputs(
    request: RTCMToggleOutputsRequest,
    context: SecurityContext = Depends(require_operator),
) -> RTCMToggleOutputsResponse:
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
        logger.error("rtcm_toggle_outputs_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle outputs: {str(e)}"
        )


# ============================================================================
# Saved Configuration Endpoints
# ============================================================================

@router.get("/saved-config")
async def get_saved_rtcm_config(
    context: SecurityContext = Depends(require_viewer),
) -> dict:
    """Get saved RTCM configuration.

    Returns the persisted RTCM configuration that will be used on service restart.

    Returns:
        Dictionary with saved configuration or null if no config saved

    Raises:
        HTTPException: If loading fails
    """
    config_store = get_rtcm_config_store()

    try:
        has_config = await config_store.has_config()

        if not has_config:
            return {"saved": False, "config": None}

        config = await config_store.load_config()

        return {
            "saved": True,
            "config": config.model_dump(mode="json", exclude_none=True),
        }

    except Exception as e:
        logger.error("rtcm_get_saved_config_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get saved RTCM config: {str(e)}"
        )


@router.delete("/saved-config")
async def delete_saved_rtcm_config(
    context: SecurityContext = Depends(require_operator),
) -> dict:
    """Delete saved RTCM configuration.

    Removes the persisted configuration. The RTCM client will not auto-start
    on next service restart.

    Returns:
        Success message

    Raises:
        HTTPException: If delete fails or no config exists
    """
    config_store = get_rtcm_config_store()

    try:
        has_config = await config_store.has_config()

        if not has_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No saved RTCM configuration found"
            )

        await config_store.delete_config()

        return {
            "success": True,
            "message": "Saved RTCM configuration deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("rtcm_delete_saved_config_exception", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete saved RTCM config: {str(e)}"
        )


# Import asyncio for async task creation
import asyncio
