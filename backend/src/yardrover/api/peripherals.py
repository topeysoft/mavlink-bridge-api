"""Peripheral management API endpoints

Provides REST API endpoints for peripheral CRUD operations,
status monitoring, and command execution.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from yardrover.auth import SecurityContext, require_operator, require_viewer
from yardrover.models.peripherals import (
    CompatibilityCheckResponse,
    Peripheral,
    PeripheralCommandRequest,
    PeripheralListResponse,
    PeripheralMetadata,
    PeripheralOperationResponse,
    PeripheralTelemetry,
    PeripheralType,
)
from yardrover.peripherals.manager import PeripheralManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/peripherals", tags=["peripherals"])

# Global peripheral manager instance (will be injected during startup)
_manager: Optional[PeripheralManager] = None


def set_manager(manager: PeripheralManager) -> None:
    """Set the global peripheral manager instance

    Args:
        manager: Peripheral manager instance
    """
    global _manager
    _manager = manager


@router.get("", response_model=PeripheralListResponse)
async def list_peripherals(
    peripheral_type: Optional[PeripheralType] = Query(
        None, description="Filter by peripheral type"
    )
) -> PeripheralListResponse:
    """List all peripherals

    Returns list of all registered peripherals, optionally filtered by type.

    Args:
        peripheral_type: Optional peripheral type filter

    Returns:
        Peripheral list response with count and status summary
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        # Get peripherals
        peripherals = await _manager.list_peripherals(peripheral_type=peripheral_type)

        # Calculate counts
        count = len(peripherals)
        connected_count = sum(
            1
            for p in peripherals
            if p.status.state.value
            in ["connected", "ready", "active", "initializing"]
        )
        active_count = sum(1 for p in peripherals if p.status.active)

        return PeripheralListResponse(
            peripherals=peripherals,
            count=count,
            connected_count=connected_count,
            active_count=active_count,
        )

    except Exception as e:
        logger.error(f"Failed to list peripherals: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list peripherals: {str(e)}",
        )


@router.get("/stats")
async def get_stats(
    context: SecurityContext = Depends(require_viewer),
) -> dict:
    """Get peripheral manager statistics

    Returns statistics about peripherals including counts and totals.

    Returns:
        Statistics dictionary
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        return _manager.get_stats()

    except Exception as e:
        logger.error(f"Failed to get stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get stats: {str(e)}",
        )


@router.get("/compatibility/check", response_model=CompatibilityCheckResponse)
async def check_compatibility() -> CompatibilityCheckResponse:
    """Check peripheral compatibility

    Checks compatibility of currently enabled peripherals and reports
    any conflicts, missing requirements, or warnings.

    Returns:
        Compatibility check response with conflicts and warnings
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )
    """Check peripheral compatibility

    Checks compatibility of currently enabled peripherals and reports
    any conflicts, missing requirements, or warnings.

    Returns:
        Compatibility check response with conflicts and warnings
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        return await _manager.check_compatibility()

    except Exception as e:
        logger.error(f"Failed to check compatibility: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check compatibility: {str(e)}",
        )


@router.post(
    "", response_model=PeripheralOperationResponse, status_code=status.HTTP_201_CREATED
)
async def register_peripheral(
    metadata: PeripheralMetadata,
) -> PeripheralOperationResponse:
    """Register a new peripheral

    Manually register a peripheral with provided metadata.
    Normally peripherals are auto-detected, but this endpoint allows
    manual registration for testing or custom peripherals.

    Args:
        metadata: Peripheral metadata

    Returns:
        Operation response with peripheral ID and status
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        success = await _manager.register_peripheral(metadata)

        if success:
            logger.info(f"Peripheral registered: {metadata.peripheral_id}")
            return PeripheralOperationResponse(
                peripheral_id=metadata.peripheral_id,
                status="success",
                message="Peripheral registered successfully",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Peripheral already registered",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to register peripheral: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register peripheral: {str(e)}",
        )


@router.get("/{peripheral_id}", response_model=Peripheral)
async def get_peripheral(
    peripheral_id: str,
    context: SecurityContext = Depends(require_viewer),
) -> Peripheral:
    """Get peripheral details

    Retrieves full peripheral information including metadata, status, and telemetry.

    Args:
        peripheral_id: Peripheral identifier

    Returns:
        Peripheral object

    Raises:
        HTTPException: 404 if peripheral not found
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        peripheral = await _manager.get_peripheral(peripheral_id)

        if peripheral is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Peripheral not found: {peripheral_id}",
            )

        return peripheral

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get peripheral: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get peripheral: {str(e)}",
        )


@router.delete("/{peripheral_id}", response_model=PeripheralOperationResponse)
async def unregister_peripheral(peripheral_id: str) -> PeripheralOperationResponse:
    """Unregister a peripheral

    Removes a peripheral from the system. The peripheral will be disabled
    first if currently enabled.

    Args:
        peripheral_id: Peripheral identifier

    Returns:
        Operation response

    Raises:
        HTTPException: 404 if peripheral not found
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        success = await _manager.unregister_peripheral(peripheral_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Peripheral not found: {peripheral_id}",
            )

        logger.info(f"Peripheral unregistered: {peripheral_id}")
        return PeripheralOperationResponse(
            peripheral_id=peripheral_id,
            status="success",
            message="Peripheral unregistered successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to unregister peripheral: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unregister peripheral: {str(e)}",
        )


