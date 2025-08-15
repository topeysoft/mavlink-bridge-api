#include "MAVLinkProcessor.h"
#include "../../core/EventManager/EventManager.h"
#include <esp_log.h>
#include <algorithm>

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

// ArduPilot MAVLink CRC_EXTRA table (ArduPilot-specific CRC_EXTRA values)
static const uint8_t crc_extra_table[256] = {
    50,   // 0: HEARTBEAT
    124,  // 1: SYS_STATUS  
    137,  // 2: SYSTEM_TIME
    0,    // 3: PING (not used)
    14,   // 4: CHANGE_OPERATOR_CONTROL
    28,   // 5: CHANGE_OPERATOR_CONTROL_ACK
    148,  // 6: AUTH_KEY
    227,  // 7: SET_MODE
    0, 0, 0,    // 8-10
    89,   // 11: PARAM_REQUEST_READ
    21,   // 12: PARAM_REQUEST_LIST
    26,   // 13: PARAM_VALUE
    46,   // 14: PARAM_SET
    0, 0, 0, 0, 0, 0, 0, 0, 0,  // 15-23
    24,   // 24: GPS_RAW_INT
    23,   // 25: GPS_STATUS
    16,   // 26: SCALED_IMU
    144,  // 27: RAW_IMU
    67,   // 28: RAW_PRESSURE
    115,  // 29: SCALED_PRESSURE
    185,  // 30: ATTITUDE
    167,  // 31: ATTITUDE_QUATERNION
    185,  // 32: LOCAL_POSITION_NED
    104,  // 33: GLOBAL_POSITION_INT
    237,  // 34: RC_CHANNELS_SCALED
    244,  // 35: RC_CHANNELS_RAW
    222,  // 36: SERVO_OUTPUT_RAW
    132,  // 37: MISSION_REQUEST_PARTIAL_LIST
    215,  // 38: MISSION_WRITE_PARTIAL_LIST
    230,  // 39: MISSION_ITEM
    40,   // 40: MISSION_REQUEST
    28,   // 41: MISSION_SET_CURRENT
    28,   // 42: MISSION_CURRENT
    132,  // 43: MISSION_REQUEST_LIST
    221,  // 44: MISSION_COUNT
    232,  // 45: MISSION_CLEAR_ALL
    11,   // 46: MISSION_ITEM_REACHED
    153,  // 47: MISSION_ACK
    41,   // 48: SET_GPS_GLOBAL_ORIGIN
    39,   // 49: GPS_GLOBAL_ORIGIN
    78,   // 50: PARAM_MAP_RC
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,     // 51-60
    62, 0, 254, 158, 227, 0, 0, 0, 136, 0,  // 61-70
    0, 0, 0,                             // 71-73
    20,   // 74: VFR_HUD
    158,  // 75: COMMAND_INT  
    152,  // 76: COMMAND_LONG
    143,  // 77: COMMAND_ACK
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,     // 78-99
    175, 0, 0, 0, 0, 0, 0, 163, 105, 151, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 100-119
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,         // 120-139
    0, 0, 0, 0, 0, 0, 0, 195, 11, 92, 235, 0, 0, 0, 0, 0, 0, 0, 0, 0,    // 140-159
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,         // 160-179
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,         // 180-199
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,         // 200-219
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,         // 220-239
    0,                                   // 240
    58,   // 241: VIBRATION
    183,  // 242: HOME_POSITION
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0  // 243-255
};

// Get CRC extra value for message ID with fallback support
static uint8_t getCrcExtra(uint32_t msgid) {
    if (msgid < 256) {
        uint8_t crc_extra = crc_extra_table[msgid];
        if (crc_extra == 0 && msgid != 0) {
            // For unknown message types, try common ArduPilot fallback values
            ESP_LOGW(TAG, "🔄 Unknown CRC_EXTRA for message ID %lu, using fallback", msgid);
            Serial.printf("🔄 Unknown CRC_EXTRA for message ID %lu, using fallback\n", msgid);
            
            // Common fallback values for ArduPilot messages
            switch (msgid) {
                case 61: return 62;   // ATTITUDE_TARGET
                case 63: return 254;  // GLOBAL_POSITION_INT_COV  
                case 64: return 158;  // LOCAL_POSITION_NED_COV
                case 65: return 227;  // RC_CHANNELS
                case 69: return 136;  // MANUAL_CONTROL
                case 100: return 175; // OPTICAL_FLOW
                case 107: return 163; // RADIO_STATUS
                case 108: return 105; // HIL_OPTICAL_FLOW
                case 109: return 151; // HIL_STATE_QUATERNION
                case 147: return 195; // BATTERY_STATUS
                case 148: return 11;  // SENSOR_OFFSETS
                case 149: return 92;  // SET_MAG_OFFSETS
                case 150: return 235; // MEMINFO
                default:
                    ESP_LOGW(TAG, "⚠️ No fallback CRC_EXTRA available for message ID %lu", msgid);
                    return 0;
            }
        }
        return crc_extra;
    }
    
    // For message IDs >= 256, return 0 (these are typically newer messages)
    ESP_LOGW(TAG, "⚠️ Message ID %lu >= 256, no CRC_EXTRA available", msgid);
    return 0;
}

