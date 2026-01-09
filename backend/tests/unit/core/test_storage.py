"""Unit tests for storage system."""

from pathlib import Path

import pytest

from yardrover.core.errors import StorageError, StorageNotFoundError
from yardrover.core.storage import Storage


class TestStorage:
    """Tests for Storage class."""

    @pytest.fixture
    async def storage(self, tmp_path: Path) -> Storage:
        """Create storage for testing."""
        storage = Storage(tmp_path / "test_storage")
        await storage.initialize()
        return storage

    async def test_initialize(self, tmp_path: Path) -> None:
        """Test storage initialization."""
        storage_path = tmp_path / "new_storage"
        storage = Storage(storage_path)

        assert not storage_path.exists()
        await storage.initialize()
        assert storage_path.exists()

    async def test_write_and_read(self, storage: Storage) -> None:
        """Test writing and reading data."""
        test_data = {"key": "value", "number": 42}

        await storage.write("test", test_data)
        read_data = await storage.read("test")

        assert read_data == test_data

    async def test_read_nonexistent(self, storage: Storage) -> None:
        """Test reading nonexistent key."""
        with pytest.raises(StorageNotFoundError):
            await storage.read("nonexistent")

    async def test_exists(self, storage: Storage) -> None:
        """Test checking key existence."""
        assert not await storage.exists("test")

        await storage.write("test", {"data": "value"})
        assert await storage.exists("test")

    async def test_delete(self, storage: Storage) -> None:
        """Test deleting data."""
        await storage.write("test", {"data": "value"})
        assert await storage.exists("test")

        await storage.delete("test")
        assert not await storage.exists("test")

    async def test_delete_nonexistent(self, storage: Storage) -> None:
        """Test deleting nonexistent key."""
        with pytest.raises(StorageNotFoundError):
            await storage.delete("nonexistent")

    async def test_list_keys(self, storage: Storage) -> None:
        """Test listing storage keys."""
        await storage.write("test1", {"data": 1})
        await storage.write("test2", {"data": 2})
        await storage.write("subdir/test3", {"data": 3})

        keys = await storage.list_keys()
        assert len(keys) == 3
        assert "test1" in keys
        assert "test2" in keys
        assert "subdir/test3" in keys

    async def test_list_keys_with_prefix(self, storage: Storage) -> None:
        """Test listing keys with prefix filter."""
        await storage.write("app/config", {"data": 1})
        await storage.write("app/state", {"data": 2})
        await storage.write("other/data", {"data": 3})

        keys = await storage.list_keys(prefix="app")
        assert len(keys) == 2
        assert all(k.startswith("app") for k in keys)

    async def test_clear(self, storage: Storage) -> None:
        """Test clearing all storage."""
        await storage.write("test1", {"data": 1})
        await storage.write("test2", {"data": 2})

        keys_before = await storage.list_keys()
        assert len(keys_before) == 2

        await storage.clear()

        keys_after = await storage.list_keys()
        assert len(keys_after) == 0

    async def test_path_traversal_prevention(self, storage: Storage) -> None:
        """Test prevention of path traversal attacks."""
        with pytest.raises(StorageError):
            await storage.write("../evil", {"data": "bad"})

        with pytest.raises(StorageError):
            await storage.write("/absolute/path", {"data": "bad"})
