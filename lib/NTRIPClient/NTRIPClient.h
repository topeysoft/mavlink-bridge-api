#pragma once

#include "../RTCMClient/RTCMClient.h"
#include <WiFiClient.h>

class NTRIPClient : public RTCMClient {
public:
    struct Config {
        char host[64];
        uint16_t port;
        char mountpoint[32];
        char username[32];
        char password[32];
        bool sendPosition;
        float latitude;   // For VRS
        float longitude;  // For VRS
        float altitude;   // For VRS
    };

private:
    Config config;
    WiFiClient tcpClient;
    
    uint32_t lastGGATime;
    uint32_t ggaInterval;
    uint32_t reconnectDelay;
    uint32_t lastReconnectAttempt;
    
    bool authenticated;
    char userAgent[64];

public:
    NTRIPClient(const Config& cfg);
    ~NTRIPClient();
    
    bool connect() override;
    void disconnect() override;
    const char* getTypeName() const override { return "NTRIP"; }
    
    void setPosition(float lat, float lon, float alt);
    bool isAuthenticated() const { return authenticated; }

private:
    bool authenticateHTTP();
    bool sendRequest();
    bool parseResponse();
    void sendNMEAPosition();
    char* generateGGA(char* buffer, size_t bufferSize);
    uint8_t calculateNMEAChecksum(const char* sentence);
    
    static void ntripTaskFunction(void* parameter);
    void runReceiveTask();
    
    bool parseSourceTable(const char* data);
    bool waitForData(uint32_t timeout);
};