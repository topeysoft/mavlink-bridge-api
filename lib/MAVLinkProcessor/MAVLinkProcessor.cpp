#include "MAVLinkProcessor.h"
#include "EventManager.h"
#include <esp_log.h>

static const char* TAG = "MAVLinkProcessor";

#define MAVLINK_STX_V1 0xFE
#define MAVLINK_STX_V2 0xFD

static const uint16_t crc_table[256] = {
    0x0000, 0x1189, 0x2312, 0x329b, 0x4624, 0x57ad, 0x6536, 0x74bf,
    0x8c48, 0x9dc1, 0xaf5a, 0xbed3, 0xca6c, 0xdbe5, 0xe97e, 0xf8f7,
    0x1081, 0x0108, 0x3393, 0x221a, 0x56a5, 0x472c, 0x75b7, 0x643e,
    0x9cc9, 0x8d40, 0xbfdb, 0xae52, 0xdaed, 0xcb64, 0xf9ff, 0xe876,
    0x2102, 0x308b, 0x0210, 0x1399, 0x6726, 0x76af, 0x4434, 0x55bd,
    0xad4a, 0xbcc3, 0x8e58, 0x9fd1, 0xeb6e, 0xfae7, 0xc87c, 0xd9f5,
    0x3183, 0x200a, 0x1291, 0x0318, 0x77a7, 0x662e, 0x54b5, 0x453c,
    0xbdcb, 0xac42, 0x9ed9, 0x8f50, 0xfbef, 0xea66, 0xd8fd, 0xc974,
    0x4204, 0x538d, 0x6116, 0x709f, 0x0420, 0x15a9, 0x2732, 0x36bb,
    0xce4c, 0xdfc5, 0xed5e, 0xfcd7, 0x8868, 0x99e1, 0xab7a, 0xbaf3,
    0x5285, 0x430c, 0x7197, 0x601e, 0x14a1, 0x0528, 0x37b3, 0x263a,
    0xdecd, 0xcf44, 0xfddf, 0xec56, 0x98e9, 0x8960, 0xbbfb, 0xaa72,
    0x6306, 0x728f, 0x4014, 0x519d, 0x2522, 0x34ab, 0x0630, 0x17b9,
    0xef4e, 0xfec7, 0xcc5c, 0xddd5, 0xa96a, 0xb8e3, 0x8a78, 0x9bf1,
    0x7387, 0x620e, 0x5095, 0x411c, 0x35a3, 0x242a, 0x16b1, 0x0738,
    0xffcf, 0xee46, 0xdcdd, 0xcd54, 0xb9eb, 0xa862, 0x9af9, 0x8b70,
    0x8408, 0x9581, 0xa71a, 0xb693, 0xc22c, 0xd3a5, 0xe13e, 0xf0b7,
    0x0840, 0x19c9, 0x2b52, 0x3adb, 0x4e64, 0x5fed, 0x6d76, 0x7cff,
    0x9489, 0x8500, 0xb79b, 0xa612, 0xd2ad, 0xc324, 0xf1bf, 0xe036,
    0x18c1, 0x0948, 0x3bd3, 0x2a5a, 0x5ee5, 0x4f6c, 0x7df7, 0x6c7e,
    0xa50a, 0xb483, 0x8618, 0x9791, 0xe32e, 0xf2a7, 0xc03c, 0xd1b5,
    0x2942, 0x38cb, 0x0a50, 0x1bd9, 0x6f66, 0x7eef, 0x4c74, 0x5dfd,
    0xb58b, 0xa402, 0x9699, 0x8710, 0xf3af, 0xe226, 0xd0bd, 0xc134,
    0x39c3, 0x284a, 0x1ad1, 0x0b58, 0x7fe7, 0x6e6e, 0x5cf5, 0x4d7c,
    0xc60c, 0xd785, 0xe51e, 0xf497, 0x8028, 0x91a1, 0xa33a, 0xb2b3,
    0x4a44, 0x5bcd, 0x6956, 0x78df, 0x0c60, 0x1de9, 0x2f72, 0x3efb,
    0xd68d, 0xc704, 0xf59f, 0xe416, 0x90a9, 0x8120, 0xb3bb, 0xa232,
    0x5ac5, 0x4b4c, 0x79d7, 0x685e, 0x1ce1, 0x0d68, 0x3ff3, 0x2e7a,
    0xe70e, 0xf687, 0xc41c, 0xd595, 0xa12a, 0xb0a3, 0x8238, 0x93b1,
    0x6b46, 0x7acf, 0x4854, 0x59dd, 0x2d62, 0x3ceb, 0x0e70, 0x1ff9,
    0xf78f, 0xe606, 0xd49d, 0xc514, 0xb1ab, 0xa022, 0x92b9, 0x8330,
    0x7bc7, 0x6a4e, 0x58d5, 0x495c, 0x3de3, 0x2c6a, 0x1ef1, 0x0f78
};

