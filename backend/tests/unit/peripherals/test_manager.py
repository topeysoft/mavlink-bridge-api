"""Tests for peripheral manager."""

import pytest
from datetime import datetime

from yardrover.core.events import EventBus
from yardrover.models.peripherals import (
    PeripheralCapability,
    PeripheralCompatibilityRule,
    PeripheralHealth,
    PeripheralMetadata,
    PeripheralState,
    PeripheralType,
)
from yardrover.peripherals.manager import PeripheralManager


class TestPeripheralManager:
    """Test PeripheralManager class"""

    @pytest.fixture
    def event_bus(self):
        """Create event bus fixture"""
        return EventBus()

    @pytest.fixture
    async def manager(self, event_bus):
        """Create peripheral manager fixture"""
        mgr = PeripheralManager(event_bus)
        await mgr.start()
        yield mgr
        await mgr.stop()

    @pytest.fixture
    def mower_metadata(self):
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
    def snow_blower_metadata(self):
        """Create snow blower peripheral metadata"""
        return PeripheralMetadata(
            peripheral_id="snowblower-001",
            type=PeripheralType.SNOW_BLOWER,
            name="Test Snow Blower",
            manufacturer="YardRover",
            model="SB-36",
            firmware_version="1.0.0",
            capabilities=PeripheralCapability(
                operations=["blow_snow"],
                power_required=750.0,
                voltage=48.0,
            ),
            compatibility=PeripheralCompatibilityRule(
                exclusive_with=[PeripheralType.MOWER],
            ),
        )

    @pytest.fixture
    def grass_collector_metadata(self):
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

    @pytest.mark.asyncio
    async def test_manager_start_stop(self, event_bus):
        """Test manager start and stop"""
        manager = PeripheralManager(event_bus)
        assert not manager.is_running

        await manager.start()
        assert manager.is_running

        await manager.stop()
        assert not manager.is_running

    @pytest.mark.asyncio
    async def test_register_peripheral(self, manager, mower_metadata):
        """Test peripheral registration"""
        # Register peripheral
        success = await manager.register_peripheral(mower_metadata)
        assert success

        # Verify peripheral is registered
        peripheral = await manager.get_peripheral("mower-001")
        assert peripheral is not None
        assert peripheral.metadata.type == PeripheralType.MOWER
        assert peripheral.status.state == PeripheralState.CONNECTED
        assert peripheral.status.health == PeripheralHealth.HEALTHY
        assert not peripheral.status.enabled

    @pytest.mark.asyncio
    async def test_register_duplicate_peripheral(self, manager, mower_metadata):
        """Test registering duplicate peripheral"""
        # Register peripheral
        success = await manager.register_peripheral(mower_metadata)
        assert success

        # Try to register again
        success = await manager.register_peripheral(mower_metadata)
        assert not success

    @pytest.mark.asyncio
    async def test_unregister_peripheral(self, manager, mower_metadata):
        """Test peripheral unregistration"""
        # Register peripheral
        await manager.register_peripheral(mower_metadata)

        # Unregister peripheral
        success = await manager.unregister_peripheral("mower-001")
        assert success

        # Verify peripheral is removed
        peripheral = await manager.get_peripheral("mower-001")
        assert peripheral is None

    @pytest.mark.asyncio
    async def test_unregister_nonexistent_peripheral(self, manager):
        """Test unregistering nonexistent peripheral"""
        success = await manager.unregister_peripheral("nonexistent")
        assert not success

    @pytest.mark.asyncio
    async def test_enable_peripheral(self, manager, mower_metadata):
        """Test enabling peripheral"""
        # Register peripheral
        await manager.register_peripheral(mower_metadata)

        # Enable peripheral
        success = await manager.enable_peripheral("mower-001")
        assert success

        # Verify peripheral is enabled
        peripheral = await manager.get_peripheral("mower-001")
        assert peripheral.status.enabled
        assert peripheral.status.state == PeripheralState.READY

    @pytest.mark.asyncio
    async def test_disable_peripheral(self, manager, mower_metadata):
        """Test disabling peripheral"""
        # Register and enable peripheral
        await manager.register_peripheral(mower_metadata)
        await manager.enable_peripheral("mower-001")

        # Disable peripheral
        success = await manager.disable_peripheral("mower-001")
        assert success

        # Verify peripheral is disabled
        peripheral = await manager.get_peripheral("mower-001")
        assert not peripheral.status.enabled
        assert peripheral.status.state == PeripheralState.CONNECTED

    @pytest.mark.asyncio
    async def test_compatibility_check_exclusive_peripherals(
        self, manager, mower_metadata, snow_blower_metadata
    ):
        """Test compatibility check for exclusive peripherals"""
        # Register and enable mower
        await manager.register_peripheral(mower_metadata)
        await manager.enable_peripheral("mower-001")

        # Register snow blower (should detect incompatibility)
        await manager.register_peripheral(snow_blower_metadata)

        # Verify snow blower is marked as incompatible
        snow_blower = await manager.get_peripheral("snowblower-001")
        assert snow_blower.status.health == PeripheralHealth.ERROR
        assert "Incompatible" in snow_blower.status.error_message

        # Try to enable snow blower (should fail)
        success = await manager.enable_peripheral("snowblower-001")
        assert not success

    @pytest.mark.asyncio
    async def test_compatibility_check_compatible_peripherals(
        self, manager, mower_metadata, grass_collector_metadata
    ):
        """Test compatibility check for compatible peripherals"""
        # Register and enable mower
        await manager.register_peripheral(mower_metadata)
        await manager.enable_peripheral("mower-001")

        # Register grass collector (should be compatible)
        await manager.register_peripheral(grass_collector_metadata)

        # Verify grass collector is compatible
        collector = await manager.get_peripheral("collector-001")
        assert collector.status.health == PeripheralHealth.HEALTHY

        # Enable grass collector (should succeed)
        success = await manager.enable_peripheral("collector-001")
        assert success

    @pytest.mark.asyncio
    async def test_check_compatibility_with_conflicts(
        self, manager, mower_metadata, snow_blower_metadata
    ):
        """Test compatibility check with conflicts"""
        # Register and enable both mower and snow blower
        await manager.register_peripheral(mower_metadata)
        await manager.register_peripheral(snow_blower_metadata)
        await manager.enable_peripheral("mower-001")

        # Manually enable snow blower (bypassing check)
        async with manager.peripherals_lock:
            manager.peripherals["snowblower-001"].status.enabled = True

        # Check compatibility
        result = await manager.check_compatibility()

        assert not result.compatible
        assert len(result.conflicts) > 0

    @pytest.mark.asyncio
    async def test_check_compatibility_no_conflicts(
        self, manager, mower_metadata, grass_collector_metadata
    ):
        """Test compatibility check with no conflicts"""
        # Register and enable compatible peripherals
        await manager.register_peripheral(mower_metadata)
        await manager.register_peripheral(grass_collector_metadata)
        await manager.enable_peripheral("mower-001")
        await manager.enable_peripheral("collector-001")

        # Check compatibility
        result = await manager.check_compatibility()

        assert result.compatible
        assert len(result.conflicts) == 0

    @pytest.mark.asyncio
    async def test_list_peripherals(self, manager, mower_metadata, grass_collector_metadata):
        """Test listing peripherals"""
        # Register multiple peripherals
        await manager.register_peripheral(mower_metadata)
        await manager.register_peripheral(grass_collector_metadata)

        # List all peripherals
        peripherals = await manager.list_peripherals()
        assert len(peripherals) == 2

        # List by type
        mowers = await manager.list_peripherals(peripheral_type=PeripheralType.MOWER)
        assert len(mowers) == 1
        assert mowers[0].metadata.type == PeripheralType.MOWER

    @pytest.mark.asyncio
    async def test_send_command(self, manager, mower_metadata):
        """Test sending command to peripheral"""
        # Register and enable peripheral
        await manager.register_peripheral(mower_metadata)
        await manager.enable_peripheral("mower-001")

        # Send command
        success = await manager.send_command(
            "mower-001", "set_height", {"height": 3.5}
        )
        assert success

    @pytest.mark.asyncio
    async def test_send_command_to_disabled_peripheral(self, manager, mower_metadata):
        """Test sending command to disabled peripheral"""
        # Register but don't enable peripheral
        await manager.register_peripheral(mower_metadata)

        # Send command (should fail)
        success = await manager.send_command(
            "mower-001", "set_height", {"height": 3.5}
        )
        assert not success

    @pytest.mark.asyncio
    async def test_update_telemetry(self, manager, mower_metadata):
        """Test updating peripheral telemetry"""
        # Register peripheral
        await manager.register_peripheral(mower_metadata)

        # Update telemetry
        telemetry_data = {
            "blade_rpm": 3200,
            "motor_current": 12.5,
            "temperature": 45.2,
        }
        success = await manager.update_telemetry("mower-001", telemetry_data)
        assert success

        # Verify telemetry is updated
        peripheral = await manager.get_peripheral("mower-001")
        assert peripheral.telemetry is not None
        assert peripheral.telemetry.data == telemetry_data

    @pytest.mark.asyncio
    async def test_get_stats(self, manager, mower_metadata, grass_collector_metadata):
        """Test getting manager statistics"""
        # Register and enable peripherals
        await manager.register_peripheral(mower_metadata)
        await manager.register_peripheral(grass_collector_metadata)
        await manager.enable_peripheral("mower-001")

        # Get stats
        stats = manager.get_stats()

        assert stats["total_peripherals"] == 2
        assert stats["connected_peripherals"] == 2
        assert stats["enabled_peripherals"] == 1
        assert stats["total_connections"] == 2
