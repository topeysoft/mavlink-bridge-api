"""MAVLink message processor.

This module provides MAVLink message parsing, validation, filtering,
and command building using the pymavlink library.
"""

import asyncio
import logging
from datetime import datetime
from typing import Callable, Dict, List, Optional

from pymavlink import mavutil
from pymavlink.dialects.v20 import ardupilotmega as mav

from yardrover.core.events import EventBus
from yardrover.models.mavlink import (
    FirmwareType,
    MAVLinkMessage,
    MAVLinkStatistics,
    MessageFilter,
)

logger = logging.getLogger(__name__)


class MAVLinkProcessor:
    """MAVLink message processor using pymavlink.

    Handles message parsing, validation, filtering, statistics,
    and firmware detection. Integrates with EventBus for message broadcasting.
    """

    # System and component IDs for generated messages
    SOURCE_SYSTEM = 255
    SOURCE_COMPONENT = 0

    def __init__(self, event_bus: Optional[EventBus] = None) -> None:
        """Initialize MAVLink processor.

        Args:
            event_bus: Optional event bus for message broadcasting
        """
        self.event_bus = event_bus

        # Statistics and filtering
        self.stats = MAVLinkStatistics()
        self.message_filter = MessageFilter()

        # Sequence tracking (per system ID)
        self.expected_seq: Dict[int, int] = {}

        # Firmware detection
        self.firmware_type = FirmwareType.UNKNOWN
        self.heartbeat_count = 0

        # Callbacks
        self._message_callback: Optional[Callable[[MAVLinkMessage], None]] = None
        self._stats_callback: Optional[Callable[[MAVLinkStatistics], None]] = None

        # Stats logging
        self._stats_logging_enabled = False
        self._stats_logging_interval = 10.0  # seconds
        self._stats_task: Optional[asyncio.Task] = None

        # Create pymavlink parser (maintains state across calls)
        self._mav = mavutil.mavlink.MAVLink(
            file=None,
            srcSystem=self.SOURCE_SYSTEM,
            srcComponent=self.SOURCE_COMPONENT,
        )
        self._mav.robust_parsing = True  # Handle malformed messages gracefully

        logger.info("MAVLinkProcessor initialized")

    # ==================== Message Processing ====================

    def process_data(self, data: bytes) -> List[mav.MAVLink_message]:
        """Process incoming MAVLink data and extract messages.

        Uses pymavlink's stateful parser to extract complete messages from
        a stream of bytes. The parser handles message framing, CRC validation,
        and sequence tracking automatically.

        Args:
            data: Raw MAVLink data bytes

        Returns:
            List of parsed pymavlink message objects
        """
        messages = []

        self.stats.total_messages += 1  # Count data packets processed

        # Log incoming data for debugging
        if len(data) > 0:
            logger.debug(f"Processing {len(data)} bytes of MAVLink data (total packets: {self.stats.total_messages})")

        # Parse MAVLink messages from data using pymavlink's parser
        # Feed bytes to the stateful parser
        for byte in data:
            msg = self._parse_byte(byte)
            if msg:
                self.stats.valid_messages += 1
                messages.append(msg)

        return messages

    def _parse_byte(self, byte: int) -> Optional[mav.MAVLink_message]:
        """Parse a single byte of MAVLink data using pymavlink parser.

        The parser maintains state across calls, assembling complete messages
        from the byte stream. It handles MAVLink v1 and v2 framing automatically.

        Args:
            byte: Single byte to parse

        Returns:
            Complete MAVLink message or None if message not yet complete
        """
        try:
            # pymavlink's parse_char expects bytes (as a string in Python 2 style)
            # In Python 3, pass bytes directly
            msg = self._mav.parse_char(bytes([byte]))

            if msg is not None and msg.get_type() != 'BAD_DATA':
                return msg

        except Exception as e:
            # Handle parse errors (malformed data, bad CRC, etc.)
            self.stats.parse_errors += 1

            # Check for CRC errors specifically
            if "bad CRC" in str(e).lower() or "checksum" in str(e).lower():
                self.stats.crc_errors += 1
                logger.debug(f"CRC error: {e}")
            else:
                logger.debug(f"Parse error: {e}")

        return None

    async def process_message(self, msg: mav.MAVLink_message) -> None:
        """Process a parsed MAVLink message.

        Args:
            msg: pymavlink message object
        """
        # Update statistics
        self._update_statistics(msg)

        # Check sequence number
        self._handle_sequence_check(msg)

        # Filter message if filtering is enabled
        if self._should_filter_message(msg):
            logger.debug(
                f"Filtered message: sysid={msg.get_srcSystem()}, "
                f"compid={msg.get_srcComponent()}, msgid={msg.get_msgId()}"
            )
            return

        # Detect firmware from heartbeat
        if msg.get_type() == "HEARTBEAT":
            self._detect_firmware(msg)

        # Convert to our message format
        mavlink_msg = self._convert_message(msg)

        # Publish to event bus with full message data for WebSocket streaming
        if self.event_bus:
            # Extract message payload as dictionary
            payload_dict = self._extract_message_payload(msg)

            await self.event_bus.publish(
                "mavlink.message",
                {
                    "message_id": msg.get_msgId(),
                    "message_name": msg.get_type(),
                    "system_id": msg.get_srcSystem(),
                    "component_id": msg.get_srcComponent(),
                    "payload": payload_dict,
                    "timestamp": datetime.now().isoformat(),
                },
            )

        # Call message callback
        if self._message_callback:
            try:
                if asyncio.iscoroutinefunction(self._message_callback):
                    await self._message_callback(mavlink_msg)
                else:
                    self._message_callback(mavlink_msg)
            except Exception as e:
                logger.error(f"Error in message callback: {e}")

    def _convert_message(self, msg: mav.MAVLink_message) -> MAVLinkMessage:
        """Convert pymavlink message to our MAVLinkMessage model.

        Args:
            msg: pymavlink message object

        Returns:
            MAVLinkMessage model instance
        """
        # Pack the message to get raw bytes
        packed = msg.pack(mavutil.mavlink.MAVLink("", 255, 0))

        return MAVLinkMessage(
            magic=packed[0] if len(packed) > 0 else 0xFD,
            length=len(msg.get_payload()),
            incompat_flags=0,  # V2 flags
            compat_flags=0,  # V2 flags
            seq=msg.get_seq(),
            sysid=msg.get_srcSystem(),
            compid=msg.get_srcComponent(),
            msgid=msg.get_msgId(),
            payload=msg.get_payload().encode() if isinstance(msg.get_payload(), str) else msg.get_payload(),
            checksum=0,  # Calculated by pymavlink
            timestamp=datetime.now(),
            valid=True,
        )

    def _extract_message_payload(self, msg: mav.MAVLink_message) -> Dict[str, any]:
        """Extract message fields as a dictionary for JSON serialization.

        Uses pymavlink's introspection to extract all message fields
        with their values, suitable for WebSocket streaming.

        Args:
            msg: pymavlink message object

        Returns:
            Dictionary of field names to values
        """
        payload = {}

        # pymavlink messages have a fieldnames attribute with all field names
        if hasattr(msg, 'fieldnames'):
            for field_name in msg.fieldnames:
                try:
                    value = getattr(msg, field_name, None)

                    # Convert bytes to string for JSON serialization
                    if isinstance(value, bytes):
                        try:
                            # Try to decode as UTF-8, null-terminated string
                            value = value.decode('utf-8').rstrip('\x00')
                        except UnicodeDecodeError:
                            # If decode fails, convert to hex string
                            value = value.hex()

                    # Handle arrays/lists
                    elif isinstance(value, (list, tuple)):
                        value = list(value)

                    payload[field_name] = value

                except Exception as e:
                    logger.debug(f"Failed to extract field {field_name}: {e}")
                    payload[field_name] = None

        return payload

    # ==================== Filtering ====================

    def set_message_filter(self, message_filter: MessageFilter) -> None:
        """Set message filter configuration.

        Args:
            message_filter: Filter configuration
        """
        self.message_filter = message_filter
        logger.info(f"Message filter updated: {message_filter}")

    def get_message_filter(self) -> MessageFilter:
        """Get current message filter configuration.

        Returns:
            Current filter configuration
        """
        return self.message_filter

    def clear_message_filter(self) -> None:
        """Clear message filter (disable filtering)."""
        self.message_filter = MessageFilter(enable_filter=False)
        logger.info("Message filter cleared")

    def _should_filter_message(self, msg: mav.MAVLink_message) -> bool:
        """Check if message should be filtered out.

        Args:
            msg: MAVLink message

        Returns:
            True if message should be filtered
        """
        if not self.message_filter.enable_filter:
            return False

        # Filter by message ID
        if (
            self.message_filter.allowed_message_ids
            and msg.get_msgId() not in self.message_filter.allowed_message_ids
        ):
            return True

        # Filter by system ID
        if (
            self.message_filter.allowed_system_ids
            and msg.get_srcSystem() not in self.message_filter.allowed_system_ids
        ):
            return True

        # Filter by component ID
        if (
            self.message_filter.allowed_component_ids
            and msg.get_srcComponent()
            not in self.message_filter.allowed_component_ids
        ):
            return True

        return False

    # ==================== Statistics ====================

    def get_statistics(self) -> MAVLinkStatistics:
        """Get current statistics.

        Returns:
            Current statistics
        """
        return self.stats

    def reset_statistics(self) -> None:
        """Reset all statistics."""
        self.stats = MAVLinkStatistics(firmware_type=self.firmware_type)
        logger.info("Statistics reset")

    def _update_statistics(self, msg: mav.MAVLink_message) -> None:
        """Update statistics with processed message.

        Args:
            msg: Processed MAVLink message
        """
        self.stats.valid_messages += 1
        self.stats.last_update = datetime.now()

        # Count message types
        msgid = msg.get_msgId()
        self.stats.message_types[msgid] = self.stats.message_types.get(msgid, 0) + 1

    def _handle_sequence_check(self, msg: mav.MAVLink_message) -> None:
        """Check and track message sequence numbers.

        Args:
            msg: MAVLink message
        """
        sysid = msg.get_srcSystem()
        seq = msg.get_seq()

        if sysid not in self.expected_seq:
            # First message from this system
            self.expected_seq[sysid] = (seq + 1) % 256
            return

        expected = self.expected_seq[sysid]
        if seq != expected:
            self.stats.sequence_errors += 1
            logger.debug(
                f"Sequence error: sysid={sysid}, expected={expected}, got={seq}"
            )

        # Update expected sequence
        self.expected_seq[sysid] = (seq + 1) % 256

    # ==================== Firmware Detection ====================

    def _detect_firmware(self, msg: mav.MAVLink_message) -> None:
        """Detect firmware type from heartbeat message.

        Args:
            msg: HEARTBEAT message
        """
        self.heartbeat_count += 1

        # MAVLink heartbeat contains autopilot type
        if hasattr(msg, "autopilot"):
            autopilot = msg.autopilot

            # ArduPilot firmware
            if autopilot == mav.MAV_AUTOPILOT_ARDUPILOTMEGA:
                if self.firmware_type != FirmwareType.ARDUPILOT:
                    self.firmware_type = FirmwareType.ARDUPILOT
                    self.stats.firmware_type = FirmwareType.ARDUPILOT
                    logger.info("Detected ArduPilot firmware")

            # PX4 firmware
            elif autopilot == mav.MAV_AUTOPILOT_PX4:
                if self.firmware_type != FirmwareType.PX4:
                    self.firmware_type = FirmwareType.PX4
                    self.stats.firmware_type = FirmwareType.PX4
                    logger.info("Detected PX4 firmware")

            # Generic firmware
            elif autopilot == mav.MAV_AUTOPILOT_GENERIC:
                if self.firmware_type != FirmwareType.GENERIC:
                    self.firmware_type = FirmwareType.GENERIC
                    self.stats.firmware_type = FirmwareType.GENERIC
                    logger.info("Detected generic firmware")

    def get_firmware_type(self) -> str:
        """Get detected firmware type.

        Returns:
            Firmware type string
        """
        return self.firmware_type

    # ==================== Callbacks ====================

    def on_message(
        self, callback: Callable[[MAVLinkMessage], None]
    ) -> None:
        """Register message callback.

        Args:
            callback: Callback function for each message
        """
        self._message_callback = callback

    def on_statistics(
        self, callback: Callable[[MAVLinkStatistics], None]
    ) -> None:
        """Register statistics callback.

        Args:
            callback: Callback function for statistics updates
        """
        self._stats_callback = callback

    # ==================== Statistics Logging ====================

    async def start_stats_logging(self, interval_seconds: float = 10.0) -> None:
        """Start periodic statistics logging.

        Args:
            interval_seconds: Logging interval in seconds
        """
        if self._stats_logging_enabled:
            logger.warning("Statistics logging already enabled")
            return

        self._stats_logging_enabled = True
        self._stats_logging_interval = interval_seconds
        self._stats_task = asyncio.create_task(self._stats_logging_loop())
        logger.info(f"Statistics logging started (interval: {interval_seconds}s)")

    async def stop_stats_logging(self) -> None:
        """Stop periodic statistics logging."""
        if not self._stats_logging_enabled:
            return

        self._stats_logging_enabled = False
        if self._stats_task:
            self._stats_task.cancel()
            try:
                await self._stats_task
            except asyncio.CancelledError:
                pass
            self._stats_task = None

        logger.info("Statistics logging stopped")

    def is_stats_logging_enabled(self) -> bool:
        """Check if statistics logging is enabled.

        Returns:
            True if statistics logging is enabled
        """
        return self._stats_logging_enabled

    async def _stats_logging_loop(self) -> None:
        """Background task for periodic statistics logging."""
        while self._stats_logging_enabled:
            try:
                await asyncio.sleep(self._stats_logging_interval)
                self._log_statistics()
                if self._stats_callback:
                    if asyncio.iscoroutinefunction(self._stats_callback):
                        await self._stats_callback(self.stats)
                    else:
                        self._stats_callback(self.stats)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in stats logging: {e}")

    def _log_statistics(self) -> None:
        """Log current statistics."""
        logger.info(
            f"MAVLink Stats: total={self.stats.total_messages}, "
            f"valid={self.stats.valid_messages}, "
            f"crc_errors={self.stats.crc_errors}, "
            f"parse_errors={self.stats.parse_errors}, "
            f"seq_errors={self.stats.sequence_errors}, "
            f"firmware={self.firmware_type}"
        )

    # ==================== Command Building ====================

    @staticmethod
    def build_arm_disarm_command(
        target_system: int, target_component: int, arm: bool, force: bool = False
    ) -> mav.MAVLink_command_long_message:
        """Build arm/disarm command.

        Args:
            target_system: Target system ID
            target_component: Target component ID
            arm: True to arm, False to disarm
            force: Force arm/disarm

        Returns:
            MAVLink COMMAND_LONG message
        """
        return mav.MAVLink_command_long_message(
            target_system=target_system,
            target_component=target_component,
            command=mav.MAV_CMD_COMPONENT_ARM_DISARM,
            confirmation=0,
            param1=1.0 if arm else 0.0,
            param2=21196.0 if force else 0.0,  # Force magic number
            param3=0.0,
            param4=0.0,
            param5=0.0,
            param6=0.0,
            param7=0.0,
        )

    @staticmethod
    def build_set_mode_command(
        target_system: int, target_component: int, custom_mode: int, base_mode: int = 0
    ) -> mav.MAVLink_set_mode_message:
        """Build set mode command.

        Args:
            target_system: Target system ID
            target_component: Target component ID (unused in SET_MODE)
            custom_mode: Custom mode value
            base_mode: Base mode flags

        Returns:
            MAVLink SET_MODE message
        """
        return mav.MAVLink_set_mode_message(
            target_system=target_system,
            base_mode=base_mode,
            custom_mode=custom_mode,
        )

    @staticmethod
    def build_command_long(
        target_system: int,
        target_component: int,
        command: int,
        param1: float = 0.0,
        param2: float = 0.0,
        param3: float = 0.0,
        param4: float = 0.0,
        param5: float = 0.0,
        param6: float = 0.0,
        param7: float = 0.0,
    ) -> mav.MAVLink_command_long_message:
        """Build generic COMMAND_LONG message.

        Args:
            target_system: Target system ID
            target_component: Target component ID
            command: MAVLink command ID
            param1-7: Command parameters

        Returns:
            MAVLink COMMAND_LONG message
        """
        return mav.MAVLink_command_long_message(
            target_system=target_system,
            target_component=target_component,
            command=command,
            confirmation=0,
            param1=param1,
            param2=param2,
            param3=param3,
            param4=param4,
            param5=param5,
            param6=param6,
            param7=param7,
        )

    @staticmethod
    def build_parameter_request_read(
        target_system: int,
        target_component: int,
        param_id: str = "",
        param_index: int = -1,
    ) -> mav.MAVLink_param_request_read_message:
        """Build parameter request read message.

        Args:
            target_system: Target system ID
            target_component: Target component ID
            param_id: Parameter ID (name), empty if using index
            param_index: Parameter index, -1 if using param_id

        Returns:
            MAVLink PARAM_REQUEST_READ message
        """
        # Ensure param_id is null-terminated and max 16 chars
        param_id_bytes = param_id.encode("utf-8")[:16].ljust(16, b"\x00")

        return mav.MAVLink_param_request_read_message(
            target_system=target_system,
            target_component=target_component,
            param_id=param_id_bytes,
            param_index=param_index,
        )

    @staticmethod
    def build_parameter_request_list(
        target_system: int, target_component: int
    ) -> mav.MAVLink_param_request_list_message:
        """Build parameter request list message.

        Args:
            target_system: Target system ID
            target_component: Target component ID

        Returns:
            MAVLink PARAM_REQUEST_LIST message
        """
        return mav.MAVLink_param_request_list_message(
            target_system=target_system,
            target_component=target_component,
        )

    @staticmethod
    def build_parameter_set(
        target_system: int,
        target_component: int,
        param_id: str,
        param_value: float,
        param_type: int,
    ) -> mav.MAVLink_param_set_message:
        """Build parameter set message.

        Args:
            target_system: Target system ID
            target_component: Target component ID
            param_id: Parameter ID (name)
            param_value: Parameter value
            param_type: Parameter type (MAVParamType)

        Returns:
            MAVLink PARAM_SET message
        """
        # Ensure param_id is null-terminated and max 16 chars
        param_id_bytes = param_id.encode("utf-8")[:16].ljust(16, b"\x00")

        return mav.MAVLink_param_set_message(
            target_system=target_system,
            target_component=target_component,
            param_id=param_id_bytes,
            param_value=param_value,
            param_type=param_type,
        )

    # ==================== Mission Commands ====================

    @staticmethod
    def build_mission_count(
        target_system: int, target_component: int, count: int, mission_type: int = 0
    ) -> mav.MAVLink_mission_count_message:
        """Build mission count message.

        Args:
            target_system: Target system ID
            target_component: Target component ID
            count: Number of mission items
            mission_type: Mission type (0=waypoints, 1=fence, 2=rally)

        Returns:
            MAVLink MISSION_COUNT message
        """
        return mav.MAVLink_mission_count_message(
            target_system=target_system,
            target_component=target_component,
            count=count,
            mission_type=mission_type,
        )

    @staticmethod
    def build_mission_clear(
        target_system: int, target_component: int, mission_type: int = 0
    ) -> mav.MAVLink_mission_clear_all_message:
        """Build mission clear message.

        Args:
            target_system: Target system ID
            target_component: Target component ID
            mission_type: Mission type

        Returns:
            MAVLink MISSION_CLEAR_ALL message
        """
        return mav.MAVLink_mission_clear_all_message(
            target_system=target_system,
            target_component=target_component,
            mission_type=mission_type,
        )

    @staticmethod
    def build_mission_request_list(
        target_system: int, target_component: int, mission_type: int = 0
    ) -> mav.MAVLink_mission_request_list_message:
        """Build mission request list message.

        Args:
            target_system: Target system ID
            target_component: Target component ID
            mission_type: Mission type

        Returns:
            MAVLink MISSION_REQUEST_LIST message
        """
        return mav.MAVLink_mission_request_list_message(
            target_system=target_system,
            target_component=target_component,
            mission_type=mission_type,
        )

    @staticmethod
    def build_mission_set_current(
        target_system: int, target_component: int, seq: int
    ) -> mav.MAVLink_mission_set_current_message:
        """Build mission set current message.

        Args:
            target_system: Target system ID
            target_component: Target component ID
            seq: Mission item sequence number

        Returns:
            MAVLink MISSION_SET_CURRENT message
        """
        return mav.MAVLink_mission_set_current_message(
            target_system=target_system, target_component=target_component, seq=seq
        )

    # ==================== Utilities ====================

    @staticmethod
    def is_mavlink_data(data: bytes) -> bool:
        """Check if data starts with MAVLink magic byte.

        Args:
            data: Data to check

        Returns:
            True if data looks like MAVLink
        """
        if len(data) < 1:
            return False

        # MAVLink v2 magic byte is 0xFD
        # MAVLink v1 magic byte is 0xFE
        return data[0] in (0xFD, 0xFE)

    @staticmethod
    def serialize_message(msg: mav.MAVLink_message) -> bytes:
        """Serialize MAVLink message to bytes.

        Args:
            msg: MAVLink message to serialize

        Returns:
            Serialized message bytes
        """
        mav_conn = mavutil.mavlink.MAVLink("", 255, 0)
        return msg.pack(mav_conn)
