#pragma once

#include "../RTCMFormatters/RTCMDataFormatter.h"
#include "../RTCMTransports/RTCMTransport.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include <memory>

/**
 * Routes RTCM data to multiple outputs with configurable formatters and transports
 *
 * Architecture:
 *   RTCM Data → Formatter (raw/mavlink) → Transport (tcp/udp/espnow/serial)
 *
 * Example:
 *   - Send raw RTCM via UDP broadcast
 *   - Send MAVLink-wrapped RTCM via serial to flight controller
 *   - Send raw RTCM via ESP-NOW to another ESP32
 */
class RTCMOutputRouter {
public:
    struct OutputTarget {
        std::unique_ptr<RTCMDataFormatter> formatter;
        std::unique_ptr<RTCMTransport> transport;
        bool enabled;
        String name;

        OutputTarget() : enabled(true), name("") {}
    };

    struct Statistics {
        size_t totalTargets;
        size_t activeTargets;
        uint32_t messagesRouted;
        uint32_t bytesRouted;
        uint32_t routingErrors;
        uint32_t lastRouteTime;
    };

private:
    std::vector<OutputTarget> targets;
    Statistics stats;
    SemaphoreHandle_t routerMutex;

public:
    RTCMOutputRouter();
    ~RTCMOutputRouter();

    /**
     * Initialize router with configuration
     * @param config JSON configuration with output targets
     * @return true if successful
     */
    bool begin(const JsonArrayConst& config);

    /**
     * Add a single output target
     * @param config JSON configuration for the target
     * @return true if successful
     */
    bool addTarget(const JsonObjectConst& config);

    /**
     * Remove all output targets
     */
    void clearTargets();

    /**
     * Route RTCM data to all configured outputs
     * @param rtcmData Raw RTCM message data
     * @param length Length of RTCM data
     */
    void route(const uint8_t* rtcmData, size_t length);

    /**
     * Enable/disable a specific target by index
     */
    bool setTargetEnabled(size_t index, bool enabled);

    /**
     * Get number of configured targets
     */
    size_t getTargetCount() const { return targets.size(); }

    /**
     * Get statistics
     */
    Statistics getStatistics() const { return stats; }

    /**
     * Reset statistics
     */
    void resetStatistics();

    /**
     * Get target information for status/debugging
     * @param doc JSON document to populate with target info
     */
    void getTargetInfo(JsonDocument& doc) const;

private:
    std::unique_ptr<RTCMDataFormatter> createFormatter(const char* type,
                                                       const JsonObjectConst& params);
    std::unique_ptr<RTCMTransport> createTransport(const char* type,
                                                    const JsonObjectConst& params);
};
