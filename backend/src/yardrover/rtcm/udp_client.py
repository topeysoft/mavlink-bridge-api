"""UDP RTCM client for receiving raw RTCM data streams.

This client listens for UDP packets containing raw RTCM 3.x binary data,
such as from ESP32 RTK base stations broadcasting RTCM over WiFi UDP.

Typical use case: Connecting to ESP32-based RTK base stations that broadcast
RTCM corrections over WiFi UDP (default port 2102).
"""

import asyncio
import time
from typing import Callable, Optional

import structlog

from yardrover.core.events import EventBus
from yardrover.models.rtcm import (
    RTCMState,
    RTCMStatistics,
    UDPSourceConfig,
    get_message_type_name,
)
from yardrover.rtcm.parser import RTCMParser

logger = structlog.get_logger(__name__)


class UDPClient:
    """UDP client for receiving raw RTCM data streams.

    This client listens on a UDP port for RTCM 3.x binary data packets
    without any protocol overhead. It's designed for simple RTCM base
    stations like the ESP32 WiFi RTK system operating in UDP broadcast mode.
    """

    def __init__(
        self,
        config: UDPSourceConfig,
        event_bus: Optional[EventBus] = None,
        data_callback: Optional[Callable[[bytes], None]] = None,
        enable_stats_broadcast: bool = True,
    ) -> None:
        """Initialize UDP RTCM client.

        Args:
            config: UDP connection configuration (port to listen on)
            event_bus: Event bus for publishing state changes and data events
            data_callback: Optional callback for received RTCM data
            enable_stats_broadcast: Whether to enable internal stats broadcasting (default: True)
                                   Set to False when stats are broadcast externally with router stats
        """
        self.config = config
        self.event_bus = event_bus
        self.data_callback = data_callback
        self.enable_stats_broadcast = enable_stats_broadcast

        self._state = RTCMState.DISCONNECTED
        self._transport: Optional[asyncio.DatagramTransport] = None
        self._protocol: Optional["UDPProtocol"] = None
        self._receive_task: Optional[asyncio.Task] = None
        self._stats_task: Optional[asyncio.Task] = None
        self._parser = RTCMParser()

        # Statistics
        self._stats = RTCMStatistics()
        self._connection_start_time: Optional[float] = None
        self._last_data_time: Optional[float] = None
        self._data_rate_window: list[tuple[float, int]] = []  # (timestamp, bytes)

        # Control
        self._running = False

        # Error tracking
        self._last_error: Optional[str] = None

    @property
    def state(self) -> RTCMState:
        """Get current connection state."""
        return self._state

    @property
    def is_connected(self) -> bool:
        """Check if client is connected (listening)."""
        return self._state == RTCMState.CONNECTED

    @property
    def last_error(self) -> Optional[str]:
        """Get the last error message."""
        return self._last_error

    @property
    def statistics(self) -> RTCMStatistics:
        """Get current statistics."""
        # Update connection time if connected
        if self._connection_start_time:
            self._stats.connection_time = int(
                (time.time() - self._connection_start_time) * 1000
            )

        # Include parser diagnostics
        diagnostics = self._parser.get_diagnostics()
        self._stats.parser_buffer_size = diagnostics["buffer_size"]
        self._stats.frames_with_no_preamble = diagnostics["frames_no_preamble"]
        self._stats.frames_with_invalid_crc = diagnostics["frames_invalid_crc"]
        self._stats.frames_with_invalid_length = diagnostics["frames_invalid_length"]

        return self._stats

    async def start(self) -> bool:
        """Start UDP client and begin listening for data.

        Returns:
            True if started successfully, False otherwise
        """
        if self._running:
            logger.warning("UDP client already running")
            return False

        try:
            # Reset state before starting
            self._state = RTCMState.DISCONNECTED
            self._stats = RTCMStatistics()
            self._connection_start_time = None
            self._last_data_time = None
            self._data_rate_window = []
            self._parser = RTCMParser()
            self._last_error = None  # Clear previous errors

            self._set_state(RTCMState.CONNECTING)

            logger.info(
                "udp_client_starting",
                port=self.config.port,
            )

            # Create UDP endpoint
            loop = asyncio.get_event_loop()

            # Create protocol instance with callback
            self._protocol = UDPProtocol(
                on_data_received=self._on_data_received,
                on_error=self._on_error,
            )

            # Create UDP server (listen on all interfaces)
            self._transport, _ = await loop.create_datagram_endpoint(
                lambda: self._protocol,
                local_addr=("0.0.0.0", self.config.port),
            )

            # Connection successful
            self._connection_start_time = time.time()
            self._running = True
            self._set_state(RTCMState.CONNECTED)

            # Start statistics broadcast task (only if not disabled)
            if self.enable_stats_broadcast:
                self._stats_task = asyncio.create_task(self._stats_broadcast_loop())
                logger.info("udp_stats_broadcast_enabled")
            else:
                logger.info("udp_stats_broadcast_disabled (handled externally)")

            logger.info(
                "udp_client_started",
                port=self.config.port,
            )

            return True

        except OSError as e:
            # Socket/network-related errors
            error_type = type(e).__name__
            error_detail = str(e)

            # Categorize common UDP/socket errors
            if "already in use" in error_detail.lower() or "address already in use" in error_detail.lower():
                reason = f"Port {self.config.port} already in use - another process may be using it"
            elif "permission denied" in error_detail.lower():
                reason = f"Permission denied - may need elevated privileges to bind to port {self.config.port}"
            elif "cannot assign requested address" in error_detail.lower():
                reason = "Cannot assign requested address - check network configuration"
            elif "address family not supported" in error_detail.lower():
                reason = "Address family not supported - IPv4/IPv6 configuration issue"
            else:
                reason = f"Socket error: {error_detail}"

            self._last_error = reason
            logger.error(
                "udp_start_socket_error",
                port=self.config.port,
                error_type=error_type,
                error=error_detail,
                reason=reason,
            )
            self._set_state(RTCMState.ERROR)
            return False

        except Exception as e:
            # Unexpected errors - log with more detail
            error_type = type(e).__name__
            self._last_error = f"Unexpected error: {error_type} - {str(e)}"
            logger.error(
                "udp_start_unexpected_error",
                port=self.config.port,
                error_type=error_type,
                error=str(e),
                exc_info=True,  # Include stack trace
            )
            self._set_state(RTCMState.ERROR)
            return False

    async def stop(self) -> None:
        """Stop UDP client and close socket."""
        if not self._running:
            return

        logger.info("udp_client_stopping")

        self._running = False

        # Cancel statistics task
        if self._stats_task:
            self._stats_task.cancel()
            try:
                await self._stats_task
            except asyncio.CancelledError:
                pass
            self._stats_task = None

        # Close transport
        if self._transport:
            self._transport.close()
            # Give OS time to release the UDP socket
            # DatagramTransport.close() is synchronous and doesn't have wait_closed()
            await asyncio.sleep(0.1)
            self._transport = None
            self._protocol = None

        self._connection_start_time = None
        self._set_state(RTCMState.DISCONNECTED)
        logger.info("udp_client_stopped")

    async def _on_data_received(self, data: bytes, addr: tuple[str, int]) -> None:
        """Handle received UDP data.

        Args:
            data: Raw UDP packet data
            addr: Source address (host, port)
        """
        if not self._running:
            return

        try:
            # Update statistics
            current_time = time.time()
            self._last_data_time = current_time
            self._stats.bytes_received += len(data)

            # Update data rate
            self._data_rate_window.append((current_time, len(data)))
            self._update_data_rate()

            # Parse RTCM messages
            messages = self._parser.add_data(data)

            # Log parsing results for debugging
            if len(data) > 0:
                logger.debug(
                    "udp_data_received",
                    bytes_count=len(data),
                    messages_parsed=len(messages),
                    source_addr=f"{addr[0]}:{addr[1]}",
                    first_bytes=data[:10].hex() if len(data) >= 10 else data.hex(),
                )

            for message in messages:
                self._stats.messages_received += 1

                # Update message type counts
                if message.message_type not in self._stats.message_type_counts:
                    self._stats.message_type_counts[message.message_type] = 0
                self._stats.message_type_counts[message.message_type] += 1

                # Log message info (at debug level to avoid spam)
                logger.debug(
                    "rtcm_message_received",
                    message_type=message.message_type,
                    message_name=get_message_type_name(message.message_type),
                    length=message.total_length,
                    source_addr=f"{addr[0]}:{addr[1]}",
                )

            # Invoke data callback with raw data
            if self.data_callback:
                try:
                    # Call callback - let it handle asyncio if needed
                    result = self.data_callback(data)
                    if asyncio.iscoroutine(result):
                        await result
                except Exception as e:
                    logger.error("udp_data_callback_error", error=str(e))

            # Publish event if event bus available
            if self.event_bus:
                for message in messages:
                    await self.event_bus.publish(
                        "rtcm.data",
                        {
                            "message_type": message.message_type,
                            "message_name": get_message_type_name(message.message_type),
                            "length": message.total_length,
                            "station_id": message.station_id,
                            "source": f"{addr[0]}:{addr[1]}",
                        },
                    )

        except Exception as e:
            logger.error("udp_receive_error", error=str(e))

    async def _on_error(self, exc: Exception) -> None:
        """Handle UDP protocol error.

        Args:
            exc: Exception that occurred
        """
        logger.error("udp_protocol_error", error=str(exc))
        self._set_state(RTCMState.ERROR)

    def _update_data_rate(self) -> None:
        """Update data rate calculation based on recent data."""
        current_time = time.time()
        window_duration = 5.0  # 5 second window

        # Remove old entries outside the window
        self._data_rate_window = [
            (ts, size)
            for ts, size in self._data_rate_window
            if current_time - ts <= window_duration
        ]

        # Calculate rate
        if self._data_rate_window:
            total_bytes = sum(size for _, size in self._data_rate_window)
            time_span = current_time - self._data_rate_window[0][0]
            if time_span > 0:
                # Convert to KB/s
                self._stats.data_rate = (total_bytes / time_span) / 1024
            else:
                self._stats.data_rate = 0.0
        else:
            self._stats.data_rate = 0.0

    async def _stats_broadcast_loop(self) -> None:
        """Periodically broadcast RTCM status with updated statistics."""
        logger.info("udp_stats_broadcast_started")

        try:
            while self._running:
                try:
                    # Wait 2 seconds between updates
                    await asyncio.sleep(2.0)

                    # Publish status update event with current statistics
                    if self.event_bus and self.is_connected:
                        status_data = {
                            "running": True,
                            "state": self._state.value,
                            "client_type": "UDP",
                            "connected": self.is_connected,
                            "statistics": self.statistics.model_dump(),
                        }
                        await self.event_bus.publish("rtcm.status.changed", status_data)

                except Exception as e:
                    logger.error("udp_stats_broadcast_error", error=str(e))
                    await asyncio.sleep(2.0)

        except asyncio.CancelledError:
            logger.info("udp_stats_broadcast_cancelled")
            raise

    def _set_state(self, state: RTCMState) -> None:
        """Set connection state and publish event.

        Args:
            state: New connection state
        """
        if state == self._state:
            return

        old_state = self._state
        self._state = state

        logger.info(
            "udp_state_changed",
            old_state=old_state.value,
            new_state=state.value,
        )

        # Publish state change event
        if self.event_bus:
            asyncio.create_task(
                self.event_bus.publish(
                    "rtcm.state",
                    {
                        "state": state.value,
                        "state_name": state.name,
                        "message": f"UDP client state changed to {state.name}",
                    },
                )
            )


