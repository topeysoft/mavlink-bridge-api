"""RTCM3 protocol message parser.

Based on C++ implementation in lib/rtcm/RTCMParser/RTCMParser.cpp
RTCM3 Protocol: Radio Technical Commission for Maritime Services Version 3

Message format:
    Byte 0:      Preamble (0xD3)
    Bytes 1-2:   Reserved (6 bits) + Length (10 bits)
    Bytes 3+:    Payload
    Last 3:      CRC24Q

This implementation provides:
- Message boundary detection (preamble scanning)
- Message length extraction
- Basic message type and station ID parsing
- CRC24Q validation
- Message metadata extraction
"""

import struct
from typing import Optional

from yardrover.models.rtcm import RTCMMessage, get_message_type_name


class RTCMParser:
    """RTCM3 message parser.

    This parser handles RTCM3 binary protocol messages, extracting message type,
    station ID, timestamp, and payload data. It validates message structure
    and CRC checksums.
    """

    PREAMBLE = 0xD3
    MIN_MESSAGE_LENGTH = 6  # Header (3) + minimal payload + CRC (3)
    MAX_PAYLOAD_LENGTH = 1023  # 10-bit length field max

    # CRC24Q polynomial (RTCM3 standard)
    CRC24_POLY = 0x1864CFB

    def __init__(self) -> None:
        """Initialize RTCM parser."""
        self._buffer = bytearray()

    def parse_message(self, data: bytes) -> Optional[RTCMMessage]:
        """Parse a complete RTCM message from data.

        Args:
            data: Raw bytes containing RTCM message

        Returns:
            Parsed RTCMMessage or None if invalid
        """
        if len(data) < self.MIN_MESSAGE_LENGTH:
            return None

        # Check preamble
        if data[0] != self.PREAMBLE:
            return None

        # Extract payload length (10 bits from bytes 1-2)
        # Byte 1: reserved (6 bits) | length high (2 bits)
        # Byte 2: length low (8 bits)
        payload_length = ((data[1] & 0x03) << 8) | data[2]
        total_length = payload_length + 6  # header(3) + payload + CRC(3)

        if len(data) < total_length:
            return None

        # Validate CRC
        if not self._validate_crc24(data[:total_length]):
            return None

        # Extract message type (12 bits from payload start)
        message_type = (data[3] << 4) | (data[4] >> 4)

        # Extract payload (everything between header and CRC)
        payload = bytes(data[3:3 + payload_length])

        # Try to extract station ID and timestamp
        station_id = self._extract_station_id(data, message_type)
        timestamp = self._extract_timestamp(data, message_type)

        return RTCMMessage(
            message_type=message_type,
            station_id=station_id,
            timestamp=timestamp,
            payload=payload,
            payload_length=payload_length,
            total_length=total_length
        )

    def find_message_start(self, buffer: bytes) -> int:
        """Find the start of an RTCM message in a buffer.

        Args:
            buffer: Buffer to search

        Returns:
            Index of preamble byte, or -1 if not found
        """
        try:
            return buffer.index(self.PREAMBLE)
        except ValueError:
            return -1

    def is_complete_message(self, buffer: bytes) -> bool:
        """Check if buffer contains a complete RTCM message.

        Args:
            buffer: Buffer to check

        Returns:
            True if complete message is present
        """
        if len(buffer) < 3:
            return False

        if buffer[0] != self.PREAMBLE:
            return False

        payload_length = ((buffer[1] & 0x03) << 8) | buffer[2]
        total_length = payload_length + 6

        return len(buffer) >= total_length

    def get_message_length(self, data: bytes) -> int:
        """Get the total length of an RTCM message.

        Args:
            data: Data starting with RTCM preamble

        Returns:
            Total message length in bytes, or 0 if invalid
        """
        if len(data) < 3:
            return 0

        if data[0] != self.PREAMBLE:
            return 0

        payload_length = ((data[1] & 0x03) << 8) | data[2]
        return payload_length + 6

    def add_data(self, data: bytes) -> list[RTCMMessage]:
        """Add data to parser buffer and extract complete messages.

        This method handles incremental parsing when data arrives in chunks.
        It maintains an internal buffer and extracts complete messages as they
        become available.

        Args:
            data: New data bytes to parse

        Returns:
            List of parsed RTCMMessage objects
        """
        self._buffer.extend(data)
        messages: list[RTCMMessage] = []

        while len(self._buffer) >= self.MIN_MESSAGE_LENGTH:
            # Find message start
            start = self.find_message_start(bytes(self._buffer))
            if start == -1:
                # No preamble found, clear buffer
                self._buffer.clear()
                break

            # Remove any data before preamble
            if start > 0:
                del self._buffer[:start]

            # Check if we have enough data for length field
            if len(self._buffer) < 3:
                break

            # Get expected message length
            msg_length = self.get_message_length(bytes(self._buffer))
            if msg_length == 0:
                # Invalid message, skip preamble
                del self._buffer[0]
                continue

            # Wait for complete message
            if len(self._buffer) < msg_length:
                break

            # Extract and parse message
            msg_data = bytes(self._buffer[:msg_length])
            message = self.parse_message(msg_data)

            if message:
                messages.append(message)
                # Remove parsed message from buffer
                del self._buffer[:msg_length]
            else:
                # Invalid message, skip preamble
                del self._buffer[0]

        # Limit buffer size to prevent memory issues
        if len(self._buffer) > 4096:
            self._buffer = self._buffer[-2048:]

        return messages

    def reset(self) -> None:
        """Clear the parser buffer."""
        self._buffer.clear()

    # ========================================================================
    # Private Methods
    # ========================================================================

    def _validate_crc24(self, data: bytes) -> bool:
        """Validate RTCM3 CRC24Q checksum.

        Args:
            data: Complete message including CRC

        Returns:
            True if CRC is valid
        """
        if len(data) < 6:
            return False

        # CRC is last 3 bytes
        message_crc = (data[-3] << 16) | (data[-2] << 8) | data[-1]

        # Calculate CRC on everything except the CRC itself
        calculated_crc = self._calculate_crc24(data[:-3])

        return message_crc == calculated_crc

    def _calculate_crc24(self, data: bytes) -> int:
        """Calculate RTCM3 CRC24Q checksum.

        Uses CRC-24Q polynomial: 0x1864CFB

        Args:
            data: Data to calculate CRC for

        Returns:
            24-bit CRC value
        """
        crc = 0

        for byte in data:
            crc ^= byte << 16

            for _ in range(8):
                crc <<= 1
                if crc & 0x1000000:  # Check if bit 24 is set
                    crc ^= self.CRC24_POLY

        return crc & 0xFFFFFF  # Keep only 24 bits

    def _extract_station_id(self, data: bytes, message_type: int) -> Optional[int]:
        """Extract station ID from RTCM message.

        Station ID location varies by message type, but is typically at bits 12-23
        of the payload (12 bits, allowing 0-4095).

        Args:
            data: Complete message data
            message_type: RTCM message type

        Returns:
            Station ID (0-4095) or None if not extractable
        """
        if len(data) < 7:
            return None

        # For most observation and position messages, station ID is in the same location
        # Bits 12-23 of payload = bits 4-15 of data[4:6]
        # data[4]: bits 0-3 are message type low bits, bits 4-7 are station ID high bits
        # data[5]: bits 0-7 are station ID low bits
        if self._is_observation_message(message_type) or self._is_position_message(message_type):
            station_id = ((data[4] & 0x0F) << 8) | data[5]
            return station_id

        return None

    def _extract_timestamp(self, data: bytes, message_type: int) -> Optional[int]:
        """Extract GPS timestamp from RTCM message.

        Timestamp format varies by message type. GPS messages typically contain
        GPS Time of Week (TOW) in milliseconds (30 bits).

        Args:
            data: Complete message data
            message_type: RTCM message type

        Returns:
            Timestamp in milliseconds or None if not extractable
        """
        if not self._is_observation_message(message_type):
            return None

        # GPS L1/L2 messages (1001-1004)
        if 1001 <= message_type <= 1004:
            if len(data) < 10:
                return None
            # 30-bit TOW starts at bit 24 (byte 6 bit 0)
            # Bytes 6-9 contain the timestamp
            timestamp = ((data[6] << 22) | (data[7] << 14) | (data[8] << 6) | (data[9] >> 2)) & 0x3FFFFFFF
            return timestamp

        # GLONASS messages (1009-1012)
        elif 1009 <= message_type <= 1012:
            if len(data) < 10:
                return None
            # Similar structure to GPS
            timestamp = ((data[6] << 22) | (data[7] << 14) | (data[8] << 6) | (data[9] >> 2)) & 0x3FFFFFFF
            return timestamp

        # MSM messages have different structure (more complex, simplified here)
        elif self._is_msm_message(message_type):
            if len(data) < 13:
                return None
            # Simplified extraction - actual MSM parsing is more complex
            timestamp = ((data[9] << 22) | (data[10] << 14) | (data[11] << 6) | (data[12] >> 2)) & 0x3FFFFFFF
            return timestamp

        return None

    @staticmethod
    def _is_position_message(message_type: int) -> bool:
        """Check if message is a position message (1005, 1006)."""
        return message_type in (1005, 1006)

    @staticmethod
    def _is_msm_message(message_type: int) -> bool:
        """Check if message is a Multi-Signal Message (MSM)."""
        return 1071 <= message_type <= 1127

    @staticmethod
    def _is_observation_message(message_type: int) -> bool:
        """Check if message is an observation message."""
        return (
            (1001 <= message_type <= 1004) or
            (1009 <= message_type <= 1012) or
            RTCMParser._is_msm_message(message_type)
        )