MAVLinkProcessor* MAVLinkProcessor::instance = nullptr;

MAVLinkProcessor::MAVLinkProcessor() : 
    parseBufferPos(0),
    parseState(PARSE_STATE_IDLE),
    payloadIndex(0) {
    
    memset(&rxMessage, 0, sizeof(rxMessage));
    memset(&rxStatus, 0, sizeof(rxStatus));
    memset(&stats, 0, sizeof(stats));
    memset(&messageFilter, 0, sizeof(messageFilter));
    memset(parseBuffer, 0, sizeof(parseBuffer));
    memset(expectedSeq, 0, sizeof(expectedSeq));
    
    stats.lastUpdateMs = millis();
    messageFilter.enableFilter = false;
}

MAVLinkProcessor::~MAVLinkProcessor() {
}

MAVLinkProcessor* MAVLinkProcessor::getInstance() {
    if (instance == nullptr) {
        instance = new MAVLinkProcessor();
    }
    return instance;
}

std::vector<MAVLinkMessage> MAVLinkProcessor::processData(const uint8_t* data, size_t length) {
    std::vector<MAVLinkMessage> messages;
    
    if (!data || length == 0) {
        return messages;
    }
    
    for (size_t i = 0; i < length; i++) {
        if (parseMessage(data[i])) {
            if (validateMessage(rxMessage)) {
                if (!shouldFilterMessage(rxMessage)) {
                    rxMessage.timestamp = millis();
                    messages.push_back(rxMessage);
                    updateStatistics(rxMessage);
                    
                    if (messageCallback) {
                        messageCallback(rxMessage);
                    }
                    
                    DynamicJsonDocument payloadDoc(256);
                    payloadDoc["messageId"] = (int)rxMessage.msgid;
                    payloadDoc["systemId"] = (int)rxMessage.sysid;
                    payloadDoc["componentId"] = (int)rxMessage.compid;
                    payloadDoc["length"] = (int)rxMessage.length;
                    EventManager::getInstance()->publish(EventType::MAVLINK_MESSAGE, payloadDoc.as<JsonObjectConst>());
                }
                handleSequenceCheck(rxMessage);
            } else {
                stats.crcErrors++;
            }
            
            memset(&rxMessage, 0, sizeof(rxMessage));
            parseState = PARSE_STATE_IDLE;
        }
    }
    
    return messages;
}

void MAVLinkProcessor::setMessageFilter(const Filter& filter) {
    messageFilter = filter;
}

MAVLinkProcessor::Filter MAVLinkProcessor::getMessageFilter() const {
    return messageFilter;
}

void MAVLinkProcessor::clearMessageFilter() {
    messageFilter.allowedMessageIds.clear();
    messageFilter.allowedSystemIds.clear();
    messageFilter.allowedComponentIds.clear();
    messageFilter.enableFilter = false;
}

MAVLinkProcessor::MessageStats MAVLinkProcessor::getStatistics() const {
    return stats;
}

void MAVLinkProcessor::resetStatistics() {
    memset(&stats, 0, sizeof(stats));
    stats.lastUpdateMs = millis();
}

void MAVLinkProcessor::onMessage(std::function<void(const MAVLinkMessage&)> callback) {
    messageCallback = callback;
}

void MAVLinkProcessor::onStatistics(std::function<void(const MessageStats&)> callback) {
    statsCallback = callback;
}

bool MAVLinkProcessor::isMAVLinkData(const uint8_t* data, size_t length) {
    if (!data || length < 8) {
        return false;
    }
    
    for (size_t i = 0; i < length - 7; i++) {
        if (data[i] == MAVLINK_STX_V1 || data[i] == MAVLINK_STX_V2) {
            if (i + 1 < length) {
                uint8_t payload_len = data[i + 1];
                if (payload_len <= 255) {
                    size_t expected_length = (data[i] == MAVLINK_STX_V2) ? 12 + payload_len : 8 + payload_len;
                    if (i + expected_length <= length) {
                        return true;
                    }
                }
            }
        }
    }
    
    return false;
}

