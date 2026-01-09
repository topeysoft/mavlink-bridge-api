"""File-based storage abstraction layer."""

import json
from pathlib import Path
from typing import Any, Optional

import aiofiles
import structlog

from yardrover.core.errors import (
    StorageError,
    StorageNotFoundError,
    StoragePermissionError,
)

logger = structlog.get_logger(__name__)


class Storage:
    """Async file-based storage abstraction.

    Replaces C++ Storage class (LittleFS) with async file I/O.
    Provides JSON-based persistent storage with atomic writes.
    """

    def __init__(self, base_path: Path) -> None:
        """Initialize storage with base path.

        Args:
            base_path: Base directory for storage
        """
        self.base_path = base_path
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize storage system.

        Creates base directory if it doesn't exist.

        Raises:
            StoragePermissionError: If directory creation fails
        """
        try:
            self.base_path.mkdir(parents=True, exist_ok=True)
            self._initialized = True
            logger.info("storage_initialized", path=str(self.base_path))
        except PermissionError as e:
            raise StoragePermissionError(
                f"Permission denied creating storage directory: {self.base_path}"
            ) from e
        except Exception as e:
            raise StorageError(f"Failed to initialize storage: {e}") from e

    async def read(self, key: str) -> Any:
        """Read data from storage.

        Args:
            key: Storage key (file path relative to base)

        Returns:
            Deserialized data

        Raises:
            StorageNotFoundError: If key not found
            StorageError: If read operation fails
        """
        self._ensure_initialized()

        file_path = self._get_file_path(key)

        try:
            async with aiofiles.open(file_path, "r") as f:
                content = await f.read()
                data = json.loads(content)

            logger.debug("storage_read", key=key, size=len(content))
            return data

        except FileNotFoundError as e:
            raise StorageNotFoundError(f"Key not found: {key}") from e
        except json.JSONDecodeError as e:
            raise StorageError(f"Invalid JSON in storage file {key}: {e}") from e
        except Exception as e:
            raise StorageError(f"Failed to read from storage: {e}") from e

    async def write(self, key: str, data: Any) -> None:
        """Write data to storage.

        Performs atomic write using temporary file and rename.

        Args:
            key: Storage key (file path relative to base)
            data: Data to serialize and write

        Raises:
            StorageError: If write operation fails
        """
        self._ensure_initialized()

        file_path = self._get_file_path(key)

        try:
            # Ensure parent directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Serialize data
            content = json.dumps(data, indent=2, ensure_ascii=False)

            # Atomic write: write to temp file then rename
            temp_path = file_path.with_suffix(".tmp")

            async with aiofiles.open(temp_path, "w") as f:
                await f.write(content)

            # Atomic rename
            temp_path.rename(file_path)

            logger.debug("storage_write", key=key, size=len(content))

        except Exception as e:
            # Clean up temp file on error
            if temp_path.exists():
                temp_path.unlink()
            raise StorageError(f"Failed to write to storage: {e}") from e

    async def delete(self, key: str) -> None:
        """Delete data from storage.

        Args:
            key: Storage key to delete

        Raises:
            StorageNotFoundError: If key not found
            StorageError: If delete operation fails
        """
        self._ensure_initialized()

        file_path = self._get_file_path(key)

        try:
            file_path.unlink()
            logger.debug("storage_delete", key=key)
        except FileNotFoundError as e:
            raise StorageNotFoundError(f"Key not found: {key}") from e
        except Exception as e:
            raise StorageError(f"Failed to delete from storage: {e}") from e

    async def exists(self, key: str) -> bool:
        """Check if key exists in storage.

        Args:
            key: Storage key to check

        Returns:
            True if key exists, False otherwise
        """
        self._ensure_initialized()
        file_path = self._get_file_path(key)
        return file_path.exists()

    async def list_keys(self, prefix: str = "") -> list[str]:
        """List all keys with optional prefix filter.

        Args:
            prefix: Optional prefix to filter keys

        Returns:
            List of matching keys
        """
        self._ensure_initialized()

        try:
            keys = []
            search_path = self.base_path / prefix if prefix else self.base_path

            if not search_path.exists():
                return []

            # Recursively find all .json files
            for file_path in search_path.rglob("*.json"):
                # Get relative path from base
                rel_path = file_path.relative_to(self.base_path)
                # Remove .json extension
                key = str(rel_path.with_suffix(""))
                keys.append(key)

            logger.debug("storage_list", prefix=prefix, count=len(keys))
            return sorted(keys)

        except Exception as e:
            raise StorageError(f"Failed to list keys: {e}") from e

    async def clear(self) -> None:
        """Clear all storage data.

        Warning: This removes all files in the storage directory.

        Raises:
            StorageError: If clear operation fails
        """
        self._ensure_initialized()

        try:
            # Remove all .json files
            for file_path in self.base_path.rglob("*.json"):
                file_path.unlink()

            logger.info("storage_cleared", path=str(self.base_path))

        except Exception as e:
            raise StorageError(f"Failed to clear storage: {e}") from e

    def _ensure_initialized(self) -> None:
        """Ensure storage is initialized.

        Raises:
            StorageError: If storage not initialized
        """
        if not self._initialized:
            raise StorageError("Storage not initialized. Call initialize() first.")

    def _get_file_path(self, key: str) -> Path:
        """Get full file path for a storage key.

        Args:
            key: Storage key

        Returns:
            Full file path
        """
        # Prevent path traversal
        if ".." in key or key.startswith("/"):
            raise StorageError(f"Invalid storage key: {key}")

        # Add .json extension if not present
        if not key.endswith(".json"):
            key = f"{key}.json"

        return self.base_path / key

    async def get_size(self) -> int:
        """Get total storage size in bytes.

        Returns:
            Total size of all storage files
        """
        self._ensure_initialized()

        try:
            total_size = 0
            for file_path in self.base_path.rglob("*.json"):
                total_size += file_path.stat().st_size
            return total_size
        except Exception as e:
            raise StorageError(f"Failed to calculate storage size: {e}") from e


# Global storage instance
_storage: Optional[Storage] = None


def get_storage(base_path: Optional[Path] = None) -> Storage:
    """Get global storage instance.

    Args:
        base_path: Optional base path (only used on first call)

    Returns:
        Global Storage instance
    """
    global _storage
    if _storage is None:
        if base_path is None:
            base_path = Path("/var/lib/yardrover")
        _storage = Storage(base_path)
    return _storage
