"""Unit tests for mDNS manager."""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from yardrover.core.errors import NetworkError
from yardrover.core.events import EventBus
from yardrover.models.network import MDNSConfig
from yardrover.network.mdns import MDNSManager


class TestMDNSManager:
    """Test MDNSManager functionality."""

    @pytest.fixture
    def event_bus(self):
        """Create event bus for testing."""
        return EventBus()

    @pytest.fixture
    async def mdns_manager(self, event_bus):
        """Create mDNS manager instance."""
        manager = MDNSManager(event_bus, "test-device")
        yield manager
        # Cleanup: ensure manager is stopped to close any resources
        if manager._azc is not None:
            await manager.stop()

    @pytest.mark.asyncio
    async def test_initialization(self, mdns_manager):
        """Test mDNS manager initialization."""
        assert mdns_manager._hostname == "test-device"
        assert mdns_manager._enabled is True
        assert len(mdns_manager._advertised_services) == 0

    @pytest.mark.asyncio
    async def test_start_when_disabled(self, mdns_manager):
        """Test starting when disabled."""
        mdns_manager._enabled = False
        await mdns_manager.start()

        # Should not initialize AsyncZeroconf
        assert mdns_manager._azc is None

    @pytest.mark.asyncio
    async def test_start_when_enabled(self, mdns_manager):
        """Test starting when enabled."""
        mock_azc_instance = AsyncMock()
        mock_azc_instance.async_close = AsyncMock()

        # Create a real async task that we can cancel
        async def mock_cleanup():
            await asyncio.sleep(1000)  # Long sleep so test won't wait

        with patch("yardrover.network.mdns.AsyncZeroconf", return_value=mock_azc_instance) as mock_azc:
            await mdns_manager.start()

            # Verify AsyncZeroconf was created
            assert mock_azc.called
            assert mdns_manager._azc is not None
            assert mdns_manager._cleanup_task is not None

    @pytest.mark.asyncio
    async def test_stop(self, mdns_manager):
        """Test stopping mDNS manager."""
        # Setup manager with mock services
        mock_azc = AsyncMock()
        mock_azc.async_unregister_service = AsyncMock()
        mock_azc.async_close = AsyncMock()
        mdns_manager._azc = mock_azc

        # Create real cleanup task that we can cancel
        async def mock_cleanup():
            try:
                await asyncio.sleep(1000)
            except asyncio.CancelledError:
                pass

        mdns_manager._cleanup_task = asyncio.create_task(mock_cleanup())

        # Add a mock service
        mock_service = MagicMock()
        mdns_manager._advertised_services["test"] = mock_service

        await mdns_manager.stop()

        # Verify cleanup
        assert mdns_manager._cleanup_task.cancelled()
        assert mock_azc.async_unregister_service.called
        assert mock_azc.async_close.called
        assert len(mdns_manager._advertised_services) == 0

    @pytest.mark.asyncio
    async def test_add_service_not_started(self, mdns_manager):
        """Test adding service when not started."""
        with pytest.raises(NetworkError) as exc_info:
            await mdns_manager.add_service("test", "_http._tcp", 8000)
        assert "mDNS not started" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_add_service_success(self, mdns_manager):
        """Test successfully adding a service."""
        # Mock AsyncZeroconf
        mock_azc = AsyncMock()
        mock_zeroconf = MagicMock()
        mock_azc.zeroconf = mock_zeroconf
        mock_azc.async_register_service = AsyncMock()
        mdns_manager._azc = mock_azc

        with patch("socket.gethostname", return_value="testhost"), patch(
            "socket.getaddrinfo",
            return_value=[
                (2, 1, 6, "", ("192.168.1.100", 0))  # AF_INET, mock data
            ],
        ), patch("socket.inet_aton", return_value=b"\xc0\xa8\x01\x64"), patch(
            "yardrover.network.mdns.ServiceInfo"
        ) as mock_service_info:
            result = await mdns_manager.add_service(
                "test-service",
                "_http._tcp",
                8000,
                {"version": "1.0"},
            )

            assert result is True
            assert mock_azc.async_register_service.called
            assert len(mdns_manager._advertised_services) == 1

    @pytest.mark.asyncio
    async def test_add_service_with_txt_records(self, mdns_manager):
        """Test adding service with TXT records."""
        mock_azc = AsyncMock()
        mock_zeroconf = MagicMock()
        mock_azc.zeroconf = mock_zeroconf
        mock_azc.async_register_service = AsyncMock()
        mdns_manager._azc = mock_azc

        txt_records = {"key1": "value1", "key2": "value2"}

        with patch("socket.gethostname", return_value="testhost"), patch(
            "socket.getaddrinfo",
            return_value=[(2, 1, 6, "", ("192.168.1.100", 0))],
        ), patch("socket.inet_aton", return_value=b"\xc0\xa8\x01\x64"), patch(
            "yardrover.network.mdns.ServiceInfo"
        ) as mock_service_info:
            await mdns_manager.add_service(
                "test", "_http._tcp", 8000, txt_records
            )

            # Verify ServiceInfo was called with properties
            call_args = mock_service_info.call_args
            properties = call_args[1]["properties"]
            assert b"key1" in properties
            assert b"key2" in properties

    @pytest.mark.asyncio
    async def test_remove_service_success(self, mdns_manager):
        """Test successfully removing a service."""
        # Setup with a registered service
        mock_azc = AsyncMock()
        mock_azc.async_unregister_service = AsyncMock()
        mdns_manager._azc = mock_azc

        mock_service = MagicMock()
        service_key = "_http._tcp.local.:8000"
        mdns_manager._advertised_services[service_key] = mock_service

        result = await mdns_manager.remove_service("_http._tcp.local.", 8000)

        assert result is True
        assert mock_azc.async_unregister_service.called
        assert service_key not in mdns_manager._advertised_services

    @pytest.mark.asyncio
    async def test_remove_service_not_found(self, mdns_manager):
        """Test removing non-existent service."""
        mock_azc = AsyncMock()
        mdns_manager._azc = mock_azc

        result = await mdns_manager.remove_service("_http._tcp", 8000)

        assert result is False

    @pytest.mark.asyncio
    async def test_remove_service_not_started(self, mdns_manager):
        """Test removing service when not started."""
        result = await mdns_manager.remove_service("_http._tcp", 8000)
        assert result is False

    @pytest.mark.asyncio
    async def test_discover_services(self, mdns_manager):
        """Test service discovery."""
        # Setup mDNS manager
        mock_azc = AsyncMock()
        mock_zeroconf = MagicMock()
        mock_azc.zeroconf = mock_zeroconf
        mock_azc.async_close = AsyncMock()
        mdns_manager._azc = mock_azc

        # Mock browser with async_cancel
        mock_browser_instance = AsyncMock()
        mock_browser_instance.async_cancel = AsyncMock()

        with patch(
            "yardrover.network.mdns.AsyncServiceBrowser",
            return_value=mock_browser_instance
        ) as mock_browser, patch("asyncio.sleep", new_callable=AsyncMock):
            services = await mdns_manager.discover("_http._tcp", timeout=1)

            # Verify browser was created
            assert mock_browser.called
            assert isinstance(services, list)

    @pytest.mark.asyncio
    async def test_discover_services_not_started(self, mdns_manager):
        """Test discovery when not started."""
        with pytest.raises(NetworkError) as exc_info:
            await mdns_manager.discover("_http._tcp")
        assert "mDNS not started" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_advertised_services(self, mdns_manager):
        """Test getting advertised services."""
        # Add mock service
        mock_service = MagicMock()
        mock_service.type = "_http._tcp.local."
        mock_service.name = "test._http._tcp.local."
        mock_service.port = 8000
        mock_service.server = "testhost.local."
        mock_service.properties = {
            b"version": b"1.0",
            b"device": b"test",
        }

        mdns_manager._advertised_services["key"] = mock_service

        services = mdns_manager.get_advertised_services()

        assert len(services) == 1
        assert services[0].service_name == "test"
        assert services[0].port == 8000
        assert services[0].txt_records["version"] == "1.0"

    @pytest.mark.asyncio
    async def test_get_discovered_services(self, mdns_manager):
        """Test getting discovered services."""
        # Create mock listener with discovered services
        mock_listener = MagicMock()
        mock_service = MagicMock()
        mock_listener.discovered = {"service1": mock_service}

        mock_browser = MagicMock()
        mdns_manager._listeners["_http._tcp.local."] = (
            mock_listener,
            mock_browser,
        )

        services = mdns_manager.get_discovered_services("_http._tcp.local.")

        assert len(services) == 1
        assert services[0] == mock_service

    @pytest.mark.asyncio
    async def test_get_config(self, mdns_manager):
        """Test getting mDNS configuration."""
        config = mdns_manager.get_config()

        assert isinstance(config, MDNSConfig)
        assert config.enabled is True
        assert config.hostname == "test-device"

    @pytest.mark.asyncio
    async def test_set_config_enable(self, mdns_manager):
        """Test enabling mDNS via config."""
        mdns_manager._enabled = False

        new_config = MDNSConfig(enabled=True, hostname="new-hostname")

        with patch.object(mdns_manager, "start", new_callable=AsyncMock):
            await mdns_manager.set_config(new_config)

            assert mdns_manager._enabled is True
            assert mdns_manager._hostname == "new-hostname"
            assert mdns_manager.start.called

    @pytest.mark.asyncio
    async def test_set_config_disable(self, mdns_manager):
        """Test disabling mDNS via config."""
        mdns_manager._enabled = True

        new_config = MDNSConfig(enabled=False, hostname="test-device")

        with patch.object(mdns_manager, "stop", new_callable=AsyncMock):
            await mdns_manager.set_config(new_config)

            assert mdns_manager._enabled is False
            assert mdns_manager.stop.called

    @pytest.mark.asyncio
    async def test_service_listener_add(self, event_bus):
        """Test service listener add event (async)."""
        from yardrover.network.mdns import ServiceListener
        from zeroconf.asyncio import AsyncZeroconf, AsyncServiceInfo

        listener = ServiceListener(event_bus, "_http._tcp.local.")

        # Mock AsyncZeroconf
        mock_azc = AsyncMock(spec=AsyncZeroconf)
        mock_azc.zeroconf = MagicMock()

        # Mock AsyncServiceInfo to return service details
        with patch("yardrover.network.mdns.AsyncServiceInfo") as mock_info_class:
            mock_info = AsyncMock(spec=AsyncServiceInfo)
            mock_info.async_request = AsyncMock(return_value=True)
            mock_info.addresses = [bytes([192, 168, 1, 100])]
            mock_info.port = 8000
            mock_info.server = "test-server.local."
            mock_info.properties = {}
            mock_info_class.return_value = mock_info

            # Test async_add_service
            await listener.async_add_service(mock_azc, "_http._tcp.local.", "test-service")

            # Verify service was discovered
            assert "test-service" in listener.discovered
            assert listener.discovered["test-service"].ip_address == "192.168.1.100"

    @pytest.mark.asyncio
    async def test_service_listener_remove(self, event_bus):
        """Test service listener remove event (async)."""
        from yardrover.network.mdns import ServiceListener
        from yardrover.models.network import DiscoveredService
        from datetime import datetime

        listener = ServiceListener(event_bus, "_http._tcp.local.")

        # Add a discovered service
        listener.discovered["test-service"] = DiscoveredService(
            hostname="test.local.",
            service_name="test-service",
            service_type="_http._tcp.local.",
            ip_address="192.168.1.100",
            port=8000,
            txt_records={},
            last_seen=datetime.utcnow(),
        )

        # Mock AsyncZeroconf
        mock_azc = AsyncMock()

        # Test async_remove_service
        await listener.async_remove_service(mock_azc, "_http._tcp.local.", "test-service")

        # Verify service was removed
        assert "test-service" not in listener.discovered