size_t MAVLinkProcessor::serializeMessage(const MAVLinkMessage& message, uint8_t* buffer, size_t bufferSize) {
    if (!buffer || !message.valid) {
        return 0;
    }
    
    size_t messageSize = (message.magic == MAVLINK_STX_V2) ? 12 + message.length : 8 + message.length;
    
    if (bufferSize < messageSize) {
        return 0;
    }
    
    size_t pos = 0;
    
    buffer[pos++] = message.magic;
    buffer[pos++] = message.length;
    
    if (message.magic == MAVLINK_STX_V2) {
        buffer[pos++] = message.incompat_flags;
        buffer[pos++] = message.compat_flags;
    }
    
    buffer[pos++] = message.seq;
    buffer[pos++] = message.sysid;
    buffer[pos++] = message.compid;
    
    if (message.magic == MAVLINK_STX_V2) {
        buffer[pos++] = message.msgid & 0xFF;
        buffer[pos++] = (message.msgid >> 8) & 0xFF;
        buffer[pos++] = (message.msgid >> 16) & 0xFF;
    } else {
        buffer[pos++] = message.msgid & 0xFF;
        buffer[pos++] = (message.msgid >> 8) & 0xFF;
    }
    
    memcpy(buffer + pos, message.payload, message.length);
    pos += message.length;
    
    buffer[pos++] = message.checksum & 0xFF;
    buffer[pos++] = (message.checksum >> 8) & 0xFF;
    
    return pos;
}

uint16_t MAVLinkProcessor::calculateChecksum(const uint8_t* data, size_t length, uint16_t crc_extra) {
    uint16_t crc = 0xFFFF;
    
    for (size_t i = 0; i < length; i++) {
        uint8_t tmp = data[i] ^ (uint8_t)(crc & 0xFF);
        crc = (crc >> 8) ^ crc_table[tmp];
    }
    
    if (crc_extra != 0) {
        uint8_t tmp = crc_extra ^ (uint8_t)(crc & 0xFF);
        crc = (crc >> 8) ^ crc_table[tmp];
    }
    
    return crc;
}

bool MAVLinkProcessor::validateChecksum(const MAVLinkMessage& message) {
    size_t headerSize = (message.magic == MAVLINK_STX_V2) ? 10 : 6;
    uint8_t temp[headerSize + message.length];
    
    size_t pos = 0;
    temp[pos++] = message.length;
    
    if (message.magic == MAVLINK_STX_V2) {
        temp[pos++] = message.incompat_flags;
        temp[pos++] = message.compat_flags;
    }
    
    temp[pos++] = message.seq;
    temp[pos++] = message.sysid;
    temp[pos++] = message.compid;
    
    if (message.magic == MAVLINK_STX_V2) {
        temp[pos++] = message.msgid & 0xFF;
        temp[pos++] = (message.msgid >> 8) & 0xFF;
        temp[pos++] = (message.msgid >> 16) & 0xFF;
    } else {
        temp[pos++] = message.msgid & 0xFF;
        temp[pos++] = (message.msgid >> 8) & 0xFF;
    }
    
    memcpy(temp + pos, message.payload, message.length);
    
    uint16_t calculated_crc = calculateChecksum(temp, sizeof(temp));
    
    return calculated_crc == message.checksum;
}

