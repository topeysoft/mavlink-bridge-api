"""RTCM configuration persistence.

Handles saving and loading RTCM client configurations for persistence
across service restarts.
"""

from typing import Optional

import structlog

from yardrover.core.errors import StorageError, StorageNotFoundError
from yardrover.core.storage import Storage, get_storage
from yardrover.models.rtcm import RTCMClientConfig

logger = structlog.get_logger(__name__)

RTCM_CONFIG_KEY = "rtcm/config"


class RTCMConfigStore:
    """RTCM configuration storage manager.

    Provides persistence for RTCM client configurations using the
    core Storage abstraction. Configurations are saved as JSON and
    automatically restored on service restart.
    """

    def __init__(self, storage: Optional[Storage] = None) -> None:
        """Initialize RTCM configuration store.

        Args:
            storage: Storage instance (uses global storage if None)
        """
        self.storage = storage or get_storage()

    async def save_config(self, config: RTCMClientConfig) -> None:
        """Save RTCM client configuration.

        Args:
            config: RTCM client configuration to save

        Raises:
            StorageError: If save operation fails
        """
        try:
            # Convert to JSON-serializable dict
            config_dict = config.model_dump(mode="json", exclude_none=True)

            # Save to storage
            await self.storage.write(RTCM_CONFIG_KEY, config_dict)

            logger.info(
                "rtcm_config_saved",
                source_type=config.source.type,
                output_count=len(config.outputs),
            )

        except Exception as e:
            logger.error("rtcm_config_save_failed", error=str(e))
            raise StorageError(f"Failed to save RTCM configuration: {e}") from e

    async def load_config(self) -> RTCMClientConfig:
        """Load saved RTCM client configuration.

        Returns:
            Loaded RTCM client configuration

        Raises:
            StorageNotFoundError: If no saved configuration exists
            StorageError: If load operation fails or validation fails
        """
        try:
            # Load from storage
            config_dict = await self.storage.read(RTCM_CONFIG_KEY)

            # Validate and create config model
            config = RTCMClientConfig(**config_dict)

            logger.info(
                "rtcm_config_loaded",
                source_type=config.source.type,
                output_count=len(config.outputs),
            )

            return config

        except StorageNotFoundError:
            logger.debug("rtcm_config_not_found")
            raise
        except Exception as e:
            logger.error("rtcm_config_load_failed", error=str(e))
            raise StorageError(f"Failed to load RTCM configuration: {e}") from e

    async def delete_config(self) -> None:
        """Delete saved RTCM client configuration.

        Raises:
            StorageNotFoundError: If no saved configuration exists
            StorageError: If delete operation fails
        """
        try:
            await self.storage.delete(RTCM_CONFIG_KEY)
            logger.info("rtcm_config_deleted")

        except StorageNotFoundError:
            logger.debug("rtcm_config_not_found_for_delete")
            raise
        except Exception as e:
            logger.error("rtcm_config_delete_failed", error=str(e))
            raise StorageError(f"Failed to delete RTCM configuration: {e}") from e

    async def has_config(self) -> bool:
        """Check if saved RTCM configuration exists.

        Returns:
            True if saved configuration exists, False otherwise
        """
        try:
            return await self.storage.exists(RTCM_CONFIG_KEY)
        except Exception as e:
            logger.error("rtcm_config_exists_check_failed", error=str(e))
            return False


# Global RTCM config store instance
_rtcm_config_store: Optional[RTCMConfigStore] = None


def get_rtcm_config_store() -> RTCMConfigStore:
    """Get global RTCM configuration store instance.

    Returns:
        Global RTCMConfigStore instance
    """
    global _rtcm_config_store
    if _rtcm_config_store is None:
        _rtcm_config_store = RTCMConfigStore()
    return _rtcm_config_store
