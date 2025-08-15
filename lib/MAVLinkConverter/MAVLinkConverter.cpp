#include "MAVLinkConverter.h"
#include <esp_log.h>

static const char* TAG = "MAVLinkConverter";

MAVLinkConverter::MAVLinkConverter(uint8_t sysId, uint8_t compId)
    : systemId(sysId)
    , componentId(compId)
    , sequenceNumber(0) {
}

std::vector<mavlink_message_t> MAVLinkConverter::convertRTCMToMAVLink(
    const uint8_t* rtcmData,
    size_t length) {
    
    std::vector<mavlink_message_t> messages;
    
    if (rtcmData == nullptr || length == 0) {
        return messages;
    }
    
    // Calculate number of fragments needed
    size_t numFragments = (length + MAX_RTCM_FRAGMENT_SIZE - 1) / MAX_RTCM_FRAGMENT_SIZE;
    
    ESP_LOGD(TAG, "Converting %d bytes of RTCM data into %d MAVLink messages", 
             length, numFragments);
    
    // Fragment the RTCM data
    for (size_t i = 0; i < numFragments; i++) {
        size_t offset = i * MAX_RTCM_FRAGMENT_SIZE;
        size_t fragmentLen = (i == numFragments - 1) ? 
                            (length - offset) : MAX_RTCM_FRAGMENT_SIZE;
        
        // Set flags
        uint8_t flags = 0;
        if (numFragments > 1) {
            flags = (i << 3) | (numFragments - 1);  // Fragment sequence and ID
        }
        
        // Create message
        mavlink_message_t msg = createRTCMMessage(&rtcmData[offset], fragmentLen, flags);
        messages.push_back(msg);
    }
    
    return messages;
}

mavlink_message_t MAVLinkConverter::createRTCMMessage(
    const uint8_t* data,
    uint8_t len,
    uint8_t flags) {
    
    mavlink_message_t msg;
    
    // Create GPS_RTCM_DATA message
    mavlink_msg_gps_rtcm_data_pack(
        systemId,
        componentId,
        &msg,
        flags,      // flags (fragmentation info)
        len,        // len
        data        // data
    );
    
    return msg;
}

bool MAVLinkConverter::injectToFC(const mavlink_message_t& message, Stream* fcStream) {
    if (fcStream == nullptr) {
        ESP_LOGE(TAG, "FC stream is null");
        return false;
    }
    
    // Serialize message
    uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
    uint16_t len = mavlink_msg_to_send_buffer(buffer, &message);
    
    // Send to flight controller
    size_t written = fcStream->write(buffer, len);
    
    if (written != len) {
        ESP_LOGE(TAG, "Failed to write complete message: %d/%d bytes", written, len);
        return false;
    }
    
    ESP_LOGD(TAG, "Sent MAVLink message ID %d, %d bytes", message.msgid, len);
    return true;
}

bool MAVLinkConverter::sendRTCMData(const uint8_t* rtcmData, size_t length, Stream* fcStream) {
    if (fcStream == nullptr) {
        ESP_LOGE(TAG, "FC stream is null");
        return false;
    }
    
    // Convert RTCM to MAVLink messages
    std::vector<mavlink_message_t> messages = convertRTCMToMAVLink(rtcmData, length);
    
    // Send all messages
    bool success = true;
    for (const auto& msg : messages) {
        if (!injectToFC(msg, fcStream)) {
            success = false;
            break;
        }
        
        // Small delay between fragments to avoid overwhelming the FC
        vTaskDelay(pdMS_TO_TICKS(1));
    }
    
    return success;
}

uint8_t MAVLinkConverter::getNextSequence() {
    return sequenceNumber++;
}