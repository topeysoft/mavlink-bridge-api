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
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._connected = False

    async def _ensure_connected(self) -> bool:
        """Ensure serial connection is established.

        Retries up to 3 times with delays to handle OS resource release timing.

        Returns:
            True if connected
        """
        if self._connected and self._writer:
            return True

        # Try up to 3 times with delays for resource release
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                # Import serial_asyncio for async serial communication
                from serial_asyncio import open_serial_connection
                import serial

                if attempt > 0:
                    logger.info(
                        "Retrying serial port open",
                        serial_port=self.config.port,
                        attempt=attempt + 1,
                        max_attempts=max_attempts
                    )

                logger.info("Opening serial port", serial_port=self.config.port, baudrate=self.config.baudrate)

                self._reader, self._writer = await open_serial_connection(
                    url=self.config.port,
                    baudrate=self.config.baudrate,
                    bytesize=serial.EIGHTBITS,
                    parity=serial.PARITY_NONE,
                    stopbits=serial.STOPBITS_ONE,
                )
                self._connected = True
                logger.info("Serial port opened successfully")
                return True

            except ImportError:
                logger.error("pyserial-asyncio not installed. Install with: pip install pyserial-asyncio")
                return False
            except Exception as e:
                if attempt < max_attempts - 1:
                    # Retry after a short delay
                    logger.warning(
                        "Failed to open serial port, retrying",
                        serial_port=self.config.port,
                        error=str(e),
                        attempt=attempt + 1
                    )
                    await asyncio.sleep(0.1)
                    continue
                else:
                    # Final attempt failed
                    logger.error("Failed to open serial port after all retries", serial_port=self.config.port, error=str(e))
                    self._connected = False
                    return False

        return False

    async def send(self, data: bytes) -> bool:
        """Send data via serial port."""
        try:
            if not await self._ensure_connected():
                return False

            if not self._writer:
                return False

            self._writer.write(data)
            await self._writer.drain()
            return True

        except Exception as e:
            logger.error("Failed to send data via serial", error=str(e))
            self._connected = False
            await self.close()
            return False

    async def close(self) -> None:
        """Close serial connection."""
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("Error closing serial connection", error=str(e))
            finally:
                self._writer = None
                self._reader = None
                self._connected = False


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

    MAX_PAYLOAD_SIZE = 180  # GPS_RTCM_DATA max data length

    def __init__(self) -> None:
        """Initialize MAVLink formatter."""
        from pymavlink import mavutil

        # Create MAVLink connection for encoding (memory buffer)
        self._mav = mavutil.mavlink_connection('udpin:0.0.0.0:0', dialect='ardupilotmega')
        self._sequence = 0

    def format(self, data: bytes) -> bytes:
        """Wrap RTCM data in MAVLink GPS_RTCM_DATA messages.

        GPS_RTCM_DATA can carry up to 180 bytes per message. Large RTCM
        messages are fragmented across multiple MAVLink messages.

        Fragment flags (bit field):
        - Bit 0 (LSB): 1 = message is fragmented
        - Bit 1: 1 = not the first fragment
        - Bit 2: 1 = not the last fragment

        Args:
            data: Raw RTCM data

        Returns:
            MAVLink-wrapped data (potentially multiple messages)
        """
        if not data:
            return b''

        data_len = len(data)
        result = b''

        # Single message case (no fragmentation needed)
        if data_len <= self.MAX_PAYLOAD_SIZE:
            # Pad data to 180 bytes
            data_array = list(data) + [0] * (self.MAX_PAYLOAD_SIZE - data_len)

            msg = self._mav.mav.gps_rtcm_data_encode(
                flags=0,  # Not fragmented
                len=data_len,
                data=data_array
            )
            result = msg.pack(self._mav.mav)

        else:
            # Fragmented message case
            offset = 0
            fragment_index = 0
            total_fragments = (data_len + self.MAX_PAYLOAD_SIZE - 1) // self.MAX_PAYLOAD_SIZE

            while offset < data_len:
                chunk_len = min(self.MAX_PAYLOAD_SIZE, data_len - offset)
                chunk = data[offset:offset + chunk_len]

                # Calculate fragment flags
                flags = 0b001  # Bit 0: message is fragmented
                if fragment_index > 0:
                    flags |= 0b010  # Bit 1: not first fragment
                if fragment_index < total_fragments - 1:
                    flags |= 0b100  # Bit 2: not last fragment

                # Pad chunk to 180 bytes
                data_array = list(chunk) + [0] * (self.MAX_PAYLOAD_SIZE - chunk_len)

                msg = self._mav.mav.gps_rtcm_data_encode(
                    flags=flags,
                    len=chunk_len,
                    data=data_array
                )
                result += msg.pack(self._mav.mav)

                offset += chunk_len
                fragment_index += 1

        self._sequence += 1
        return result


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

        # Global statistics
        self._messages_routed = 0
        self._bytes_routed = 0
        self._routing_errors = 0
        self._last_route_time: Optional[float] = None

        # Per-target statistics: {target_name: {messages_sent, bytes_sent, send_errors, last_send_time}}
        self._target_stats: dict[str, dict[str, int | float]] = {}

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

                # Initialize per-target statistics
                self._target_stats[target.name] = {
                    "messages_sent": 0,
                    "bytes_sent": 0,
                    "send_errors": 0,
                    "last_send_time": 0.0,
                }

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

            # Remove per-target statistics
            if name in self._target_stats:
                del self._target_stats[name]

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
        current_time = time.time()
        self._last_route_time = current_time

        async with self._lock:
            for name, (target, formatter, transport) in list(self._targets.items()):
                if not target.enabled:
                    continue

                # Initialize stats if missing (shouldn't happen, but be defensive)
                if name not in self._target_stats:
                    self._target_stats[name] = {
                        "messages_sent": 0,
                        "bytes_sent": 0,
                        "send_errors": 0,
                        "last_send_time": 0.0,
                    }

                try:
                    # Format data
                    formatted_data = formatter.format(data)

                    # Send via transport
                    if await transport.send(formatted_data):
                        success_count += 1
                        self._bytes_routed += len(formatted_data)

                        # Update per-target statistics
                        self._target_stats[name]["messages_sent"] += 1
                        self._target_stats[name]["bytes_sent"] += len(formatted_data)
                        self._target_stats[name]["last_send_time"] = current_time
                    else:
                        self._routing_errors += 1
                        self._target_stats[name]["send_errors"] += 1
                        logger.warning("Failed to send to target", name=name)

                except Exception as e:
                    self._routing_errors += 1
                    self._target_stats[name]["send_errors"] += 1
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
            "targets": self.get_target_statistics(),
        }

    def get_target_statistics(self) -> list[dict]:
        """Get per-target statistics.

        Returns:
            List of dictionaries with per-target statistics
        """
        target_stats = []
        current_time = time.time()

        for name, stats in self._target_stats.items():
            # Calculate data rate for last second
            last_send = stats.get("last_send_time", 0.0)
            is_active = (current_time - last_send) < 2.0 if last_send > 0 else False

            target_stats.append({
                "name": name,
                "messages_sent": int(stats.get("messages_sent", 0)),
                "bytes_sent": int(stats.get("bytes_sent", 0)),
                "send_errors": int(stats.get("send_errors", 0)),
                "last_send_time": int(last_send * 1000) if last_send > 0 else None,
                "is_active": is_active,
            })

        return target_stats

    def reset_statistics(self) -> None:
        """Reset routing statistics."""
        self._messages_routed = 0
        self._bytes_routed = 0
        self._routing_errors = 0
        self._last_route_time = None

        # Reset per-target statistics
        for name in self._target_stats:
            self._target_stats[name] = {
                "messages_sent": 0,
                "bytes_sent": 0,
                "send_errors": 0,
                "last_send_time": 0.0,
            }

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
