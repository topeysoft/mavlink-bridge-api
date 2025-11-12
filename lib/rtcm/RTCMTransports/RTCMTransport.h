#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <functional>

/**
 * Abstract base class for RTCM data transports
 *
 * Transports handle the actual delivery of formatted RTCM data
 * via different communication protocols (TCP, UDP, ESP-NOW, Serial)
 */
class RTCMTransport {
public:
    enum State {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,
        ERROR
    };

    struct Statistics {
        uint32_t bytesSent;
        uint32_t messagesSent;
        uint32_t sendErrors;
        uint32_t lastSendTime;
        float sendRate;  // KB/s
    };

    using StateCallback = std::function<void(State)>;

    virtual ~RTCMTransport() = default;

    /**
     * Initialize transport with configuration
     * @param config Transport-specific JSON configuration
     * @return true if initialization successful
     */
    virtual bool begin(const JsonObjectConst& config) = 0;

    /**
     * Cleanup and disconnect transport
     */
    virtual void end() = 0;

    /**
     * Send data via transport
     * @param data Formatted data to send
     * @param length Length of data
     * @return Number of bytes actually sent
     */
    virtual size_t send(const uint8_t* data, size_t length) = 0;

    /**
     * Check if transport is ready to send
     */
    virtual bool isReady() const = 0;

    /**
     * Get current transport state
     */
    virtual State getState() const = 0;

    /**
     * Get transport type name
     */
    virtual const char* getTypeName() const = 0;

    /**
     * Get transport statistics
     */
    virtual Statistics getStatistics() const { return stats; }

    /**
     * Reset statistics
     */
    virtual void resetStatistics() {
        memset(&stats, 0, sizeof(stats));
    }

    /**
     * Set state change callback
     */
    void setStateCallback(StateCallback callback) {
        stateCallback = callback;
    }

protected:
    State currentState = DISCONNECTED;
    Statistics stats;
    StateCallback stateCallback;

    uint32_t bytesInPeriod = 0;
    uint32_t periodStartTime = 0;

    void setState(State newState) {
        if (currentState != newState) {
            currentState = newState;
            if (stateCallback) {
                stateCallback(newState);
            }
        }
    }

    void updateStatistics(size_t bytesSent) {
        stats.bytesSent += bytesSent;
        stats.messagesSent++;
        stats.lastSendTime = millis();

        // Update data rate (KB/s)
        bytesInPeriod += bytesSent;
        uint32_t now = millis();
        uint32_t elapsed = now - periodStartTime;

        if (elapsed >= 1000) {  // Update every second
            stats.sendRate = (float)bytesInPeriod / 1024.0f;
            bytesInPeriod = 0;
            periodStartTime = now;
        }
    }

    void recordError() {
        stats.sendErrors++;
    }
};
