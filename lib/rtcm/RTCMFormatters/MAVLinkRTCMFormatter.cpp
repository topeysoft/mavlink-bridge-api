#include "MAVLinkRTCMFormatter.h"
#include <esp_log.h>

static const char* TAG = "MAVLinkRTCMFormatter";

MAVLinkRTCMFormatter::MAVLinkRTCMFormatter(uint8_t systemId, uint8_t componentId)
    : converter(systemId, componentId) {
}

void MAVLinkRTCMFormatter::format(const uint8_t* rtcmData, size_t length, OutputCallback callback) {
    if (!rtcmData || length == 0 || !callback) {
        return;
    }

    // Use MAVLinkConverter to fragment RTCM data
    std::vector<mavlink_message_t> messages = converter.convertRTCMToMAVLink(rtcmData, length);

    ESP_LOGD(TAG, "Formatted %d bytes into %d MAVLink fragments", length, messages.size());

    // Convert each MAVLink message to formatted data
    for (size_t i = 0; i < messages.size(); i++) {
        FormattedData formatted;

        // Serialize MAVLink message to buffer
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t msgLen = mavlink_msg_to_send_buffer(buffer, &messages[i]);

        formatted.data.assign(buffer, buffer + msgLen);
        formatted.fragmentIndex = i;
        formatted.totalFragments = messages.size();

        callback(formatted);
    }
}
