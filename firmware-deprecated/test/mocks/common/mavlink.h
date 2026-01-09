#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>

// Basic MAVLink constants
#define MAVLINK_MAX_PAYLOAD_LEN 255
#define MAVLINK_MAX_PACKET_LEN 280
#define MAVLINK_STX_MAVLINK1 0xFE
#define MAVLINK_STX 0xFD

// MAVLink message structure (simplified mock)
typedef struct __mavlink_message {
    uint16_t checksum;
    uint8_t magic;
    uint8_t len;
    uint8_t seq;
    uint8_t sysid;
    uint8_t compid;
    uint32_t msgid;
    uint8_t payload64[MAVLINK_MAX_PAYLOAD_LEN];
} mavlink_message_t;

// MAVLink status structure
typedef struct __mavlink_status {
    uint8_t msg_received;
    uint8_t buffer_overrun;
    uint8_t parse_error;
    uint8_t packet_idx;
    uint8_t current_rx_seq;
    uint8_t current_tx_seq;
    uint16_t packet_rx_success_count;
    uint16_t packet_rx_drop_count;
} mavlink_status_t;

// MAVLink command types (mock)
typedef struct __mavlink_command_long_t {
    uint16_t command;
    uint8_t target_system;
    uint8_t target_component;
    uint8_t confirmation;
    float param1;
    float param2;
    float param3;
    float param4;
    float param5;
    float param6;
    float param7;
} mavlink_command_long_t;

typedef struct __mavlink_set_mode_t {
    uint32_t custom_mode;
    uint8_t target_system;
    uint8_t base_mode;
} mavlink_set_mode_t;

typedef struct __mavlink_command_int_t {
    uint16_t command;
    uint8_t target_system;
    uint8_t target_component;
    uint8_t frame;
    uint8_t current;
    uint8_t autocontinue;
    float param1;
    float param2;
    float param3;
    float param4;
    int32_t x;
    int32_t y;
    float z;
} mavlink_command_int_t;

typedef struct __mavlink_set_position_target_local_ned_t {
    uint32_t time_boot_ms;
    float x;
    float y;
    float z;
    float vx;
    float vy;
    float vz;
    float afx;
    float afy;
    float afz;
    float yaw;
    float yaw_rate;
    uint16_t type_mask;
    uint8_t target_system;
    uint8_t target_component;
    uint8_t coordinate_frame;
} mavlink_set_position_target_local_ned_t;

typedef struct __mavlink_param_set_t {
    float param_value;
    uint8_t target_system;
    uint8_t target_component;
    char param_id[16];
    uint8_t param_type;
} mavlink_param_set_t;

typedef struct __mavlink_param_request_read_t {
    int16_t param_index;
    uint8_t target_system;
    uint8_t target_component;
    char param_id[16];
} mavlink_param_request_read_t;

typedef struct __mavlink_param_request_list_t {
    uint8_t target_system;
    uint8_t target_component;
} mavlink_param_request_list_t;

// MAVLink constants
#define MAV_CMD_COMPONENT_ARM_DISARM 400
#define MAV_PARAM_TYPE_REAL32 9
#define MAVLINK_FRAMING_OK 1
#define MAVLINK_FRAMING_BAD_CRC 2
#define MAVLINK_FRAMING_BAD_SIGNATURE 3

// Mock MAVLink functions
inline uint8_t mavlink_parse_char(uint8_t chan, uint8_t c, mavlink_message_t* r_message, mavlink_status_t* r_mavlink_status) {
    (void)chan;
    (void)c;
    (void)r_message;
    (void)r_mavlink_status;
    return 0; // No message parsed
}

inline uint16_t mavlink_finalize_message(mavlink_message_t* msg, uint8_t system_id, uint8_t component_id, uint8_t min_length, uint8_t length, uint8_t crc_extra) {
    (void)msg;
    (void)system_id;
    (void)component_id;
    (void)min_length;
    (void)length;
    (void)crc_extra;
    return 0;
}

inline uint16_t mavlink_msg_to_send_buffer(uint8_t *buffer, const mavlink_message_t *msg) {
    (void)buffer;
    (void)msg;
    return 0;
}

// Additional MAVLink message functions
inline void mavlink_msg_gps_rtcm_data_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, 
                                          uint8_t flags, uint8_t len, const uint8_t* data) {
    (void)system_id;
    (void)component_id;
    (void)msg;
    (void)flags;
    (void)len;
    (void)data;
}

inline void mavlink_msg_command_long_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_command_long_t* cmd) {
    (void)system_id;
    (void)component_id;
    (void)msg;
    (void)cmd;
}

inline void mavlink_msg_set_mode_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_set_mode_t* mode) {
    (void)system_id;
    (void)component_id;
    (void)msg;
    (void)mode;
}

inline void mavlink_msg_command_int_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_command_int_t* cmd) {
    (void)system_id;
    (void)component_id;
    (void)msg;
    (void)cmd;
}

inline void mavlink_msg_set_position_target_local_ned_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_set_position_target_local_ned_t* pos) {
    (void)system_id;
    (void)component_id;
    (void)msg;
    (void)pos;
}

inline void mavlink_msg_param_set_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_param_set_t* param) {
    (void)system_id;
    (void)component_id;
    (void)msg;
    (void)param;
}

inline void mavlink_msg_param_request_read_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_param_request_read_t* param) {
    (void)system_id;
    (void)component_id;
    (void)msg;
    (void)param;
}

inline void mavlink_msg_param_request_list_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_param_request_list_t* param) {
    (void)system_id;
    (void)component_id;
    (void)msg;
    (void)param;
}

// Channel management
inline void mavlink_reset_channel_status(uint8_t chan) {
    (void)chan;
}

#endif // ARDUINO_ARCH_NATIVE