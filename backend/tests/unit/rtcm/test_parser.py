"""Unit tests for RTCM parser."""

import pytest
from yardrover.rtcm.parser import RTCMParser
from yardrover.models.rtcm import RTCMMessage


class TestRTCMParser:
    """Test RTCM3 message parser."""

    def test_init(self):
        """Test parser initialization."""
        parser = RTCMParser()
        assert parser._buffer == bytearray()

    def test_calculate_crc24(self):
        """Test CRC24Q calculation."""
        parser = RTCMParser()

        # Test with known data
        data = b"\xD3\x00\x03\x40\x00\x00"  # Header + minimal payload
        crc = parser._calculate_crc24(data)

        # CRC should be 24-bit value
        assert 0 <= crc <= 0xFFFFFF

    def test_validate_crc24_valid(self):
        """Test CRC24Q validation with valid checksum."""
        parser = RTCMParser()

        # Create message with valid CRC
        data = b"\xD3\x00\x03\x40\x00\x00"  # Header + minimal payload
        crc = parser._calculate_crc24(data)

        # Append CRC bytes (3 bytes, big-endian)
        complete_message = data + bytes([
            (crc >> 16) & 0xFF,
            (crc >> 8) & 0xFF,
            crc & 0xFF
        ])

        assert parser._validate_crc24(complete_message) is True

    def test_validate_crc24_invalid(self):
        """Test CRC24Q validation with invalid checksum."""
        parser = RTCMParser()

        # Message with wrong CRC
        data = b"\xD3\x00\x03\x40\x00\x00\x00\x00\x00"  # Wrong CRC

        assert parser._validate_crc24(data) is False

    def test_validate_crc24_too_short(self):
        """Test CRC validation with too-short data."""
        parser = RTCMParser()

        assert parser._validate_crc24(b"\xD3\x00") is False

    def test_find_message_start_found(self):
        """Test finding message start when preamble is present."""
        parser = RTCMParser()

        # Preamble at start
        assert parser.find_message_start(b"\xD3\x00\x00") == 0

        # Preamble after some junk data
        assert parser.find_message_start(b"\x00\x00\xD3\x00") == 2

    def test_find_message_start_not_found(self):
        """Test finding message start when no preamble."""
        parser = RTCMParser()

        assert parser.find_message_start(b"\x00\x00\x00") == -1

    def test_get_message_length_valid(self):
        """Test getting message length with valid header."""
        parser = RTCMParser()

        # Payload length = 3 bytes, total = 3 + 6 = 9
        data = b"\xD3\x00\x03\x40\x00\x00"
        assert parser.get_message_length(data) == 9

        # Payload length = 10 bytes, total = 10 + 6 = 16
        data = b"\xD3\x00\x0A\x40\x00\x00"
        assert parser.get_message_length(data) == 16

        # Test 10-bit length field (max 1023)
        # Bytes 1-2: 0x03FF = 0b0000001111111111 = 1023
        data = b"\xD3\x03\xFF\x40\x00\x00"
        assert parser.get_message_length(data) == 1029  # 1023 + 6

    def test_get_message_length_invalid(self):
        """Test getting message length with invalid data."""
        parser = RTCMParser()

        # Too short
        assert parser.get_message_length(b"\xD3") == 0

        # Wrong preamble
        assert parser.get_message_length(b"\x00\x00\x03") == 0

    def test_is_complete_message_complete(self):
        """Test checking for complete message when complete."""
        parser = RTCMParser()

        # Build complete message (payload length = 3)
        data = b"\xD3\x00\x03\x40\x00\x00"
        crc = parser._calculate_crc24(data)
        complete = data + bytes([(crc >> 16) & 0xFF, (crc >> 8) & 0xFF, crc & 0xFF])

        assert parser.is_complete_message(complete) is True

    def test_is_complete_message_incomplete(self):
        """Test checking for complete message when incomplete."""
        parser = RTCMParser()

        # Only header
        assert parser.is_complete_message(b"\xD3\x00\x03") is False

        # Header + partial payload
        assert parser.is_complete_message(b"\xD3\x00\x03\x40") is False

    def test_is_complete_message_wrong_preamble(self):
        """Test checking for complete message with wrong preamble."""
        parser = RTCMParser()

        assert parser.is_complete_message(b"\x00\x00\x03\x40\x00\x00") is False

    def test_extract_station_id_observation_message(self):
        """Test extracting station ID from observation message."""
        parser = RTCMParser()

        # Message type 1001 (GPS L1), station ID = 0x123 (291)
        # data[4]: low 4 bits of message type + high 4 bits of station ID
        # data[5]: low 8 bits of station ID
        # Station ID 0x123 = 0001 00100011
        data = b"\xD3\x00\x06\x3E\x91\x23\x00\x00\x00"  # type 1001, station 291

        station_id = parser._extract_station_id(data, 1001)
        assert station_id == 0x123

    def test_extract_station_id_position_message(self):
        """Test extracting station ID from position message."""
        parser = RTCMParser()

        # Message type 1005 (Stationary RTK reference), station ID = 0x456
        data = b"\xD3\x00\x06\x3E\xD4\x56\x00\x00\x00"  # type 1005, station 0x456

        station_id = parser._extract_station_id(data, 1005)
        assert station_id == 0x456

    def test_extract_station_id_too_short(self):
        """Test extracting station ID from too-short data."""
        parser = RTCMParser()

        station_id = parser._extract_station_id(b"\xD3\x00\x03", 1001)
        assert station_id is None

    def test_extract_timestamp_gps_message(self):
        """Test extracting timestamp from GPS message."""
        parser = RTCMParser()

        # Message type 1001, timestamp = 123456 ms
        # 30-bit timestamp starting at bit 24 (byte 6)
        # 123456 = 0x0001E240
        # Need 30 bits: 0x0001E240 << 2 = 0x00078900
        timestamp_val = 123456
        shifted = timestamp_val << 2

        data = bytearray(b"\xD3\x00\x0A\x3E\x90\x00")  # Header + type + station
        data.extend([
            (shifted >> 24) & 0xFF,  # Byte 6
            (shifted >> 16) & 0xFF,  # Byte 7
            (shifted >> 8) & 0xFF,   # Byte 8
            shifted & 0xFF           # Byte 9
        ])

        timestamp = parser._extract_timestamp(bytes(data), 1001)
        assert timestamp == timestamp_val

    def test_extract_timestamp_glonass_message(self):
        """Test extracting timestamp from GLONASS message."""
        parser = RTCMParser()

        # Message type 1009, timestamp = 234567 ms
        timestamp_val = 234567
        shifted = timestamp_val << 2

        data = bytearray(b"\xD3\x00\x0A\x3F\x10\x00")  # Header + type 1009 + station
        data.extend([
            (shifted >> 24) & 0xFF,
            (shifted >> 16) & 0xFF,
            (shifted >> 8) & 0xFF,
            shifted & 0xFF
        ])

        timestamp = parser._extract_timestamp(bytes(data), 1009)
        assert timestamp == timestamp_val

    def test_extract_timestamp_non_observation(self):
        """Test extracting timestamp from non-observation message."""
        parser = RTCMParser()

        # Message type 1005 (position, not observation)
        data = b"\xD3\x00\x0A\x3E\xD0\x00\x00\x00\x00\x00"

        timestamp = parser._extract_timestamp(data, 1005)
        assert timestamp is None

    def test_is_position_message(self):
        """Test position message detection."""
        assert RTCMParser._is_position_message(1005) is True
        assert RTCMParser._is_position_message(1006) is True
        assert RTCMParser._is_position_message(1001) is False

    def test_is_msm_message(self):
        """Test MSM message detection."""
        assert RTCMParser._is_msm_message(1071) is True
        assert RTCMParser._is_msm_message(1100) is True
        assert RTCMParser._is_msm_message(1127) is True
        assert RTCMParser._is_msm_message(1001) is False
        assert RTCMParser._is_msm_message(1128) is False

    def test_is_observation_message(self):
        """Test observation message detection."""
        # GPS L1/L2
        assert RTCMParser._is_observation_message(1001) is True
        assert RTCMParser._is_observation_message(1004) is True

        # GLONASS
        assert RTCMParser._is_observation_message(1009) is True
        assert RTCMParser._is_observation_message(1012) is True

        # MSM
        assert RTCMParser._is_observation_message(1077) is True

        # Not observation
        assert RTCMParser._is_observation_message(1005) is False

    def test_parse_message_valid(self):
        """Test parsing a valid RTCM message."""
        parser = RTCMParser()

        # Build message: type 1005, station 123
        payload = b"\x3E\xD0\x7B\x00\x00\x00"  # Type 1005, station 123, padding

        # Build header: preamble + length
        header = bytes([0xD3, 0x00, len(payload)])

        # Calculate CRC
        data_for_crc = header + payload
        crc = parser._calculate_crc24(data_for_crc)

        # Complete message
        message_data = data_for_crc + bytes([
            (crc >> 16) & 0xFF,
            (crc >> 8) & 0xFF,
            crc & 0xFF
        ])

        result = parser.parse_message(message_data)

        assert result is not None
        assert result.message_type == 1005
        assert result.station_id == 123
        assert result.payload_length == len(payload)
        assert result.total_length == len(message_data)

    def test_parse_message_too_short(self):
        """Test parsing message with insufficient data."""
        parser = RTCMParser()

        result = parser.parse_message(b"\xD3\x00")
        assert result is None

    def test_parse_message_wrong_preamble(self):
        """Test parsing message with wrong preamble."""
        parser = RTCMParser()

        result = parser.parse_message(b"\x00\x00\x03\x40\x00\x00\x00\x00\x00")
        assert result is None

    def test_parse_message_invalid_crc(self):
        """Test parsing message with invalid CRC."""
        parser = RTCMParser()

        # Message with wrong CRC
        data = b"\xD3\x00\x03\x40\x00\x00\x00\x00\x00"  # Wrong CRC

        result = parser.parse_message(data)
        assert result is None

    def test_parse_message_incomplete(self):
        """Test parsing incomplete message."""
        parser = RTCMParser()

        # Header says 10 bytes payload, but only 3 provided
        data = b"\xD3\x00\x0A\x40\x00\x00"

        result = parser.parse_message(data)
        assert result is None

    def test_add_data_single_complete_message(self):
        """Test adding data with single complete message."""
        parser = RTCMParser()

        # Build complete message
        payload = b"\x3E\xD0\x7B\x00\x00\x00"
        header = bytes([0xD3, 0x00, len(payload)])
        data_for_crc = header + payload
        crc = parser._calculate_crc24(data_for_crc)
        message_data = data_for_crc + bytes([
            (crc >> 16) & 0xFF,
            (crc >> 8) & 0xFF,
            crc & 0xFF
        ])

        messages = parser.add_data(message_data)

        assert len(messages) == 1
        assert messages[0].message_type == 1005
        assert len(parser._buffer) == 0  # Buffer should be empty

    def test_add_data_multiple_messages(self):
        """Test adding data with multiple complete messages."""
        parser = RTCMParser()

        # Build two messages
        messages_data = b""
        for station_id in [100, 200]:
            payload = bytes([0x3E, 0xD0, station_id, 0x00, 0x00, 0x00])
            header = bytes([0xD3, 0x00, len(payload)])
            data_for_crc = header + payload
            crc = parser._calculate_crc24(data_for_crc)
            messages_data += data_for_crc + bytes([
                (crc >> 16) & 0xFF,
                (crc >> 8) & 0xFF,
                crc & 0xFF
            ])

        messages = parser.add_data(messages_data)

        assert len(messages) == 2
        assert messages[0].station_id == 100
        assert messages[1].station_id == 200

    def test_add_data_incomplete_message(self):
        """Test adding incomplete message data."""
        parser = RTCMParser()

        # Only header, no payload
        data = b"\xD3\x00\x06"

        messages = parser.add_data(data)

        assert len(messages) == 0
        assert len(parser._buffer) == 3  # Data waiting in buffer

    def test_add_data_with_junk_before(self):
        """Test adding data with junk bytes before message."""
        parser = RTCMParser()

        # Build message with junk before it
        payload = b"\x3E\xD0\x7B\x00\x00\x00"
        header = bytes([0xD3, 0x00, len(payload)])
        data_for_crc = header + payload
        crc = parser._calculate_crc24(data_for_crc)
        message_data = data_for_crc + bytes([
            (crc >> 16) & 0xFF,
            (crc >> 8) & 0xFF,
            crc & 0xFF
        ])

        # Add junk before message
        data_with_junk = b"\x00\x00\xFF\xFF" + message_data

        messages = parser.add_data(data_with_junk)

        assert len(messages) == 1
        assert messages[0].message_type == 1005

    def test_add_data_incremental(self):
        """Test adding data incrementally (streaming)."""
        parser = RTCMParser()

        # Build complete message
        payload = b"\x3E\xD0\x7B\x00\x00\x00"
        header = bytes([0xD3, 0x00, len(payload)])
        data_for_crc = header + payload
        crc = parser._calculate_crc24(data_for_crc)
        message_data = data_for_crc + bytes([
            (crc >> 16) & 0xFF,
            (crc >> 8) & 0xFF,
            crc & 0xFF
        ])

        # Add data in chunks
        messages1 = parser.add_data(message_data[:5])
        messages2 = parser.add_data(message_data[5:])

        assert len(messages1) == 0  # Incomplete
        assert len(messages2) == 1  # Complete after second chunk
        assert messages2[0].message_type == 1005

    def test_add_data_invalid_message_skipped(self):
        """Test that invalid messages are skipped."""
        parser = RTCMParser()

        # Message with invalid CRC followed by valid message
        invalid = b"\xD3\x00\x03\x40\x00\x00\x00\x00\x00"

        # Valid message
        payload = b"\x3E\xD0\x7B\x00\x00\x00"
        header = bytes([0xD3, 0x00, len(payload)])
        data_for_crc = header + payload
        crc = parser._calculate_crc24(data_for_crc)
        valid = data_for_crc + bytes([
            (crc >> 16) & 0xFF,
            (crc >> 8) & 0xFF,
            crc & 0xFF
        ])

        messages = parser.add_data(invalid + valid)

        # Should skip invalid and parse valid
        assert len(messages) == 1
        assert messages[0].message_type == 1005

    def test_add_data_buffer_limit(self):
        """Test buffer size limiting to prevent memory issues."""
        parser = RTCMParser()

        # Add lots of junk data (no valid preamble)
        junk_data = b"\xFF" * 5000

        messages = parser.add_data(junk_data)

        assert len(messages) == 0
        # Buffer should be limited to 2048 bytes (from last 2048 of 5000)
        assert len(parser._buffer) <= 2048

    def test_reset(self):
        """Test resetting parser buffer."""
        parser = RTCMParser()

        # Add some data
        parser.add_data(b"\xD3\x00\x03")
        assert len(parser._buffer) > 0

        # Reset
        parser.reset()
        assert len(parser._buffer) == 0
