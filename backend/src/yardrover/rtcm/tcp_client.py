"""TCP RTCM client for receiving raw RTCM data streams.

This client connects to a simple TCP server that streams raw RTCM 3.x binary data,
such as the ESP32 RTK base station WiFi TCP server. Unlike NTRIP, this is a pure
TCP connection with no HTTP protocol overhead - just raw RTCM bytes.

Typical use case: Connecting to ESP32-based RTK base stations that broadcast
RTCM corrections over WiFi TCP (default port 2101).
"""

import asyncio
import time
from typing import Callable, Optional

import structlog

from yardrover.core.events import EventBus
from yardrover.models.rtcm import (
    RTCMState,
    RTCMStatistics,
    TCPSourceConfig,
    get_message_type_name,
)
from yardrover.rtcm.parser import RTCMParser

logger = structlog.get_logger(__name__)


class TCPClient:
    """TCP client for receiving raw RTCM data streams.

    This client connects to a TCP server that streams raw RTCM 3.x binary data
    without any protocol overhead (no HTTP, no authentication). It's designed
    for simple RTCM base stations like the ESP32 WiFi RTK system.
    """

    def __init__(
        self,
        config: TCPSourceConfig,
        event_bus: Optional[EventBus] = None,
        data_callback: Optional[Callable[[bytes], None]] = None,
        enable_stats_broadcast: bool = True,
    ) -> None:
        """Initialize TCP RTCM client.

        Args:
            config: TCP connection configuration (host and port)
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
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._receive_task: Optional[asyncio.Task] = None
        self._stats_task: Optional[asyncio.Task] = None
        self._parser = RTCMParser()

        # Statistics
        self._stats = RTCMStatistics()
        self._connection_start_time: Optional[float] = None
        self._last_data_time: Optional[float] = None
        self._data_rate_window: list[tuple[float, int]] = []  # (timestamp, bytes)

        # Reconnection
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 30.0
        self._last_reconnect_attempt: Optional[float] = None
        self._running = False

        # Error tracking
        self._last_error: Optional[str] = None

    @property
    def state(self) -> RTCMState:
        """Get current connection state."""
        return self._state

    @property
    def is_connected(self) -> bool:
        """Check if client is connected."""
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
        """Start TCP client and connect to server.

        Returns:
            True if started successfully, False otherwise
        """
        if self._running:
            logger.warning("TCP client already running")
            return False

        # Reset state before starting
        self._state = RTCMState.DISCONNECTED
        self._stats = RTCMStatistics()
        self._connection_start_time = None
        self._last_data_time = None
        self._data_rate_window = []
        self._parser = RTCMParser()
        self._last_error = None  # Clear previous errors

        self._running = True
        self._receive_task = asyncio.create_task(self._receive_loop())

        # Start statistics broadcasting task (only if not disabled)
        if self.enable_stats_broadcast:
            self._stats_task = asyncio.create_task(self._stats_broadcast_loop())
            logger.info("tcp_stats_broadcast_enabled")
        else:
            logger.info("tcp_stats_broadcast_disabled (handled externally)")

        logger.info(
            "tcp_client_started",
            host=self.config.host,
            port=self.config.port,
        )

        return True

    async def stop(self) -> None:
        """Stop TCP client and disconnect."""
        if not self._running:
            return

        logger.info("tcp_client_stopping")

        self._running = False

        # Cancel receive task
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        # Cancel statistics task
        if self._stats_task:
            self._stats_task.cancel()
            try:
                await self._stats_task
            except asyncio.CancelledError:
                pass
            self._stats_task = None

        # Close connection
        await self._disconnect()

        self._set_state(RTCMState.DISCONNECTED)
        logger.info("tcp_client_stopped")

    async def _connect(self) -> bool:
        """Establish TCP connection to server.

        Returns:
            True if connected successfully, False otherwise
        """
        try:
            self._set_state(RTCMState.CONNECTING)

            logger.info(
                "tcp_connecting",
                host=self.config.host,
                port=self.config.port,
            )

            # Open TCP connection
            self._reader, self._writer = await asyncio.wait_for(
                asyncio.open_connection(self.config.host, self.config.port),
                timeout=10.0,
            )

            # Connection successful
            self._connection_start_time = time.time()
            self._reconnect_delay = 1.0  # Reset reconnect delay
            self._set_state(RTCMState.CONNECTED)

            logger.info(
                "tcp_connected",
                host=self.config.host,
                port=self.config.port,
            )

            return True

        except asyncio.TimeoutError:
            self._last_error = f"Connection timed out after 10 seconds ({self.config.host}:{self.config.port})"
            logger.error(
                "tcp_connection_timeout",
                host=self.config.host,
                port=self.config.port,
                error=self._last_error,
            )
            self._set_state(RTCMState.ERROR)
            return False

        except OSError as e:
            # Network-related errors (connection refused, host unreachable, DNS failure, etc.)
            error_type = type(e).__name__
            error_detail = str(e)

            # Categorize common network errors
            if "refused" in error_detail.lower():
                reason = "Connection refused - server not listening on port or firewall blocking"
            elif "unreachable" in error_detail.lower():
                reason = "Host unreachable - check network connectivity and routing"
            elif "name or service not known" in error_detail.lower() or "nodename nor servname provided" in error_detail.lower():
                reason = "DNS resolution failed - check hostname or IP address"
            elif "timed out" in error_detail.lower():
                reason = "Connection timed out"
            elif "already in use" in error_detail.lower():
                reason = "Address already in use"
            else:
                reason = f"Network error: {error_detail}"

            self._last_error = f"{reason} ({self.config.host}:{self.config.port})"
            logger.error(
                "tcp_connection_network_error",
                host=self.config.host,
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
                "tcp_connection_unexpected_error",
                host=self.config.host,
                port=self.config.port,
                error_type=error_type,
                error=str(e),
                exc_info=True,  # Include stack trace
            )
            self._set_state(RTCMState.ERROR)
            return False

    async def _disconnect(self) -> None:
        """Close TCP connection."""
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("tcp_disconnect_error", error=str(e))
            finally:
                self._writer = None
                self._reader = None

        self._connection_start_time = None

    async def _receive_loop(self) -> None:
        """Main receive loop - connects and reads RTCM data."""
        while self._running:
            try:
                # Connect if not connected
                if not self.is_connected:
                    # Implement exponential backoff
                    if self._last_reconnect_attempt:
                        elapsed = time.time() - self._last_reconnect_attempt
                        if elapsed < self._reconnect_delay:
                            await asyncio.sleep(self._reconnect_delay - elapsed)

                    self._last_reconnect_attempt = time.time()

                    if not await self._connect():
                        # Increase reconnect delay (exponential backoff)
                        self._reconnect_delay = min(
                            self._reconnect_delay * 2, self._max_reconnect_delay
                        )
                        continue

                # Read RTCM data
                await self._receive_data()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("tcp_receive_loop_error", error=str(e))
                await self._disconnect()
                self._set_state(RTCMState.ERROR)
                await asyncio.sleep(1.0)

    async def _receive_data(self) -> None:
        """Receive and process RTCM data from TCP stream."""
        if not self._reader:
            return

        try:
            # Read data in chunks
            chunk_size = 4096
            data = await self._reader.read(chunk_size)

            if not data:
                # Connection closed by server
                logger.warning("tcp_connection_closed_by_server")
                await self._disconnect()
                self._set_state(RTCMState.DISCONNECTED)
                return

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
                    "tcp_data_received",
                    bytes_count=len(data),
                    messages_parsed=len(messages),
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
                )

            # Invoke data callback with raw data
            if self.data_callback:
                try:
                    # Call callback - let it handle asyncio if needed
                    result = self.data_callback(data)
                    if asyncio.iscoroutine(result):
                        await result
                except Exception as e:
                    logger.error("tcp_data_callback_error", error=str(e))

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
                        },
                    )

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("tcp_receive_error", error=str(e))
            await self._disconnect()
            self._set_state(RTCMState.ERROR)

    def _update_data_rate(self) -> None:
        """Update data rate calculation based on recent data.

        Uses a sliding window average to smooth out rate fluctuations.
        Always calculates rate over the full window duration for stability.
        """
        current_time = time.time()
        window_duration = 5.0  # 5 second window

        # Remove old entries outside the window
        self._data_rate_window = [
            (ts, size)
            for ts, size in self._data_rate_window
            if current_time - ts <= window_duration
        ]

        # Calculate rate over the full window duration
        if self._data_rate_window:
            total_bytes = sum(size for _, size in self._data_rate_window)

            # Always use the full window duration for averaging
            # This provides stable rate calculation regardless of when data arrives
            # Convert to KB/s
            self._stats.data_rate = (total_bytes / window_duration) / 1024
        else:
            self._stats.data_rate = 0.0

    async def _stats_broadcast_loop(self) -> None:
        """Periodically broadcast RTCM status with updated statistics."""
        logger.info("tcp_stats_broadcast_started")

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
                            "client_type": "TCP",
                            "connected": self.is_connected,
                            "statistics": self.statistics.model_dump(),
                        }
                        await self.event_bus.publish("rtcm.status.changed", status_data)

                except Exception as e:
                    logger.error("tcp_stats_broadcast_error", error=str(e))
                    await asyncio.sleep(2.0)

        except asyncio.CancelledError:
            logger.info("tcp_stats_broadcast_cancelled")
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
            "tcp_state_changed",
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
                        "message": f"TCP client state changed to {state.name}",
                    },
                )
            )
