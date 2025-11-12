#pragma once

#include "RTCMDataFormatter.h"
#include "../../mavlink/MAVLinkConverter/MAVLinkConverter.h"

/**
 * Formatter that wraps RTCM data in MAVLink GPS_RTCM_DATA messages
 * Handles fragmentation for data > 180 bytes
 */
class MAVLinkRTCMFormatter : public RTCMDataFormatter {
private:
    MAVLinkConverter converter;

public:
    MAVLinkRTCMFormatter(uint8_t systemId = 1, uint8_t componentId = 1);
    ~MAVLinkRTCMFormatter() override = default;

    void format(const uint8_t* rtcmData, size_t length, OutputCallback callback) override;

    const char* getTypeName() const override { return "mavlink"; }

    size_t getMaxFragmentSize() const override { return 180; } // MAVLink fragment size

    void reset() override { converter.resetSequence(); }

    // Configuration
    void setSystemId(uint8_t id) { converter.setSystemId(id); }
    void setComponentId(uint8_t id) { converter.setComponentId(id); }
};
