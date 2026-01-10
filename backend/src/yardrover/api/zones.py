"""Zone management API endpoints

Provides REST API endpoints for zone CRUD operations.
Supports incremental sync with metadata-based queries.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError

from yardrover.auth import SecurityContext, require_operator, require_viewer
from yardrover.models.resources import (
    ResourceResult,
    ResourceType,
    Zone,
    ZoneListResponse,
    ZoneMetadata,
    ZoneOperationResponse,
)
from yardrover.resources.storage import ResourceStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/zones", tags=["zones"])

# Global resource storage instance (will be injected during startup)
_storage: Optional[ResourceStorage] = None


def set_storage(storage: ResourceStorage) -> None:
    """Set the global resource storage instance

    Args:
        storage: Resource storage instance
    """
    global _storage
    _storage = storage


@router.get("", response_model=ZoneListResponse)
async def list_zones(
    since: int = Query(0, description="Return only zones modified after this timestamp (microseconds since epoch)"),
    context: SecurityContext = Depends(require_viewer),
) -> ZoneListResponse:
    """List all zones with optional incremental sync

    Returns zone metadata for all zones, optionally filtered by timestamp.
    Supports incremental sync by returning only zones modified after `since`.

    Args:
        since: Timestamp filter (microseconds since epoch)

    Returns:
        Zone list response with metadata and sync information
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
        # Get zone metadata from cache
        metadata_list = await _storage.list_resources(ResourceType.ZONE, since=since)

        # Convert to API models
        zones = [
            ZoneMetadata(
                id=meta.id,
                version=meta.version,
                timestamp=meta.timestamp,
                size=meta.size,
            )
            for meta in metadata_list
        ]

        # Get current version (latest timestamp)
        version = max((meta.timestamp for meta in metadata_list), default=0)

        return ZoneListResponse(
            zones=zones,
            deleted=[],  # TODO: Track deleted zones for incremental sync
            version=version,
            count=len(zones),
        )

    except Exception as e:
        logger.error(f"Failed to list zones: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list zones: {str(e)}",
        )


@router.post("", response_model=ZoneOperationResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    zone: Zone,
    context: SecurityContext = Depends(require_operator),
) -> ZoneOperationResponse:
    """Create a new zone

    Creates a new zone and queues it for storage. The operation is asynchronous
    and the zone will be persisted in the background.

    Args:
        zone: Zone definition

    Returns:
        Operation response with zone ID and status
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
        # Serialize zone to JSON
        zone_json = zone.model_dump_json(by_alias=True)

        # Queue write operation
        result = await _storage.queue_write(
            resource_type=ResourceType.ZONE,
            resource_id=zone.id,
            data=zone_json,
            version=1,
        )

        if result == ResourceResult.SUCCESS:
            logger.info(f"Zone created: {zone.id}")
            return ZoneOperationResponse(id=zone.id, status="queued")
        elif result == ResourceResult.QUEUE_FULL:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Write queue is full, please try again later",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create zone: {result.value}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create zone: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create zone: {str(e)}",
        )


@router.get("/{zone_id}", response_model=Zone)
async def get_zone(
    zone_id: str,
    context: SecurityContext = Depends(require_viewer),
) -> Zone:
    """Get a specific zone by ID

    Retrieves the full zone definition for the specified zone ID.

    Args:
        zone_id: Zone identifier

    Returns:
        Zone definition

    Raises:
        HTTPException: 404 if zone not found
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
        # Read zone data
        result, data = await _storage.read_resource(ResourceType.ZONE, zone_id)

        if result == ResourceResult.NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Zone not found: {zone_id}",
            )
        elif result != ResourceResult.SUCCESS or not data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read zone: {result.value}",
            )

        # Parse and validate zone data
        zone = Zone.model_validate_json(data)
        return zone

    except HTTPException:
        raise
    except ValidationError as e:
        logger.error(f"Failed to validate zone data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid zone data: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Failed to get zone: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get zone: {str(e)}",
        )


@router.put("/{zone_id}", response_model=ZoneOperationResponse)
async def update_zone(
    zone_id: str,
    zone: Zone,
    context: SecurityContext = Depends(require_operator),
) -> ZoneOperationResponse:
    """Update an existing zone

    Updates an existing zone by replacing its data. The zone ID in the path
    must match the zone ID in the request body.

    Args:
        zone_id: Zone identifier
        zone: Updated zone definition

    Returns:
        Operation response with zone ID and status

    Raises:
        HTTPException: 400 if zone IDs don't match, 404 if zone not found
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    # Validate zone ID matches
    if zone_id != zone.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zone ID in path does not match zone ID in body",
        )

    try:
        # Check if zone exists
        exists = await _storage.resource_exists(ResourceType.ZONE, zone_id)
        if exists == ResourceResult.NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Zone not found: {zone_id}",
            )

        # Serialize zone to JSON
        zone_json = zone.model_dump_json(by_alias=True)

        # Queue write operation
        result = await _storage.queue_write(
            resource_type=ResourceType.ZONE,
            resource_id=zone.id,
            data=zone_json,
            version=1,  # TODO: Implement version tracking
        )

        if result == ResourceResult.SUCCESS:
            logger.info(f"Zone updated: {zone.id}")
            return ZoneOperationResponse(id=zone.id, status="queued")
        elif result == ResourceResult.QUEUE_FULL:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Write queue is full, please try again later",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update zone: {result.value}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update zone: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update zone: {str(e)}",
        )


@router.delete("/{zone_id}", response_model=ZoneOperationResponse)
async def delete_zone(
    zone_id: str,
    context: SecurityContext = Depends(require_operator),
) -> ZoneOperationResponse:
    """Delete a zone

    Deletes the specified zone. This operation is synchronous and the zone
    will be removed immediately.

    Args:
        zone_id: Zone identifier

    Returns:
        Operation response with zone ID and status

    Raises:
        HTTPException: 404 if zone not found
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
        # Delete zone
        result = await _storage.delete_resource(ResourceType.ZONE, zone_id)

        if result == ResourceResult.NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Zone not found: {zone_id}",
            )
        elif result != ResourceResult.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete zone: {result.value}",
            )

        logger.info(f"Zone deleted: {zone_id}")
        return ZoneOperationResponse(id=zone_id, status="success")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete zone: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete zone: {str(e)}",
        )
