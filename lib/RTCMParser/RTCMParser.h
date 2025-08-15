#pragma once

#include <Arduino.h>
#include <cstdint>

class RTCMParser {
public:
    struct RTCMMessage {
        uint16_t messageType;
        uint16_t stationId;
        uint32_t timestamp;
        const uint8_t* payload;
        size_t payloadLength;
        size_t totalLength;
    };

    static bool parseMessage(const uint8_t* data, size_t length, RTCMMessage& message);
    static bool isCompleteMessage(const uint8_t* buffer, size_t length);
    static size_t findMessageStart(const uint8_t* buffer, size_t length);
    static size_t getMessageLength(const uint8_t* data, size_t available);
    
    // Message type helpers
    static bool isPositionMessage(uint16_t messageType);
    static bool isMSMMessage(uint16_t messageType);
    static bool isObservationMessage(uint16_t messageType);
    static const char* getMessageTypeName(uint16_t messageType);
    static const char* getMessageDescription(uint16_t messageType);
    
    // Message parsing helpers
    static bool extractStationId(const uint8_t* data, size_t length, uint16_t& stationId);
    static bool extractTimestamp(const uint8_t* data, size_t length, uint16_t messageType, uint32_t& timestamp);
    
private:
    static const uint8_t RTCM3_PREAMBLE = 0xD3;
};