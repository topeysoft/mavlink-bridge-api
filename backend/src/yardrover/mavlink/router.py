"""MAVLink data router.

This module integrates serial communication with MAVLink processing,
routing messages between serial ports and the application layer.
"""

import asyncio
import logging
from datetime import datetime
from typing import Callable, Optional

from pymavlink.dialects.v20 import ardupilotmega as mav

from yardrover.core.events import EventBus
from yardrover.mavlink.processor import MAVLinkProcessor
from yardrover.mavlink.serial import SerialManager
from yardrover.models.mavlink import MessageFilter, SerialConfig

logger = logging.getLogger(__name__)


class RouteStatistics:
    """Data router statistics."""

    def __init__(self) -> None:
        """Initialize statistics."""
        self.upstream_bytes: int = 0  # Bytes from serial to app
        self.downstream_bytes: int = 0  # Bytes from app to serial
        self.upstream_packets: int = 0
        self.downstream_packets: int = 0
        self.upstream_rate: float = 0.0  # bytes/sec
        self.downstream_rate: float = 0.0  # bytes/sec
        self.last_update: datetime = datetime.now()


class DataRouter:
    """Routes MAVLink data between serial port and application.

    Integrates SerialManager and MAVLinkProcessor to provide seamless
    MAVLink communication with message filtering and statistics.
    """

    def __init__(
        self,
        serial_config: SerialConfig,
        event_bus: Optional[EventBus] = None,
    ) -> None:
        """Initialize data router.

        Args:
            serial_config: Serial port configuration
            event_bus: Optional event bus for broadcasting events
        """
        self.event_bus = event_bus

        # Create serial manager and MAVLink processor
        self.serial_manager = SerialManager(serial_config, event_bus)
        self.mavlink_processor = MAVLinkProcessor(event_bus)

        # Statistics
        self.stats = RouteStatistics()
        self._stats_task: Optional[asyncio.Task] = None

        # MAVLink processing control
        self.mavlink_processing_enabled = True

        # Callbacks
        self._message_callback: Optional[Callable[[mav.MAVLink_message], None]] = None

        # Wire up serial data callback
        self.serial_manager.on_data(self._handle_serial_data)

        logger.info("DataRouter initialized")

    # ==================== Lifecycle ====================

    async def start(self) -> bool:
        """Start router and serial communication.

        Returns:
            True if successfully started
        """
        logger.info("Starting DataRouter...")

        # Start serial manager
        if not await self.serial_manager.start():
            logger.error("Failed to start serial manager")
            return False

        # Start statistics task
        self._stats_task = asyncio.create_task(self._stats_loop())

        logger.info("DataRouter started")
        return True

    async def stop(self) -> None:
        """Stop router and serial communication."""
        logger.info("Stopping DataRouter...")

        # Stop statistics task
        if self._stats_task:
            self._stats_task.cancel()
            try:
                await self._stats_task
            except asyncio.CancelledError:
                pass

        # Stop serial manager
        await self.serial_manager.stop()

        logger.info("DataRouter stopped")

    def is_connected(self) -> bool:
        """Check if router is connected.

        Returns:
            True if serial port is connected
        """
        return self.serial_manager.is_connected()

    # ==================== Data Routing ====================

    async def _handle_serial_data(self, data: bytes) -> None:
        """Handle data received from serial port.

        Args:
            data: Raw serial data
        """
        # Update upstream statistics
        self.stats.upstream_bytes += len(data)
        self.stats.upstream_packets += 1

        # Process through MAVLink if enabled
        if self.mavlink_processing_enabled:
            await self._process_mavlink_data(data)
        else:
            # Pass raw data through
            if self.event_bus:
                await self.event_bus.publish(
                    "mavlink.raw_data",
                    {"data": data.hex(), "direction": "upstream"},
                )

    async def _process_mavlink_data(self, data: bytes) -> None:
        """Process data through MAVLink processor.

        Parses incoming data using the MAVLink processor's stateful parser,
        which handles message framing, CRC validation, and extraction.
        Each complete message is processed and broadcast via the event bus.

        Args:
            data: Raw MAVLink data
        """
        try:
            # Use processor's stateful parser to extract complete messages
            messages = self.mavlink_processor.process_data(data)

            # Process each extracted message
            for msg in messages:
                # Process message (updates stats, filters, publishes to event bus)
                await self.mavlink_processor.process_message(msg)

                # Call message callback if registered
                if self._message_callback:
                    try:
                        if asyncio.iscoroutinefunction(self._message_callback):
                            await self._message_callback(msg)
                        else:
                            self._message_callback(msg)
                    except Exception as e:
                        logger.error(f"Error in message callback: {e}")

        except Exception as e:
            logger.error(f"Error processing MAVLink data: {e}", exc_info=True)

    async def send_to_serial(self, data: bytes) -> int:
        """Send data to serial port (downstream).

        Args:
            data: Data to send

        Returns:
            Number of bytes written

        Raises:
            RuntimeError: If serial port not connected
        """
        bytes_written = await self.serial_manager.write(data)

        # Update downstream statistics
        self.stats.downstream_bytes += bytes_written
        self.stats.downstream_packets += 1

        return bytes_written

    async def send_mavlink_message(self, msg: mav.MAVLink_message) -> None:
        """Send MAVLink message to serial port.

        Args:
            msg: MAVLink message to send
        """
        # Serialize message
        data = MAVLinkProcessor.serialize_message(msg)

        # Send to serial
        await self.send_to_serial(data)

        # Publish event
        if self.event_bus:
            await self.event_bus.publish(
                "mavlink.message_sent",
                {
                    "msgid": msg.get_msgId(),
                    "target_system": (
                        msg.target_system if hasattr(msg, "target_system") else None
                    ),
                    "target_component": (
                        msg.target_component
                        if hasattr(msg, "target_component")
                        else None
                    ),
                },
            )

    # ==================== MAVLink Processing Control ====================

    def enable_mavlink_processing(self, enable: bool) -> None:
        """Enable or disable MAVLink processing.

        Args:
            enable: True to enable MAVLink processing
        """
        self.mavlink_processing_enabled = enable
        logger.info(f"MAVLink processing {'enabled' if enable else 'disabled'}")

    def is_mavlink_processing_enabled(self) -> bool:
        """Check if MAVLink processing is enabled.

        Returns:
            True if MAVLink processing is enabled
        """
        return self.mavlink_processing_enabled

    def set_mavlink_filter(self, message_filter: MessageFilter) -> None:
        """Set MAVLink message filter.

        Args:
            message_filter: Message filter configuration
        """
        self.mavlink_processor.set_message_filter(message_filter)

    def get_mavlink_filter(self) -> MessageFilter:
        """Get current MAVLink message filter.

        Returns:
            Current message filter
        """
        return self.mavlink_processor.get_message_filter()

    # ==================== Statistics ====================

    def get_statistics(self) -> RouteStatistics:
        """Get current routing statistics.

        Returns:
            Current statistics
        """
        return self.stats

    def get_mavlink_statistics(self):
        """Get MAVLink processor statistics.

        Returns:
            MAVLink statistics
        """
        return self.mavlink_processor.get_statistics()

    def get_serial_statistics(self):
        """Get serial communication statistics.

        Returns:
            Serial statistics
        """
        return self.serial_manager.get_statistics()

    def reset_statistics(self) -> None:
        """Reset all statistics."""
        self.stats = RouteStatistics()
        self.mavlink_processor.reset_statistics()
        self.serial_manager.reset_statistics()
        logger.info("All statistics reset")

    async def _stats_loop(self) -> None:
        """Background task for updating statistics."""
        last_upstream = 0
        last_downstream = 0
        last_update = datetime.now()

        while True:
            try:
                await asyncio.sleep(1.0)  # Update every second

                now = datetime.now()
                delta = (now - last_update).total_seconds()

                if delta > 0:
                    # Calculate data rates (bytes/sec)
                    upstream_bytes = self.stats.upstream_bytes - last_upstream
                    downstream_bytes = self.stats.downstream_bytes - last_downstream

                    self.stats.upstream_rate = upstream_bytes / delta
                    self.stats.downstream_rate = downstream_bytes / delta

                    # Update last values
                    last_upstream = self.stats.upstream_bytes
                    last_downstream = self.stats.downstream_bytes
                    last_update = now
                    self.stats.last_update = now

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error updating router statistics: {e}")

    # ==================== Callbacks ====================

    def on_message(self, callback: Callable[[mav.MAVLink_message], None]) -> None:
        """Register callback for parsed MAVLink messages.

        Args:
            callback: Callback function for each message
        """
        self._message_callback = callback
        # Also register with processor
        self.mavlink_processor.on_message(callback)

    # ==================== Serial Control ====================

    async def detect_baudrate(self) -> Optional[int]:
        """Auto-detect serial baud rate.

        Returns:
            Detected baud rate or None
        """
        return await self.serial_manager.detect_baudrate()

    async def set_baudrate(self, baudrate: int) -> bool:
        """Set serial baud rate.

        Args:
            baudrate: New baud rate

        Returns:
            True if successful
        """
        return await self.serial_manager.set_baudrate(baudrate)

    def get_baudrate(self) -> int:
        """Get current baud rate.

        Returns:
            Current baud rate
        """
        return self.serial_manager.get_baudrate()

    async def detect_mavlink(self) -> bool:
        """Detect if MAVLink traffic is present.

        Returns:
            True if MAVLink detected
        """
        return await self.serial_manager.detect_mavlink()

    # ==================== Convenience Methods ====================

    def get_firmware_type(self) -> str:
        """Get detected firmware type from MAVLink processor.

        Returns:
            Firmware type string
        """
        return self.mavlink_processor.get_firmware_type()

    async def start_stats_logging(self, interval_seconds: float = 10.0) -> None:
        """Start periodic statistics logging.

        Args:
            interval_seconds: Logging interval
        """
        await self.mavlink_processor.start_stats_logging(interval_seconds)

    async def stop_stats_logging(self) -> None:
        """Stop periodic statistics logging."""
        await self.mavlink_processor.stop_stats_logging()
