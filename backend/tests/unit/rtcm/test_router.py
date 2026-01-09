"""Unit tests for RTCM output router."""

import pytest
from yardrover.models.rtcm import (
    OutputFormat,
    RTCMOutputTarget,
    TCPOutputConfig,
    TransportType,
    UDPOutputConfig,
)
from yardrover.rtcm.router import (
    MAVLinkFormatter,
    RawFormatter,
    RTCMOutputRouter,
    TCPTransport,
    UDPTransport,
)


class TestRTCMFormatters:
    """Test RTCM data formatters."""

    def test_raw_formatter(self):
        """Test raw formatter (pass-through)."""
        formatter = RawFormatter()
        data = b"\xD3\x00\x03\x40\x00\x00"

        result = formatter.format(data)
        assert result == data  # Raw formatter should pass through unchanged

    def test_mavlink_formatter(self):
        """Test MAVLink formatter (placeholder)."""
        formatter = MAVLinkFormatter()
        data = b"\xD3\x00\x03\x40\x00\x00"

        result = formatter.format(data)
        # Currently a placeholder, should return original data
        assert result == data


class TestUDPTransport:
    """Test UDP transport."""

    @pytest.mark.asyncio
    async def test_init(self):
        """Test UDP transport initialization."""
        config = UDPOutputConfig(
            host="127.0.0.1",
            port=14550,
        )
        transport = UDPTransport(config)

        assert transport.config == config
        assert transport._transport is None
        assert transport._protocol is None

    @pytest.mark.asyncio
    async def test_close(self):
        """Test UDP transport close."""
        config = UDPOutputConfig(host="127.0.0.1", port=14550)
        transport = UDPTransport(config)

        # Should handle close even when not connected
        await transport.close()

        assert transport._transport is None


class TestTCPTransport:
    """Test TCP transport."""

    def test_init(self):
        """Test TCP transport initialization."""
        config = TCPOutputConfig(
            host="127.0.0.1",
            port=5015,
        )
        transport = TCPTransport(config)

        assert transport.config == config
        assert transport._reader is None
        assert transport._writer is None
        assert transport._connected is False

    @pytest.mark.asyncio
    async def test_close(self):
        """Test TCP transport close."""
        config = TCPOutputConfig(host="127.0.0.1", port=5015)
        transport = TCPTransport(config)

        # Should handle close even when not connected
        await transport.close()

        assert transport._writer is None
        assert transport._connected is False


class TestRTCMOutputRouter:
    """Test RTCM output router."""

    def test_init(self):
        """Test router initialization."""
        router = RTCMOutputRouter()

        assert len(router._outputs) == 0
        assert len(router._stats) == 0

    def test_add_output_tcp(self):
        """Test adding TCP output target."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="tcp_test",
            enabled=True,
            format=OutputFormat.RAW,
            transport=TransportType.TCP,
            tcp_config=TCPOutputConfig(
                host="127.0.0.1",
                port=5015,
            ),
        )

        router.add_output(target)

        assert "tcp_test" in router._outputs
        assert "tcp_test" in router._stats
        assert router._stats["tcp_test"]["messages"] == 0

    def test_add_output_udp(self):
        """Test adding UDP output target."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="udp_test",
            enabled=True,
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(
                host="127.0.0.1",
                port=14550,
            ),
        )

        router.add_output(target)

        assert "udp_test" in router._outputs

    def test_remove_output(self):
        """Test removing output target."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="test",
            enabled=True,
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(host="127.0.0.1", port=14550),
        )

        router.add_output(target)
        assert "test" in router._outputs

        router.remove_output("test")
        assert "test" not in router._outputs

    def test_enable_output(self):
        """Test enabling output target."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="test",
            enabled=False,  # Start disabled
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(host="127.0.0.1", port=14550),
        )

        router.add_output(target)

        # Enable it
        router.enable_output("test", True)
        output_info = router._outputs.get("test")
        assert output_info is not None
        assert output_info["target"].enabled is True

    def test_disable_output(self):
        """Test disabling output target."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="test",
            enabled=True,  # Start enabled
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(host="127.0.0.1", port=14550),
        )

        router.add_output(target)

        # Disable it
        router.enable_output("test", False)
        output_info = router._outputs.get("test")
        assert output_info is not None
        assert output_info["target"].enabled is False

    def test_get_outputs(self):
        """Test getting all output targets."""
        router = RTCMOutputRouter()

        target1 = RTCMOutputTarget(
            name="output1",
            enabled=True,
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(host="127.0.0.1", port=14550),
        )

        target2 = RTCMOutputTarget(
            name="output2",
            enabled=False,
            format=OutputFormat.MAVLINK,
            transport=TransportType.TCP,
            tcp_config=TCPOutputConfig(host="127.0.0.1", port=5015),
        )

        router.add_output(target1)
        router.add_output(target2)

        outputs = router.get_outputs()
        assert len(outputs) == 2
        assert any(o.name == "output1" for o in outputs)
        assert any(o.name == "output2" for o in outputs)

    def test_get_statistics(self):
        """Test getting output statistics."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="test",
            enabled=True,
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(host="127.0.0.1", port=14550),
        )

        router.add_output(target)

        stats = router.get_statistics()
        assert "test" in stats
        assert stats["test"]["messages"] == 0
        assert stats["test"]["bytes"] == 0
        assert stats["test"]["errors"] == 0

    def test_reset_statistics(self):
        """Test resetting output statistics."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="test",
            enabled=True,
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(host="127.0.0.1", port=14550),
        )

        router.add_output(target)

        # Simulate some activity
        router._stats["test"]["messages"] = 100
        router._stats["test"]["bytes"] = 1024

        # Reset
        router.reset_statistics()

        stats = router.get_statistics()
        assert stats["test"]["messages"] == 0
        assert stats["test"]["bytes"] == 0

    @pytest.mark.asyncio
    async def test_route_data_disabled_output(self):
        """Test routing data when output is disabled."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="test",
            enabled=False,  # Disabled
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(host="127.0.0.1", port=14550),
        )

        router.add_output(target)

        data = b"\xD3\x00\x03\x40\x00\x00"
        await router.route_data(data)

        # Should not count messages for disabled output
        stats = router.get_statistics()
        assert stats["test"]["messages"] == 0

    @pytest.mark.asyncio
    async def test_close(self):
        """Test closing router."""
        router = RTCMOutputRouter()

        target = RTCMOutputTarget(
            name="test",
            enabled=True,
            format=OutputFormat.RAW,
            transport=TransportType.UDP,
            udp_config=UDPOutputConfig(host="127.0.0.1", port=14550),
        )

        router.add_output(target)

        # Should close without errors
        await router.close()

        # Outputs should be cleared
        assert len(router._outputs) == 0
