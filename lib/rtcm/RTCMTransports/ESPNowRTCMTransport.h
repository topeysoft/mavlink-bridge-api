#pragma once

#include "RTCMTransport.h"
#include <esp_now.h>
#include <WiFi.h>
#include <vector>

/**
 * Transport that sends RTCM data via ESP-NOW
 * Supports peer-to-peer and broadcast communication
 */
class ESPNowRTCMTransport : public RTCMTransport {
private:
    struct Peer {
        uint8_t mac[6];
        bool broadcast;
        uint8_t channel;
    };

    std::vector<Peer> peers;
    bool isESPNowInitialized;

    static const size_t MAX_ESPNOW_PAYLOAD = 250;  // ESP-NOW max payload
    static ESPNowRTCMTransport* instance;  // For static callbacks

public:
    ESPNowRTCMTransport();
    ~ESPNowRTCMTransport() override;

    bool begin(const JsonObjectConst& config) override;
    void end() override;

    size_t send(const uint8_t* data, size_t length) override;

    bool isReady() const override;
    State getState() const override;

    const char* getTypeName() const override { return "espnow"; }

    // Peer management
    bool addPeer(const uint8_t* macAddress, uint8_t channel = 0);
    bool addPeer(const char* macString, uint8_t channel = 0);
    void clearPeers();

private:
    bool initESPNow();
    void deinitESPNow();
    bool parseMacAddress(const char* macStr, uint8_t* mac);

    // ESP-NOW callbacks
    static void onDataSent(const uint8_t* mac, esp_now_send_status_t status);
};
