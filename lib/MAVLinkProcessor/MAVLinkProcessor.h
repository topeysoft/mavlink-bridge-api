#pragma once

#include <Arduino.h>
#include <vector>
#include <map>
#include <functional>

struct MAVLinkMessage {
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

struct MAVLinkStatus {
    uint8_t msg_received;
    uint8_t buffer_overrun;
    uint8_t parse_error;
    uint8_t packet_idx;
    uint8_t current_rx_seq;
    uint8_t current_tx_seq;
    uint16_t packet_rx_success_count;
    uint16_t packet_rx_drop_count;
};

class MAVLinkProcessor {
public:
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
    
private:
    static MAVLinkProcessor* instance;
    MAVLinkMessage rxMessage;
    MAVLinkStatus rxStatus;
    MessageStats stats;
    Filter messageFilter;
    
    uint8_t parseBuffer[512];
    size_t parseBufferPos;
    
    std::function<void(const MAVLinkMessage&)> messageCallback;
    std::function<void(const MessageStats&)> statsCallback;
    
    uint8_t expectedSeq[256];
    
public:
    static MAVLinkProcessor* getInstance();
    
    std::vector<MAVLinkMessage> processData(const uint8_t* data, size_t length);
    
    void setMessageFilter(const Filter& filter);
    Filter getMessageFilter() const;
    void clearMessageFilter();
    
    MessageStats getStatistics() const;
    void resetStatistics();
    
    void onMessage(std::function<void(const MAVLinkMessage&)> callback);
    void onStatistics(std::function<void(const MessageStats&)> callback);
    
    static bool isMAVLinkData(const uint8_t* data, size_t length);
    static size_t serializeMessage(const MAVLinkMessage& message, uint8_t* buffer, size_t bufferSize);
    
    static uint16_t calculateChecksum(const uint8_t* data, size_t length, uint16_t crc_extra = 0);
    static bool validateChecksum(const MAVLinkMessage& message);
    
private:
    MAVLinkProcessor();
    ~MAVLinkProcessor();
    
    bool parseMessage(uint8_t byte);
    bool validateMessage(const MAVLinkMessage& message);
    bool shouldFilterMessage(const MAVLinkMessage& message);
    void updateStatistics(const MAVLinkMessage& message);
    void handleSequenceCheck(const MAVLinkMessage& message);
    
    enum ParseState {
        PARSE_STATE_UNINIT = 0,
        PARSE_STATE_IDLE,
        PARSE_STATE_GOT_STX,
        PARSE_STATE_GOT_LENGTH,
        PARSE_STATE_GOT_INCOMPAT_FLAGS,
        PARSE_STATE_GOT_COMPAT_FLAGS,
        PARSE_STATE_GOT_SEQ,
        PARSE_STATE_GOT_SYSID,
        PARSE_STATE_GOT_COMPID,
        PARSE_STATE_GOT_MSGID1,
        PARSE_STATE_GOT_MSGID2,
        PARSE_STATE_GOT_MSGID3,
        PARSE_STATE_GOT_PAYLOAD,
        PARSE_STATE_GOT_CRC1
    };
    
    ParseState parseState;
    uint8_t payloadIndex;
};