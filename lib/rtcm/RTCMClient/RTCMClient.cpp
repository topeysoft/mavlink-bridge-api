#include "RTCMClient.h"
#include <esp_log.h>
#include <cstring>

static const char* TAG = "RTCMClient";

// RTCM3 preamble byte
static const uint8_t RTCM3_PREAMBLE = 0xD3;

// CRC24 lookup table for RTCM3
static const uint32_t CRC24_TABLE[256] = {
    0x000000, 0x864CFB, 0x8AD50D, 0x0C99F6, 0x93E6E1, 0x15AA1A, 0x1933EC, 0x9F7F17,
    0xA18139, 0x27CDC2, 0x2B5434, 0xAD18CF, 0x3267D8, 0xB42B23, 0xB8B2D5, 0x3EFE2E,
    0xC54E89, 0x430272, 0x4F9B84, 0xC9D77F, 0x56A868, 0xD0E493, 0xDC7D65, 0x5A319E,
    0x64CFB0, 0xE2834B, 0xEE1ABD, 0x685646, 0xF72951, 0x7165AA, 0x7DFC5C, 0xFBB0A7,
    0x0CD1E9, 0x8A9D12, 0x8604E4, 0x00481F, 0x9F3708, 0x197BF3, 0x15E205, 0x93AEFE,
    0xAD50D0, 0x2B1C2B, 0x2785DD, 0xA1C926, 0x3EB631, 0xB8FACA, 0xB4633C, 0x322FC7,
    0xC99F60, 0x4FD39B, 0x434A6D, 0xC50696, 0x5A7981, 0xDC357A, 0xD0AC8C, 0x56E077,
    0x681E59, 0xEE52A2, 0xE2CB54, 0x6487AF, 0xFBF8B8, 0x7DB443, 0x712DB5, 0xF7614E,
    0x19A3D2, 0x9FEF29, 0x9376DF, 0x153A24, 0x8A4533, 0x0C09C8, 0x00903E, 0x86DCC5,
    0xB822EB, 0x3E6E10, 0x32F7E6, 0xB4BB1D, 0x2BC40A, 0xAD88F1, 0xA11107, 0x275DFC,
    0xDCED5B, 0x5AA1A0, 0x563856, 0xD074AD, 0x4F0BBA, 0xC94741, 0xC5DEB7, 0x43924C,
    0x7D6C62, 0xFB2099, 0xF7B96F, 0x71F594, 0xEE8A83, 0x68C678, 0x645F8E, 0xE21375,
    0x15723B, 0x933EC0, 0x9FA736, 0x19EBCD, 0x8694DA, 0x00D821, 0x0C41D7, 0x8A0D2C,
    0xB4F302, 0x32BFF9, 0x3E260F, 0xB86AF4, 0x2715E3, 0xA15918, 0xADC0EE, 0x2B8C15,
    0xD03CB2, 0x567049, 0x5AE9BF, 0xDCA544, 0x43DA53, 0xC596A8, 0xC90F5E, 0x4F43A5,
    0x71BD8B, 0xF7F170, 0xFB6886, 0x7D247D, 0xE25B6A, 0x641791, 0x688E67, 0xEEC29C,
    0x334BA5, 0xB5075E, 0xB99EA8, 0x3FD253, 0xA0AD44, 0x26E1BF, 0x2A7849, 0xAC34B2,
    0x92CA9C, 0x148667, 0x181F91, 0x9E536A, 0x012C7D, 0x876086, 0x8BF970, 0x0DB58B,
    0xF6052C, 0x7049D7, 0x7CD021, 0xFA9CDA, 0x65E3CD, 0xE3AF36, 0xEF36C0, 0x697A3B,
    0x578415, 0xD1C8EE, 0xDD5118, 0x5B1DE3, 0xC462F4, 0x422E0F, 0x4EB7F9, 0xC8FB02,
    0x3F9A4C, 0xB9D6B7, 0xB54F41, 0x3303BA, 0xAC7CAD, 0x2A3056, 0x26A9A0, 0xA0E55B,
    0x9E1B75, 0x18578E, 0x14CE78, 0x928283, 0x0DFD94, 0x8BB16F, 0x872899, 0x016462,
    0xFAD4C5, 0x7C983E, 0x7001C8, 0xF64D33, 0x693224, 0xEF7EDF, 0xE3E729, 0x65ABD2,
    0x5B55FC, 0xDD1907, 0xD180F1, 0x57CC0A, 0xC8B31D, 0x4EFFE6, 0x426610, 0xC42AEB,
    0x52A033, 0xD4ECC8, 0xD8753E, 0x5E39C5, 0xC146D2, 0x470A29, 0x4B93DF, 0xCDDF24,
    0xF3210A, 0x756DF1, 0x79F407, 0xFFB8FC, 0x60C7EB, 0xE68B10, 0xEA12E6, 0x6C5E1D,
    0x97EEBA, 0x11A241, 0x1D3BB7, 0x9B774C, 0x04085B, 0x8244A0, 0x8EDD56, 0x0891AD,
    0x366F83, 0xB02378, 0xBCBA8E, 0x3AF675, 0xA58962, 0x23C599, 0x2F5C6F, 0xA91094,
    0x5EA0DA, 0xD8EC21, 0xD475D7, 0x52392C, 0xCD463B, 0x4B0AC0, 0x479336, 0xC1DFCD,
    0xFF21E3, 0x796D18, 0x75F4EE, 0xF3B815, 0x6CC702, 0xEA8BF9, 0xE6120F, 0x605EF4,
    0x9BEE53, 0x1DA2A8, 0x113B5E, 0x9777A5, 0x0808B2, 0x8E4449, 0x82DDBF, 0x049144,
    0x3A6F6A, 0xBC2391, 0xB0BA67, 0x36F69C, 0xA9898B, 0x2FC570, 0x235C86, 0xA5107D
};