bool MAVLinkProcessor::parseMessage(uint8_t byte) {
    bool messageComplete = false;
    
    switch (parseState) {
        case PARSE_STATE_IDLE:
            if (byte == MAVLINK_STX_V1 || byte == MAVLINK_STX_V2) {
                parseState = PARSE_STATE_GOT_STX;
                rxMessage.magic = byte;
                rxStatus.msg_received = 1;
            }
            break;
            
        case PARSE_STATE_GOT_STX:
            rxMessage.length = byte;
            parseState = PARSE_STATE_GOT_LENGTH;
            if (rxMessage.magic == MAVLINK_STX_V1) {
                parseState = PARSE_STATE_GOT_COMPAT_FLAGS;
            }
            break;
            
        case PARSE_STATE_GOT_LENGTH:
            rxMessage.incompat_flags = byte;
            parseState = PARSE_STATE_GOT_INCOMPAT_FLAGS;
            break;
            
        case PARSE_STATE_GOT_INCOMPAT_FLAGS:
            rxMessage.compat_flags = byte;
            parseState = PARSE_STATE_GOT_COMPAT_FLAGS;
            break;
            
        case PARSE_STATE_GOT_COMPAT_FLAGS:
            rxMessage.seq = byte;
            parseState = PARSE_STATE_GOT_SEQ;
            break;
            
        case PARSE_STATE_GOT_SEQ:
            rxMessage.sysid = byte;
            parseState = PARSE_STATE_GOT_SYSID;
            break;
            
        case PARSE_STATE_GOT_SYSID:
            rxMessage.compid = byte;
            parseState = PARSE_STATE_GOT_COMPID;
            break;
            
        case PARSE_STATE_GOT_COMPID:
            rxMessage.msgid = byte;
            parseState = (rxMessage.magic == MAVLINK_STX_V2) ? PARSE_STATE_GOT_MSGID1 : PARSE_STATE_GOT_MSGID2;
            break;
            
        case PARSE_STATE_GOT_MSGID1:
            rxMessage.msgid |= (uint32_t)byte << 8;
            parseState = PARSE_STATE_GOT_MSGID2;
            break;
            
        case PARSE_STATE_GOT_MSGID2:
            if (rxMessage.magic == MAVLINK_STX_V2) {
                rxMessage.msgid |= (uint32_t)byte << 16;
                parseState = PARSE_STATE_GOT_MSGID3;
            } else {
                rxMessage.msgid |= (uint32_t)byte << 8;
                payloadIndex = 0;
                parseState = (rxMessage.length == 0) ? PARSE_STATE_GOT_PAYLOAD : PARSE_STATE_GOT_PAYLOAD;
            }
            break;
            
        case PARSE_STATE_GOT_MSGID3:
            payloadIndex = 0;
            parseState = (rxMessage.length == 0) ? PARSE_STATE_GOT_PAYLOAD : PARSE_STATE_GOT_PAYLOAD;
            if (rxMessage.length > 0) {
                rxMessage.payload[payloadIndex++] = byte;
            }
            break;
            
        case PARSE_STATE_GOT_PAYLOAD:
            if (payloadIndex < rxMessage.length) {
                rxMessage.payload[payloadIndex++] = byte;
            }
            if (payloadIndex >= rxMessage.length) {
                parseState = PARSE_STATE_GOT_CRC1;
            }
            break;
            
        case PARSE_STATE_GOT_CRC1:
            rxMessage.checksum = byte;
            parseState = PARSE_STATE_GOT_CRC1;
            break;
            
        default:
            rxMessage.checksum |= (uint16_t)byte << 8;
            rxMessage.valid = true;
            messageComplete = true;
            break;
    }
    
    if (parseState == PARSE_STATE_GOT_PAYLOAD && rxMessage.length == 0) {
        parseState = PARSE_STATE_GOT_CRC1;
    }
    
    return messageComplete;
}

bool MAVLinkProcessor::validateMessage(const MAVLinkMessage& message) {
    if (!message.valid) {
        return false;
    }
    
    if (message.length > 255) {
        return false;
    }
    
    return validateChecksum(message);
}

bool MAVLinkProcessor::shouldFilterMessage(const MAVLinkMessage& message) {
    if (!messageFilter.enableFilter) {
        return false;
    }
    
    if (!messageFilter.allowedMessageIds.empty()) {
        bool found = false;
        for (uint32_t id : messageFilter.allowedMessageIds) {
            if (id == message.msgid) {
                found = true;
                break;
            }
        }
        if (!found) return true;
    }
    
    if (!messageFilter.allowedSystemIds.empty()) {
        bool found = false;
        for (uint8_t id : messageFilter.allowedSystemIds) {
            if (id == message.sysid) {
                found = true;
                break;
            }
        }
        if (!found) return true;
    }
    
    if (!messageFilter.allowedComponentIds.empty()) {
        bool found = false;
        for (uint8_t id : messageFilter.allowedComponentIds) {
            if (id == message.compid) {
                found = true;
                break;
            }
        }
        if (!found) return true;
    }
    
    return false;
}

void MAVLinkProcessor::updateStatistics(const MAVLinkMessage& message) {
    stats.totalMessages++;
    stats.messageTypes[message.msgid]++;
    
    uint32_t now = millis();
    if (now - stats.lastUpdateMs >= 1000) {
        if (statsCallback) {
            statsCallback(stats);
        }
        stats.lastUpdateMs = now;
    }
}

void MAVLinkProcessor::handleSequenceCheck(const MAVLinkMessage& message) {
    uint8_t expected = expectedSeq[message.sysid];
    
    if (message.seq != expected && expected != 0) {
        stats.sequenceErrors++;
        ESP_LOGW(TAG, "Sequence error: expected %d, got %d from sys %d", 
                 expected, message.seq, message.sysid);
    }
    
    expectedSeq[message.sysid] = (message.seq + 1) % 256;
}