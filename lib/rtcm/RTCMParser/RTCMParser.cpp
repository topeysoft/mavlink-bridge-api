#include "RTCMParser.h"
#include <esp_log.h>

static const char* TAG = "RTCMParser";

bool RTCMParser::parseMessage(const uint8_t* data, size_t length, RTCMMessage& message) {
    if (length < 6) {
        return false;
    }
    
    // Check preamble
    if (data[0] != RTCM3_PREAMBLE) {
        return false;
    }
    
    // Extract message length
    uint16_t payloadLength = ((data[1] & 0x03) << 8) | data[2];
    size_t totalLength = payloadLength + 6;  // header(3) + payload + CRC(3)
    
    if (length < totalLength) {
        return false;
    }
    
    // Extract message type (12 bits)
    message.messageType = (data[3] << 4) | (data[4] >> 4);
    message.payload = &data[3];  // Payload starts after header
    message.payloadLength = payloadLength;
    message.totalLength = totalLength;
    
    // Try to extract station ID and timestamp
    extractStationId(data, length, message.stationId);
    extractTimestamp(data, length, message.messageType, message.timestamp);
    
    return true;
}

bool RTCMParser::isCompleteMessage(const uint8_t* buffer, size_t length) {
    if (length < 3) return false;
    if (buffer[0] != RTCM3_PREAMBLE) return false;
    
    uint16_t payloadLength = ((buffer[1] & 0x03) << 8) | buffer[2];
    size_t totalLength = payloadLength + 6;
    
    return length >= totalLength;
}

size_t RTCMParser::findMessageStart(const uint8_t* buffer, size_t length) {
    for (size_t i = 0; i < length; i++) {
        if (buffer[i] == RTCM3_PREAMBLE) {
            return i;
        }
    }
    return (size_t)-1;
}

size_t RTCMParser::getMessageLength(const uint8_t* data, size_t available) {
    if (available < 3) return 0;
    if (data[0] != RTCM3_PREAMBLE) return 0;
    
    uint16_t payloadLength = ((data[1] & 0x03) << 8) | data[2];
    return payloadLength + 6;
}

bool RTCMParser::isPositionMessage(uint16_t messageType) {
    return (messageType == 1005 || messageType == 1006);
}

bool RTCMParser::isMSMMessage(uint16_t messageType) {
    return (messageType >= 1071 && messageType <= 1127);
}

bool RTCMParser::isObservationMessage(uint16_t messageType) {
    return ((messageType >= 1001 && messageType <= 1004) ||
            (messageType >= 1009 && messageType <= 1012) ||
            isMSMMessage(messageType));
}

