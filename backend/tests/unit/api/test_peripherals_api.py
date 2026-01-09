"""Tests for peripheral API endpoints."""

import pytest
from fastapi.testclient import TestClient

from yardrover.api import peripherals
from yardrover.core.events import EventBus
from yardrover.models.peripherals import (
    PeripheralCapability,
    PeripheralCompatibilityRule,
    PeripheralMetadata,
    PeripheralType,
)
from yardrover.peripherals.manager import PeripheralManager


@pytest.fixture
def event_bus():
    """Create event bus fixture"""
    return EventBus()


@pytest.fixture
async def peripheral_manager(event_bus):
    """Create and start peripheral manager"""
    manager = PeripheralManager(event_bus)
    await manager.start()
    peripherals.set_manager(manager)
    yield manager
    await manager.stop()


@pytest.fixture
def mower_metadata():
    """Create mower peripheral metadata"""
    return PeripheralMetadata(
        peripheral_id="mower-001",
        type=PeripheralType.MOWER,
        name="Test Mower",
        manufacturer="YardRover",
        model="MR-48",
        firmware_version="1.0.0",
        capabilities=PeripheralCapability(
            operations=["mow", "mulch"],
            power_required=500.0,
            voltage=48.0,
        ),
        compatibility=PeripheralCompatibilityRule(
            exclusive_with=[PeripheralType.SNOW_BLOWER],
            compatible_with=[PeripheralType.GRASS_COLLECTOR],
        ),
    )


@pytest.fixture
def grass_collector_metadata():
    """Create grass collector peripheral metadata"""
    return PeripheralMetadata(
        peripheral_id="collector-001",
        type=PeripheralType.GRASS_COLLECTOR,
        name="Test Grass Collector",
        manufacturer="YardRover",
        model="GC-20",
        firmware_version="1.0.0",
        capabilities=PeripheralCapability(
            operations=["collect"],
            power_required=50.0,
            voltage=12.0,
        ),
        compatibility=PeripheralCompatibilityRule(
            compatible_with=[PeripheralType.MOWER],
        ),
    )


