#pragma once

#include "RTCMTransport.h"
#include "../../communication/DataRouter/DataRouter.h"

/**
 * Transport that sends RTCM data via USB/UART using DataRouter
 * Sends data to flight controller or other serial device
 */
class SerialRTCMTransport : public RTCMTransport {
private:
    DataRouter* dataRouter;
    DataRouter::Interface targetInterface;
    HardwareSerial* directSerial;  // Optional: direct serial access
    bool useDataRouter;

public:
    SerialRTCMTransport();
    ~SerialRTCMTransport() override;

    bool begin(const JsonObjectConst& config) override;
    void end() override;

    size_t send(const uint8_t* data, size_t length) override;

    bool isReady() const override;
    State getState() const override;

    const char* getTypeName() const override { return "serial"; }
};
