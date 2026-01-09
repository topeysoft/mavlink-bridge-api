#pragma once

#include <Arduino.h>
#include <cstdint>
#include <map>
#include <functional>

namespace RTCM {

enum class ClientState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR
};

struct Statistics {
    uint32_t messagesReceived;
    uint32_t bytesReceived;
    uint32_t crcErrors;
    uint32_t lastMessageTime;
    float dataRate;  // KB/s
    std::map<uint16_t, uint32_t> messageTypeCounts;
};

using DataCallback = std::function<void(const uint8_t*, size_t)>;
using StateCallback = std::function<void(ClientState)>;

struct MessageInfo {
    uint16_t messageType;
    uint16_t stationId;
    uint32_t timestamp;
    const uint8_t* payload;
    size_t payloadLength;
    size_t totalLength;
};

static const uint8_t RTCM3_PREAMBLE = 0xD3;
static const size_t MAX_BUFFER_SIZE = 2048;
static const uint32_t DATA_RATE_CALC_PERIOD = 1000; // ms

const char* getClientStateString(ClientState state);
const char* getMessageTypeName(uint16_t messageType);
const char* getMessageDescription(uint16_t messageType);
bool isPositionMessage(uint16_t messageType);
bool isMSMMessage(uint16_t messageType);
bool isObservationMessage(uint16_t messageType);

}