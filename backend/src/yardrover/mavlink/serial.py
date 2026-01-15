"""Serial communication manager for MAVLink.

This module provides async serial communication with auto-baud detection,
statistics tracking, and MAVLink message detection.
"""

import asyncio
import logging
from datetime import datetime
from typing import Callable, List, Optional

import serial
from serial_asyncio import open_serial_connection

from yardrover.core.events import EventBus
from yardrover.models.mavlink import SerialConfig, SerialStatistics, SerialStatus

# Define custom VERBOSE log level (below DEBUG)
VERBOSE = 5
logging.addLevelName(VERBOSE, "VERBOSE")

logger = logging.getLogger(__name__)


class SerialManager:
    """Async serial port manager for MAVLink communication.

    Handles serial port connection, data transmission, baud rate detection,
    and statistics tracking.
    """

    # Supported baud rates for auto-detection
    SUPPORTED_BAUDS: List[int] = [
        57600,
        115200,
        230400,
        460800,
        921600,
    ]

    # MAVLink detection timeout
    MAVLINK_DETECTION_TIMEOUT = 5.0  # seconds
    MAVLINK_MIN_MESSAGES = 3  # Minimum messages to confirm MAVLink

    def __init__(
        self,
        config: SerialConfig,
        event_bus: Optional[EventBus] = None,
    ) -> None:
        """Initialize serial manager.

        Args:
            config: Serial port configuration
            event_bus: Optional event bus for broadcasting events
        """
        self.config = config
        self.event_bus = event_bus

        # Connection state
        self.connected = False
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None

        # Statistics
        self.stats = SerialStatistics()

        # Background tasks
        self._read_task: Optional[asyncio.Task] = None
        self._stats_task: Optional[asyncio.Task] = None

        # Callbacks
        self._connect_callback: Optional[Callable[[], None]] = None
        self._disconnect_callback: Optional[Callable[[], None]] = None
        self._data_callback: Optional[Callable[[bytes], None]] = None

        logger.info(f"SerialManager initialized for port {config.port}")

    # ==================== Connection Management ====================

    async def start(self) -> bool:
        """Start serial communication.

        Returns:
            True if successfully started
        """
        if self.connected:
            logger.warning("Serial port already connected")
            return True

        try:
            # Auto-detect baud rate if enabled
            if self.config.auto_baud:
                detected_baud = await self.detect_baudrate()
                if detected_baud:
                    self.config.baudrate = detected_baud
                    logger.info(f"Auto-detected baud rate: {detected_baud}")
                else:
                    logger.warning(
                        f"Auto-baud failed, using configured: {self.config.baudrate}"
                    )

            # Open serial connection
            self.reader, self.writer = await open_serial_connection(
                url=self.config.port,
                baudrate=self.config.baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                rtscts=self.config.flow_control,
            )

            self.connected = True
            logger.info(
                f"Serial port opened: {self.config.port} @ {self.config.baudrate}"
            )

            # Start background tasks
            self._read_task = asyncio.create_task(self._read_loop())
            self._stats_task = asyncio.create_task(self._stats_loop())

            # Publish connection event
            if self.event_bus:
                await self.event_bus.publish(
                    "serial.connected",
                    {
                        "port": self.config.port,
                        "baudrate": self.config.baudrate,
                    },
                )

            # Call connect callback
            if self._connect_callback:
                if asyncio.iscoroutinefunction(self._connect_callback):
                    await self._connect_callback()
                else:
                    self._connect_callback()

            return True

        except Exception as e:
            logger.error(f"Failed to open serial port {self.config.port}: {e}")
            self.connected = False
            return False

    async def stop(self) -> None:
        """Stop serial communication."""
        if not self.connected:
            return

        logger.info(f"Stopping serial port {self.config.port}")

        # Cancel background tasks
        if self._read_task:
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass

        if self._stats_task:
            self._stats_task.cancel()
            try:
                await self._stats_task
            except asyncio.CancelledError:
                pass

        # Close serial connection
        if self.writer:
            self.writer.close()
            await self.writer.wait_closed()

        self.connected = False
        self.reader = None
        self.writer = None

        # Publish disconnection event
        if self.event_bus:
            await self.event_bus.publish(
                "serial.disconnected",
                {"port": self.config.port},
            )

        # Call disconnect callback
        if self._disconnect_callback:
            if asyncio.iscoroutinefunction(self._disconnect_callback):
                await self._disconnect_callback()
            else:
                self._disconnect_callback()

        logger.info(f"Serial port {self.config.port} closed")

    def is_connected(self) -> bool:
        """Check if serial port is connected.

        Returns:
            True if connected
        """
        return self.connected

    # ==================== Data Transmission ====================

    async def write(self, data: bytes) -> int:
        """Write data to serial port.

        Args:
            data: Data bytes to write

        Returns:
            Number of bytes written

        Raises:
            RuntimeError: If not connected
        """
        if not self.connected or not self.writer:
            raise RuntimeError("Serial port not connected")

        try:
            self.writer.write(data)
            await self.writer.drain()

            # Update statistics
            self.stats.bytes_sent += len(data)
            self.stats.packets_sent += 1

            return len(data)

        except Exception as e:
            logger.error(f"Serial write error: {e}")
            await self._handle_connection_error()
            raise

    async def _read_loop(self) -> None:
        """Background task for reading serial data."""
        if not self.reader:
            return

        buffer = bytearray()

        while self.connected:
            try:
                # Read available data
                data = await self.reader.read(4096)
                if not data:
                    # Connection closed
                    logger.warning("Serial port closed by remote")
                    await self._handle_connection_error()
                    break

                # Update statistics
                self.stats.bytes_received += len(data)
                self.stats.packets_received += 1

                # Log data reception at VERBOSE level (below DEBUG)
                logger.log(VERBOSE, f"Serial data received: {len(data)} bytes (total: {self.stats.bytes_received})")

                # Add to buffer
                buffer.extend(data)

                # Call data callback
                if self._data_callback:
                    try:
                        if asyncio.iscoroutinefunction(self._data_callback):
                            await self._data_callback(bytes(buffer))
                        else:
                            self._data_callback(bytes(buffer))
                        buffer.clear()
                    except Exception as e:
                        logger.error(f"Error in data callback: {e}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Serial read error: {e}")
                await self._handle_connection_error()
                break

    async def _handle_connection_error(self) -> None:
        """Handle connection error and cleanup."""
        if self.connected:
            await self.stop()

    # ==================== Statistics ====================

    def get_statistics(self) -> SerialStatistics:
        """Get current statistics.

        Returns:
            Current statistics
        """
        return self.stats

    def reset_statistics(self) -> None:
        """Reset all statistics."""
        self.stats = SerialStatistics()
        logger.info("Serial statistics reset")

    async def _stats_loop(self) -> None:
        """Background task for updating statistics."""
        last_bytes_received = 0
        last_bytes_sent = 0
        last_update = datetime.now()

        while self.connected:
            try:
                await asyncio.sleep(1.0)  # Update every second

                now = datetime.now()
                delta = (now - last_update).total_seconds()

                if delta > 0:
                    # Calculate data rate (bytes/sec)
                    bytes_rx = self.stats.bytes_received - last_bytes_received
                    bytes_tx = self.stats.bytes_sent - last_bytes_sent
                    self.stats.data_rate = (bytes_rx + bytes_tx) / delta

                    # Update last values
                    last_bytes_received = self.stats.bytes_received
                    last_bytes_sent = self.stats.bytes_sent
                    last_update = now
                    self.stats.last_update = now

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error updating statistics: {e}")

    def get_status(self) -> SerialStatus:
        """Get current serial port status.

        Returns:
            Serial port status
        """
        return SerialStatus(
            connected=self.connected,
            port=self.config.port,
            baudrate=self.config.baudrate,
            statistics=self.stats,
        )

    # ==================== Baud Rate Detection ====================

    async def detect_baudrate(self) -> Optional[int]:
        """Auto-detect baud rate by testing for MAVLink traffic.

        Returns:
            Detected baud rate or None if detection failed
        """
        logger.info(f"Auto-detecting baud rate on {self.config.port}")

        for baudrate in self.SUPPORTED_BAUDS:
            logger.debug(f"Testing baud rate: {baudrate}")

            if await self._test_baudrate(baudrate):
                logger.info(f"Detected baud rate: {baudrate}")
                return baudrate

        logger.warning("Baud rate auto-detection failed")
        return None

    async def _test_baudrate(self, baudrate: int) -> bool:
        """Test if a specific baud rate has valid MAVLink traffic.

        Args:
            baudrate: Baud rate to test

        Returns:
            True if MAVLink traffic detected
        """
        try:
            # Open temporary connection
            reader, writer = await open_serial_connection(
                url=self.config.port,
                baudrate=baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=self.MAVLINK_DETECTION_TIMEOUT,
            )

            # Look for MAVLink messages
            mavlink_count = 0
            start_time = asyncio.get_event_loop().time()

            while (
                asyncio.get_event_loop().time() - start_time
                < self.MAVLINK_DETECTION_TIMEOUT
            ):
                try:
                    # Read with timeout
                    data = await asyncio.wait_for(reader.read(1024), timeout=1.0)

                    if not data:
                        break

                    # Check for MAVLink magic bytes (0xFD or 0xFE)
                    for byte in data:
                        if byte in (0xFD, 0xFE):
                            mavlink_count += 1
                            if mavlink_count >= self.MAVLINK_MIN_MESSAGES:
                                # Found enough MAVLink markers
                                writer.close()
                                await writer.wait_closed()
                                return True

                except asyncio.TimeoutError:
                    continue

            # Close connection
            writer.close()
            await writer.wait_closed()

        except Exception as e:
            logger.debug(f"Baud rate test failed for {baudrate}: {e}")

        return False

    async def detect_mavlink(self) -> bool:
        """Check if current connection has MAVLink traffic.

        Returns:
            True if MAVLink traffic detected
        """
        if not self.connected or not self.reader:
            return False

        logger.info("Detecting MAVLink traffic...")

        mavlink_count = 0
        start_time = asyncio.get_event_loop().time()

        while (
            asyncio.get_event_loop().time() - start_time
            < self.MAVLINK_DETECTION_TIMEOUT
        ):
            try:
                # Read with timeout
                data = await asyncio.wait_for(self.reader.read(1024), timeout=1.0)

                if not data:
                    break

                # Check for MAVLink magic bytes
                for byte in data:
                    if byte in (0xFD, 0xFE):
                        mavlink_count += 1
                        if mavlink_count >= self.MAVLINK_MIN_MESSAGES:
                            logger.info("MAVLink traffic detected")
                            return True

            except asyncio.TimeoutError:
                continue

        logger.warning("No MAVLink traffic detected")
        return False

    async def set_baudrate(self, baudrate: int) -> bool:
        """Change baud rate.

        Args:
            baudrate: New baud rate

        Returns:
            True if baud rate changed successfully
        """
        if baudrate not in self.SUPPORTED_BAUDS:
            logger.error(f"Unsupported baud rate: {baudrate}")
            return False

        was_connected = self.connected

        # Reconnect with new baud rate
        if was_connected:
            await self.stop()

        self.config.baudrate = baudrate

        if was_connected:
            return await self.start()

        return True

    def get_baudrate(self) -> int:
        """Get current baud rate.

        Returns:
            Current baud rate
        """
        return self.config.baudrate

    # ==================== Callbacks ====================

    def on_connect(self, callback: Callable[[], None]) -> None:
        """Register connection callback.

        Args:
            callback: Callback function for connection events
        """
        self._connect_callback = callback

    def on_disconnect(self, callback: Callable[[], None]) -> None:
        """Register disconnection callback.

        Args:
            callback: Callback function for disconnection events
        """
        self._disconnect_callback = callback

    def on_data(self, callback: Callable[[bytes], None]) -> None:
        """Register data callback.

        Args:
            callback: Callback function for received data
        """
        self._data_callback = callback
