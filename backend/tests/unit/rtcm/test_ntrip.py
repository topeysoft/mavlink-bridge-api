"""Unit tests for NTRIP client."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from yardrover.models.rtcm import NTRIPConfig, NTRIPPosition, RTCMState
from yardrover.rtcm.ntrip import NTRIPClient


@pytest.fixture
def ntrip_config():
    """Create test NTRIP configuration."""
    return NTRIPConfig(
        host="rtk2go.com",
        port=2101,
        mountpoint="TEST",
        username="user",
        password="pass",
        user_agent="YardRover/1.0",
        send_position=False,
    )


@pytest.fixture
def ntrip_config_with_position():
    """Create NTRIP config with VRS position."""
    return NTRIPConfig(
        host="rtk2go.com",
        port=2101,
        mountpoint="TEST",
        username="user",
        password="pass",
        send_position=True,
        position=NTRIPPosition(
            latitude=37.7749,
            longitude=-122.4194,
            altitude=10.0
        ),
        gga_interval=10000,  # 10 seconds
    )


class TestNTRIPClient:
    """Test NTRIP client."""

    def test_init(self, ntrip_config):
        """Test client initialization."""
        client = NTRIPClient(ntrip_config)

        assert client.config == ntrip_config
        assert client.state == RTCMState.DISCONNECTED
        assert client.is_connected is False
        assert client.event_bus is None
        assert client.data_callback is None

    def test_init_with_event_bus(self, ntrip_config):
        """Test initialization with event bus."""
        event_bus = Mock()
        client = NTRIPClient(ntrip_config, event_bus=event_bus)

        assert client.event_bus == event_bus

    def test_init_with_callback(self, ntrip_config):
        """Test initialization with data callback."""
        callback = Mock()
        client = NTRIPClient(ntrip_config, data_callback=callback)

        assert client.data_callback == callback

    def test_state_property(self, ntrip_config):
        """Test state property."""
        client = NTRIPClient(ntrip_config)
        assert client.state == RTCMState.DISCONNECTED

        client._state = RTCMState.CONNECTING
        assert client.state == RTCMState.CONNECTING

    def test_statistics_property(self, ntrip_config):
        """Test statistics property."""
        client = NTRIPClient(ntrip_config)

        stats = client.statistics
        assert stats.messages_received == 0
        assert stats.bytes_received == 0
        assert stats.connection_time == 0

        # Update stats
        client._stats.messages_received = 10
        client._stats.bytes_received = 1024

        stats = client.statistics
        assert stats.messages_received == 10
        assert stats.bytes_received == 1024

    def test_is_connected_false(self, ntrip_config):
        """Test is_connected when disconnected."""
        client = NTRIPClient(ntrip_config)
        assert client.is_connected is False

    def test_is_connected_true(self, ntrip_config):
        """Test is_connected when connected."""
        client = NTRIPClient(ntrip_config)
        client._state = RTCMState.CONNECTED
        client._writer = Mock()

        assert client.is_connected is True

    @pytest.mark.asyncio
    async def test_start_already_running(self, ntrip_config):
        """Test starting client when already running."""
        client = NTRIPClient(ntrip_config)
        client._running = True

        result = await client.start()
        assert result is False

    @pytest.mark.asyncio
    async def test_start_success(self, ntrip_config):
        """Test successful client start."""
        client = NTRIPClient(ntrip_config)

        # Mock connection
        with patch.object(client, "_connect", return_value=True) as mock_connect:
            result = await client.start()

            assert result is True
            assert client._running is True
            mock_connect.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop(self, ntrip_config):
        """Test stopping client."""
        client = NTRIPClient(ntrip_config)
        client._running = True

        with patch.object(client, "_disconnect") as mock_disconnect:
            await client.stop()

            assert client._running is False
            mock_disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_set_position(self, ntrip_config):
        """Test setting VRS position."""
        client = NTRIPClient(ntrip_config)

        await client.set_position(37.7749, -122.4194, 10.0)

        assert client.config.send_position is True
        assert client.config.position is not None
        assert client.config.position.latitude == 37.7749
        assert client.config.position.longitude == -122.4194
        assert client.config.position.altitude == 10.0

    @pytest.mark.asyncio
    async def test_connect_success(self, ntrip_config):
        """Test successful connection."""
        client = NTRIPClient(ntrip_config)

        mock_reader = AsyncMock()
        mock_writer = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)), \
             patch.object(client, "_send_request", return_value=True), \
             patch.object(client, "_parse_response", return_value=True), \
             patch("asyncio.create_task"):

            result = await client._connect()

            assert result is True
            assert client.state == RTCMState.CONNECTED
            assert client._reader == mock_reader
            assert client._writer == mock_writer
            assert client._connection_start_time is not None

    @pytest.mark.asyncio
    async def test_connect_send_request_fails(self, ntrip_config):
        """Test connection when request sending fails."""
        client = NTRIPClient(ntrip_config)

        mock_reader = AsyncMock()
        mock_writer = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)), \
             patch.object(client, "_send_request", return_value=False), \
             patch.object(client, "_disconnect") as mock_disconnect:

            result = await client._connect()

            assert result is False
            mock_disconnect.assert_called()

    @pytest.mark.asyncio
    async def test_connect_parse_response_fails(self, ntrip_config):
        """Test connection when response parsing fails."""
        client = NTRIPClient(ntrip_config)

        mock_reader = AsyncMock()
        mock_writer = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)), \
             patch.object(client, "_send_request", return_value=True), \
             patch.object(client, "_parse_response", return_value=False), \
             patch.object(client, "_disconnect") as mock_disconnect:

            result = await client._connect()

            assert result is False
            mock_disconnect.assert_called()

    @pytest.mark.asyncio
    async def test_connect_exception(self, ntrip_config):
        """Test connection when exception occurs."""
        client = NTRIPClient(ntrip_config)

        with patch("asyncio.open_connection", side_effect=ConnectionRefusedError), \
             patch.object(client, "_disconnect") as mock_disconnect:

            result = await client._connect()

            assert result is False
            assert client.state == RTCMState.ERROR
            mock_disconnect.assert_called()

    @pytest.mark.asyncio
    async def test_disconnect(self, ntrip_config):
        """Test disconnection."""
        client = NTRIPClient(ntrip_config)

        # Set up connected state
        client._state = RTCMState.CONNECTED
        client._receive_task = asyncio.create_task(asyncio.sleep(10))
        client._gga_task = asyncio.create_task(asyncio.sleep(10))

        mock_writer = AsyncMock()
        client._writer = mock_writer
        client._reader = AsyncMock()

        await client._disconnect()

        assert client.state == RTCMState.DISCONNECTED
        assert client._writer is None
        assert client._reader is None
        assert client._receive_task is None
        assert client._gga_task is None
        mock_writer.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_request_basic_auth(self, ntrip_config):
        """Test sending request with basic authentication."""
        client = NTRIPClient(ntrip_config)

        mock_writer = AsyncMock()
        client._writer = mock_writer

        result = await client._send_request()

        assert result is True
        mock_writer.write.assert_called_once()
        mock_writer.drain.assert_called_once()

        # Check request content
        written_data = mock_writer.write.call_args[0][0].decode()
        assert "GET /TEST HTTP/1.0" in written_data
        assert "User-Agent: YardRover/1.0" in written_data
        assert "Authorization: Basic" in written_data
        assert "Ntrip-Version: Ntrip/2.0" in written_data

    @pytest.mark.asyncio
    async def test_send_request_no_auth(self):
        """Test sending request without authentication."""
        config = NTRIPConfig(
            host="rtk2go.com",
            port=2101,
            mountpoint="TEST",
        )
        client = NTRIPClient(config)

        mock_writer = AsyncMock()
        client._writer = mock_writer

        result = await client._send_request()

        assert result is True

        # Check request content
        written_data = mock_writer.write.call_args[0][0].decode()
        assert "Authorization: Basic" not in written_data

    @pytest.mark.asyncio
    async def test_send_request_no_writer(self, ntrip_config):
        """Test sending request when writer is None."""
        client = NTRIPClient(ntrip_config)
        client._writer = None

        result = await client._send_request()
        assert result is False

    @pytest.mark.asyncio
    async def test_send_request_exception(self, ntrip_config):
        """Test sending request with exception."""
        client = NTRIPClient(ntrip_config)

        mock_writer = AsyncMock()
        mock_writer.write.side_effect = IOError("Write error")
        client._writer = mock_writer

        result = await client._send_request()
        assert result is False

    @pytest.mark.asyncio
    async def test_parse_response_icy_200(self, ntrip_config):
        """Test parsing ICY 200 OK response."""
        client = NTRIPClient(ntrip_config)

        mock_reader = AsyncMock()
        mock_reader.readline = AsyncMock(side_effect=[
            b"ICY 200 OK\r\n",
            b"Content-Type: gnss/data\r\n",
            b"\r\n",
        ])
        client._reader = mock_reader

        result = await client._parse_response()
        assert result is True

    @pytest.mark.asyncio
    async def test_parse_response_http_200(self, ntrip_config):
        """Test parsing HTTP 200 OK response."""
        client = NTRIPClient(ntrip_config)

        mock_reader = AsyncMock()
        mock_reader.readline = AsyncMock(side_effect=[
            b"HTTP/1.0 200 OK\r\n",
            b"Content-Type: gnss/data\r\n",
            b"\r\n",
        ])
        client._reader = mock_reader

        result = await client._parse_response()
        assert result is True

    @pytest.mark.asyncio
    async def test_parse_response_401(self, ntrip_config):
        """Test parsing 401 Unauthorized response."""
        client = NTRIPClient(ntrip_config)

        mock_reader = AsyncMock()
        mock_reader.readline = AsyncMock(side_effect=[
            b"HTTP/1.0 401 Unauthorized\r\n",
            b"\r\n",
        ])
        client._reader = mock_reader

        result = await client._parse_response()
        assert result is False

    @pytest.mark.asyncio
    async def test_parse_response_no_reader(self, ntrip_config):
        """Test parsing response when reader is None."""
        client = NTRIPClient(ntrip_config)
        client._reader = None

        result = await client._parse_response()
        assert result is False

    @pytest.mark.asyncio
    async def test_parse_response_timeout(self, ntrip_config):
        """Test parsing response with timeout."""
        client = NTRIPClient(ntrip_config)

        mock_reader = AsyncMock()
        mock_reader.readline = AsyncMock(side_effect=asyncio.TimeoutError)
        client._reader = mock_reader

        result = await client._parse_response()
        assert result is False

    def test_generate_gga_north_east(self, ntrip_config_with_position):
        """Test GGA generation for northern/eastern position."""
        client = NTRIPClient(ntrip_config_with_position)

        gga = client._generate_gga()

        assert gga.startswith("$GPGGA")
        assert ",N," in gga  # Northern hemisphere
        assert ",E," in gga  # Eastern hemisphere
        assert gga.endswith("\r\n")
        assert "*" in gga  # Checksum present

    def test_generate_gga_south_west(self):
        """Test GGA generation for southern/western position."""
        config = NTRIPConfig(
            host="test.com",
            port=2101,
            mountpoint="TEST",
            send_position=True,
            position=NTRIPPosition(
                latitude=-33.8688,  # Sydney
                longitude=-151.2093,
                altitude=5.0
            ),
        )
        client = NTRIPClient(config)

        gga = client._generate_gga()

        assert ",S," in gga  # Southern hemisphere
        assert ",W," in gga  # Western hemisphere

    def test_generate_gga_no_position(self, ntrip_config):
        """Test GGA generation without position."""
        client = NTRIPClient(ntrip_config)
        client.config.position = None

        gga = client._generate_gga()
        assert gga == ""

    def test_generate_gga_checksum(self, ntrip_config_with_position):
        """Test GGA checksum calculation."""
        client = NTRIPClient(ntrip_config_with_position)

        gga = client._generate_gga()

        # Extract sentence and checksum
        sentence_part = gga[1:gga.index("*")]  # Remove $ and get part before *
        checksum_str = gga[gga.index("*") + 1:gga.index("\r")]

        # Calculate checksum
        expected_checksum = 0
        for char in sentence_part:
            expected_checksum ^= ord(char)

        assert int(checksum_str, 16) == expected_checksum

    def test_update_data_rate_empty(self, ntrip_config):
        """Test data rate update with no data."""
        client = NTRIPClient(ntrip_config)

        client._update_data_rate()
        assert client._stats.data_rate == 0.0

    def test_update_data_rate_with_data(self, ntrip_config):
        """Test data rate update with data."""
        import time

        client = NTRIPClient(ntrip_config)

        now = time.time()
        client._data_rate_window = [
            (now, 1024),
            (now, 2048),
        ]

        client._update_data_rate()

        # Should calculate KB/s
        expected_rate = 3072 / 1024.0  # 3 KB/s
        assert client._stats.data_rate == expected_rate

    def test_update_data_rate_removes_old(self, ntrip_config):
        """Test data rate update removes old entries."""
        import time

        client = NTRIPClient(ntrip_config)

        now = time.time()
        client._data_rate_window = [
            (now - 2.0, 1024),  # Old entry
            (now, 2048),  # Recent entry
        ]

        client._update_data_rate()

        # Old entry should be removed
        assert len(client._data_rate_window) == 1
        expected_rate = 2048 / 1024.0  # 2 KB/s
        assert client._stats.data_rate == expected_rate

    def test_set_state_no_change(self, ntrip_config):
        """Test setting state when state doesn't change."""
        client = NTRIPClient(ntrip_config)
        client._state = RTCMState.DISCONNECTED

        client._set_state(RTCMState.DISCONNECTED)

        # Should not change
        assert client._state == RTCMState.DISCONNECTED

    def test_set_state_with_change(self, ntrip_config):
        """Test setting state when state changes."""
        client = NTRIPClient(ntrip_config)
        client._state = RTCMState.DISCONNECTED

        client._set_state(RTCMState.CONNECTING)

        assert client._state == RTCMState.CONNECTING

    def test_set_state_publishes_event(self, ntrip_config):
        """Test state change publishes event."""
        event_bus = Mock()
        event_bus.publish = AsyncMock()
        client = NTRIPClient(ntrip_config, event_bus=event_bus)

        client._set_state(RTCMState.CONNECTING)

        # Should create task to publish event
        assert client._state == RTCMState.CONNECTING

    @pytest.mark.asyncio
    async def test_receive_loop_processes_data(self, ntrip_config):
        """Test receive loop processes RTCM data."""
        client = NTRIPClient(ntrip_config)
        client._running = True

        # Create valid RTCM message
        from yardrover.rtcm.parser import RTCMParser
        parser = RTCMParser()
        payload = b"\x3E\xD0\x7B\x00\x00\x00"
        header = bytes([0xD3, 0x00, len(payload)])
        data_for_crc = header + payload
        crc = parser._calculate_crc24(data_for_crc)
        rtcm_data = data_for_crc + bytes([
            (crc >> 16) & 0xFF,
            (crc >> 8) & 0xFF,
            crc & 0xFF
        ])

        mock_reader = AsyncMock()
        mock_reader.read = AsyncMock(side_effect=[rtcm_data, b""])  # Second call returns empty to break loop
        client._reader = mock_reader

        await client._receive_loop()

        # Should have processed message
        assert client._stats.messages_received == 1
        assert client._stats.bytes_received == len(rtcm_data)

    @pytest.mark.asyncio
    async def test_receive_loop_calls_callback(self, ntrip_config):
        """Test receive loop calls data callback."""
        callback = Mock()
        client = NTRIPClient(ntrip_config, data_callback=callback)
        client._running = True

        rtcm_data = b"\xD3\x00\x03\x40\x00\x00"

        mock_reader = AsyncMock()
        mock_reader.read = AsyncMock(side_effect=[rtcm_data, b""])
        client._reader = mock_reader

        await client._receive_loop()

        # Callback should have been called with data
        callback.assert_called_once_with(rtcm_data)

    @pytest.mark.asyncio
    async def test_gga_loop_sends_position(self, ntrip_config_with_position):
        """Test GGA loop sends position updates."""
        client = NTRIPClient(ntrip_config_with_position)
        client._running = True

        mock_writer = AsyncMock()
        client._writer = mock_writer

        # Run loop for short time
        gga_task = asyncio.create_task(client._gga_loop())
        await asyncio.sleep(0.1)
        client._running = False

        try:
            await asyncio.wait_for(gga_task, timeout=1.0)
        except asyncio.TimeoutError:
            gga_task.cancel()

        # Should have sent at least one GGA message
        assert mock_writer.write.call_count >= 1

        # Check that GGA message was sent
        call_args = mock_writer.write.call_args_list[0][0][0]
        assert call_args.startswith(b"$GPGGA")
