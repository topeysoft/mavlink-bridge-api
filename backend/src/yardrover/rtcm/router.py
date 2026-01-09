"""RTCM data output router.

Based on C++ implementation in lib/rtcm/RTCMOutputRouter/RTCMOutputRouter.cpp

Routes RTCM data to multiple outputs with configurable formatters and transports.
Architecture:
    RTCM Data → Formatter (raw/mavlink) → Transport (serial/tcp/udp)

Examples:
- Send raw RTCM via TCP to a specific host
- Send MAVLink-wrapped RTCM via serial to flight controller
- Send raw RTCM via UDP broadcast to network
"""

import asyncio
import time
from typing import Callable, Optional

import structlog

from yardrover.core.events import EventBus
from yardrover.models.rtcm import (
    OutputFormat,
    RTCMOutputConfig,
    RTCMOutputTarget,
    SerialOutputConfig,
    TCPOutputConfig,
    TransportType,
    UDPOutputConfig,
)

logger = structlog.get_logger(__name__)


# ============================================================================
# Transport Implementations
# ============================================================================

class RTCMTransport:
    """Base class for RTCM data transports."""

    async def send(self, data: bytes) -> bool:
        """Send data through transport.

        Args:
            data: Data to send

        Returns:
            True if send successful
        """
        raise NotImplementedError

    async def close(self) -> None:
        """Close transport connection."""
        pass


class SerialTransport(RTCMTransport):
    """Serial port RTCM transport."""

    def __init__(self, config: SerialOutputConfig) -> None:
        """Initialize serial transport.

        Args:
            config: Serial configuration
        """
        self.config = config
        self._writer: Optional[asyncio.StreamWriter] = None

    async def send(self, data: bytes) -> bool:
        """Send data via serial port."""
        try:
            # Lazy initialization of serial connection
            if not self._writer:
                # In Python, we'd use pyserial-asyncio here
                # For now, this is a placeholder showing the pattern
                # TODO: Implement actual serial transport with pyserial-asyncio
                logger.warning("Serial transport not yet implemented", port=self.config.port)
                return False

            self._writer.write(data)
            await self._writer.drain()
            return True

        except Exception as e:
            logger.error("Failed to send data via serial", error=str(e))
            return False

    async def close(self) -> None:
        """Close serial connection."""
        if self._writer:
            self._writer.close()
            await self._writer.wait_closed()
            self._writer = None


class TCPTransport(RTCMTransport):
    """TCP socket RTCM transport."""

    def __init__(self, config: TCPOutputConfig) -> None:
        """Initialize TCP transport.

        Args:
            config: TCP configuration
        """
        self.config = config
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._connected = False

    async def _ensure_connected(self) -> bool:
        """Ensure TCP connection is established.

        Returns:
            True if connected
        """
        if self._connected and self._writer:
            return True

        try:
            logger.info("Connecting to TCP server", host=self.config.host, port=self.config.port)
            self._reader, self._writer = await asyncio.open_connection(
                self.config.host,
                self.config.port
            )
            self._connected = True
            logger.info("Connected to TCP server")
            return True

        except Exception as e:
            logger.error("Failed to connect to TCP server", error=str(e))
            self._connected = False
            return False

    async def send(self, data: bytes) -> bool:
        """Send data via TCP socket."""
        try:
            if not await self._ensure_connected():
                return False

            if not self._writer:
                return False

            self._writer.write(data)
            await self._writer.drain()
            return True

        except Exception as e:
            logger.error("Failed to send data via TCP", error=str(e))
            self._connected = False
            await self.close()
            return False

    async def close(self) -> None:
        """Close TCP connection."""
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("Error closing TCP connection", error=str(e))
            finally:
                self._writer = None
                self._reader = None
                self._connected = False


