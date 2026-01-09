"""Tests for MAVLink processor."""

import pytest
from pymavlink.dialects.v20 import ardupilotmega as mav

from yardrover.mavlink.processor import MAVLinkProcessor
from yardrover.models.mavlink import FirmwareType, MessageFilter


class TestMAVLinkProcessor:
    """Test MAVLinkProcessor class."""

    @pytest.fixture
    def processor(self):
        """Create MAVLinkProcessor instance."""
        return MAVLinkProcessor()

    def test_initialization(self, processor):
        """Test processor initialization."""
        assert processor is not None
        assert processor.firmware_type == FirmwareType.UNKNOWN
        assert processor.heartbeat_count == 0
        assert processor.stats.total_messages == 0

    def test_message_filter_management(self, processor):
        """Test message filter get/set/clear."""
        # Set filter
        filter_config = MessageFilter(
            allowed_message_ids=[0, 1, 2],
            allowed_system_ids=[1],
            enable_filter=True,
        )
        processor.set_message_filter(filter_config)

        # Get filter
        current_filter = processor.get_message_filter()
        assert current_filter.enable_filter is True
        assert current_filter.allowed_message_ids == [0, 1, 2]
        assert current_filter.allowed_system_ids == [1]

        # Clear filter
        processor.clear_message_filter()
        cleared_filter = processor.get_message_filter()
        assert cleared_filter.enable_filter is False

    def test_statistics_reset(self, processor):
        """Test statistics reset."""
        # Modify statistics
        processor.stats.total_messages = 100
        processor.stats.valid_messages = 90
        processor.stats.crc_errors = 5

        # Reset
        processor.reset_statistics()

        # Verify reset
        assert processor.stats.total_messages == 0
        assert processor.stats.valid_messages == 0
        assert processor.stats.crc_errors == 0

    def test_get_firmware_type(self, processor):
        """Test firmware type getter."""
        assert processor.get_firmware_type() == FirmwareType.UNKNOWN

        # Simulate firmware detection
        processor.firmware_type = FirmwareType.ARDUPILOT
        assert processor.get_firmware_type() == FirmwareType.ARDUPILOT

    def test_is_mavlink_data(self):
        """Test MAVLink data detection."""
        # Valid MAVLink v2 header
        valid_v2 = bytes([0xFD, 0x09, 0x00])
        assert MAVLinkProcessor.is_mavlink_data(valid_v2) is True

        # Valid MAVLink v1 header
        valid_v1 = bytes([0xFE, 0x09, 0x00])
        assert MAVLinkProcessor.is_mavlink_data(valid_v1) is True

        # Invalid data
        invalid = bytes([0x00, 0x01, 0x02])
        assert MAVLinkProcessor.is_mavlink_data(invalid) is False

        # Empty data
        empty = bytes([])
        assert MAVLinkProcessor.is_mavlink_data(empty) is False

    def test_build_arm_disarm_command(self):
        """Test arm/disarm command building."""
        # Arm command
        arm_msg = MAVLinkProcessor.build_arm_disarm_command(
            target_system=1,
            target_component=1,
            arm=True,
            force=False,
        )
        assert arm_msg is not None
        assert arm_msg.target_system == 1
        assert arm_msg.target_component == 1
        assert arm_msg.command == mav.MAV_CMD_COMPONENT_ARM_DISARM
        assert arm_msg.param1 == 1.0  # Arm

        # Disarm command
        disarm_msg = MAVLinkProcessor.build_arm_disarm_command(
            target_system=1,
            target_component=1,
            arm=False,
            force=False,
        )
        assert disarm_msg.param1 == 0.0  # Disarm

        # Force arm
        force_arm_msg = MAVLinkProcessor.build_arm_disarm_command(
            target_system=1,
            target_component=1,
            arm=True,
            force=True,
        )
        assert force_arm_msg.param2 == 21196.0  # Force magic number

    def test_build_set_mode_command(self):
        """Test set mode command building."""
        msg = MAVLinkProcessor.build_set_mode_command(
            target_system=1,
            target_component=1,
            custom_mode=4,  # GUIDED mode for ArduPilot
            base_mode=0,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.custom_mode == 4
        assert msg.base_mode == 0

    def test_build_command_long(self):
        """Test generic COMMAND_LONG building."""
        msg = MAVLinkProcessor.build_command_long(
            target_system=1,
            target_component=1,
            command=400,  # MAV_CMD_COMPONENT_ARM_DISARM
            param1=1.0,
            param2=0.0,
            param3=0.0,
            param4=0.0,
            param5=0.0,
            param6=0.0,
            param7=0.0,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.target_component == 1
        assert msg.command == 400
        assert msg.param1 == 1.0

    def test_build_parameter_request_read(self):
        """Test parameter request read command."""
        # Request by name
        msg = MAVLinkProcessor.build_parameter_request_read(
            target_system=1,
            target_component=1,
            param_id="SYSID_THISMAV",
            param_index=-1,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.param_index == -1

        # Request by index
        msg_idx = MAVLinkProcessor.build_parameter_request_read(
            target_system=1,
            target_component=1,
            param_id="",
            param_index=0,
        )
        assert msg_idx.param_index == 0

    def test_build_parameter_request_list(self):
        """Test parameter request list command."""
        msg = MAVLinkProcessor.build_parameter_request_list(
            target_system=1,
            target_component=1,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.target_component == 1

    def test_build_parameter_set(self):
        """Test parameter set command."""
        msg = MAVLinkProcessor.build_parameter_set(
            target_system=1,
            target_component=1,
            param_id="SYSID_THISMAV",
            param_value=1.0,
            param_type=mav.MAV_PARAM_TYPE_REAL32,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.param_value == 1.0
        assert msg.param_type == mav.MAV_PARAM_TYPE_REAL32

    def test_build_mission_count(self):
        """Test mission count command."""
        msg = MAVLinkProcessor.build_mission_count(
            target_system=1,
            target_component=1,
            count=5,
            mission_type=0,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.count == 5
        assert msg.mission_type == 0

    def test_build_mission_clear(self):
        """Test mission clear command."""
        msg = MAVLinkProcessor.build_mission_clear(
            target_system=1,
            target_component=1,
            mission_type=0,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.mission_type == 0

    def test_build_mission_request_list(self):
        """Test mission request list command."""
        msg = MAVLinkProcessor.build_mission_request_list(
            target_system=1,
            target_component=1,
            mission_type=0,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.mission_type == 0

    def test_build_mission_set_current(self):
        """Test mission set current command."""
        msg = MAVLinkProcessor.build_mission_set_current(
            target_system=1,
            target_component=1,
            seq=2,
        )
        assert msg is not None
        assert msg.target_system == 1
        assert msg.seq == 2

    @pytest.mark.asyncio
    async def test_stats_logging(self, processor):
        """Test statistics logging start/stop."""
        assert processor.is_stats_logging_enabled() is False

        # Start logging
        await processor.start_stats_logging(interval_seconds=1.0)
        assert processor.is_stats_logging_enabled() is True

        # Stop logging
        await processor.stop_stats_logging()
        assert processor.is_stats_logging_enabled() is False

    def test_serialize_message(self):
        """Test message serialization."""
        # Create a simple heartbeat message
        msg = mav.MAVLink_heartbeat_message(
            type=mav.MAV_TYPE_QUADROTOR,
            autopilot=mav.MAV_AUTOPILOT_ARDUPILOTMEGA,
            base_mode=0,
            custom_mode=0,
            system_status=mav.MAV_STATE_STANDBY,
            mavlink_version=3,
        )

        # Serialize
        data = MAVLinkProcessor.serialize_message(msg)

        # Check that we got bytes back
        assert isinstance(data, bytes)
        assert len(data) > 0
        # MAVLink v2 magic byte should be first
        assert data[0] == 0xFD

    @pytest.mark.asyncio
    async def test_extract_message_payload(self, processor):
        """Test message payload extraction for WebSocket streaming."""
        # Create a GPS message with various field types
        msg = mav.MAVLink_gps_raw_int_message(
            time_usec=123456789,
            fix_type=3,
            lat=374542000,  # 37.4542 degrees * 1e7
            lon=-1222389000,  # -122.2389 degrees * 1e7
            alt=50000,  # 50m * 1000
            eph=100,
            epv=100,
            vel=250,  # 2.5 m/s * 100
            cog=18000,  # 180 degrees * 100
            satellites_visible=12,
        )

        # Extract payload
        payload = processor._extract_message_payload(msg)

        # Verify extracted fields
        assert payload is not None
        assert isinstance(payload, dict)
        assert payload["lat"] == 374542000
        assert payload["lon"] == -1222389000
        assert payload["satellites_visible"] == 12
        assert payload["fix_type"] == 3
