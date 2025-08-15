#pragma once

#include <Arduino.h>
#include <vector>
#include <functional>
#include <map>

class RTCMClient {
public:
    enum State {
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
    using StateCallback = std::function<void(State)>;

protected:
    State currentState;
    Statistics stats;
    uint8_t buffer[2048];
    size_t bufferPos;
    TaskHandle_t receiveTask;
    
    DataCallback dataCallback;
    StateCallback stateCallback;
    
    uint32_t lastDataTime;
    uint32_t bytesInPeriod;
    uint32_t periodStartTime;

public:
    RTCMClient();
    virtual ~RTCMClient();
    
    virtual bool connect() = 0;
    virtual void disconnect() = 0;
    virtual const char* getTypeName() const = 0;
    
    State getState() const { return currentState; }
    Statistics getStatistics() const { return stats; }
    
    void setDataCallback(DataCallback callback) { dataCallback = callback; }
    void setStateCallback(StateCallback callback) { stateCallback = callback; }
    
    void resetStatistics();

protected:
    void setState(State newState);
    void processRTCMData(const uint8_t* data, size_t length);
    bool validateRTCMMessage(const uint8_t* message, size_t length);
    uint32_t calculateCRC24(const uint8_t* data, size_t length);
    void updateDataRate();
    
    void findAndProcessMessages();
    size_t findMessageStart(const uint8_t* data, size_t length);
    size_t getMessageLength(const uint8_t* data, size_t available);
};