MAVLinkProcessor* MAVLinkProcessor::instance = nullptr;

MAVLinkProcessor::MAVLinkProcessor() : 
    parseBufferPos(0),
    parseState(PARSE_STATE_IDLE),
    payloadIndex(0),
    statsTimer(NULL),
    statsLoggingEnabled(false),
    statsLoggingInterval(10000) {
    
    memset(&rxMessage, 0, sizeof(rxMessage));
    memset(&rxStatus, 0, sizeof(rxStatus));
    memset(&stats, 0, sizeof(stats));
    memset(&messageFilter, 0, sizeof(messageFilter));
    memset(parseBuffer, 0, sizeof(parseBuffer));
    memset(expectedSeq, 0, sizeof(expectedSeq));
    
    stats.lastUpdateMs = millis();
    messageFilter.enableFilter = false;
    
    // Initialize firmware detection
    firmwareType = FIRMWARE_UNKNOWN;
    heartbeatCount = 0;
}

MAVLinkProcessor::~MAVLinkProcessor() {
    stopStatsLogging();
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
        ESP_LOGW(TAG, "⚠️ MAVLink: Invalid input - data=%p, length=%d", data, length);
        return messages;
    }
    
    ESP_LOGI(TAG, "🔍 MAVLink: Processing %d bytes", length);
    Serial.printf("🔍 MAVLink: Processing %d bytes of data\n", length);
    
    // Log first few bytes for debugging
    Serial.printf("   Raw data: ");
    for (int i = 0; i < min(16, (int)length); i++) {
        Serial.printf("0x%02X ", data[i]);
    }
    Serial.printf("\n");
    
    size_t messagesFound = 0;
    for (size_t i = 0; i < length; i++) {
        if (parseMessage(data[i])) {
            messagesFound++;
            ESP_LOGI(TAG, "📡 MAVLink: Found message #%d - validating...", messagesFound);
            Serial.printf("📡 MAVLink: Found message #%d\n", messagesFound);
            
            // Debug the parsed message
            Serial.printf("   🔍 Message details:\n");
            Serial.printf("      - Magic: 0x%02X (%s)\n", rxMessage.magic, 
                         (rxMessage.magic == 0xFE) ? "MAVLink v1" : 
                         (rxMessage.magic == 0xFD) ? "MAVLink v2" : "Unknown");
            Serial.printf("      - Length: %d\n", rxMessage.length);
            Serial.printf("      - Sequence: %d\n", rxMessage.seq);
            Serial.printf("      - System ID: %d\n", rxMessage.sysid);
            Serial.printf("      - Component ID: %d\n", rxMessage.compid);
            Serial.printf("      - Message ID: %lu\n", rxMessage.msgid);
            Serial.printf("      - Checksum: 0x%04X\n", rxMessage.checksum);
            
            // Show payload bytes
            Serial.printf("      - Payload (%d bytes): ", rxMessage.length);
            for (int p = 0; p < min((int)rxMessage.length, 16); p++) {
                Serial.printf("0x%02X ", rxMessage.payload[p]);
            }
            if (rxMessage.length > 16) Serial.printf("...");
            Serial.printf("\n");
            
            if (validateMessage(rxMessage)) {
                ESP_LOGI(TAG, "✅ MAVLink: Valid message - ID=%lu, SYS=%d, COMP=%d", 
                         rxMessage.msgid, rxMessage.sysid, rxMessage.compid);
                Serial.printf("✅ MAVLink: Valid message - ID=%lu, SYS=%d, COMP=%d\n", 
                              rxMessage.msgid, rxMessage.sysid, rxMessage.compid);
                
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
                } else {
                    ESP_LOGD(TAG, "🚫 MAVLink: Message filtered out");
                }
                handleSequenceCheck(rxMessage);
            } else {
                // Calculate what the CRC should be for debugging
                uint16_t calculatedCrc = calculateChecksum((const uint8_t*)&rxMessage + 1, 
                                                          rxMessage.length + (rxMessage.magic == MAVLINK_STX_V2 ? 9 : 5));
                
                ESP_LOGW(TAG, "❌ MAVLink: Invalid message - CRC error");
                Serial.printf("❌ MAVLink: CRC validation failed\n");
                Serial.printf("      - Received CRC: 0x%04X\n", rxMessage.checksum);
                Serial.printf("      - Calculated CRC: 0x%04X\n", calculatedCrc);
                Serial.printf("      - Message ID: %lu (needs CRC_EXTRA)\n", rxMessage.msgid);
                stats.crcErrors++;
            }
            
            memset(&rxMessage, 0, sizeof(rxMessage));
            parseState = PARSE_STATE_IDLE;
        }
    }
    
    if (messagesFound == 0) {
        ESP_LOGD(TAG, "🔍 MAVLink: No complete messages found in %d bytes", length);
        Serial.printf("🔍 MAVLink: No complete messages in this data chunk\n");
    } else {
        ESP_LOGI(TAG, "✅ MAVLink: Found %d valid messages", messages.size());
        Serial.printf("✅ MAVLink: Found %d valid messages\n", messages.size());
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
    
    // Get the CRC_EXTRA for this message type
    uint8_t crc_extra = getCrcExtra(message.msgid);
    
    uint16_t calculated_crc = calculateChecksum(temp, sizeof(temp), crc_extra);
    
    // Enhanced debug logging for CRC validation
    bool crcValid = calculated_crc == message.checksum;
    if (!crcValid) {
        ESP_LOGW(TAG, "🔍 CRC Debug for message ID %lu:", message.msgid);
        ESP_LOGW(TAG, "   - Received CRC: 0x%04X", message.checksum);
        ESP_LOGW(TAG, "   - Calculated CRC: 0x%04X", calculated_crc);
        ESP_LOGW(TAG, "   - CRC_EXTRA used: %d (0x%02X)", crc_extra, crc_extra);
        ESP_LOGW(TAG, "   - Message length: %d", message.length);
        ESP_LOGW(TAG, "   - MAVLink version: %s", (message.magic == MAVLINK_STX_V2) ? "v2" : "v1");
        
        Serial.printf("🔍 CRC Debug for message ID %lu:\n", message.msgid);
        Serial.printf("   - Received CRC: 0x%04X\n", message.checksum);
        Serial.printf("   - Calculated CRC: 0x%04X\n", calculated_crc);
        Serial.printf("   - CRC_EXTRA used: %d (0x%02X)\n", crc_extra, crc_extra);
        Serial.printf("   - Message length: %d\n", message.length);
        Serial.printf("   - MAVLink version: %s\n", (message.magic == MAVLINK_STX_V2) ? "v2" : "v1");
    }
    
    return crcValid;
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
            parseState = PARSE_STATE_GOT_CRC2;
            break;
            
        case PARSE_STATE_GOT_CRC2:
            rxMessage.checksum |= (uint16_t)byte << 8;
            rxMessage.valid = true;
            messageComplete = true;
            parseState = PARSE_STATE_IDLE;
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
    
    // Firmware detection based on heartbeat messages
    if (message.msgid == 0 && firmwareType == FIRMWARE_UNKNOWN) { // HEARTBEAT
        heartbeatCount++;
        
        // Analyze heartbeat content for firmware detection
        if (message.length >= 9 && heartbeatCount >= 3) { // Wait for a few heartbeats for stability
            uint8_t autopilot = message.payload[5]; // autopilot field in HEARTBEAT
            
            switch (autopilot) {
                case 3:  // MAV_AUTOPILOT_ARDUPILOTMEGA
                    firmwareType = FIRMWARE_ARDUPILOT;
                    ESP_LOGI(TAG, "🎯 Detected ArduPilot firmware (autopilot=%d)", autopilot);
                    Serial.printf("🎯 Firmware detected: ArduPilot (autopilot=%d)\n", autopilot);
                    break;
                case 12: // MAV_AUTOPILOT_PX4
                    firmwareType = FIRMWARE_PX4;
                    ESP_LOGI(TAG, "🎯 Detected PX4 firmware (autopilot=%d)", autopilot);
                    Serial.printf("🎯 Firmware detected: PX4 (autopilot=%d)\n", autopilot);
                    break;
                case 0:  // MAV_AUTOPILOT_GENERIC
                    firmwareType = FIRMWARE_GENERIC;
                    ESP_LOGI(TAG, "🎯 Detected Generic firmware (autopilot=%d)", autopilot);
                    Serial.printf("🎯 Firmware detected: Generic (autopilot=%d)\n", autopilot);
                    break;
                default:
                    if (heartbeatCount >= 10) { // Give up after 10 heartbeats
                        firmwareType = FIRMWARE_GENERIC;
                        ESP_LOGI(TAG, "🎯 Unknown autopilot type %d, defaulting to Generic", autopilot);
                        Serial.printf("🎯 Unknown autopilot type %d, using Generic\n", autopilot);
                    }
                    break;
            }
        }
    }
    
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

void MAVLinkProcessor::startStatsLogging(uint32_t intervalMs) {
    if (statsTimer != NULL) {
        stopStatsLogging();
    }
    
    statsLoggingInterval = intervalMs;
    statsLoggingEnabled = true;
    
    statsTimer = xTimerCreate(
        "MAVLinkStats",
        pdMS_TO_TICKS(intervalMs),
        pdTRUE,  // Auto-reload
        this,
        statsTimerCallback
    );
    
    if (statsTimer != NULL) {
        if (xTimerStart(statsTimer, 0) == pdPASS) {
            ESP_LOGI(TAG, "Stats logging started (interval: %lums)", intervalMs);
        } else {
            ESP_LOGE(TAG, "Failed to start stats timer");
            statsLoggingEnabled = false;
        }
    } else {
        ESP_LOGE(TAG, "Failed to create stats timer");
        statsLoggingEnabled = false;
    }
}

void MAVLinkProcessor::stopStatsLogging() {
    if (statsTimer != NULL) {
        xTimerStop(statsTimer, 0);
        xTimerDelete(statsTimer, 0);
        statsTimer = NULL;
    }
    statsLoggingEnabled = false;
    ESP_LOGI(TAG, "Stats logging stopped");
}

bool MAVLinkProcessor::isStatsLoggingEnabled() const {
    return statsLoggingEnabled;
}

void MAVLinkProcessor::statsTimerCallback(TimerHandle_t timer) {
    MAVLinkProcessor* processor = static_cast<MAVLinkProcessor*>(pvTimerGetTimerID(timer));
    if (processor) {
        processor->logStatistics();
    }
}

const char* MAVLinkProcessor::getFirmwareTypeString() const {
    switch (firmwareType) {
        case FIRMWARE_ARDUPILOT: return "ArduPilot";
        case FIRMWARE_PX4: return "PX4";
        case FIRMWARE_GENERIC: return "Generic";
        case FIRMWARE_UNKNOWN: return "Unknown";
        default: return "Invalid";
    }
}

void MAVLinkProcessor::logStatistics() {
    uint32_t currentMs = millis();
    uint32_t periodMs = currentMs - stats.lastUpdateMs;
    
    if (periodMs == 0) periodMs = 1;  // Prevent division by zero
    
    float messageRate = (stats.totalMessages * 1000.0f) / periodMs;
    
    ESP_LOGI(TAG, "===== MAVLink Stats (10s) =====");
    ESP_LOGI(TAG, "Firmware: %s (%d heartbeats)", getFirmwareTypeString(), heartbeatCount);
    ESP_LOGI(TAG, "Total Messages: %lu (%.1f msg/s)", 
             stats.totalMessages, messageRate);
    ESP_LOGI(TAG, "Errors: CRC=%lu, Parse=%lu, Seq=%lu", 
             stats.crcErrors, stats.parseErrors, stats.sequenceErrors);
    
    // Check if we have any message types to show
    if (stats.messageTypes.empty()) {
        ESP_LOGI(TAG, "No messages received yet");
    } else {
        // Find top 5 message types
        struct MessageTypeCount {
            uint32_t id;
            uint32_t count;
        };
        
        std::vector<MessageTypeCount> sortedTypes;
        for (const auto& pair : stats.messageTypes) {
            sortedTypes.push_back({pair.first, pair.second});
        }
        
        // Sort by count descending
        std::sort(sortedTypes.begin(), sortedTypes.end(), 
                  [](const MessageTypeCount& a, const MessageTypeCount& b) {
                      return a.count > b.count;
                  });
        
        ESP_LOGI(TAG, "Top Message Types:");
        size_t topCount = std::min(sortedTypes.size(), size_t(5));
        for (size_t i = 0; i < topCount; i++) {
            const char* msgName = "UNKNOWN";
            switch (sortedTypes[i].id) {
                case 0: msgName = "HEARTBEAT"; break;
                case 1: msgName = "SYS_STATUS"; break;
                case 24: msgName = "GPS_RAW_INT"; break;
                case 30: msgName = "ATTITUDE"; break;
                case 33: msgName = "GLOBAL_POSITION_INT"; break;
                case 74: msgName = "VFR_HUD"; break;
                case 241: msgName = "VIBRATION"; break;
                case 242: msgName = "HOME_POSITION"; break;
            }
            ESP_LOGI(TAG, "  - %s(%lu): %lu", 
                     msgName, sortedTypes[i].id, sortedTypes[i].count);
        }
    }
    
    ESP_LOGI(TAG, "Active for: %lus", currentMs / 1000);
    ESP_LOGI(TAG, "==============================");
}