class UDPTransport(RTCMTransport):
    """UDP socket RTCM transport."""

    def __init__(self, config: UDPOutputConfig) -> None:
        """Initialize UDP transport.

        Args:
            config: UDP configuration
        """
        self.config = config
        self._transport: Optional[asyncio.DatagramTransport] = None
        self._protocol: Optional[asyncio.DatagramProtocol] = None

    async def _ensure_connected(self) -> bool:
        """Ensure UDP socket is ready.

        Returns:
            True if ready
        """
        if self._transport:
            return True

        try:
            loop = asyncio.get_event_loop()

            # Create UDP endpoint
            self._transport, self._protocol = await loop.create_datagram_endpoint(
                asyncio.DatagramProtocol,
                remote_addr=(self.config.host, self.config.port)
            )
            logger.info("Created UDP transport", host=self.config.host, port=self.config.port)
            return True

        except Exception as e:
            logger.error("Failed to create UDP transport", error=str(e))
            return False

    async def send(self, data: bytes) -> bool:
        """Send data via UDP socket."""
        try:
            if not await self._ensure_connected():
                return False

            if not self._transport:
                return False

            self._transport.sendto(data)
            return True

        except Exception as e:
            logger.error("Failed to send data via UDP", error=str(e))
            return False

    async def close(self) -> None:
        """Close UDP socket."""
        if self._transport:
            self._transport.close()
            self._transport = None
            self._protocol = None


# ============================================================================
# Formatter Implementations
# ============================================================================

class RTCMFormatter:
    """Base class for RTCM data formatters."""

    def format(self, data: bytes) -> bytes:
        """Format RTCM data.

        Args:
            data: Raw RTCM data

        Returns:
            Formatted data
        """
        raise NotImplementedError


class RawFormatter(RTCMFormatter):
    """Pass-through formatter (no modification)."""

    def format(self, data: bytes) -> bytes:
        """Return data unchanged."""
        return data


class MAVLinkFormatter(RTCMFormatter):
    """MAVLink GPS_RTCM_DATA wrapper formatter.

    Wraps RTCM data in MAVLink GPS_RTCM_DATA messages for sending
    to flight controllers.
    """

    def __init__(self) -> None:
        """Initialize MAVLink formatter."""
        self._sequence = 0

    def format(self, data: bytes) -> bytes:
        """Wrap RTCM data in MAVLink GPS_RTCM_DATA messages.

        GPS_RTCM_DATA can carry up to 180 bytes per message. Large RTCM
        messages are fragmented across multiple MAVLink messages.

        Args:
            data: Raw RTCM data

        Returns:
            MAVLink-wrapped data (potentially multiple messages)
        """
        # TODO: Implement MAVLink GPS_RTCM_DATA wrapping
        # This requires pymavlink integration
        # For now, return raw data as placeholder
        logger.warning("MAVLink formatter not yet implemented, returning raw data")
        return data


# ============================================================================
# Router
# ============================================================================

