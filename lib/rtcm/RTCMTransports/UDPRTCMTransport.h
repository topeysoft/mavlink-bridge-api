#pragma once

#include "RTCMTransport.h"
#include <WiFiUdp.h>
#include <vector>

/**
 * Transport that sends RTCM data via UDP
 * Supports broadcast and multiple unicast targets
 */
class UDPRTCMTransport : public RTCMTransport {
private:
    WiFiUDP udp;
    uint16_t localPort;
    bool broadcastEnabled;

    struct Target {
        IPAddress address;
        uint16_t port;
    };
    std::vector<Target> targets;

public:
    UDPRTCMTransport();
    ~UDPRTCMTransport() override;

    bool begin(const JsonObjectConst& config) override;
    void end() override;

    size_t send(const uint8_t* data, size_t length) override;

    bool isReady() const override;
    State getState() const override;

    const char* getTypeName() const override { return "udp"; }

    // Helper methods
    bool addTarget(const IPAddress& address, uint16_t port);
    void clearTargets();
};
