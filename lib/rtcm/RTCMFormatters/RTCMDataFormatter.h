#pragma once

#include <Arduino.h>
#include <vector>
#include <functional>

/**
 * Abstract base class for RTCM data formatters
 *
 * Formatters transform raw RTCM data into different protocols
 * (e.g., pass-through raw, wrapped in MAVLink, etc.)
 */
class RTCMDataFormatter {
public:
    struct FormattedData {
        std::vector<uint8_t> data;
        size_t fragmentIndex;
        size_t totalFragments;

        FormattedData() : fragmentIndex(0), totalFragments(1) {}
        FormattedData(const uint8_t* bytes, size_t len)
            : data(bytes, bytes + len), fragmentIndex(0), totalFragments(1) {}
    };

    using OutputCallback = std::function<void(const FormattedData&)>;

    virtual ~RTCMDataFormatter() = default;

    /**
     * Format RTCM data according to protocol
     * May produce multiple fragments for large data
     *
     * @param rtcmData Raw RTCM message data
     * @param length Length of RTCM data
     * @param callback Called for each formatted fragment
     */
    virtual void format(const uint8_t* rtcmData, size_t length, OutputCallback callback) = 0;

    /**
     * Get formatter type name
     */
    virtual const char* getTypeName() const = 0;

    /**
     * Get maximum fragment size (0 = no fragmentation)
     */
    virtual size_t getMaxFragmentSize() const { return 0; }

    /**
     * Reset internal state (useful for sequence numbers, etc.)
     */
    virtual void reset() {}
};
