"""Authentication behavior tests for mDNS discover endpoint."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import yardrover.api.mdns as mdns_api
from yardrover.main import app


DISCOVER_PATH = "/api/mdns/discover"
DISCOVER_PAYLOAD = {"service_type": "_rtk-base._tcp", "timeout": 1}


def _set_setup_auth_policy(monkeypatch, *, in_setup_mode: bool, require_auth_during_setup: bool) -> None:
    """Patch setup/auth policy checks used by mDNS discover dependency."""
    fake_config_manager = SimpleNamespace(
        config=SimpleNamespace(
            security=SimpleNamespace(require_auth_during_setup=require_auth_during_setup)
        )
    )

    monkeypatch.setattr(mdns_api, "is_truly_in_setup_mode", lambda: in_setup_mode)
    monkeypatch.setattr(mdns_api, "get_config_manager", lambda: fake_config_manager)


def _set_discovery_result() -> None:
    """Ensure discover returns a valid response payload for API tests."""
    app.state.mdns_manager.discover = AsyncMock(return_value=[])


def test_mdns_discover_allows_anonymous_in_true_setup_mode(test_client, monkeypatch):
    _set_setup_auth_policy(monkeypatch, in_setup_mode=True, require_auth_during_setup=False)
    _set_discovery_result()

    response = test_client.post(DISCOVER_PATH, json=DISCOVER_PAYLOAD)

    assert response.status_code == 200
    data = response.json()
    assert data["service_type"] == "_rtk-base._tcp"
    assert data["services"] == []


def test_mdns_discover_blocks_anonymous_when_setup_auth_required(test_client, monkeypatch):
    _set_setup_auth_policy(monkeypatch, in_setup_mode=True, require_auth_during_setup=True)
    _set_discovery_result()

    response = test_client.post(DISCOVER_PATH, json=DISCOVER_PAYLOAD)

    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_mdns_discover_blocks_anonymous_outside_setup_mode(test_client, monkeypatch):
    _set_setup_auth_policy(monkeypatch, in_setup_mode=False, require_auth_during_setup=False)
    _set_discovery_result()

    response = test_client.post(DISCOVER_PATH, json=DISCOVER_PAYLOAD)

    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_mdns_discover_keeps_invalid_credentials_rejected_in_setup_mode(test_client, monkeypatch):
    _set_setup_auth_policy(monkeypatch, in_setup_mode=True, require_auth_during_setup=False)
    _set_discovery_result()

    response = test_client.post(
        DISCOVER_PATH,
        json=DISCOVER_PAYLOAD,
        headers={"X-API-Key": "invalid-key"},
    )

    assert response.status_code == 401
    assert "Invalid or expired API key" in response.json()["detail"]