class TestPeripheralsAPI:
    """Test peripheral API endpoints"""

    @pytest.mark.asyncio
    async def test_list_peripherals_empty(self, peripheral_manager):
        """Test listing peripherals when none are registered"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.get("/api/peripherals")
            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 0
            assert len(data["peripherals"]) == 0

    @pytest.mark.asyncio
    async def test_register_peripheral(self, peripheral_manager, mower_metadata):
        """Test registering a peripheral via API"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.post(
                "/api/peripherals",
                json=mower_metadata.model_dump(mode="json"),
            )
            assert response.status_code == 201
            data = response.json()
            assert data["status"] == "success"
            assert data["peripheral_id"] == "mower-001"

    @pytest.mark.asyncio
    async def test_get_peripheral(self, peripheral_manager, mower_metadata):
        """Test getting peripheral details"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register peripheral first
        await peripheral_manager.register_peripheral(mower_metadata)

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.get("/api/peripherals/mower-001")
            assert response.status_code == 200
            data = response.json()
            assert data["metadata"]["type"] == "mower"
            assert data["metadata"]["name"] == "Test Mower"

    @pytest.mark.asyncio
    async def test_get_peripheral_not_found(self, peripheral_manager):
        """Test getting nonexistent peripheral"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.get("/api/peripherals/nonexistent")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_enable_peripheral(self, peripheral_manager, mower_metadata):
        """Test enabling peripheral via API"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register peripheral first
        await peripheral_manager.register_peripheral(mower_metadata)

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.post("/api/peripherals/mower-001/enable")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"

    @pytest.mark.asyncio
    async def test_disable_peripheral(self, peripheral_manager, mower_metadata):
        """Test disabling peripheral via API"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register and enable peripheral first
        await peripheral_manager.register_peripheral(mower_metadata)
        await peripheral_manager.enable_peripheral("mower-001")

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.post("/api/peripherals/mower-001/disable")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"

    @pytest.mark.asyncio
    async def test_send_command(self, peripheral_manager, mower_metadata):
        """Test sending command via API"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register and enable peripheral first
        await peripheral_manager.register_peripheral(mower_metadata)
        await peripheral_manager.enable_peripheral("mower-001")

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.post(
                "/api/peripherals/mower-001/command",
                json={"command": "set_height", "parameters": {"height": 3.5}},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"

    @pytest.mark.asyncio
    async def test_send_command_to_disabled_peripheral(
        self, peripheral_manager, mower_metadata
    ):
        """Test sending command to disabled peripheral"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register but don't enable peripheral
        await peripheral_manager.register_peripheral(mower_metadata)

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.post(
                "/api/peripherals/mower-001/command",
                json={"command": "set_height", "parameters": {"height": 3.5}},
            )
            assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_peripheral_status(self, peripheral_manager, mower_metadata):
        """Test getting peripheral status"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register peripheral first
        await peripheral_manager.register_peripheral(mower_metadata)

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.get("/api/peripherals/mower-001/status")
            assert response.status_code == 200
            data = response.json()
            assert data["peripheral_id"] == "mower-001"
            assert data["state"] == "connected"

    @pytest.mark.asyncio
    async def test_get_peripheral_telemetry(self, peripheral_manager, mower_metadata):
        """Test getting peripheral telemetry"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register peripheral and add telemetry
        await peripheral_manager.register_peripheral(mower_metadata)
        await peripheral_manager.update_telemetry(
            "mower-001", {"blade_rpm": 3200, "temperature": 45.2}
        )

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.get("/api/peripherals/mower-001/telemetry")
            assert response.status_code == 200
            data = response.json()
            assert data["peripheral_id"] == "mower-001"
            assert data["data"]["blade_rpm"] == 3200

    @pytest.mark.asyncio
    async def test_get_peripheral_telemetry_not_available(
        self, peripheral_manager, mower_metadata
    ):
        """Test getting telemetry when none available"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register peripheral without telemetry
        await peripheral_manager.register_peripheral(mower_metadata)

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.get("/api/peripherals/mower-001/telemetry")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_check_compatibility(
        self, peripheral_manager, mower_metadata, grass_collector_metadata
    ):
        """Test checking compatibility"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register and enable compatible peripherals
        await peripheral_manager.register_peripheral(mower_metadata)
        await peripheral_manager.register_peripheral(grass_collector_metadata)
        await peripheral_manager.enable_peripheral("mower-001")
        await peripheral_manager.enable_peripheral("collector-001")

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.get("/api/peripherals/compatibility/check")
            assert response.status_code == 200
            data = response.json()
            assert data["compatible"] is True
            assert len(data["conflicts"]) == 0

    @pytest.mark.asyncio
    async def test_get_stats(self, peripheral_manager, mower_metadata):
        """Test getting peripheral manager stats"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register peripheral
        await peripheral_manager.register_peripheral(mower_metadata)

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.get("/api/peripherals/stats")
            assert response.status_code == 200
            data = response.json()
            assert data["total_peripherals"] == 1
            assert data["connected_peripherals"] == 1

    @pytest.mark.asyncio
    async def test_unregister_peripheral(self, peripheral_manager, mower_metadata):
        """Test unregistering peripheral via API"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register peripheral first
        await peripheral_manager.register_peripheral(mower_metadata)

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            response = client.delete("/api/peripherals/mower-001")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"

            # Verify peripheral is removed
            response = client.get("/api/peripherals/mower-001")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_peripherals_with_filter(
        self, peripheral_manager, mower_metadata, grass_collector_metadata
    ):
        """Test listing peripherals with type filter"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        # Register multiple peripherals
        await peripheral_manager.register_peripheral(mower_metadata)
        await peripheral_manager.register_peripheral(grass_collector_metadata)

        app = FastAPI()
        app.include_router(peripherals.router)

        with TestClient(app) as client:
            # List all
            response = client.get("/api/peripherals")
            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 2

            # List only mowers
            response = client.get("/api/peripherals?peripheral_type=mower")
            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 1
            assert data["peripherals"][0]["metadata"]["type"] == "mower"
