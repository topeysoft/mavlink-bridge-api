"""NTRIP (Networked Transport of RTCM via Internet Protocol) client.

Based on C++ implementation in lib/rtcm/NTRIPClient/NTRIPClient.cpp

NTRIP is an HTTP-based protocol for streaming RTCM corrections from a caster
(server) to GPS receivers for RTK positioning. This implementation supports:
- NTRIP 1.0 and 2.0 protocols
- HTTP Basic authentication
- NMEA GGA position updates for VRS (Virtual Reference Station)
- Automatic reconnection
- Data rate monitoring
"""

import asyncio
import base64
import time
from typing import Callable, Optional

import structlog

from yardrover.core.events import EventBus
from yardrover.models.rtcm import (
    NTRIPConfig,
    RTCMState,
    RTCMStatistics,
    get_message_type_name,
)
from yardrover.rtcm.parser import RTCMParser

logger = structlog.get_logger(__name__)


class NTRIPClient:
    """NTRIP client for receiving RTCM corrections.

    This client connects to an NTRIP caster, authenticates, and receives
    RTCM correction data for high-precision GPS positioning.
    """

    def __init__(
        self,
        config: NTRIPConfig,
        event_bus: Optional[EventBus] = None,
        data_callback: Optional[Callable[[bytes], None]] = None,
        enable_stats_broadcast: bool = True,
    ) -> None:
        """Initialize NTRIP client.

        Args:
            config: NTRIP configuration
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
        self._gga_task: Optional[asyncio.Task] = None
        self._stats_task: Optional[asyncio.Task] = None
        self._parser = RTCMParser()

        # Statistics
        self._stats = RTCMStatistics()
        self._connection_start_time: Optional[float] = None
        self._last_data_time: Optional[float] = None
        self._data_rate_window: list[tuple[float, int]] = []  # (timestamp, bytes)

        # Reconnection
        self._reconnect_delay = 1.0
        self._last_reconnect_attempt: Optional[float] = None
        self._running = False

        # Error tracking
        self._last_error: Optional[str] = None

    @property
    def state(self) -> RTCMState:
        """Get current connection state."""
        return self._state

    @property
    def statistics(self) -> RTCMStatistics:
        """Get current statistics."""
        stats = self._stats.copy()
        if self._connection_start_time:
            stats.connection_time = int((time.time() - self._connection_start_time) * 1000)

        # Include parser diagnostics
        diagnostics = self._parser.get_diagnostics()
        stats.parser_buffer_size = diagnostics["buffer_size"]
        stats.frames_with_no_preamble = diagnostics["frames_no_preamble"]
        stats.frames_with_invalid_crc = diagnostics["frames_invalid_crc"]
        stats.frames_with_invalid_length = diagnostics["frames_invalid_length"]

        return stats

    @property
    def is_connected(self) -> bool:
        """Check if connected to NTRIP caster."""
        return self._state == RTCMState.CONNECTED and self._writer is not None

    @property
    def last_error(self) -> Optional[str]:
        """Get the last error message."""
        return self._last_error

    async def start(self) -> bool:
        """Start NTRIP client and connect to caster.

        Returns:
            True if connection successful
        """
        if self._running:
            logger.warning("NTRIP client already running")
            return self.is_connected

        # Reset state before starting
        from yardrover.models.rtcm import RTCMStatistics
        from yardrover.rtcm.parser import RTCMParser

        self._state = RTCMState.DISCONNECTED
        self._stats = RTCMStatistics()
        self._connection_start_time = None
        self._last_data_time = None
        self._data_rate_window = []
        self._parser = RTCMParser()
        self._last_error = None  # Clear previous errors

        self._running = True
        return await self._connect()

    async def stop(self) -> None:
        """Stop NTRIP client and disconnect."""
        self._running = False
        await self._disconnect()

    async def set_position(self, latitude: float, longitude: float, altitude: float = 0.0) -> None:
        """Update position for VRS (Virtual Reference Station).

        Args:
            latitude: Latitude in degrees
            longitude: Longitude in degrees
            altitude: Altitude in meters (MSL)
        """
        from yardrover.models.rtcm import NTRIPPosition

        self.config.position = NTRIPPosition(
            latitude=latitude,
            longitude=longitude,
            altitude=altitude
        )
        self.config.send_position = True

    # ========================================================================
    # Private Methods
    # ========================================================================

    async def _connect(self) -> bool:
        """Connect to NTRIP caster.

        Returns:
            True if connection successful
        """
        self._set_state(RTCMState.CONNECTING)

        try:
            # Open TCP connection
            logger.info(
                "Connecting to NTRIP caster",
                host=self.config.host,
                port=self.config.port,
                mountpoint=self.config.mountpoint,
            )

            self._reader, self._writer = await asyncio.open_connection(
                self.config.host,
                self.config.port
            )

            # Send NTRIP request
            if not await self._send_request():
                await self._disconnect()
                return False

            # Parse response
            if not await self._parse_response():
                await self._disconnect()
                return False

            # Connection successful
            self._set_state(RTCMState.CONNECTED)
            self._connection_start_time = time.time()
            logger.info("Connected to NTRIP caster")

            # Start receive task
            self._receive_task = asyncio.create_task(self._receive_loop())

            # Start GGA task if position sending is enabled
            if self.config.send_position and self.config.position:
                self._gga_task = asyncio.create_task(self._gga_loop())

            # Start statistics broadcasting task (only if not disabled)
            if self.enable_stats_broadcast:
                self._stats_task = asyncio.create_task(self._stats_broadcast_loop())
                logger.info("Started internal RTCM stats broadcast")
            else:
                logger.info("Internal RTCM stats broadcast disabled (handled externally)")

            return True

        except asyncio.TimeoutError:
            self._last_error = f"Connection timed out to {self.config.host}:{self.config.port}"
            logger.error(
                "ntrip_connection_timeout",
                host=self.config.host,
                port=self.config.port,
                mountpoint=self.config.mountpoint,
                error=self._last_error,
            )
            self._set_state(RTCMState.ERROR)
            await self._disconnect()
            return False

        except OSError as e:
            # Network-related errors (connection refused, host unreachable, DNS failure, etc.)
            error_type = type(e).__name__
            error_detail = str(e)

            # Categorize common network errors
            if "refused" in error_detail.lower():
                reason = "Connection refused - server may be down or port blocked"
            elif "unreachable" in error_detail.lower():
                reason = "Host unreachable - check network connectivity"
            elif "name or service not known" in error_detail.lower() or "nodename nor servname provided" in error_detail.lower():
                reason = "DNS resolution failed - check hostname"
            elif "timed out" in error_detail.lower():
                reason = "Connection timed out"
            else:
                reason = f"Network error: {error_detail}"

            self._last_error = f"{reason} ({self.config.host}:{self.config.port}{self.config.mountpoint})"
            logger.error(
                "ntrip_connection_network_error",
                host=self.config.host,
                port=self.config.port,
                mountpoint=self.config.mountpoint,
                error_type=error_type,
                error=error_detail,
                reason=reason,
            )
            self._set_state(RTCMState.ERROR)
            await self._disconnect()
            return False

        except Exception as e:
            # Unexpected errors - log with more detail
            error_type = type(e).__name__
            self._last_error = f"Unexpected error: {error_type} - {str(e)}"
            logger.error(
                "ntrip_connection_unexpected_error",
                host=self.config.host,
                port=self.config.port,
                mountpoint=self.config.mountpoint,
                error_type=error_type,
                error=str(e),
                exc_info=True,  # Include stack trace
            )
            self._set_state(RTCMState.ERROR)
            await self._disconnect()
            return False

    async def _disconnect(self) -> None:
        """Disconnect from NTRIP caster."""
        # Cancel tasks
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._gga_task:
            self._gga_task.cancel()
            try:
                await self._gga_task
            except asyncio.CancelledError:
                pass
            self._gga_task = None

        if self._stats_task:
            self._stats_task.cancel()
            try:
                await self._stats_task
            except asyncio.CancelledError:
                pass
            self._stats_task = None

        # Close connection
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("Error closing NTRIP connection", error=str(e))
            finally:
                self._writer = None
                self._reader = None

        self._parser.reset()
        self._connection_start_time = None
        self._set_state(RTCMState.DISCONNECTED)
        logger.info("Disconnected from NTRIP caster")

    async def _send_request(self) -> bool:
        """Send HTTP GET request to NTRIP caster.

        Returns:
            True if request sent successfully
        """
        if not self._writer:
            return False

        try:
            # Build GET request
            request_lines = [
                f"GET /{self.config.mountpoint} HTTP/1.0",
                f"User-Agent: {self.config.user_agent}",
                "Accept: */*",
                "Connection: close",
            ]

            # Add authorization if credentials provided
            if self.config.username:
                credentials = f"{self.config.username}:{self.config.password or ''}"
                encoded = base64.b64encode(credentials.encode()).decode()
                request_lines.append(f"Authorization: Basic {encoded}")

            # Add NTRIP version header
            request_lines.append("Ntrip-Version: Ntrip/2.0")
            request_lines.append("")  # Empty line before end
            request_lines.append("")  # End of headers

            request = "\r\n".join(request_lines)

            logger.debug("Sending NTRIP request", request=request.split("\r\n"))

            self._writer.write(request.encode())
            await self._writer.drain()
            return True

        except Exception as e:
            logger.error("Failed to send NTRIP request", error=str(e))
            return False

    async def _parse_response(self) -> bool:
        """Parse HTTP response from NTRIP caster.

        Returns:
            True if response indicates success (ICY 200 OK or HTTP 200 OK)
        """
        if not self._reader:
            return False

        try:
            # Read response headers (until \r\n\r\n)
            response_lines = []
            timeout = 5.0
            start_time = time.time()

            while time.time() - start_time < timeout:
                try:
                    line = await asyncio.wait_for(self._reader.readline(), timeout=1.0)
                    if not line:
                        break

                    line_str = line.decode().strip()
                    response_lines.append(line_str)

                    # Check for end of headers
                    if line_str == "":
                        break

                except asyncio.TimeoutError:
                    continue

            if not response_lines:
                logger.error("No response from NTRIP caster")
                return False

            logger.debug("Received NTRIP response", response=response_lines)

            # Check status line
            status_line = response_lines[0]
            if "ICY 200 OK" in status_line or "HTTP/1.0 200 OK" in status_line or "HTTP/1.1 200 OK" in status_line:
                logger.info("NTRIP authentication successful")
                return True
            else:
                logger.error("NTRIP authentication failed", status=status_line)
                return False

        except Exception as e:
            logger.error("Failed to parse NTRIP response", error=str(e))
            return False

    async def _receive_loop(self) -> None:
        """Receive loop for RTCM data."""
        logger.info("Starting NTRIP receive loop")

        try:
            while self._running and self._reader:
                try:
                    # Read data with timeout
                    data = await asyncio.wait_for(self._reader.read(4096), timeout=30.0)

                    if not data:
                        logger.warning("Connection closed by caster")
                        break

                    # Update statistics
                    now = time.time()
                    self._last_data_time = now
                    self._stats.bytes_received += len(data)
                    self._data_rate_window.append((now, len(data)))
                    self._update_data_rate()

                    # Parse RTCM messages
                    messages = self._parser.add_data(data)

                    for message in messages:
                        self._stats.messages_received += 1
                        self._stats.last_message_time = int(now * 1000)

                        # Update message type counts
                        msg_type = message.message_type
                        self._stats.message_type_counts[msg_type] = (
                            self._stats.message_type_counts.get(msg_type, 0) + 1
                        )

                        # Publish event
                        if self.event_bus:
                            await self.event_bus.publish("rtcm.data", {
                                "message_type": msg_type,
                                "message_name": get_message_type_name(msg_type),
                                "length": message.total_length,
                                "station_id": message.station_id,
                            })

                    # Call data callback with raw data
                    if self.data_callback:
                        self.data_callback(data)

                except asyncio.TimeoutError:
                    logger.warning("No data received from NTRIP caster (timeout)")
                    continue

                except Exception as e:
                    logger.error("Error in receive loop", error=str(e))
                    break

        except asyncio.CancelledError:
            logger.info("Receive loop cancelled")
            raise

        finally:
            logger.info("NTRIP receive loop stopped")
            if self._running:
                # Unexpected disconnect, try to reconnect
                self._set_state(RTCMState.ERROR)
                asyncio.create_task(self._reconnect_loop())

    async def _gga_loop(self) -> None:
        """Send NMEA GGA position updates for VRS."""
        logger.info("Starting NMEA GGA position update loop")

        try:
            while self._running and self.config.send_position:
                try:
                    # Send GGA message
                    if self.config.position and self._writer:
                        gga = self._generate_gga()
                        self._writer.write(gga.encode())
                        await self._writer.drain()
                        logger.debug("Sent NMEA GGA position")

                    # Wait for next interval
                    await asyncio.sleep(self.config.gga_interval / 1000.0)

                except Exception as e:
                    logger.error("Error sending GGA position", error=str(e))
                    await asyncio.sleep(1.0)

        except asyncio.CancelledError:
            logger.info("GGA loop cancelled")
            raise

    async def _stats_broadcast_loop(self) -> None:
        """Periodically broadcast RTCM status with updated statistics."""
        logger.info("Starting RTCM statistics broadcast loop")

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
                            "client_type": "NTRIP",
                            "connected": self.is_connected,
                            "statistics": self.statistics.model_dump(),
                        }
                        await self.event_bus.publish("rtcm.status.changed", status_data)

                except Exception as e:
                    logger.error("Error broadcasting RTCM statistics", error=str(e))
                    await asyncio.sleep(2.0)

        except asyncio.CancelledError:
            logger.info("Statistics broadcast loop cancelled")
            raise

    async def _reconnect_loop(self) -> None:
        """Automatic reconnection loop."""
        while self._running and not self.is_connected:
            now = time.time()

            # Check reconnection delay
            if self._last_reconnect_attempt:
                elapsed = now - self._last_reconnect_attempt
                if elapsed < self._reconnect_delay:
                    await asyncio.sleep(self._reconnect_delay - elapsed)

            self._last_reconnect_attempt = time.time()
            logger.info("Attempting to reconnect to NTRIP caster")

            if await self._connect():
                self._reconnect_delay = 1.0  # Reset delay on success
                return

            # Exponential backoff (max 60 seconds)
            self._reconnect_delay = min(self._reconnect_delay * 2, 60.0)

    def _generate_gga(self) -> str:
        """Generate NMEA GGA sentence with current position.

        Returns:
            NMEA GGA sentence string
        """
        if not self.config.position:
            return ""

        pos = self.config.position

        # Convert latitude to NMEA format (DDMM.MMMM)
        lat_deg = int(abs(pos.latitude))
        lat_min = (abs(pos.latitude) - lat_deg) * 60.0
        lat_str = f"{lat_deg:02d}{lat_min:07.4f}"
        lat_ns = "N" if pos.latitude >= 0 else "S"

        # Convert longitude to NMEA format (DDDMM.MMMM)
        lon_deg = int(abs(pos.longitude))
        lon_min = (abs(pos.longitude) - lon_deg) * 60.0
        lon_str = f"{lon_deg:03d}{lon_min:07.4f}"
        lon_ew = "E" if pos.longitude >= 0 else "W"

        # Get current time
        now = time.gmtime()
        time_str = f"{now.tm_hour:02d}{now.tm_min:02d}{now.tm_sec:02d}.00"

        # Build GGA sentence (without checksum)
        gga_fields = [
            "GPGGA",
            time_str,
            lat_str,
            lat_ns,
            lon_str,
            lon_ew,
            "1",  # GPS quality (1 = GPS fix)
            "08",  # Number of satellites
            "1.0",  # HDOP
            f"{pos.altitude:.1f}",  # Altitude
            "M",  # Altitude units
            "0.0",  # Geoidal separation
            "M",  # Separation units
            "",  # Age of diff corrections (empty)
            "",  # Diff station ID (empty)
        ]

        gga_sentence = ",".join(gga_fields)

        # Calculate checksum
        checksum = 0
        for char in gga_sentence:
            checksum ^= ord(char)

        # Return complete sentence
        return f"${gga_sentence}*{checksum:02X}\r\n"

    def _update_data_rate(self) -> None:
        """Update data rate calculation.

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

    def _set_state(self, state: RTCMState) -> None:
        """Set connection state and publish event.

        Args:
            state: New connection state
        """
        if state == self._state:
            return

        old_state = self._state
        self._state = state

        logger.info("NTRIP state changed", old_state=old_state.value, new_state=state.value)

        if self.event_bus:
            asyncio.create_task(
                self.event_bus.publish("rtcm.state", {
                    "state": state.value,
                    "state_name": state.value,
                })
            )
