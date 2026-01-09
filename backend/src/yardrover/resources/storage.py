"""Resource storage manager

Handles file-based storage and CRUD operations for resources (zones, missions).
Python port of the C++ ResourceStorage class with async operations.
"""

import asyncio
import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

import aiofiles
from pydantic import ValidationError

from yardrover.core.events import EventBus
from yardrover.core.storage import Storage
from yardrover.models.resources import (
    MissionMetadata,
    ResourceResult,
    ResourceType,
    ScheduledMission,
    Zone,
    ZoneMetadata,
)

logger = logging.getLogger(__name__)


class ResourceMetadata:
    """Metadata for a resource stored in the cache

    Equivalent to the C++ ResourceMetadata struct.
    """

    def __init__(
        self,
        id: str,
        version: int,
        timestamp: int,
        resource_type: ResourceType,
        checksum: str,
        size: int,
    ):
        self.id = id
        self.version = version
        self.timestamp = timestamp
        self.type = resource_type
        self.checksum = checksum
        self.size = size

    def to_dict(self) -> dict[str, Any]:
        """Convert metadata to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "version": self.version,
            "timestamp": self.timestamp,
            "type": self.type.value,
            "checksum": self.checksum,
            "size": self.size,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ResourceMetadata":
        """Create metadata from dictionary"""
        return cls(
            id=data["id"],
            version=data["version"],
            timestamp=data["timestamp"],
            resource_type=ResourceType(data["type"]),
            checksum=data["checksum"],
            size=data["size"],
        )


class WriteOperation:
    """Queued write operation

    Equivalent to the C++ WriteOperation struct.
    """

    def __init__(
        self,
        resource_type: ResourceType,
        resource_id: str,
        data: str,
        version: int = 1,
    ):
        self.type = resource_type
        self.id = resource_id
        self.data = data
        self.version = version


class StorageStats:
    """Storage statistics

    Equivalent to the C++ StorageStats struct.
    """

    def __init__(self):
        self.total_writes = 0
        self.total_reads = 0
        self.failed_writes = 0
        self.failed_reads = 0
        self.queued_writes = 0
        self.avg_write_latency = 0.0
        self.avg_read_latency = 0.0
        self.pool_utilization = 0.0
        self.free_space = 0
        self.used_space = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert stats to dictionary"""
        return {
            "totalWrites": self.total_writes,
            "totalReads": self.total_reads,
            "failedWrites": self.failed_writes,
            "failedReads": self.failed_reads,
            "queuedWrites": self.queued_writes,
            "avgWriteLatency": self.avg_write_latency,
            "avgReadLatency": self.avg_read_latency,
            "poolUtilization": self.pool_utilization,
            "freeSpace": self.free_space,
            "usedSpace": self.used_space,
        }


