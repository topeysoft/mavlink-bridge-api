#pragma once

#include "RTCMTransport.h"
#include <WiFi.h>
#include <vector>

/**
 * Transport that sends RTCM data to TCP clients
 * Acts as TCP server accepting multiple client connections
 */
class TCPRTCMTransport : public RTCMTransport {
private:
    WiFiServer* server;
    uint16_t port;
    std::vector<WiFiClient> clients;
    uint32_t lastCleanupTime;

    static const size_t MAX_CLIENTS = 5;
    static const uint32_t CLEANUP_INTERVAL = 5000;  // 5 seconds

public:
    TCPRTCMTransport();
    ~TCPRTCMTransport() override;

    bool begin(const JsonObjectConst& config) override;
    void end() override;

    size_t send(const uint8_t* data, size_t length) override;

    bool isReady() const override;
    State getState() const override;

    const char* getTypeName() const override { return "tcp"; }

private:
    void acceptNewClients();
    void cleanupDisconnectedClients();
};
