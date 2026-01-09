"""Pytest configuration and shared fixtures."""

import asyncio
from pathlib import Path
from typing import AsyncIterator, Iterator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

from yardrover.main import app


@pytest.fixture(scope="session")
def event_loop() -> Iterator[asyncio.AbstractEventLoop]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_client() -> Iterator[TestClient]:
    """Create synchronous test client with mocked network services."""
    # Mock mDNS and WiFi managers to avoid resource leaks in tests
    with patch("yardrover.main.MDNSManager") as mock_mdns, \
         patch("yardrover.main.WiFiManager") as mock_wifi:
        # Configure mocks
        mock_mdns_instance = AsyncMock()
        mock_mdns_instance.start = AsyncMock()
        mock_mdns_instance.stop = AsyncMock()
        mock_mdns_instance.add_service = AsyncMock()
        mock_mdns.return_value = mock_mdns_instance

        mock_wifi_instance = AsyncMock()
        mock_wifi_instance.start = AsyncMock()
        mock_wifi_instance.stop = AsyncMock()
        mock_wifi.return_value = mock_wifi_instance

        with TestClient(app) as client:
            yield client


@pytest.fixture
async def async_client() -> AsyncIterator[AsyncClient]:
    """Create async test client."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def tmp_storage_path(tmp_path: Path) -> Path:
    """Create temporary storage directory."""
    storage_path = tmp_path / "storage"
    storage_path.mkdir(parents=True, exist_ok=True)
    return storage_path


@pytest.fixture
def tmp_config_path(tmp_path: Path) -> Path:
    """Create temporary config file path."""
    return tmp_path / "config.yaml"


# Additional fixtures will be added as components are implemented:
# - mock_mavlink_processor
# - mock_serial_connection
# - mock_event_bus
# - test_storage
# - test_config_manager
