"""Unit tests for WiFi manager."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from yardrover.core.errors import NetworkError
from yardrover.core.events import EventBus
from yardrover.models.network import WiFiAuthMode, WiFiCredentials, WiFiState
from yardrover.network.wifi import WiFiManager


class TestWiFiManager:
    """Test WiFiManager functionality."""

    @pytest.fixture
    def event_bus(self):
        """Create event bus for testing."""
        return EventBus()

    @pytest.fixture
    async def wifi_manager(self, event_bus):
        """Create WiFi manager instance."""
        manager = WiFiManager(event_bus)
        yield manager
        # Cleanup: ensure manager is stopped to close any resources
        if manager._connection_monitor_task is not None or manager._signal_check_task is not None:
            await manager.stop()

    @pytest.mark.asyncio
    async def test_initialization(self, wifi_manager):
        """Test WiFi manager initialization."""
        assert wifi_manager._state == WiFiState.DISCONNECTED
        assert wifi_manager._reconnect_attempts == 0

    @pytest.mark.asyncio
    async def test_start_without_networkmanager(self, wifi_manager):
        """Test starting without NetworkManager available."""
        with patch.object(
            wifi_manager, "_check_nm_available", return_value=False
        ):
            with pytest.raises(NetworkError) as exc_info:
                await wifi_manager.start()
            assert "NetworkManager not available" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_start_with_networkmanager(self, wifi_manager):
        """Test starting with NetworkManager available."""
        with patch.object(
            wifi_manager, "_check_nm_available", return_value=True
        ), patch.object(
            wifi_manager, "_update_state", new_callable=AsyncMock
        ):
            await wifi_manager.start()

            # Verify state was updated
            wifi_manager._update_state.assert_called_once()

            # Verify monitoring task was created
            assert wifi_manager._connection_monitor_task is not None

    @pytest.mark.asyncio
    async def test_connect_success(self, wifi_manager):
        """Test successful WiFi connection."""
        credentials = WiFiCredentials(ssid="TestNetwork", password="password123")

        # Mock subprocess execution
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate = AsyncMock(return_value=(b"Success", b""))

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_process
        ), patch.object(
            wifi_manager, "_update_state", new_callable=AsyncMock
        ), patch.object(
            wifi_manager, "_set_state", new_callable=AsyncMock
        ):
            state = await wifi_manager.connect(credentials)

            # Verify connection was attempted
            assert wifi_manager._reconnect_attempts == 0

    @pytest.mark.asyncio
    async def test_connect_failure(self, wifi_manager):
        """Test failed WiFi connection."""
        credentials = WiFiCredentials(ssid="TestNetwork", password="password123")

        # Mock subprocess execution failure
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate = AsyncMock(
            return_value=(b"", b"Connection failed")
        )

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_process
        ), patch.object(
            wifi_manager, "_set_state", new_callable=AsyncMock
        ):
            with pytest.raises(NetworkError) as exc_info:
                await wifi_manager.connect(credentials)
            assert "Failed to connect" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_connect_timeout(self, wifi_manager):
        """Test WiFi connection timeout."""
        credentials = WiFiCredentials(ssid="TestNetwork", password="password123")

        # Mock subprocess that times out
        mock_process = AsyncMock()
        mock_process.communicate = AsyncMock(
            side_effect=asyncio.TimeoutError()
        )

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_process
        ), patch.object(
            wifi_manager, "_set_state", new_callable=AsyncMock
        ):
            with pytest.raises(NetworkError) as exc_info:
                await wifi_manager.connect(credentials)
            assert "timed out" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_disconnect(self, wifi_manager):
        """Test WiFi disconnection."""
        # Mock getting active connection
        with patch.object(
            wifi_manager,
            "_get_active_wifi_connection",
            return_value="TestConnection",
        ):
            mock_process = AsyncMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))

            with patch(
                "asyncio.create_subprocess_exec", return_value=mock_process
            ), patch.object(
                wifi_manager, "_set_state", new_callable=AsyncMock
            ):
                await wifi_manager.disconnect()

                # Verify state was set to disconnected
                wifi_manager._set_state.assert_called_with(
                    WiFiState.DISCONNECTED
                )

    @pytest.mark.asyncio
    async def test_disconnect_no_connection(self, wifi_manager):
        """Test disconnection when no active connection."""
        with patch.object(
            wifi_manager,
            "_get_active_wifi_connection",
            return_value=None,
        ), patch.object(
            wifi_manager, "_set_state", new_callable=AsyncMock
        ):
            await wifi_manager.disconnect()

            # Should set state to disconnected
            wifi_manager._set_state.assert_called_with(WiFiState.DISCONNECTED)

    @pytest.mark.asyncio
    async def test_scan_networks(self, wifi_manager):
        """Test WiFi network scanning."""
        # Mock nmcli output
        scan_output = b"""TestNetwork1:80:WPA2:6:AA:BB:CC:DD:EE:FF
