"""Unit tests for configuration system."""

from pathlib import Path

import pytest
import yaml

from yardrover.core.config import ConfigManager
from yardrover.core.errors import ConfigValidationError
from yardrover.core.events import EventBus
from yardrover.models.config import Configuration, DeviceConfig


class TestConfigManager:
    """Tests for ConfigManager class."""

    @pytest.fixture
    async def config_manager(
        self, tmp_path: Path
    ) -> ConfigManager:
        """Create config manager for testing."""
        config_path = tmp_path / "config.yaml"
        event_bus = EventBus()
        manager = ConfigManager(config_path, event_bus)
        return manager

    async def test_load_default_config(
        self, config_manager: ConfigManager
    ) -> None:
        """Test loading default configuration."""
        config = await config_manager.load()

        assert isinstance(config, Configuration)
        assert config.device.name is not None
        assert config.device.hostname is not None

    async def test_load_from_file(
        self, tmp_path: Path
    ) -> None:
        """Test loading configuration from YAML file."""
        config_path = tmp_path / "config.yaml"

        # Create test config file
        test_config = {
            "device": {
                "name": "TestRover",
                "hostname": "test-rover",
            }
        }

        with open(config_path, "w") as f:
            yaml.dump(test_config, f)

        # Load config
        manager = ConfigManager(config_path)
        config = await manager.load()

        assert config.device.name == "TestRover"
        assert config.device.hostname == "test-rover"

    async def test_save_config(
        self, config_manager: ConfigManager
    ) -> None:
        """Test saving configuration to file."""
        await config_manager.load()

        config_manager._config.device.name = "SavedRover"
        await config_manager.save()

        # Verify file was created
        assert config_manager.config_path.exists()

        # Load in new manager to verify persistence
        new_manager = ConfigManager(config_manager.config_path)
        config = await new_manager.load()

        assert config.device.name == "SavedRover"

    async def test_update_config(
        self, config_manager: ConfigManager
    ) -> None:
        """Test updating configuration."""
        await config_manager.load()

        updates = {
            "device": {
                "name": "UpdatedRover",
            }
        }

        updated_config = await config_manager.update(updates)

        assert updated_config.device.name == "UpdatedRover"
        assert config_manager.config.device.name == "UpdatedRover"

    async def test_config_property_before_load(
        self, config_manager: ConfigManager
    ) -> None:
        """Test accessing config property before loading."""
        from yardrover.core.errors import ConfigurationError

        with pytest.raises(ConfigurationError):
            _ = config_manager.config

    async def test_event_emission_on_save(
        self, tmp_path: Path
    ) -> None:
        """Test that config_changed event is emitted on save."""
        event_bus = EventBus()
        received_events: list[str] = []

        async def handler(event: str, data: any) -> None:
            received_events.append(event)

        await event_bus.subscribe("config_changed", handler)

        config_manager = ConfigManager(tmp_path / "config.yaml", event_bus)
        await config_manager.load()
        await config_manager.save()

        assert "config_changed" in received_events