RTCMClient::RTCMClient() 
    : currentState(DISCONNECTED)
    , bufferPos(0)
    , receiveTask(nullptr)
    , lastDataTime(0)
    , bytesInPeriod(0)
    , periodStartTime(0) {
    memset(&stats, 0, sizeof(stats));
    memset(buffer, 0, sizeof(buffer));
}

RTCMClient::~RTCMClient() {
    // Don't call pure virtual disconnect() from destructor
    // Derived classes should handle cleanup in their own destructors
}

void RTCMClient::resetStatistics() {
    memset(&stats, 0, sizeof(stats));
    stats.messageTypeCounts.clear();
    bytesInPeriod = 0;
    periodStartTime = millis();
}

void RTCMClient::setState(State newState) {
    if (currentState != newState) {
        currentState = newState;
        ESP_LOGI(TAG, "%s state changed to: %d", getTypeName(), (int)newState);
        
        if (stateCallback) {
            stateCallback(newState);
        }
    }
}

void RTCMClient::processRTCMData(const uint8_t* data, size_t length) {
    if (length == 0) return;
    
    // Update statistics
    stats.bytesReceived += length;
    bytesInPeriod += length;
    lastDataTime = millis();
    updateDataRate();
    
    // Add to buffer
    size_t spaceAvailable = sizeof(buffer) - bufferPos;
    size_t toCopy = (length > spaceAvailable) ? spaceAvailable : length;
    
    if (toCopy > 0) {
        memcpy(&buffer[bufferPos], data, toCopy);
        bufferPos += toCopy;
        
        // Process complete messages in buffer
        findAndProcessMessages();
    }
    
    // If we couldn't fit all data, process remaining
    if (length > toCopy) {
        ESP_LOGW(TAG, "Buffer overflow, dropping %d bytes", length - toCopy);
    }
}

void RTCMClient::findAndProcessMessages() {
    size_t processed = 0;
    
    while (processed < bufferPos) {
        // Find message start
        size_t start = findMessageStart(&buffer[processed], bufferPos - processed);
        if (start == (size_t)-1) {
            // No valid message found
            break;
        }
        
        processed += start;
        
        // Check if we have enough data for the header
        if (bufferPos - processed < 3) {
            break;  // Need more data
        }
        
        // Get message length
        size_t msgLength = getMessageLength(&buffer[processed], bufferPos - processed);
        if (msgLength == 0 || msgLength > 1023 + 6) {
            // Invalid length
            processed++;
            continue;
        }
        
        // Check if we have the complete message
        if (bufferPos - processed < msgLength) {
            break;  // Need more data
        }
        
        // Validate message
        if (validateRTCMMessage(&buffer[processed], msgLength)) {
            // Extract message type
            uint16_t messageType = (buffer[processed + 3] << 4) | (buffer[processed + 4] >> 4);
            
            // Update statistics
            stats.messagesReceived++;
            stats.lastMessageTime = millis();
            stats.messageTypeCounts[messageType]++;
            
            ESP_LOGD(TAG, "Received RTCM message type %d, length %d", messageType, msgLength);
            
            // Call data callback
            if (dataCallback) {
                dataCallback(&buffer[processed], msgLength);
            }
        } else {
            stats.crcErrors++;
            ESP_LOGW(TAG, "CRC error in RTCM message");
        }
        
        processed += msgLength;
    }
    
    // Move remaining data to beginning of buffer
    if (processed > 0 && processed < bufferPos) {
        memmove(buffer, &buffer[processed], bufferPos - processed);
        bufferPos -= processed;
    } else if (processed >= bufferPos) {
        bufferPos = 0;
    }
}

size_t RTCMClient::findMessageStart(const uint8_t* data, size_t length) {
    for (size_t i = 0; i < length; i++) {
        if (data[i] == RTCM3_PREAMBLE) {
            return i;
        }
    }
    return (size_t)-1;
}

size_t RTCMClient::getMessageLength(const uint8_t* data, size_t available) {
    if (available < 3) return 0;
    
    if (data[0] != RTCM3_PREAMBLE) return 0;
    
    uint16_t length = ((data[1] & 0x03) << 8) | data[2];
    return length + 6;  // Add header (3) and CRC (3)
}

bool RTCMClient::validateRTCMMessage(const uint8_t* message, size_t length) {
    if (length < 6) return false;
    if (message[0] != RTCM3_PREAMBLE) return false;
    
    // Extract payload length
    uint16_t payloadLength = ((message[1] & 0x03) << 8) | message[2];
    if (payloadLength + 6 != length) return false;
    
    // Calculate CRC24 (excludes the CRC bytes themselves)
    uint32_t calculated = calculateCRC24(message, length - 3);
    
    // Extract CRC from message
    uint32_t received = (message[length - 3] << 16) | 
                       (message[length - 2] << 8) | 
                       message[length - 1];
    
    return calculated == received;
}

uint32_t RTCMClient::calculateCRC24(const uint8_t* data, size_t length) {
    uint32_t crc = 0;
    
    for (size_t i = 0; i < length; i++) {
        crc = (crc << 8) ^ CRC24_TABLE[((crc >> 16) ^ data[i]) & 0xFF];
    }
    
    return crc & 0xFFFFFF;
}

void RTCMClient::updateDataRate() {
    uint32_t now = millis();
    uint32_t elapsed = now - periodStartTime;
    
    if (elapsed >= 1000) {  // Update every second
        stats.dataRate = (float)bytesInPeriod / 1024.0f;  // KB/s
        bytesInPeriod = 0;
        periodStartTime = now;
    }
}