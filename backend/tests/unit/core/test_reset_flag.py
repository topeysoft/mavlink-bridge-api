"""Unit tests for the SD-card boot-flag reset."""

from pathlib import Path

import pytest
import yaml

from yardrover.core.config import ConfigManager
from yardrover.core.events import EventBus
from yardrover.core.reset_flag import check_and_handle_reset_flag


async def _make_manager(tmp_path: Path, reset_flag_path: Path) -> ConfigManager:
    """Load a ConfigManager with storage + reset-flag paths pointed at tmp_path.

    The ``YARDROVER_RESET_FLAG_PATH`` env var would normally set this via
    Settings, but pytest can't reliably mutate env during a test run (Settings
    is instantiated lazily inside ConfigManager.load). Instead, we load the
    manager and then patch ``settings.reset_flag_path`` directly.
    """
    storage_path = tmp_path / "storage"
    storage_path.mkdir()

    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        yaml.safe_dump(
            {
                "device": {"name": "test", "hostname": "test"},
                "storage": {"base_path": str(storage_path)},
                "security": {"enabled": True, "setup_completed": True},
            }
        )
    )

    manager = ConfigManager(config_path, EventBus())
    await manager.load()
    manager.settings.reset_flag_path = reset_flag_path
    return manager


@pytest.mark.asyncio
async def test_no_flag_is_a_noop(tmp_path: Path) -> None:
    flag = tmp_path / "never-created"
    manager = await _make_manager(tmp_path, flag)

    storage_dir = manager.config.storage.base_path
    (storage_dir / "users.json").write_text('{"users": []}')

    assert await check_and_handle_reset_flag(manager) is False
    assert (storage_dir / "users.json").exists()
    assert manager.config.security.setup_completed is True


@pytest.mark.asyncio
async def test_flag_wipes_credentials_and_flips_setup(tmp_path: Path) -> None:
    flag = tmp_path / "yardrover-reset"
    flag.touch()
    manager = await _make_manager(tmp_path, flag)

    storage_dir = manager.config.storage.base_path
    (storage_dir / "users.json").write_text('{"users": ["sentinel"]}')
    (storage_dir / "api_keys.json").write_text("{}")
    (storage_dir / "refresh_tokens.json").write_text("{}")

    assert await check_and_handle_reset_flag(manager) is True

    assert not (storage_dir / "users.json").exists()
    assert not (storage_dir / "api_keys.json").exists()
    assert not (storage_dir / "refresh_tokens.json").exists()
    assert not flag.exists()
    assert manager.config.security.setup_completed is False

    # Persisted to disk too — not just in-memory.
    on_disk = yaml.safe_load(manager.config_path.read_text())
    assert on_disk["security"]["setup_completed"] is False


@pytest.mark.asyncio
async def test_flag_without_credential_files_still_succeeds(tmp_path: Path) -> None:
    flag = tmp_path / "yardrover-reset"
    flag.touch()
    manager = await _make_manager(tmp_path, flag)
    # storage dir has no json files yet — first-boot-but-locked-out scenario

    assert await check_and_handle_reset_flag(manager) is True
    assert not flag.exists()
    assert manager.config.security.setup_completed is False
