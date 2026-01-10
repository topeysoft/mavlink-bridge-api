"""MAVLink API endpoints.

This module provides REST API endpoints for MAVLink command execution,
parameter management, and mission operations.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from yardrover.auth import SecurityContext, require_operator, require_viewer
from yardrover.mavlink.processor import MAVLinkProcessor
from yardrover.mavlink.router import DataRouter
from yardrover.models.mavlink import (
    ArmDisarmCommand,
    MAVLinkCommand,
    MAVLinkCommandResponse,
    MAVLinkStatistics,
    MissionClearRequest,
    MissionDownloadRequest,
    MissionResponse,
    MissionSetCurrentRequest,
    MissionStatusRequest,
    MissionUploadRequest,
    ParameterListRequest,
    ParameterRequest,
    ParameterSetRequest,
    ParameterValue,
    SerialConfig,
    SerialStatus,
    SetModeCommand,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mavlink", tags=["mavlink"])

# Global router instance (will be set during app startup)
_router: Optional[DataRouter] = None


def get_router() -> DataRouter:
    """Get the global DataRouter instance.

    Returns:
        DataRouter instance

    Raises:
        HTTPException: If router not initialized
    """
    if _router is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MAVLink router not initialized",
        )
    return _router


def set_router(data_router: DataRouter) -> None:
    """Set the global DataRouter instance.

    Args:
        data_router: DataRouter instance to use
    """
    global _router
    _router = data_router


# ==================== Command Endpoints ====================


@router.post("/command", response_model=MAVLinkCommandResponse)
async def send_command(
    command: MAVLinkCommand,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MAVLinkCommandResponse:
    """Send MAVLink command to flight controller.

    Args:
        command: MAVLink command to send
        router: DataRouter dependency

    Returns:
        Command response

    Raises:
        HTTPException: If router not connected
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Build command message
        msg = MAVLinkProcessor.build_command_long(
            target_system=command.target_system,
            target_component=command.target_component,
            command=command.command,
            param1=command.param1,
            param2=command.param2,
            param3=command.param3,
            param4=command.param4,
            param5=command.param5,
            param6=command.param6,
            param7=command.param7,
        )

        # Send to flight controller
        await router.send_mavlink_message(msg)

        return MAVLinkCommandResponse(
            success=True,
            message=f"Command {command.command} sent",
            sequence_number=msg.get_seq() if hasattr(msg, "get_seq") else None,
        )

    except Exception as e:
        logger.error(f"Failed to send MAVLink command: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send command: {str(e)}",
        )