const char* RTCMParser::getMessageTypeName(uint16_t messageType) {
    switch (messageType) {
        // GPS messages
        case 1001: return "GPS L1-Only RTK";
        case 1002: return "GPS Extended L1-Only RTK";
        case 1003: return "GPS L1&L2 RTK";
        case 1004: return "GPS Extended L1&L2 RTK";
        case 1005: return "Station ARP";
        case 1006: return "Station ARP with Height";
        case 1007: return "Antenna Descriptor";
        case 1008: return "Antenna Descriptor & Serial";
        
        // GLONASS messages
        case 1009: return "GLONASS L1-Only RTK";
        case 1010: return "GLONASS Extended L1-Only RTK";
        case 1011: return "GLONASS L1&L2 RTK";
        case 1012: return "GLONASS Extended L1&L2 RTK";
        
        // MSM messages
        case 1071: return "GPS MSM1";
        case 1072: return "GPS MSM2";
        case 1073: return "GPS MSM3";
        case 1074: return "GPS MSM4";
        case 1075: return "GPS MSM5";
        case 1076: return "GPS MSM6";
        case 1077: return "GPS MSM7";
        
        case 1081: return "GLONASS MSM1";
        case 1082: return "GLONASS MSM2";
        case 1083: return "GLONASS MSM3";
        case 1084: return "GLONASS MSM4";
        case 1085: return "GLONASS MSM5";
        case 1086: return "GLONASS MSM6";
        case 1087: return "GLONASS MSM7";
        
        case 1091: return "Galileo MSM1";
        case 1092: return "Galileo MSM2";
        case 1093: return "Galileo MSM3";
        case 1094: return "Galileo MSM4";
        case 1095: return "Galileo MSM5";
        case 1096: return "Galileo MSM6";
        case 1097: return "Galileo MSM7";
        
        case 1101: return "SBAS MSM1";
        case 1102: return "SBAS MSM2";
        case 1103: return "SBAS MSM3";
        case 1104: return "SBAS MSM4";
        case 1105: return "SBAS MSM5";
        case 1106: return "SBAS MSM6";
        case 1107: return "SBAS MSM7";
        
        case 1111: return "QZSS MSM1";
        case 1112: return "QZSS MSM2";
        case 1113: return "QZSS MSM3";
        case 1114: return "QZSS MSM4";
        case 1115: return "QZSS MSM5";
        case 1116: return "QZSS MSM6";
        case 1117: return "QZSS MSM7";
        
        case 1121: return "BDS MSM1";
        case 1122: return "BDS MSM2";
        case 1123: return "BDS MSM3";
        case 1124: return "BDS MSM4";
        case 1125: return "BDS MSM5";
        case 1126: return "BDS MSM6";
        case 1127: return "BDS MSM7";
        
        case 1230: return "GLONASS Code-Phase Biases";
        
        default: return "Unknown";
    }
}

const char* RTCMParser::getMessageDescription(uint16_t messageType) {
    if (messageType >= 1071 && messageType <= 1077) {
        int msmLevel = ((messageType - 1071) % 10) + 1;
        switch (msmLevel) {
            case 1: return "Compact pseudoranges";
            case 2: return "Compact pseudoranges and phaseranges";
            case 3: return "Compact pseudoranges and carrier phases";
            case 4: return "Full pseudoranges and carrier phases plus CNR";
            case 5: return "Full pseudoranges, carrier phases, Doppler and CNR";
            case 6: return "Full pseudoranges and carrier phases plus CNR (high resolution)";
            case 7: return "Full pseudoranges, carrier phases, Doppler and CNR (high resolution)";
        }
    }
    
    switch (messageType) {
        case 1005: return "Stationary RTK reference station ARP";
        case 1006: return "Stationary RTK reference station ARP with antenna height";
        case 1007: return "Antenna descriptor";
        case 1008: return "Antenna descriptor & serial number";
        case 1230: return "GLONASS L1 and L2 Code-Phase biases";
        default: return "";
    }
}

bool RTCMParser::extractStationId(const uint8_t* data, size_t length, uint16_t& stationId) {
    if (length < 6) return false;
    
    uint16_t messageType = (data[3] << 4) | (data[4] >> 4);
    
    // Station ID is typically in bits 12-23 of most messages
    // This is a simplified extraction - actual position varies by message type
    if (isObservationMessage(messageType) || isPositionMessage(messageType)) {
        if (length >= 7) {
            stationId = ((data[4] & 0x0F) << 8) | data[5];
            return true;
        }
    }
    
    return false;
}

bool RTCMParser::extractTimestamp(const uint8_t* data, size_t length, uint16_t messageType, uint32_t& timestamp) {
    // Timestamp extraction is message-specific
    // This is a simplified version - actual implementation would need to handle each message type
    
    if (isObservationMessage(messageType)) {
        // GPS messages have epoch time after station ID
        if (messageType >= 1001 && messageType <= 1004) {
            if (length >= 10) {
                // 30-bit TOW in milliseconds
                timestamp = ((data[6] << 22) | (data[7] << 14) | (data[8] << 6) | (data[9] >> 2));
                return true;
            }
        }
        // MSM messages have different structure
        else if (isMSMMessage(messageType)) {
            if (length >= 13) {
                // Simplified - actual parsing is more complex
                timestamp = ((data[9] << 22) | (data[10] << 14) | (data[11] << 6) | (data[12] >> 2));
                return true;
            }
        }
    }
    
    return false;
}