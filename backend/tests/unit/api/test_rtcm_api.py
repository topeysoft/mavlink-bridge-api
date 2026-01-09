"""Tests for RTCM API endpoints."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from yardrover.models.rtcm import (
    NTRIPConfig,
    OutputFormat,
    RTCMOutputTarget,
    RTCMState,
    RTCMStatistics,
    TCPOutputConfig,
    UDPOutputConfig,
)


@pytest.fixture
def mock_ntrip_client():
    """Create a mock NTRIPClient."""
    client = MagicMock()
    client.config = NTRIPConfig(
        host="test.ntrip.com",
        port=2101,
        mountpoint="TEST",
        username="user",
        password="pass",
        send_position=False,
        user_agent="TestAgent",
        gga_interval=10000,
    )
    client.state = RTCMState.CONNECTED
    client.is_connected = True
    client.statistics = RTCMStatistics()
    client.start = AsyncMock(return_value=True)
    client.stop = AsyncMock()
    return client


@pytest.fixture
def mock_output_router():
    """Create a mock RTCMOutputRouter."""
    router = MagicMock()
    router.get_target_count = MagicMock(return_value=2)
    router.get_active_target_count = MagicMock(return_value=1)
    router.get_target_info = MagicMock(return_value=[
        {
            "name": "tcp_out",
            "enabled": True,
            "format": "raw",
            "transport": {
                "type": "tcp",
                "host": "localhost",
                "port": 5015,
            },
        },
        {
            "name": "udp_out",
            "enabled": False,
            "format": "raw",
            "transport": {
                "type": "udp",
                "host": "localhost",
                "port": 5016,
            },
        },
    ])
    router.get_statistics = MagicMock(return_value={
        "total_targets": 2,
        "active_targets": 1,
        "messages_routed": 100,
        "bytes_routed": 5000,
        "routing_errors": 0,
    })
    router.reset_statistics = MagicMock()
    router.add_target = AsyncMock(return_value=True)
    router.remove_target = AsyncMock(return_value=True)
    router.set_target_enabled = AsyncMock(return_value=True)
    router.close = AsyncMock()
    return router


@pytest.fixture
def client_with_rtcm(mock_ntrip_client, mock_output_router):
    """Create test client with mocked RTCM components."""
    # Import here to avoid circular imports
    from yardrover import api
    from yardrover.main import app

    # Patch the module-level variables
    with patch.object(api.rtcm, "_ntrip_client", mock_ntrip_client):
        with patch.object(api.rtcm, "_output_router", mock_output_router):
            with TestClient(app) as test_client:
                yield test_client


def test_get_rtcm_config(client_with_rtcm, mock_ntrip_client, mock_output_router):
    """Test GET /api/rtcm/config endpoint."""
    response = client_with_rtcm.get("/api/rtcm/config")
    assert response.status_code == 200

    data = response.json()
    assert data["enabled"] is True
    assert data["source"]["type"] == "ntrip"
    assert data["source"]["host"] == "test.ntrip.com"
    assert data["source"]["port"] == 2101
    assert data["source"]["mountpoint"] == "TEST"
    assert len(data["outputs"]) == 2


def test_get_rtcm_status(client_with_rtcm, mock_ntrip_client):
    """Test GET /api/rtcm/status endpoint."""
    response = client_with_rtcm.get("/api/rtcm/status")
    assert response.status_code == 200

    data = response.json()
    assert data["running"] is True
    assert data["state"] == "connected"
    assert data["client_type"] == "NTRIP"
    assert data["connected"] is True


def test_get_rtcm_outputs(client_with_rtcm, mock_output_router):
    """Test GET /api/rtcm/outputs endpoint."""
    response = client_with_rtcm.get("/api/rtcm/outputs")
    assert response.status_code == 200

    data = response.json()
    assert data["total_targets"] == 2
    assert data["active_targets"] == 1
    assert len(data["targets"]) == 2
    assert data["targets"][0]["name"] == "tcp_out"
    assert data["targets"][0]["enabled"] is True


def test_get_rtcm_statistics(client_with_rtcm, mock_output_router):
    """Test GET /api/rtcm/statistics endpoint."""
    response = client_with_rtcm.get("/api/rtcm/statistics")
    assert response.status_code == 200

    data = response.json()
    assert "client" in data
    assert "router" in data
    assert data["router"]["messages_routed"] == 100


def test_reset_rtcm_statistics(client_with_rtcm, mock_output_router):
    """Test POST /api/rtcm/statistics/reset endpoint."""
    response = client_with_rtcm.post("/api/rtcm/statistics/reset")
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    mock_output_router.reset_statistics.assert_called_once()


def test_add_output(client_with_rtcm, mock_output_router):
    """Test POST /api/rtcm/outputs endpoint."""
    target = {
        "name": "new_tcp",
        "enabled": True,
        "format": "raw",
        "transport": {
            "type": "tcp",
            "host": "192.168.1.100",
            "port": 9000,
        },
    }

    response = client_with_rtcm.post("/api/rtcm/outputs", json={"target": target})
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert "new_tcp" in data["message"]
    mock_output_router.add_target.assert_called_once()


def test_remove_output(client_with_rtcm, mock_output_router):
    """Test DELETE /api/rtcm/outputs/{name} endpoint."""
    response = client_with_rtcm.delete("/api/rtcm/outputs/tcp_out")
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert "tcp_out" in data["message"]
    mock_output_router.remove_target.assert_called_once_with("tcp_out")


def test_set_output_enabled(client_with_rtcm, mock_output_router):
    """Test PATCH /api/rtcm/outputs/{name}/enabled endpoint."""
    response = client_with_rtcm.patch(
        "/api/rtcm/outputs/tcp_out/enabled",
        json={"enabled": False}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert "disabled" in data["message"]
    mock_output_router.set_target_enabled.assert_called_once_with("tcp_out", False)


def test_toggle_outputs_success(client_with_rtcm, mock_output_router):
    """Test POST /api/rtcm/outputs/toggle endpoint with all successful."""
    request_data = {
        "names": ["tcp_out", "udp_out"],
        "enabled": True,
    }

    response = client_with_rtcm.post("/api/rtcm/outputs/toggle", json=request_data)
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert len(data["toggled"]) == 2
    assert len(data["failed"]) == 0
    assert "tcp_out" in data["toggled"]
    assert "udp_out" in data["toggled"]
    assert "Successfully enabled 2 output target(s)" in data["message"]


def test_toggle_outputs_partial_failure(client_with_rtcm, mock_output_router):
    """Test POST /api/rtcm/outputs/toggle endpoint with partial failure."""
    # Mock set_target_enabled to fail for one target
    async def mock_set_enabled(name, enabled):
        if name == "udp_out":
            return False
        return True

    mock_output_router.set_target_enabled = AsyncMock(side_effect=mock_set_enabled)

    request_data = {
        "names": ["tcp_out", "udp_out"],
        "enabled": False,
    }

    response = client_with_rtcm.post("/api/rtcm/outputs/toggle", json=request_data)
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is False
    assert len(data["toggled"]) == 1
    assert len(data["failed"]) == 1
    assert "tcp_out" in data["toggled"]
    assert "udp_out" in data["failed"]
    assert "1 failed" in data["message"]


def test_toggle_outputs_empty_list(client_with_rtcm, mock_output_router):
    """Test POST /api/rtcm/outputs/toggle endpoint with empty list."""
    request_data = {
        "names": [],
        "enabled": True,
    }

    response = client_with_rtcm.post("/api/rtcm/outputs/toggle", json=request_data)
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert len(data["toggled"]) == 0
    assert len(data["failed"]) == 0