class ResourceStorage:
    """Resource storage manager

    Manages file-based storage of resources (zones, missions) with async operations,
    metadata caching, and incremental sync support.

    Python port of the C++ ResourceStorage class. Uses async file I/O instead of
    FreeRTOS queues and mutexes.
    """

    _instance: Optional["ResourceStorage"] = None

    def __init__(
        self,
        base_path: str = "/data/resources",
        event_bus: Optional[EventBus] = None,
    ):
        """Initialize resource storage

        Args:
            base_path: Base directory for resource storage
            event_bus: Event bus for publishing resource events
        """
        self.base_path = Path(base_path)
        self.event_bus = event_bus
        self.is_initialized = False

        # Metadata cache (in-memory index)
        self.metadata_cache: list[ResourceMetadata] = []
        self.metadata_lock = asyncio.Lock()

        # Write queue (async queue for pending writes)
        self.write_queue: asyncio.Queue[WriteOperation] = asyncio.Queue(maxsize=16)
        self.write_task: Optional[asyncio.Task[None]] = None

        # Statistics
        self.stats = StorageStats()
        self.total_write_time = 0.0
        self.total_read_time = 0.0

        # Last error message
        self.last_error = ""

        logger.info(f"ResourceStorage initialized with base_path={base_path}")

    @classmethod
    def get_instance(
        cls,
        base_path: str = "/data/resources",
        event_bus: Optional[EventBus] = None,
    ) -> "ResourceStorage":
        """Get or create singleton instance

        Args:
            base_path: Base directory for resource storage
            event_bus: Event bus for publishing resource events

        Returns:
            ResourceStorage singleton instance
        """
        if cls._instance is None:
            cls._instance = cls(base_path=base_path, event_bus=event_bus)
        return cls._instance

    async def start(self) -> ResourceResult:
        """Start resource storage system

        Creates directories, loads metadata cache, and starts write queue processor.

        Returns:
            ResourceResult indicating success or failure
        """
        if self.is_initialized:
            return ResourceResult.SUCCESS

        logger.info("Starting resource storage system")

        try:
            # Create directories
            (self.base_path / "zones").mkdir(parents=True, exist_ok=True)
            (self.base_path / "missions").mkdir(parents=True, exist_ok=True)
            (self.base_path / "settings").mkdir(parents=True, exist_ok=True)

            logger.info(f"Resource directories created at {self.base_path}")

            # Load metadata cache
            result = await self._load_metadata_cache()
            if result != ResourceResult.SUCCESS and result != ResourceResult.NOT_FOUND:
                logger.warning(f"Failed to load metadata cache: {result}")
                # Continue anyway, will rebuild cache

            logger.info(f"Loaded {len(self.metadata_cache)} metadata entries")

            # Start write queue processor
            self.write_task = asyncio.create_task(self._process_write_queue())

            self.is_initialized = True
            return ResourceResult.SUCCESS

        except Exception as e:
            self.last_error = f"Failed to start resource storage: {e}"
            logger.error(self.last_error, exc_info=True)
            return ResourceResult.WRITE_FAILED

    async def stop(self) -> None:
        """Stop resource storage system

        Saves metadata cache and stops write queue processor.
        """
        if not self.is_initialized:
            return

        logger.info("Stopping resource storage system")

        # Save metadata before shutdown
        await self._save_metadata_cache()

        # Stop write queue processor
        if self.write_task:
            self.write_task.cancel()
            try:
                await self.write_task
            except asyncio.CancelledError:
                pass
            self.write_task = None

        # Clear write queue
        while not self.write_queue.empty():
            try:
                self.write_queue.get_nowait()
                self.write_queue.task_done()
                self.stats.queued_writes -= 1
            except asyncio.QueueEmpty:
                break

        self.metadata_cache.clear()
        self.is_initialized = False

        logger.info("Resource storage system stopped")

    def _get_resource_path(self, resource_type: ResourceType, resource_id: str) -> Path:
        """Get file path for a resource

        Args:
            resource_type: Type of resource
            resource_id: Resource ID

        Returns:
            Path to resource file
        """
        if resource_type == ResourceType.ZONE:
            subdir = "zones"
        elif resource_type == ResourceType.MISSION:
            subdir = "missions"
        elif resource_type == ResourceType.USER_SETTINGS:
            subdir = "settings"
        else:
            subdir = ""

        return self.base_path / subdir / f"{resource_id}.json"

    def _get_metadata_path(self) -> Path:
        """Get path to metadata cache file

        Returns:
            Path to metadata file
        """
        return self.base_path / ".metadata.json"

    def _calculate_checksum(self, data: str) -> str:
        """Calculate SHA-256 checksum of data

        Args:
            data: Data to checksum

        Returns:
            Hex-encoded checksum
        """
        return hashlib.sha256(data.encode()).hexdigest()

    async def read_resource(
        self, resource_type: ResourceType, resource_id: str
    ) -> tuple[ResourceResult, Optional[str]]:
        """Read a resource from storage

        Args:
            resource_type: Type of resource
            resource_id: Resource ID

        Returns:
            Tuple of (result, data) where data is JSON string or None on error
        """
        if not self.is_initialized:
            return ResourceResult.INVALID_DATA, None

        start_time = time.time()

        try:
            path = self._get_resource_path(resource_type, resource_id)

            if not path.exists():
                return ResourceResult.NOT_FOUND, None

            async with aiofiles.open(path, "r") as f:
                data = await f.read()

            # Update statistics
            self.stats.total_reads += 1
            duration = (time.time() - start_time) * 1000  # Convert to ms
            self.total_read_time += duration
            self.stats.avg_read_latency = self.total_read_time / self.stats.total_reads

            return ResourceResult.SUCCESS, data

        except Exception as e:
            self.last_error = f"Failed to read resource: {e}"
            logger.error(self.last_error, exc_info=True)
            self.stats.failed_reads += 1
            return ResourceResult.READ_FAILED, None

    async def resource_exists(
        self, resource_type: ResourceType, resource_id: str
    ) -> ResourceResult:
        """Check if a resource exists

        Args:
            resource_type: Type of resource
            resource_id: Resource ID

        Returns:
            ResourceResult.SUCCESS if exists, ResourceResult.NOT_FOUND otherwise
        """
        if not self.is_initialized:
            return ResourceResult.INVALID_DATA

        # Check metadata cache first
        async with self.metadata_lock:
            meta = self._find_in_metadata_cache(resource_id, resource_type)
            if meta is not None:
                return ResourceResult.SUCCESS

        # Check filesystem
        path = self._get_resource_path(resource_type, resource_id)
        return ResourceResult.SUCCESS if path.exists() else ResourceResult.NOT_FOUND

    async def delete_resource(
        self, resource_type: ResourceType, resource_id: str
    ) -> ResourceResult:
        """Delete a resource

        Args:
            resource_type: Type of resource
            resource_id: Resource ID

        Returns:
            ResourceResult indicating success or failure
        """
        if not self.is_initialized:
            return ResourceResult.INVALID_DATA

        try:
            path = self._get_resource_path(resource_type, resource_id)

            if not path.exists():
                return ResourceResult.NOT_FOUND

            # Delete file
            path.unlink()

            # Remove from metadata cache
            async with self.metadata_lock:
                self._remove_from_metadata_cache(resource_id, resource_type)

            # Publish event
            if self.event_bus:
                event_type = f"{resource_type.value}.deleted"
                await self.event_bus.publish(event_type, {"id": resource_id})

            return ResourceResult.SUCCESS

        except Exception as e:
            self.last_error = f"Failed to delete resource: {e}"
            logger.error(self.last_error, exc_info=True)
            return ResourceResult.WRITE_FAILED

    async def queue_write(
        self,
        resource_type: ResourceType,
        resource_id: str,
        data: str,
        version: int = 1,
    ) -> ResourceResult:
        """Queue a write operation

        Args:
            resource_type: Type of resource
            resource_id: Resource ID
            data: JSON data to write
            version: Resource version

        Returns:
            ResourceResult indicating success or failure
        """
        if not self.is_initialized or not data or len(data) > 1024 * 1024:  # 1MB limit
            return ResourceResult.INVALID_DATA

        try:
            op = WriteOperation(resource_type, resource_id, data, version)
            await self.write_queue.put(op)
            self.stats.queued_writes += 1
            return ResourceResult.SUCCESS

        except asyncio.QueueFull:
            return ResourceResult.QUEUE_FULL
        except Exception as e:
            self.last_error = f"Failed to queue write: {e}"
            logger.error(self.last_error, exc_info=True)
            return ResourceResult.WRITE_FAILED

    async def _process_write_queue(self) -> None:
        """Background task to process write queue

        Processes write operations from the queue.
        """
        logger.info("Write queue processor started")

        while True:
            try:
                # Get next operation from queue
                op = await self.write_queue.get()

                # Process write
                await self._process_write_operation(op)

                # Mark task done
                self.write_queue.task_done()
                self.stats.queued_writes -= 1

            except asyncio.CancelledError:
                logger.info("Write queue processor cancelled")
                break
            except Exception as e:
                logger.error(f"Error processing write operation: {e}", exc_info=True)

    async def _process_write_operation(self, op: WriteOperation) -> None:
        """Process a single write operation

        Args:
            op: Write operation to process
        """
        start_time = time.time()

        try:
            path = self._get_resource_path(op.type, op.id)

            # Write file
            async with aiofiles.open(path, "w") as f:
                await f.write(op.data)

            # Update metadata cache
            checksum = self._calculate_checksum(op.data)
            timestamp = int(time.time() * 1_000_000)  # Microseconds since epoch

            meta = ResourceMetadata(
                id=op.id,
                version=op.version,
                timestamp=timestamp,
                resource_type=op.type,
                checksum=checksum,
                size=len(op.data),
            )

            async with self.metadata_lock:
                self._add_to_metadata_cache(meta)

            # Update statistics
            self.stats.total_writes += 1
            duration = (time.time() - start_time) * 1000  # Convert to ms
            self.total_write_time += duration
            self.stats.avg_write_latency = self.total_write_time / self.stats.total_writes

            # Publish event
            if self.event_bus:
                event_type = f"{op.type.value}.updated"
                await self.event_bus.publish(
                    event_type, {"id": op.id, "version": op.version}
                )

            logger.debug(f"Write operation completed: {op.type.value}/{op.id}")

        except Exception as e:
            self.last_error = f"Failed to write resource: {e}"
            logger.error(self.last_error, exc_info=True)
            self.stats.failed_writes += 1

    async def list_resources(
        self, resource_type: ResourceType, since: int = 0
    ) -> list[ResourceMetadata]:
        """List resources of a specific type

        Args:
            resource_type: Type of resources to list
            since: Timestamp filter (microseconds since epoch)

        Returns:
            List of resource metadata matching the criteria
        """
        if not self.is_initialized:
            return []

        async with self.metadata_lock:
            return [
                meta
                for meta in self.metadata_cache
                if meta.type == resource_type and meta.timestamp >= since
            ]

    async def get_metadata(
        self, resource_type: ResourceType, resource_id: str
    ) -> Optional[ResourceMetadata]:
        """Get metadata for a specific resource

        Args:
            resource_type: Type of resource
            resource_id: Resource ID

        Returns:
            Resource metadata or None if not found
        """
        if not self.is_initialized:
            return None

        async with self.metadata_lock:
            return self._find_in_metadata_cache(resource_id, resource_type)

    def get_stats(self) -> dict[str, Any]:
        """Get storage statistics

        Returns:
            Dictionary of storage statistics
        """
        stats = self.stats
        stats.free_space = self._get_free_space()
        stats.used_space = self._get_used_space()
        return stats.to_dict()

    def _get_free_space(self) -> int:
        """Get free space in storage

        Returns:
            Free space in bytes
        """
        if not self.is_initialized:
            return 0

        try:
            stat = os.statvfs(self.base_path)
            return stat.f_bavail * stat.f_frsize
        except Exception:
            return 0

    def _get_used_space(self) -> int:
        """Get used space in storage

        Returns:
            Used space in bytes
        """
        if not self.is_initialized:
            return 0

        try:
            total = 0
            for path in self.base_path.rglob("*.json"):
                total += path.stat().st_size
            return total
        except Exception:
            return 0

    def is_healthy(self) -> bool:
        """Check if storage is healthy

        Returns:
            True if storage is healthy, False otherwise
        """
        if not self.is_initialized:
            return False

        # Check free space (warn if less than 10% free)
        free_space = self._get_free_space()
        total_space = self._get_total_space()
        if total_space > 0 and (free_space * 100 / total_space) < 10:
            return False

        # Check queue depth (warn if more than 10 pending)
        if self.write_queue.qsize() > 10:
            return False

        # Check write latency (warn if average > 100ms)
        if self.stats.avg_write_latency > 100:
            return False

        return True

    def _get_total_space(self) -> int:
        """Get total storage space

        Returns:
            Total space in bytes
        """
        if not self.is_initialized:
            return 0

        try:
            stat = os.statvfs(self.base_path)
            return stat.f_blocks * stat.f_frsize
        except Exception:
            return 0

    async def _load_metadata_cache(self) -> ResourceResult:
        """Load metadata cache from disk

        Returns:
            ResourceResult indicating success or failure
        """
        path = self._get_metadata_path()

        if not path.exists():
            return ResourceResult.NOT_FOUND

        try:
            async with aiofiles.open(path, "r") as f:
                content = await f.read()
                data = json.loads(content)

            self.metadata_cache.clear()

            for entry in data.get("entries", []):
                meta = ResourceMetadata.from_dict(entry)
                self.metadata_cache.append(meta)

            return ResourceResult.SUCCESS

        except Exception as e:
            self.last_error = f"Failed to load metadata cache: {e}"
            logger.error(self.last_error, exc_info=True)
            return ResourceResult.PARSE_ERROR

    async def _save_metadata_cache(self) -> ResourceResult:
        """Save metadata cache to disk

        Returns:
            ResourceResult indicating success or failure
        """
        path = self._get_metadata_path()

        try:
            data = {
                "entries": [meta.to_dict() for meta in self.metadata_cache]
            }

            async with aiofiles.open(path, "w") as f:
                await f.write(json.dumps(data, indent=2))

            return ResourceResult.SUCCESS

        except Exception as e:
            self.last_error = f"Failed to save metadata cache: {e}"
            logger.error(self.last_error, exc_info=True)
            return ResourceResult.WRITE_FAILED

    def _add_to_metadata_cache(self, meta: ResourceMetadata) -> None:
        """Add or update metadata in cache (not thread-safe, caller must hold lock)

        Args:
            meta: Metadata to add or update
        """
        # Update existing or add new
        for i, existing in enumerate(self.metadata_cache):
            if existing.id == meta.id and existing.type == meta.type:
                self.metadata_cache[i] = meta
                return

        self.metadata_cache.append(meta)

    def _remove_from_metadata_cache(
        self, resource_id: str, resource_type: ResourceType
    ) -> None:
        """Remove metadata from cache (not thread-safe, caller must hold lock)

        Args:
            resource_id: Resource ID
            resource_type: Resource type
        """
        self.metadata_cache = [
            meta
            for meta in self.metadata_cache
            if not (meta.id == resource_id and meta.type == resource_type)
        ]

    def _find_in_metadata_cache(
        self, resource_id: str, resource_type: ResourceType
    ) -> Optional[ResourceMetadata]:
        """Find metadata in cache (not thread-safe, caller must hold lock)

        Args:
            resource_id: Resource ID
            resource_type: Resource type

        Returns:
            Resource metadata or None if not found
        """
        for meta in self.metadata_cache:
            if meta.id == resource_id and meta.type == resource_type:
                return meta
        return None