class RTCMOutputRouter:
    """Routes RTCM data to multiple output targets.

    Manages formatters and transports, handling data routing, error recovery,
    and statistics tracking.
    """

    def __init__(self, event_bus: Optional[EventBus] = None) -> None:
        """Initialize RTCM output router.

        Args:
            event_bus: Event bus for publishing routing events
        """
        self.event_bus = event_bus
        self._targets: dict[str, tuple[RTCMOutputTarget, RTCMFormatter, RTCMTransport]] = {}
        self._lock = asyncio.Lock()

        # Statistics
        self._messages_routed = 0
        self._bytes_routed = 0
        self._routing_errors = 0
        self._last_route_time: Optional[float] = None

    async def add_target(self, target: RTCMOutputTarget) -> bool:
        """Add output routing target.

        Args:
            target: Output target configuration

        Returns:
            True if target added successfully
        """
        async with self._lock:
            if target.name in self._targets:
                logger.warning("Output target already exists", name=target.name)
                return False

            try:
                # Create formatter
                formatter = self._create_formatter(target.format)

                # Create transport
                transport = self._create_transport(target.transport)

                self._targets[target.name] = (target, formatter, transport)
                logger.info("Added output target", name=target.name, format=target.format, transport=target.transport.type)
                return True

            except Exception as e:
                logger.error("Failed to add output target", name=target.name, error=str(e))
                return False

    async def remove_target(self, name: str) -> bool:
        """Remove output routing target.

        Args:
            name: Target name to remove

        Returns:
            True if target removed successfully
        """
        async with self._lock:
            if name not in self._targets:
                logger.warning("Output target not found", name=name)
                return False

            # Close transport
            _, _, transport = self._targets[name]
            await transport.close()

            del self._targets[name]
            logger.info("Removed output target", name=name)
            return True

    async def set_target_enabled(self, name: str, enabled: bool) -> bool:
        """Enable or disable an output target.

        Args:
            name: Target name
            enabled: Whether to enable or disable

        Returns:
            True if successful
        """
        async with self._lock:
            if name not in self._targets:
                logger.warning("Output target not found", name=name)
                return False

            target, formatter, transport = self._targets[name]
            # Update target enabled state
            target.enabled = enabled
            self._targets[name] = (target, formatter, transport)

            logger.info("Set output target enabled", name=name, enabled=enabled)
            return True

    async def route(self, data: bytes) -> int:
        """Route RTCM data to all enabled output targets.

        Args:
            data: Raw RTCM data to route

        Returns:
            Number of targets successfully sent to
        """
        if not data:
            return 0

        success_count = 0
        self._last_route_time = time.time()

        async with self._lock:
            for name, (target, formatter, transport) in list(self._targets.items()):
                if not target.enabled:
                    continue

                try:
                    # Format data
                    formatted_data = formatter.format(data)

                    # Send via transport
                    if await transport.send(formatted_data):
                        success_count += 1
                        self._bytes_routed += len(formatted_data)
                    else:
                        self._routing_errors += 1
                        logger.warning("Failed to send to target", name=name)

                except Exception as e:
                    self._routing_errors += 1
                    logger.error("Error routing to target", name=name, error=str(e))

        if success_count > 0:
            self._messages_routed += 1

        return success_count

    async def clear_targets(self) -> None:
        """Remove all output targets."""
        async with self._lock:
            for name in list(self._targets.keys()):
                _, _, transport = self._targets[name]
                await transport.close()

            self._targets.clear()
            logger.info("Cleared all output targets")

    def get_target_count(self) -> int:
        """Get number of configured targets."""
        return len(self._targets)

    def get_active_target_count(self) -> int:
        """Get number of enabled targets."""
        return sum(1 for target, _, _ in self._targets.values() if target.enabled)

    def get_statistics(self) -> dict:
        """Get routing statistics.

        Returns:
            Dictionary with statistics
        """
        return {
            "total_targets": self.get_target_count(),
            "active_targets": self.get_active_target_count(),
            "messages_routed": self._messages_routed,
            "bytes_routed": self._bytes_routed,
            "routing_errors": self._routing_errors,
            "last_route_time": int(self._last_route_time * 1000) if self._last_route_time else None,
        }

    def reset_statistics(self) -> None:
        """Reset routing statistics."""
        self._messages_routed = 0
        self._bytes_routed = 0
        self._routing_errors = 0
        self._last_route_time = None
        logger.info("Reset routing statistics")

    def get_target_info(self) -> list[dict]:
        """Get information about all targets.

        Returns:
            List of target information dictionaries
        """
        targets_info = []
        for name, (target, _, _) in self._targets.items():
            targets_info.append({
                "name": name,
                "enabled": target.enabled,
                "format": target.format.value,
                "transport": {
                    "type": target.transport.type,
                    **target.transport.model_dump(exclude={"type"}),
                },
            })
        return targets_info

    async def close(self) -> None:
        """Close all transports and clean up."""
        await self.clear_targets()

    # ========================================================================
    # Private Methods
    # ========================================================================

    def _create_formatter(self, format_type: OutputFormat) -> RTCMFormatter:
        """Create formatter based on type.

        Args:
            format_type: Formatter type

        Returns:
            RTCMFormatter instance
        """
        if format_type == OutputFormat.RAW:
            return RawFormatter()
        elif format_type == OutputFormat.MAVLINK:
            return MAVLinkFormatter()
        else:
            raise ValueError(f"Unknown formatter type: {format_type}")

    def _create_transport(self, config: RTCMOutputConfig) -> RTCMTransport:
        """Create transport based on configuration.

        Args:
            config: Transport configuration

        Returns:
            RTCMTransport instance
        """
        if isinstance(config, SerialOutputConfig):
            return SerialTransport(config)
        elif isinstance(config, TCPOutputConfig):
            return TCPTransport(config)
        elif isinstance(config, UDPOutputConfig):
            return UDPTransport(config)
        else:
            raise ValueError(f"Unknown transport type: {type(config)}")
