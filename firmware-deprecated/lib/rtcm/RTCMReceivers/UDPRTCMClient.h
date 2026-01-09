#pragma once

#include "RTCMCommon.h"
#include "RTCMClient/RTCMClient.h"
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>

class UDPRTCMClient : public RTCMClient
{
private:
    uint16_t port;
    WiFiUDP udp;

    IPAddress remoteIP;
    uint16_t remotePort;
    bool acceptAnySource;

public:
    UDPRTCMClient(uint16_t port);
    ~UDPRTCMClient();

    bool connect() override;
    void disconnect() override;
    const char *getTypeName() const override { return "UDP"; }

    void setRemoteEndpoint(IPAddress ip, uint16_t port);
    void setAcceptAnySource(bool accept) { acceptAnySource = accept; }

private:
    static void udpTaskFunction(void *parameter);
    void runReceiveTask();
};