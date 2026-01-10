"""Scheduled mission management API endpoints

Provides REST API endpoints for scheduled mission CRUD operations.
Supports incremental sync with metadata-based queries.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError

from yardrover.auth import SecurityContext, require_operator, require_viewer
from yardrover.models.resources import (
    MissionListResponse,
    MissionMetadata,
    MissionOperationResponse,
    ResourceResult,
    ResourceType,
    ScheduledMission,
)
from yardrover.resources.storage import ResourceStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/missions", tags=["missions"])

# Global resource storage instance (will be injected during startup)
_storage: Optional[ResourceStorage] = None


def set_storage(storage: ResourceStorage) -> None:
    """Set the global resource storage instance

    Args:
        storage: Resource storage instance
    """
    global _storage
    _storage = storage


@router.get("", response_model=MissionListResponse)
async def list_missions(
    since: int = Query(0, description="Return only missions modified after this timestamp (microseconds since epoch)"),
    context: SecurityContext = Depends(require_viewer),
) -> MissionListResponse:
    """List all missions with optional incremental sync

    Returns mission metadata for all missions, optionally filtered by timestamp.
    Supports incremental sync by returning only missions modified after `since`.

    Args:
        since: Timestamp filter (microseconds since epoch)

    Returns:
        Mission list response with metadata and sync information
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
        # Get mission metadata from cache
        metadata_list = await _storage.list_resources(ResourceType.MISSION, since=since)

        # Convert to API models
        missions = [
            MissionMetadata(
                id=meta.id,
                version=meta.version,
                timestamp=meta.timestamp,
                size=meta.size,
            )
            for meta in metadata_list
        ]

        # Get current version (latest timestamp)
        version = max((meta.timestamp for meta in metadata_list), default=0)

        return MissionListResponse(
            missions=missions,
            deleted=[],  # TODO: Track deleted missions for incremental sync
            version=version,
            count=len(missions),
        )

    except Exception as e:
        logger.error(f"Failed to list missions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list missions: {str(e)}",
        )


@router.post("", response_model=MissionOperationResponse, status_code=status.HTTP_201_CREATED)
async def create_mission(
    mission: ScheduledMission,
    context: SecurityContext = Depends(require_operator),
) -> MissionOperationResponse:
    """Create a new mission

    Creates a new scheduled mission and queues it for storage. The operation is
    asynchronous and the mission will be persisted in the background.

    Args:
        mission: Mission definition

    Returns:
        Operation response with mission ID and status
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
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
            logger.info(f"Mission created: {mission.id}")
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
        logger.error(f"Failed to create mission: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create mission: {str(e)}",
        )


@router.get("/{mission_id}", response_model=ScheduledMission)
async def get_mission(
    mission_id: str,
    context: SecurityContext = Depends(require_viewer),
) -> ScheduledMission:
    """Get a specific mission by ID

    Retrieves the full mission definition for the specified mission ID.

    Args:
        mission_id: Mission identifier

    Returns:
        Mission definition

    Raises:
        HTTPException: 404 if mission not found
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
        # Read mission data
        result, data = await _storage.read_resource(ResourceType.MISSION, mission_id)

        if result == ResourceResult.NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mission not found: {mission_id}",
            )
        elif result != ResourceResult.SUCCESS or not data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read mission: {result.value}",
            )

        # Parse and validate mission data
        mission = ScheduledMission.model_validate_json(data)
        return mission

    except HTTPException:
        raise
    except ValidationError as e:
        logger.error(f"Failed to validate mission data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid mission data: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Failed to get mission: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get mission: {str(e)}",
        )


@router.put("/{mission_id}", response_model=MissionOperationResponse)
async def update_mission(
    mission_id: str,
    mission: ScheduledMission,
    context: SecurityContext = Depends(require_operator),
) -> MissionOperationResponse:
    """Update an existing mission

    Updates an existing mission by replacing its data. The mission ID in the path
    must match the mission ID in the request body.

    Args:
        mission_id: Mission identifier
        mission: Updated mission definition

    Returns:
        Operation response with mission ID and status

    Raises:
        HTTPException: 400 if mission IDs don't match, 404 if mission not found
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    # Validate mission ID matches
    if mission_id != mission.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mission ID in path does not match mission ID in body",
        )

    try:
        # Check if mission exists
        exists = await _storage.resource_exists(ResourceType.MISSION, mission_id)
        if exists == ResourceResult.NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mission not found: {mission_id}",
            )

        # Serialize mission to JSON
        mission_json = mission.model_dump_json(by_alias=True)

        # Queue write operation
        result = await _storage.queue_write(
            resource_type=ResourceType.MISSION,
            resource_id=mission.id,
            data=mission_json,
            version=1,  # TODO: Implement version tracking
        )

        if result == ResourceResult.SUCCESS:
            logger.info(f"Mission updated: {mission.id}")
            return MissionOperationResponse(id=mission.id, status="queued")
        elif result == ResourceResult.QUEUE_FULL:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Write queue is full, please try again later",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update mission: {result.value}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update mission: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update mission: {str(e)}",
        )


@router.delete("/{mission_id}", response_model=MissionOperationResponse)
async def delete_mission(
    mission_id: str,
    context: SecurityContext = Depends(require_operator),
) -> MissionOperationResponse:
    """Delete a mission

    Deletes the specified mission. This operation is synchronous and the mission
    will be removed immediately.

    Args:
        mission_id: Mission identifier

    Returns:
        Operation response with mission ID and status

    Raises:
        HTTPException: 404 if mission not found
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
        # Delete mission
        result = await _storage.delete_resource(ResourceType.MISSION, mission_id)

        if result == ResourceResult.NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mission not found: {mission_id}",
            )
        elif result != ResourceResult.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete mission: {result.value}",
            )

        logger.info(f"Mission deleted: {mission_id}")
        return MissionOperationResponse(id=mission_id, status="success")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete mission: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete mission: {str(e)}",
        )