class UDPProtocol(asyncio.DatagramProtocol):
    """Asyncio datagram protocol for UDP RTCM reception."""

    def __init__(
        self,
        on_data_received: Callable[[bytes, tuple[str, int]], asyncio.coroutines.coroutine],
        on_error: Callable[[Exception], asyncio.coroutines.coroutine],
    ) -> None:
        """Initialize UDP protocol.

        Args:
            on_data_received: Callback for received data (data, address)
            on_error: Callback for errors
        """
        self.on_data_received = on_data_received
        self.on_error = on_error
        self.transport: Optional[asyncio.DatagramTransport] = None

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        """Called when connection is established.

        Args:
            transport: Transport instance
        """
        self.transport = transport  # type: ignore

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        """Called when a datagram is received.

        Args:
            data: Received data
            addr: Source address (host, port)
        """
        # Schedule the async callback
        asyncio.create_task(self.on_data_received(data, addr))

    def error_received(self, exc: Exception) -> None:
        """Called when an error is received.

        Args:
            exc: Exception that occurred
        """
        # Schedule the async callback
        asyncio.create_task(self.on_error(exc))

    def connection_lost(self, exc: Optional[Exception]) -> None:
        """Called when connection is lost.

        Args:
            exc: Exception if connection lost due to error
        """
        if exc:
            asyncio.create_task(self.on_error(exc))
