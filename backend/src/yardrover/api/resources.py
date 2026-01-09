"""Resource sync API endpoints

Provides unified resource sync endpoint for zones and missions.
Supports incremental sync with timestamp-based queries.
"""

import logging
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from yardrover.models.resources import (
    MissionMetadata,
    ResourceSyncResponse,
    ResourceType,
    ZoneMetadata,
)
from yardrover.resources.storage import ResourceStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resources", tags=["resources"])

# Global resource storage instance (will be injected during startup)
_storage: Optional[ResourceStorage] = None


def set_storage(storage: ResourceStorage) -> None:
    """Set the global resource storage instance

    Args:
        storage: Resource storage instance
    """
    global _storage
    _storage = storage


@router.get("/sync", response_model=ResourceSyncResponse)
async def sync_resources(
    since: int = Query(0, description="Return only resources modified after this timestamp (microseconds since epoch)")
) -> ResourceSyncResponse:
    """Sync all resources (zones and missions)

    Returns metadata for all resources, optionally filtered by timestamp.
    This endpoint enables incremental sync by returning only resources
    modified after the specified timestamp.

    The response includes:
    - Current server version (timestamp)
    - Zone metadata
    - Mission metadata
    - Lists of deleted resource IDs (for incremental sync)

    Args:
        since: Timestamp filter (microseconds since epoch)

    Returns:
        Resource sync response with all resource metadata
    """
    if not _storage:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage not available",
        )

    try:
        # Get zone metadata
        zone_metadata_list = await _storage.list_resources(ResourceType.ZONE, since=since)
        zones = [
            ZoneMetadata(
                id=meta.id,
                version=meta.version,
                timestamp=meta.timestamp,
                size=meta.size,
            )
            for meta in zone_metadata_list
        ]

        # Get mission metadata
        mission_metadata_list = await _storage.list_resources(ResourceType.MISSION, since=since)
        missions = [
            MissionMetadata(
                id=meta.id,
                version=meta.version,
                timestamp=meta.timestamp,
                size=meta.size,
            )
            for meta in mission_metadata_list
        ]

        # Get current server version (latest timestamp across all resources)
        all_timestamps = [m.timestamp for m in zone_metadata_list + mission_metadata_list]
        version = max(all_timestamps, default=int(time.time() * 1_000_000))

        return ResourceSyncResponse(
            version=version,
            timestamp=datetime.utcnow(),
            zones=zones,
            missions=missions,
            deleted_zones=[],  # TODO: Track deleted zones
            deleted_missions=[],  # TODO: Track deleted missions
        )

    except Exception as e:
        logger.error(f"Failed to sync resources: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync resources: {str(e)}",
        )
