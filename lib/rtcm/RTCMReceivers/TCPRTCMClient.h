#pragma once

#include "../RTCMCommon.h"
#include "../RTCMClient/RTCMClient.h"
#include <WiFiClient.h>

class TCPRTCMClient : public RTCMClient {
private:
    char host[64];
    uint16_t port;
    WiFiClient tcpClient;
    
    uint32_t reconnectDelay;
    uint32_t lastReconnectAttempt;
    uint32_t connectionTimeout;

public:
    TCPRTCMClient(const char* host, uint16_t port);
    ~TCPRTCMClient();
    
    bool connect() override;
    void disconnect() override;
    const char* getTypeName() const override { return "TCP"; }
    
    void setConnectionTimeout(uint32_t timeout) { connectionTimeout = timeout; }

private:
    static void tcpTaskFunction(void* parameter);
    void runReceiveTask();
};