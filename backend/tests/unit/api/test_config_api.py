"""Tests for configuration API endpoints."""

import pytest
from fastapi.testclient import TestClient

from yardrover.core.config import get_config_manager
from yardrover.main import app
from yardrover.models.config import Configuration


@pytest.fixture
async def initialized_config():
    """Initialize config manager for tests."""
    config_manager = get_config_manager()
    await config_manager.load()
    return config_manager


@pytest.fixture
def client(initialized_config):
    """Create a test client with initialized config."""
    with TestClient(app) as test_client:
        yield test_client


def test_get_config(client):
    """Test GET /api/config endpoint."""
    response = client.get("/api/config")
    assert response.status_code == 200

    data = response.json()
    assert "device" in data
    assert "network" in data
    assert "storage" in data
    assert "serial" in data
    assert "rtcm" in data


def test_get_config_returns_valid_schema(client):
    """Test that GET /api/config returns valid Configuration schema."""
    response = client.get("/api/config")
    assert response.status_code == 200

    # Validate response against Pydantic model
    config = Configuration(**response.json())
    assert config.device.name == "YardRover Dev"
    assert config.device.hostname == "yardrover-dev"


def test_post_config_replace(client):
    """Test POST /api/config to replace entire configuration."""
    # First get current config
    response = client.get("/api/config")
    assert response.status_code == 200
    current_config = response.json()

    # Modify and replace
    current_config["device"]["name"] = "TestRover"
    response = client.post("/api/config", json=current_config)
    assert response.status_code == 200
    assert "message" in response.json()

    # Verify change persisted
    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json()["device"]["name"] == "TestRover"

    # Restore original
    current_config["device"]["name"] = "YardRover Dev"
    client.post("/api/config", json=current_config)


def test_patch_config_single_field(client):
    """Test PATCH /api/config to update single field."""
    updates = {"device": {"name": "PatchedRover"}}
    response = client.patch("/api/config", json=updates)
    assert response.status_code == 200

    # Verify change
    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json()["device"]["name"] == "PatchedRover"

    # Restore original
    client.patch("/api/config", json={"device": {"name": "YardRover Dev"}})


def test_patch_config_multiple_fields(client):
    """Test PATCH /api/config to update multiple fields."""
    updates = {
        "device": {"name": "MultiPatch", "hostname": "multipatch"},
    }
    response = client.patch("/api/config", json=updates)
    assert response.status_code == 200

    # Verify changes
    response = client.get("/api/config")
    data = response.json()
    assert data["device"]["name"] == "MultiPatch"
    assert data["device"]["hostname"] == "multipatch"

    # Restore originals
    client.patch(
        "/api/config",
        json={
            "device": {"name": "YardRover Dev", "hostname": "yardrover-dev"},
        },
    )


def test_patch_config_invalid_section(client):
    """Test PATCH /api/config with invalid section."""
    updates = {"invalid_section": {"field": "value"}}
    response = client.patch("/api/config", json=updates)
    assert response.status_code == 400


def test_patch_config_invalid_field(client):
    """Test PATCH /api/config with invalid field."""
    updates = {"device": {"invalid_field": "value"}}
    response = client.patch("/api/config", json=updates)
    assert response.status_code == 400