@router.get("/{peripheral_id}/status", response_model=dict)
async def get_peripheral_status(
    peripheral_id: str,
    context: SecurityContext = Depends(require_viewer),
) -> dict:
    """Get peripheral status

    Returns current operational status of the peripheral.

    Args:
        peripheral_id: Peripheral identifier

    Returns:
        Status dictionary

    Raises:
        HTTPException: 404 if peripheral not found
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        peripheral = await _manager.get_peripheral(peripheral_id)

        if peripheral is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Peripheral not found: {peripheral_id}",
            )

        return peripheral.status.model_dump()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get peripheral status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get peripheral status: {str(e)}",
        )


@router.get("/{peripheral_id}/telemetry", response_model=PeripheralTelemetry)
async def get_peripheral_telemetry(
    peripheral_id: str,
    context: SecurityContext = Depends(require_viewer),
) -> PeripheralTelemetry:
    """Get peripheral telemetry

    Returns latest telemetry data from the peripheral.

    Args:
        peripheral_id: Peripheral identifier

    Returns:
        Telemetry data

    Raises:
        HTTPException: 404 if peripheral not found or no telemetry available
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        peripheral = await _manager.get_peripheral(peripheral_id)

        if peripheral is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Peripheral not found: {peripheral_id}",
            )

        if peripheral.telemetry is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No telemetry available for this peripheral",
            )

        return peripheral.telemetry

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get peripheral telemetry: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get peripheral telemetry: {str(e)}",
        )


@router.post("/{peripheral_id}/enable", response_model=PeripheralOperationResponse)
async def enable_peripheral(
    peripheral_id: str,
    context: SecurityContext = Depends(require_operator),
) -> PeripheralOperationResponse:
    """Enable a peripheral

    Enables the peripheral for operation. Checks compatibility with
    currently enabled peripherals before enabling.

    Args:
        peripheral_id: Peripheral identifier

    Returns:
        Operation response

    Raises:
        HTTPException: 404 if peripheral not found, 409 if incompatible
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        success = await _manager.enable_peripheral(peripheral_id)

        if not success:
            # Could be not found or incompatible
            peripheral = await _manager.get_peripheral(peripheral_id)
            if peripheral is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Peripheral not found: {peripheral_id}",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cannot enable peripheral: incompatible with current configuration",
                )

        logger.info(f"Peripheral enabled: {peripheral_id}")
        return PeripheralOperationResponse(
            peripheral_id=peripheral_id,
            status="success",
            message="Peripheral enabled successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to enable peripheral: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable peripheral: {str(e)}",
        )


@router.post("/{peripheral_id}/disable", response_model=PeripheralOperationResponse)
async def disable_peripheral(
    peripheral_id: str,
    context: SecurityContext = Depends(require_operator),
) -> PeripheralOperationResponse:
    """Disable a peripheral

    Disables the peripheral and stops its operation.

    Args:
        peripheral_id: Peripheral identifier

    Returns:
        Operation response

    Raises:
        HTTPException: 404 if peripheral not found
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        success = await _manager.disable_peripheral(peripheral_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Peripheral not found: {peripheral_id}",
            )

        logger.info(f"Peripheral disabled: {peripheral_id}")
        return PeripheralOperationResponse(
            peripheral_id=peripheral_id,
            status="success",
            message="Peripheral disabled successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to disable peripheral: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable peripheral: {str(e)}",
        )


@router.post("/{peripheral_id}/command", response_model=PeripheralOperationResponse)
async def send_command(
    peripheral_id: str, command_request: PeripheralCommandRequest
) -> PeripheralOperationResponse:
    """Send command to peripheral

    Sends a command with parameters to the peripheral for execution.
    The peripheral must be enabled to accept commands.

    Args:
        peripheral_id: Peripheral identifier
        command_request: Command and parameters

    Returns:
        Operation response

    Raises:
        HTTPException: 404 if peripheral not found, 400 if not enabled
    """
    if not _manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Peripheral manager not available",
        )

    try:
        # Check if peripheral exists and is enabled
        peripheral = await _manager.get_peripheral(peripheral_id)
        if peripheral is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Peripheral not found: {peripheral_id}",
            )

        if not peripheral.status.enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Peripheral must be enabled to accept commands",
            )

        # Send command
        success = await _manager.send_command(
            peripheral_id, command_request.command, command_request.parameters
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send command to peripheral",
            )

        logger.info(
            f"Command sent to peripheral: {peripheral_id} - {command_request.command}"
        )
        return PeripheralOperationResponse(
            peripheral_id=peripheral_id,
            status="success",
            message=f"Command '{command_request.command}' sent successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send command: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send command: {str(e)}",
        )


