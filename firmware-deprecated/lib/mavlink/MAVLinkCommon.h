#pragma once

#include <Arduino.h>
#include <vector>
#include <map>
#include <functional>

namespace MAVLink {

struct Message {
    uint8_t magic;
    uint8_t length;
    uint8_t incompat_flags;
    uint8_t compat_flags;
    uint8_t seq;
    uint8_t sysid;
    uint8_t compid;
    uint32_t msgid;
    uint8_t payload[255];
    uint16_t checksum;
    bool valid;
    uint32_t timestamp;
};

struct Status {
    uint8_t msg_received;
    uint8_t buffer_overrun;
    uint8_t parse_error;
    uint8_t packet_idx;
    uint8_t current_rx_seq;
    uint8_t current_tx_seq;
    uint16_t packet_rx_success_count;
    uint16_t packet_rx_drop_count;
};

struct MessageStats {
    uint32_t totalMessages;
    uint32_t crcErrors;
    uint32_t parseErrors;
    uint32_t sequenceErrors;
    std::map<uint32_t, uint32_t> messageTypes;
    uint32_t lastUpdateMs;
};

struct Filter {
    std::vector<uint32_t> allowedMessageIds;
    std::vector<uint8_t> allowedSystemIds;
    std::vector<uint8_t> allowedComponentIds;
    bool enableFilter;
};

enum class ParseState {
    UNINIT = 0,
    IDLE,
    GOT_STX,
    GOT_LENGTH,
    GOT_INCOMPAT_FLAGS,
    GOT_COMPAT_FLAGS,
    GOT_SEQ,
    GOT_SYSID,
    GOT_COMPID,
    GOT_MSGID1,
    GOT_MSGID2,
    GOT_MSGID3,
    GOT_PAYLOAD,
    GOT_CRC1
};

using MessageCallback = std::function<void(const Message&)>;
using StatsCallback = std::function<void(const MessageStats&)>;

static const size_t MAX_RTCM_FRAGMENT_SIZE = 180;  // MAVLink GPS_RTCM_DATA max payload
static const size_t MAX_PARSE_BUFFER_SIZE = 512;
// Note: MAVLINK_STX is defined as macro in mavlink.h (253 / 0xFD)

bool isMAVLinkData(const uint8_t* data, size_t length);
size_t serializeMessage(const Message& message, uint8_t* buffer, size_t bufferSize);
uint16_t calculateChecksum(const uint8_t* data, size_t length, uint16_t crc_extra = 0);
bool validateChecksum(const Message& message);

}