"""SD-card boot-flag reset.

Allows a user locked out of the device to force it back into setup mode by
dropping a file onto the Raspberry Pi's FAT32 boot partition from any computer.

On startup, the backend looks for a flag file at one of two default paths
(settable via ``YARDROVER_RESET_FLAG_PATH``):

- ``/boot/firmware/yardrover-reset``  (Raspberry Pi OS >= bookworm)
- ``/boot/yardrover-reset``           (older Raspberry Pi OS)

If found, the backend:

1. Deletes ``users.json``, ``api_keys.json``, and ``refresh_tokens.json`` from
   the configured storage directory.
2. Flips ``security.setup_completed`` back to ``False`` in config.yaml.
3. Deletes the flag file itself so the next boot is normal.

Must run after ``ConfigManager.load()`` but before any auth manager reads its
JSON store from disk — see ``main.py`` lifespan.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from yardrover.core.config import ConfigManager

logger = structlog.get_logger(__name__)

DEFAULT_FLAG_PATHS: tuple[Path, ...] = (
    Path("/boot/firmware/yardrover-reset"),
    Path("/boot/yardrover-reset"),
)

CREDENTIAL_FILES: tuple[str, ...] = (
    "users.json",
    "api_keys.json",
    "refresh_tokens.json",
)


def _candidate_paths(config_manager: "ConfigManager") -> tuple[Path, ...]:
    """Return the flag paths to check, honoring the settings override."""
    override = config_manager.settings.reset_flag_path
    if override is not None:
        return (override,)
    return DEFAULT_FLAG_PATHS


def _find_flag_file(config_manager: "ConfigManager") -> Path | None:
    for path in _candidate_paths(config_manager):
        try:
            if path.is_file():
                return path
        except OSError as e:
            # e.g. permission denied reading /boot. Log at debug so noise stays
            # out of normal boots, but don't let it crash startup.
            logger.debug(
                "reset_flag_stat_failed",
                path=str(path),
                error=str(e),
            )
    return None


async def check_and_handle_reset_flag(config_manager: "ConfigManager") -> bool:
    """Check for the SD-card reset flag and, if present, wipe credentials.

    Returns ``True`` if a reset was performed, ``False`` otherwise.
    """
    flag_path = _find_flag_file(config_manager)
    if flag_path is None:
        return False

    logger.warning(
        "sd_card_reset_flag_detected",
        flag_path=str(flag_path),
        note="Wiping credentials and re-entering setup mode.",
    )

    storage_dir = config_manager.config.storage.base_path
    deleted: list[str] = []
    for name in CREDENTIAL_FILES:
        target = storage_dir / name
        try:
            if target.exists():
                target.unlink()
                deleted.append(name)
        except OSError as e:
            # If we can't delete a credential file the reset is incomplete.
            # Fail loud so the boot log makes the problem visible — the user
            # can still remove the flag manually next boot.
            logger.error(
                "reset_flag_credential_delete_failed",
                file=str(target),
                error=str(e),
            )

    try:
        await config_manager.update({"security": {"setup_completed": False}})
    except Exception as e:
        logger.error(
            "reset_flag_config_update_failed",
            error=str(e),
            note="setup_completed flag may still be true; manual edit of config.yaml required.",
        )

    try:
        flag_path.unlink()
    except OSError as e:
        # If we can't delete the flag, every subsequent boot will reset too.
        # The user can still remove the file by pulling the SD card again.
        logger.error(
            "reset_flag_unlink_failed",
            flag_path=str(flag_path),
            error=str(e),
            note="Flag file remains; device will reset again next boot until removed.",
        )

    logger.warning(
        "sd_card_reset_flag_applied",
        flag_path=str(flag_path),
        deleted_files=deleted,
    )
    return True
