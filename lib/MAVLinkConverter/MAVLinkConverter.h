#pragma once

#include <Arduino.h>
#include <vector>
#include <mavlink/common/mavlink.h>

class MAVLinkConverter {
private:
    uint8_t systemId;
    uint8_t componentId;
    uint8_t sequenceNumber;
    
    // Buffer for fragmenting RTCM data
    static const size_t MAX_RTCM_FRAGMENT_SIZE = 180;  // MAVLink GPS_RTCM_DATA max payload

public:
    MAVLinkConverter(uint8_t sysId = 1, uint8_t compId = 1);
    
    // Fragment RTCM data into MAVLink messages (max 180 bytes/message)
    std::vector<mavlink_message_t> convertRTCMToMAVLink(
        const uint8_t* rtcmData,
        size_t length
    );
    
    // Create a single GPS_RTCM_DATA message
    mavlink_message_t createRTCMMessage(
        const uint8_t* data,
        uint8_t len,
        uint8_t flags
    );
    
    // Helper to inject data to flight controller
    bool injectToFC(const mavlink_message_t& message, Stream* fcStream);
    
    // Helper to send all fragments
    bool sendRTCMData(const uint8_t* rtcmData, size_t length, Stream* fcStream);
    
    // Setters
    void setSystemId(uint8_t id) { systemId = id; }
    void setComponentId(uint8_t id) { componentId = id; }
    
    // Reset sequence number (useful after reconnection)
    void resetSequence() { sequenceNumber = 0; }
    
private:
    uint8_t getNextSequence();
};