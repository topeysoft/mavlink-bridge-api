#pragma once

#include "RTCMDataFormatter.h"

/**
 * Pass-through formatter that sends raw RTCM data unchanged
 */
class RawRTCMFormatter : public RTCMDataFormatter {
public:
    RawRTCMFormatter() = default;
    ~RawRTCMFormatter() override = default;

    void format(const uint8_t* rtcmData, size_t length, OutputCallback callback) override;

    const char* getTypeName() const override { return "raw"; }
};