@router.post("/command/arm", response_model=MAVLinkCommandResponse)
async def arm_disarm(
    command: ArmDisarmCommand,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MAVLinkCommandResponse:
    """Arm or disarm the vehicle.

    Args:
        command: Arm/disarm command
        router: DataRouter dependency

    Returns:
        Command response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Build arm/disarm command
        msg = MAVLinkProcessor.build_arm_disarm_command(
            target_system=command.target_system,
            target_component=command.target_component,
            arm=command.arm,
            force=command.force,
        )

        # Send to flight controller
        await router.send_mavlink_message(msg)

        action = "arm" if command.arm else "disarm"
        return MAVLinkCommandResponse(
            success=True,
            message=f"Vehicle {action} command sent",
        )

    except Exception as e:
        logger.error(f"Failed to send arm/disarm command: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send command: {str(e)}",
        )


@router.post("/command/mode", response_model=MAVLinkCommandResponse)
async def set_mode(
    command: SetModeCommand,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MAVLinkCommandResponse:
    """Set flight mode.

    Args:
        command: Set mode command
        router: DataRouter dependency

    Returns:
        Command response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Build set mode command
        msg = MAVLinkProcessor.build_set_mode_command(
            target_system=command.target_system,
            target_component=command.target_component,
            custom_mode=command.custom_mode,
            base_mode=command.base_mode,
        )

        # Send to flight controller
        await router.send_mavlink_message(msg)

        return MAVLinkCommandResponse(
            success=True,
            message=f"Set mode to {command.custom_mode}",
        )

    except Exception as e:
        logger.error(f"Failed to set mode: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set mode: {str(e)}",
        )


# ==================== Parameter Endpoints ====================


@router.post("/parameters/request", response_model=MAVLinkCommandResponse)
async def request_parameter(
    request: ParameterRequest,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MAVLinkCommandResponse:
    """Request specific parameter from flight controller.

    Args:
        request: Parameter request
        router: DataRouter dependency

    Returns:
        Command response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    # Validate that either param_id or param_index is provided
    if request.param_id is None and request.param_index is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either param_id or param_index must be provided",
        )

    try:
        # Build parameter request
        msg = MAVLinkProcessor.build_parameter_request_read(
            target_system=request.target_system,
            target_component=request.target_component,
            param_id=request.param_id or "",
            param_index=request.param_index if request.param_index is not None else -1,
        )

        # Send to flight controller
        await router.send_mavlink_message(msg)

        return MAVLinkCommandResponse(
            success=True,
            message="Parameter request sent",
        )

    except Exception as e:
        logger.error(f"Failed to request parameter: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to request parameter: {str(e)}",
        )


@router.post("/parameters/list", response_model=MAVLinkCommandResponse)
async def request_parameter_list(
    request: ParameterListRequest,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MAVLinkCommandResponse:
    """Request complete parameter list from flight controller.

    Args:
        request: Parameter list request
        router: DataRouter dependency

    Returns:
        Command response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Build parameter list request
        msg = MAVLinkProcessor.build_parameter_request_list(
            target_system=request.target_system,
            target_component=request.target_component,
        )

        # Send to flight controller
        await router.send_mavlink_message(msg)

        return MAVLinkCommandResponse(
            success=True,
            message="Parameter list request sent",
        )

    except Exception as e:
        logger.error(f"Failed to request parameter list: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to request parameter list: {str(e)}",
        )


@router.post("/parameters/set", response_model=MAVLinkCommandResponse)
async def set_parameter(
    request: ParameterSetRequest,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MAVLinkCommandResponse:
    """Set parameter value on flight controller.

    Args:
        request: Parameter set request
        router: DataRouter dependency

    Returns:
        Command response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Build parameter set message
        msg = MAVLinkProcessor.build_parameter_set(
            target_system=request.target_system,
            target_component=request.target_component,
            param_id=request.param_id,
            param_value=request.param_value,
            param_type=request.param_type,
        )

        # Send to flight controller
        await router.send_mavlink_message(msg)

        return MAVLinkCommandResponse(
            success=True,
            message=f"Parameter {request.param_id} set to {request.param_value}",
        )

    except Exception as e:
        logger.error(f"Failed to set parameter: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set parameter: {str(e)}",
        )


@router.get("/parameters/stream")
async def stream_parameters(
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_viewer),
) -> StreamingResponse:
    """Stream parameters via Server-Sent Events (SSE).

    Args:
        router: DataRouter dependency

    Returns:
        SSE stream response

    Note:
        This endpoint streams parameter updates as they arrive from the FC.
        Client should subscribe to parameter events via WebSocket for real-time updates.
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    async def event_generator():
        """Generate SSE events for parameter updates."""
        # This is a placeholder - full implementation would listen for
        # PARAM_VALUE messages from the MAVLink processor
        yield "data: {\"message\": \"Parameter stream started\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ==================== Mission Endpoints ====================


@router.post("/mission/upload", response_model=MissionResponse)
async def upload_mission(
    request: MissionUploadRequest,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MissionResponse:
    """Upload mission plan to flight controller.

    Args:
        request: Mission upload request
        router: DataRouter dependency

    Returns:
        Mission operation response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Send mission count first
        count_msg = MAVLinkProcessor.build_mission_count(
            target_system=request.target_system,
            target_component=request.target_component,
            count=len(request.mission_items),
            mission_type=request.mission_type,
        )
        await router.send_mavlink_message(count_msg)

        # In full implementation, we'd wait for MISSION_REQUEST messages
        # and send each mission item in response
        # For now, just acknowledge the upload request

        return MissionResponse(
            success=True,
            message=f"Mission upload initiated ({len(request.mission_items)} items)",
            total_count=len(request.mission_items),
        )

    except Exception as e:
        logger.error(f"Failed to upload mission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload mission: {str(e)}",
        )


@router.post("/mission/download", response_model=MissionResponse)
async def download_mission(
    request: MissionDownloadRequest,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MissionResponse:
    """Download mission plan from flight controller.

    Args:
        request: Mission download request
        router: DataRouter dependency

    Returns:
        Mission operation response with mission items
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Send mission request list
        msg = MAVLinkProcessor.build_mission_request_list(
            target_system=request.target_system,
            target_component=request.target_component,
            mission_type=request.mission_type,
        )
        await router.send_mavlink_message(msg)

        # In full implementation, we'd wait for MISSION_COUNT
        # then request each mission item and build the response
        # For now, just acknowledge the request

        return MissionResponse(
            success=True,
            message="Mission download initiated",
            mission_items=[],  # Would be populated from responses
        )

    except Exception as e:
        logger.error(f"Failed to download mission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download mission: {str(e)}",
        )


@router.post("/mission/clear", response_model=MissionResponse)
async def clear_mission(
    request: MissionClearRequest,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MissionResponse:
    """Clear all mission items from flight controller.

    Args:
        request: Mission clear request
        router: DataRouter dependency

    Returns:
        Mission operation response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Send mission clear
        msg = MAVLinkProcessor.build_mission_clear(
            target_system=request.target_system,
            target_component=request.target_component,
            mission_type=request.mission_type,
        )
        await router.send_mavlink_message(msg)

        return MissionResponse(
            success=True,
            message="Mission clear command sent",
        )

    except Exception as e:
        logger.error(f"Failed to clear mission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear mission: {str(e)}",
        )


@router.post("/mission/set_current", response_model=MissionResponse)
async def set_current_mission_item(
    request: MissionSetCurrentRequest,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> MissionResponse:
    """Set current mission item sequence number.

    Args:
        request: Mission set current request
        router: DataRouter dependency

    Returns:
        Mission operation response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    try:
        # Send mission set current
        msg = MAVLinkProcessor.build_mission_set_current(
            target_system=request.target_system,
            target_component=request.target_component,
            seq=request.seq,
        )
        await router.send_mavlink_message(msg)

        return MissionResponse(
            success=True,
            message=f"Current mission item set to {request.seq}",
            current_seq=request.seq,
        )

    except Exception as e:
        logger.error(f"Failed to set current mission item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set current mission item: {str(e)}",
        )


@router.post("/mission/status", response_model=MissionResponse)
async def get_mission_status(
    request: MissionStatusRequest,
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_viewer),
) -> MissionResponse:
    """Get current mission status and progress.

    Args:
        request: Mission status request
        router: DataRouter dependency

    Returns:
        Mission status response
    """
    if not router.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serial port not connected",
        )

    # In full implementation, this would query the flight controller
    # and return current mission progress
    # For now, return a placeholder

    return MissionResponse(
        success=True,
        message="Mission status unavailable (requires FC integration)",
    )


# ==================== Statistics and Status ====================


@router.get("/statistics", response_model=MAVLinkStatistics)
async def get_statistics(
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_viewer),
) -> MAVLinkStatistics:
    """Get MAVLink processor statistics.

    Args:
        router: DataRouter dependency

    Returns:
        MAVLink statistics
    """
    return router.get_mavlink_statistics()


@router.post("/statistics/reset")
async def reset_statistics(
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_operator),
) -> dict:
    """Reset MAVLink statistics.

    Args:
        router: DataRouter dependency

    Returns:
        Success message
    """
    router.reset_statistics()
    return {"message": "Statistics reset"}


@router.get("/serial/status", response_model=SerialStatus)
async def get_serial_status(
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_viewer),
) -> SerialStatus:
    """Get serial port status.

    Args:
        router: DataRouter dependency

    Returns:
        Serial port status
    """
    return router.serial_manager.get_status()


@router.get("/firmware")
async def get_firmware_info(
    router: DataRouter = Depends(get_router),
    context: SecurityContext = Depends(require_viewer),
) -> dict:
    """Get detected firmware information.

    Args:
        router: DataRouter dependency

    Returns:
        Firmware information
    """
    return {
        "firmware_type": router.get_firmware_type(),
        "detected": router.get_firmware_type() != "unknown",
    }
