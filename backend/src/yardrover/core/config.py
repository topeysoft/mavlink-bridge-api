"""Configuration management with file and environment variable support."""

from pathlib import Path
from typing import Any, Optional

import aiofiles
import structlog
import yaml

from yardrover.core.errors import ConfigNotFoundError, ConfigValidationError, ConfigurationError
from yardrover.core.events import EventBus
from yardrover.models.config import Configuration, Settings

logger = structlog.get_logger(__name__)


class ConfigManager:
    """Configuration manager with validation and persistence.

    Manages application configuration with file-based persistence (YAML),
    validation using Pydantic models, and event notifications.

    Replaces C++ ConfigManager and NVSManager functionality.
    """

    def __init__(
        self,
        config_path: Optional[Path] = None,
        event_bus: Optional[EventBus] = None,
    ) -> None:
        """Initialize configuration manager.

        Args:
            config_path: Path to configuration file (defaults to config.yaml)
            event_bus: Event bus for change notifications
        """
        self.config_path = config_path or Path("config.yaml")
        self.event_bus = event_bus
        self._config: Optional[Configuration] = None
        self._settings: Optional[Settings] = None

    async def load(self) -> Configuration:
        """Load configuration from file or create default.

        Loads configuration in the following priority:
        1. Environment variables (via Settings)
        2. Configuration file (config.yaml)
        3. Default values

        Returns:
            Loaded and validated configuration

        Raises:
            ConfigValidationError: If configuration is invalid
        """
        # Load settings from environment variables
        self._settings = Settings()

        # Try to load from file if it exists
        if self.config_path.exists():
            try:
                config_data = await self._read_config_file()
                self._config = Configuration(**config_data)
                logger.info(
                    "config_loaded_from_file",
                    path=str(self.config_path),
                    device_name=self._config.device.name,
                )
            except Exception as e:
                logger.warning(
                    "config_file_load_failed",
                    path=str(self.config_path),
                    error=str(e),
                )
                # Fall back to settings
                self._config = self._settings.to_configuration()
        else:
            # Use configuration from settings
            self._config = self._settings.to_configuration()
            logger.info(
                "config_loaded_from_env",
                device_name=self._config.device.name,
            )

        # Ensure storage directories exist
        await self._ensure_storage_paths()

        return self._config

    async def _read_config_file(self) -> dict[str, Any]:
        """Read configuration from YAML file.

        Returns:
            Configuration dictionary

        Raises:
            ConfigNotFoundError: If file not found
            ConfigValidationError: If YAML is invalid
        """
        try:
            async with aiofiles.open(self.config_path, "r") as f:
                content = await f.read()
                return yaml.safe_load(content) or {}
        except FileNotFoundError as e:
            raise ConfigNotFoundError(
                f"Configuration file not found: {self.config_path}"
            ) from e
        except yaml.YAMLError as e:
            raise ConfigValidationError(f"Invalid YAML in config file: {e}") from e

    async def save(self) -> None:
        """Save current configuration to file.

        Raises:
            ConfigurationError: If config not loaded or save fails
        """
        if self._config is None:
            raise ConfigurationError("Configuration not loaded")

        try:
            # Convert to dict and save as YAML
            config_dict = self._config.model_dump(mode="json", exclude_none=True)

            async with aiofiles.open(self.config_path, "w") as f:
                content = yaml.dump(config_dict, default_flow_style=False, sort_keys=False)
                await f.write(content)

            logger.info("config_saved", path=str(self.config_path))

            # Emit event
            if self.event_bus:
                await self.event_bus.emit("config.changed", self._config)

        except Exception as e:
            raise ConfigurationError(f"Failed to save configuration: {e}") from e

    async def update(self, updates: dict[str, Any]) -> Configuration:
        """Update configuration with partial changes.

        Args:
            updates: Dictionary of configuration updates (supports nested updates)

        Returns:
            Updated configuration

        Raises:
            ConfigurationError: If config not loaded
            ConfigValidationError: If updates are invalid
        """
        if self._config is None:
            raise ConfigurationError("Configuration not loaded")

        try:
            # Get current config as dict
            config_dict = self._config.model_dump()

            # Apply updates (supports nested dict updates)
            self._deep_update(config_dict, updates)

            # Validate and create new config
            self._config = Configuration(**config_dict)

            # Save to file
            await self.save()

            logger.info("config_updated", updates=list(updates.keys()))

            return self._config

        except Exception as e:
            raise ConfigValidationError(f"Configuration update failed: {e}") from e

    def _deep_update(self, target: dict[str, Any], updates: dict[str, Any]) -> None:
        """Recursively update nested dictionary.

        Args:
            target: Target dictionary to update
            updates: Updates to apply
        """
        for key, value in updates.items():
            if isinstance(value, dict) and key in target and isinstance(target[key], dict):
                self._deep_update(target[key], value)
            else:
                target[key] = value

    async def _ensure_storage_paths(self) -> None:
        """Ensure storage directories exist."""
        if self._config is None:
            return

        try:
            # Create base storage path
            self._config.storage.base_path.mkdir(parents=True, exist_ok=True)

            # Create resources path if specified
            if self._config.storage.resources_path:
                self._config.storage.resources_path.mkdir(parents=True, exist_ok=True)
            else:
                # Use default: base_path/resources
                resources_path = self._config.storage.base_path / "resources"
                resources_path.mkdir(parents=True, exist_ok=True)
                self._config.storage.resources_path = resources_path

            logger.debug(
                "storage_paths_created",
                base=str(self._config.storage.base_path),
                resources=str(self._config.storage.resources_path),
            )

        except Exception as e:
            logger.warning("storage_path_creation_failed", error=str(e))

    @property
    def config(self) -> Configuration:
        """Get current configuration.

        Returns:
            Current configuration

        Raises:
            ConfigurationError: If configuration not loaded
        """
        if self._config is None:
            raise ConfigurationError("Configuration not loaded. Call load() first.")
        return self._config

    @config.setter
    def config(self, value: Configuration) -> None:
        """Set configuration.

        Args:
            value: New configuration
        """
        self._config = value

    @property
    def settings(self) -> Settings:
        """Get current settings.

        Returns:
            Current settings

        Raises:
            ConfigurationError: If settings not loaded
        """
        if self._settings is None:
            raise ConfigurationError("Settings not loaded. Call load() first.")
        return self._settings


# Global configuration manager instance
_config_manager: Optional[ConfigManager] = None


def get_config_manager() -> ConfigManager:
    """Get global configuration manager instance.

    Returns:
        Global ConfigManager instance
    """
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager
