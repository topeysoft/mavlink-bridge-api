#include "RawRTCMFormatter.h"

void RawRTCMFormatter::format(const uint8_t* rtcmData, size_t length, OutputCallback callback) {
    if (!rtcmData || length == 0 || !callback) {
        return;
    }

    // Pass through unchanged - single fragment
    FormattedData formatted(rtcmData, length);
    formatted.fragmentIndex = 0;
    formatted.totalFragments = 1;

    callback(formatted);
}
