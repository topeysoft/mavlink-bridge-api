#pragma once

#include <Arduino.h>
#include <functional>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

namespace Communication {

enum class BaudRate {
    BAUD_57600 = 57600,
    BAUD_115200 = 115200,
    BAUD_230400 = 230400,
    BAUD_460800 = 460800,
    BAUD_921600 = 921600
};

enum class ConnectionState {
    NOT_INITIALIZED,
    INITIALIZED,
    CONNECTING,
    CONNECTED,
    SUSPENDED,
    DISCONNECTED,
    ERROR
};

struct Statistics {
    uint32_t bytesReceived;
    uint32_t bytesSent;
    uint32_t packetsReceived;
    uint32_t packetsSent;
    float dataRate;
    uint32_t lastUpdateMs;
    uint32_t crcErrors;
    uint32_t framingErrors;
};

struct DeviceInfo {
    uint16_t vid;
    uint16_t pid;
    String vendor;
    String product;
    bool isFlightController;
    bool isIdentified;
};

using ConnectCallback = std::function<void()>;
using DisconnectCallback = std::function<void()>;
using DataCallback = std::function<void(uint8_t*, size_t)>;

static const size_t DEFAULT_BUFFER_SIZE = 4096;
static const uint32_t STATS_UPDATE_PERIOD = 1000; // ms
static const uint32_t CONNECTION_TIMEOUT = 10000; // ms

const char* getConnectionStateString(ConnectionState state);
const char* getBaudRateString(BaudRate baud);
bool isValidBaudRate(uint32_t baud);
BaudRate getBaudRateFromValue(uint32_t baud);

}