TestNetwork2:65:WPA3:11:11:22:33:44:55:66
OpenNetwork:50::1:77:88:99:AA:BB:CC"""

        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate = AsyncMock(return_value=(scan_output, b""))

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_process
        ):
            networks = await wifi_manager.scan(force=False)

            assert len(networks) == 3
            assert networks[0].ssid == "TestNetwork1"
            assert networks[0].rssi == -60  # Approximate conversion
            assert networks[0].auth_mode == WiFiAuthMode.WPA2_PSK

    @pytest.mark.asyncio
    async def test_scan_force_rescan(self, wifi_manager):
        """Test forced network rescan."""
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate = AsyncMock(return_value=(b"", b""))

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_process
        ), patch("asyncio.sleep", new_callable=AsyncMock):
            await wifi_manager.scan(force=True)

            # Verify rescan was requested (called twice: rescan + list)
            assert asyncio.create_subprocess_exec.call_count == 2

    @pytest.mark.asyncio
    async def test_scan_failure(self, wifi_manager):
        """Test scan failure handling."""
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate = AsyncMock(return_value=(b"", b"Scan failed"))

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_process
        ):
            with pytest.raises(NetworkError) as exc_info:
                await wifi_manager.scan()
            assert "WiFi scan failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_status(self, wifi_manager):
        """Test getting WiFi status."""
        with patch.object(
            wifi_manager, "_update_state", new_callable=AsyncMock
        ), patch.object(
            wifi_manager, "_get_connection_info", return_value=None
        ), patch.object(
            wifi_manager, "_get_saved_network", return_value="SavedNetwork"
        ):
            status = await wifi_manager.get_status()

            assert status.state == WiFiState.DISCONNECTED
            assert status.saved_network == "SavedNetwork"
            assert status.ap_mode_active is False

    @pytest.mark.asyncio
    async def test_parse_auth_mode(self, wifi_manager):
        """Test WiFi authentication mode parsing."""
        assert wifi_manager._parse_auth_mode("") == WiFiAuthMode.OPEN
        assert wifi_manager._parse_auth_mode("--") == WiFiAuthMode.OPEN
        assert wifi_manager._parse_auth_mode("WPA2") == WiFiAuthMode.WPA2_PSK
        assert (
            wifi_manager._parse_auth_mode("WPA3") == WiFiAuthMode.WPA3_PSK
        )
        assert (
            wifi_manager._parse_auth_mode("WPA2 WPA3")
            == WiFiAuthMode.WPA2_WPA3_PSK
        )
        assert wifi_manager._parse_auth_mode("WEP") == WiFiAuthMode.WEP

    @pytest.mark.asyncio
    async def test_state_change_events(self, wifi_manager, event_bus):
        """Test state change event publishing."""
        events_received = []

        async def event_handler(event_type: str, data: dict):
            events_received.append((event_type, data))

        await event_bus.subscribe("wifi.state_changed", event_handler)

        # Change state
        await wifi_manager._set_state(WiFiState.CONNECTING)

        # Wait for event processing
        await asyncio.sleep(0.1)

        assert len(events_received) == 1
        assert events_received[0][0] == "wifi.state_changed"
        assert events_received[0][1]["state"] == "connecting"

    @pytest.mark.asyncio
    async def test_clear_saved_network(self, wifi_manager):
        """Test clearing saved network."""
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate = AsyncMock(return_value=(b"", b""))

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_process
        ):
            result = await wifi_manager.clear_saved_network("TestNetwork")
            assert result is True

    @pytest.mark.asyncio
    async def test_clear_saved_network_failure(self, wifi_manager):
        """Test clearing saved network failure."""
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate = AsyncMock(
            return_value=(b"", b"Network not found")
        )

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_process
        ):
            result = await wifi_manager.clear_saved_network("TestNetwork")
            assert result is False

    @pytest.mark.asyncio
    async def test_stop(self, wifi_manager):
        """Test stopping WiFi manager."""
        # Create mock tasks
        wifi_manager._signal_check_task = AsyncMock()
        wifi_manager._signal_check_task.done = MagicMock(return_value=False)
        wifi_manager._signal_check_task.cancel = MagicMock()

        wifi_manager._connection_monitor_task = AsyncMock()
        wifi_manager._connection_monitor_task.done = MagicMock(
            return_value=False
        )
        wifi_manager._connection_monitor_task.cancel = MagicMock()

        with patch("asyncio.gather", new_callable=AsyncMock):
            await wifi_manager.stop()

            # Verify tasks were cancelled
            assert wifi_manager._signal_check_task.cancel.called
            assert wifi_manager._connection_monitor_task.cancel.called
