#include "MAVLinkProcessor.h"
#include "EventManager/EventManager.h"
#include <esp_log.h>
#include <algorithm>
#include <common/mavlink.h>

static const char *TAG = "MAVLinkProcessor";

// MAVLink channel for this processor
static const uint8_t MAVLINK_COMM_CHANNEL_IMPL = 0;

// Removed custom CRC table - using official implementation

// Removed custom CRC_EXTRA table - using official implementation

MAVLinkProcessor *MAVLinkProcessor::instance = nullptr;

MAVLinkProcessor::MAVLinkProcessor() : statsTimer(NULL),
                                       statsLoggingEnabled(false),
                                       statsLoggingInterval(10000)
{
    // Initialize official MAVLink parser state
    memset(&rxMessage, 0, sizeof(rxMessage));
    memset(&rxStatus, 0, sizeof(rxStatus));
    memset(expectedSeq, 0, sizeof(expectedSeq));

    // Reset MAVLink channel status
    mavlink_reset_channel_status(MAVLINK_COMM_CHANNEL_IMPL);

    // Initialize statistics properly (cannot use memset on structures with STL containers)
    stats.totalMessages = 0;
    stats.validMessages = 0;
    stats.crcErrors = 0;
    stats.parseErrors = 0;
    stats.sequenceErrors = 0;
    stats.messageTypes.clear();
    stats.lastUpdateMs = millis();

    // Initialize filter properly
    messageFilter.allowedMessageIds.clear();
    messageFilter.allowedSystemIds.clear();
    messageFilter.allowedComponentIds.clear();
    messageFilter.enableFilter = false;

    // Initialize firmware detection
    firmwareType = FIRMWARE_UNKNOWN;
    heartbeatCount = 0;
}

MAVLinkProcessor::~MAVLinkProcessor()
{
    stopStatsLogging();
}

MAVLinkProcessor *MAVLinkProcessor::getInstance()
{
    if (instance == nullptr)
    {
        instance = new MAVLinkProcessor();
    }
    return instance;
}

std::vector<MAVLinkMessage> MAVLinkProcessor::processData(const uint8_t *data, size_t length)
{
    std::vector<MAVLinkMessage> messages;

    if (!data || length == 0)
    {
        ESP_LOGW(TAG, "⚠️ MAVLink: Invalid input - data=%p, length=%d", data, length);
        return messages;
    }

    ESP_LOGD(TAG, "🔍 MAVLink: Processing %d bytes", length);

    // Process each byte using official MAVLink parser
    for (size_t i = 0; i < length; i++)
    {
        mavlink_message_t message;
        mavlink_status_t status;

        // Use official MAVLink parser
        uint8_t result = mavlink_parse_char(MAVLINK_COMM_CHANNEL_IMPL, data[i], &message, &status);

        if (result == MAVLINK_FRAMING_OK)
        {
            ESP_LOGD(TAG, "📡 MAVLink: Valid message received - ID=%lu, SYS=%d, COMP=%d",
                     message.msgid, message.sysid, message.compid);

            // Update statistics
            stats.totalMessages++;
            stats.validMessages++;

            // Check if message should be filtered
            if (!shouldFilterMessage(message))
            {
                // Create wrapper with timestamp
                MAVLinkMessage wrappedMessage;
                wrappedMessage.msg = message;
                wrappedMessage.timestamp = millis();

                messages.push_back(wrappedMessage);
                updateStatistics(message);

                if (messageCallback)
                {
                    messageCallback(wrappedMessage);
                }

                // Publish event with base64-encoded payload
                DynamicJsonDocument payloadDoc(512);  // Increased size for base64 data
                payloadDoc["messageId"] = (int)message.msgid;
                payloadDoc["systemId"] = (int)message.sysid;
                payloadDoc["componentId"] = (int)message.compid;
                payloadDoc["length"] = (int)message.len;

                // Encode payload to base64 for transmission
                // Base64 encoding: 4 chars per 3 bytes, so max ~340 chars for 255 byte payload
                char base64Buffer[400];
                size_t base64Len = 0;

                // Simple base64 encode - ESP32 doesn't have built-in, use manual encoding
                const char* b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                size_t i = 0, j = 0;
                uint8_t a3[3], a4[4];

                // Cast payload64 array to uint8_t* to access raw bytes
                const uint8_t* payload = reinterpret_cast<const uint8_t*>(message.payload64);
                size_t payloadLen = message.len;

                while (payloadLen--) {
                    a3[i++] = *(payload++);
                    if (i == 3) {
                        a4[0] = (a3[0] & 0xfc) >> 2;
                        a4[1] = ((a3[0] & 0x03) << 4) + ((a3[1] & 0xf0) >> 4);
                        a4[2] = ((a3[1] & 0x0f) << 2) + ((a3[2] & 0xc0) >> 6);
                        a4[3] = a3[2] & 0x3f;

                        for (i = 0; i < 4; i++) {
                            base64Buffer[j++] = b64chars[a4[i]];
                        }
                        i = 0;
                    }
                }

                if (i) {
                    for (size_t k = i; k < 3; k++) {
                        a3[k] = '\0';
                    }

                    a4[0] = (a3[0] & 0xfc) >> 2;
                    a4[1] = ((a3[0] & 0x03) << 4) + ((a3[1] & 0xf0) >> 4);
                    a4[2] = ((a3[1] & 0x0f) << 2) + ((a3[2] & 0xc0) >> 6);

                    for (size_t k = 0; k < i + 1; k++) {
                        base64Buffer[j++] = b64chars[a4[k]];
                    }

                    while (i++ < 3) {
                        base64Buffer[j++] = '=';
                    }
                }

                base64Buffer[j] = '\0';
                base64Len = j;

                payloadDoc["data"] = base64Buffer;
                EventManager::getInstance()->publish(EventType::MAVLINK_MESSAGE, payloadDoc.as<JsonObjectConst>());
            }

            handleSequenceCheck(message);
        }
        else if (result == MAVLINK_FRAMING_BAD_CRC)
        {
            ESP_LOGD(TAG, "❌ MAVLink: CRC error");
            stats.totalMessages++;
            stats.crcErrors++;
        }
        else if (result == MAVLINK_FRAMING_BAD_SIGNATURE)
        {
            ESP_LOGD(TAG, "❌ MAVLink: Signature error");
            stats.totalMessages++;
            stats.parseErrors++;
        }
    }

    ESP_LOGD(TAG, "✅ MAVLink: Found %d valid messages", messages.size());
    return messages;
}

void MAVLinkProcessor::setMessageFilter(const Filter &filter)
{
    messageFilter = filter;
}

MAVLinkProcessor::Filter MAVLinkProcessor::getMessageFilter() const
{
    return messageFilter;
}

void MAVLinkProcessor::clearMessageFilter()
{
    messageFilter.allowedMessageIds.clear();
    messageFilter.allowedSystemIds.clear();
    messageFilter.allowedComponentIds.clear();
    messageFilter.enableFilter = false;
}

MAVLinkProcessor::MessageStats MAVLinkProcessor::getStatistics() const
{
    return stats;
}

void MAVLinkProcessor::resetStatistics()
{
    // Cannot use memset on structures with STL containers
    stats.totalMessages = 0;
    stats.validMessages = 0;
    stats.crcErrors = 0;
    stats.parseErrors = 0;
    stats.sequenceErrors = 0;
    stats.messageTypes.clear();
    stats.lastUpdateMs = millis();
}

void MAVLinkProcessor::onMessage(std::function<void(const MAVLinkMessage &)> callback)
{
    messageCallback = callback;
}

void MAVLinkProcessor::onStatistics(std::function<void(const MessageStats &)> callback)
{
    statsCallback = callback;
}

bool MAVLinkProcessor::isMAVLinkData(const uint8_t *data, size_t length)
{
    if (!data || length < 8)
    {
        return false;
    }

    // Check for MAVLink start bytes
    for (size_t i = 0; i < length - 7; i++)
    {
        if (data[i] == MAVLINK_STX || data[i] == MAVLINK_STX_MAVLINK1)
        {
            if (i + 1 < length)
            {
                uint8_t payload_len = data[i + 1];
                if (payload_len <= MAVLINK_MAX_PAYLOAD_LEN)
                {
                    size_t expected_length = (data[i] == MAVLINK_STX) ? 12 + payload_len : 8 + payload_len;
                    if (i + expected_length <= length)
                    {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

size_t MAVLinkProcessor::serializeMessage(const mavlink_message_t &message, uint8_t *buffer, size_t bufferSize)
{
    if (!buffer)
    {
        return 0;
    }

    // Use official MAVLink serialization
    uint16_t len = mavlink_msg_to_send_buffer(buffer, &message);

    if (len > bufferSize)
    {
        return 0;
    }

    return len;
}

// Removed custom checksum functions - using official implementation

bool MAVLinkProcessor::shouldFilterMessage(const mavlink_message_t &message)
{
    if (!messageFilter.enableFilter)
    {
        return false;
    }

    if (!messageFilter.allowedMessageIds.empty())
    {
        bool found = false;
        for (uint32_t id : messageFilter.allowedMessageIds)
        {
            if (id == message.msgid)
            {
                found = true;
                break;
            }
        }
        if (!found)
            return true;
    }

    if (!messageFilter.allowedSystemIds.empty())
    {
        bool found = false;
        for (uint8_t id : messageFilter.allowedSystemIds)
        {
            if (id == message.sysid)
            {
                found = true;
                break;
            }
        }
        if (!found)
            return true;
    }

    if (!messageFilter.allowedComponentIds.empty())
    {
        bool found = false;
        for (uint8_t id : messageFilter.allowedComponentIds)
        {
            if (id == message.compid)
            {
                found = true;
                break;
            }
        }
        if (!found)
            return true;
    }

    return false;
}

void MAVLinkProcessor::updateStatistics(const mavlink_message_t &message)
{
    // Note: stats.totalMessages is now updated in processData() for all parsed messages
    stats.messageTypes[message.msgid]++;

    // Firmware detection based on heartbeat messages
    if (message.msgid == 0 && firmwareType == FIRMWARE_UNKNOWN)
    { // HEARTBEAT
        heartbeatCount++;

        // Analyze heartbeat content for firmware detection
        if (message.len >= 9 && heartbeatCount >= 3)
        { // Wait for a few heartbeats for stability
            uint8_t autopilot = mavlink_msg_heartbeat_get_autopilot(&message);

            switch (autopilot)
            {
            case 3: // MAV_AUTOPILOT_ARDUPILOTMEGA
                firmwareType = FIRMWARE_ARDUPILOT;
                ESP_LOGI(TAG, "🎯 Detected ArduPilot firmware (autopilot=%d)", autopilot);
                break;
            case 12: // MAV_AUTOPILOT_PX4
                firmwareType = FIRMWARE_PX4;
                ESP_LOGI(TAG, "🎯 Detected PX4 firmware (autopilot=%d)", autopilot);
                break;
            case 0: // MAV_AUTOPILOT_GENERIC
                firmwareType = FIRMWARE_GENERIC;
                ESP_LOGI(TAG, "🎯 Detected Generic firmware (autopilot=%d)", autopilot);
                break;
            default:
                if (heartbeatCount >= 10)
                { // Give up after 10 heartbeats
                    firmwareType = FIRMWARE_GENERIC;
                    ESP_LOGI(TAG, "🎯 Unknown autopilot type %d, defaulting to Generic", autopilot);
                }
                break;
            }
        }
    }

    uint32_t now = millis();
    if (now - stats.lastUpdateMs >= 1000)
    {
        if (statsCallback)
        {
            statsCallback(stats);
        }
        stats.lastUpdateMs = now;
    }
}

void MAVLinkProcessor::handleSequenceCheck(const mavlink_message_t &message)
{
    uint8_t expected = expectedSeq[message.sysid];

    if (message.seq != expected && expected != 0)
    {
        stats.sequenceErrors++;
        // ESP_LOGW(TAG, "Sequence error: expected %d, got %d from sys %d",
        //  expected, message.seq, message.sysid);
    }

    expectedSeq[message.sysid] = (message.seq + 1) % 256;
}

void MAVLinkProcessor::startStatsLogging(uint32_t intervalMs)
{
    if (statsTimer != NULL)
    {
        stopStatsLogging();
    }

    statsLoggingInterval = intervalMs;
    statsLoggingEnabled = true;

    statsTimer = xTimerCreate(
        "MAVLinkStats",
        pdMS_TO_TICKS(intervalMs),
        pdTRUE, // Auto-reload
        this,
        statsTimerCallback);

    if (statsTimer != NULL)
    {
        if (xTimerStart(statsTimer, 0) == pdPASS)
        {
            ESP_LOGI(TAG, "Stats logging started (interval: %ums)", intervalMs);
        }
        else
        {
            ESP_LOGE(TAG, "Failed to start stats timer");
            statsLoggingEnabled = false;
        }
    }
    else
    {
        ESP_LOGE(TAG, "Failed to create stats timer");
        statsLoggingEnabled = false;
    }
}

void MAVLinkProcessor::stopStatsLogging()
{
    if (statsTimer != NULL)
    {
        xTimerStop(statsTimer, 0);
        xTimerDelete(statsTimer, 0);
        statsTimer = NULL;
    }
    statsLoggingEnabled = false;
    ESP_LOGI(TAG, "Stats logging stopped");
}

bool MAVLinkProcessor::isStatsLoggingEnabled() const
{
    return statsLoggingEnabled;
}

void MAVLinkProcessor::statsTimerCallback(TimerHandle_t timer)
{
    MAVLinkProcessor *processor = static_cast<MAVLinkProcessor *>(pvTimerGetTimerID(timer));
    if (processor)
    {
        processor->logStatistics();
    }
}

const char *MAVLinkProcessor::getFirmwareTypeString() const
{
    switch (firmwareType)
    {
    case FIRMWARE_ARDUPILOT:
        return "ArduPilot";
    case FIRMWARE_PX4:
        return "PX4";
    case FIRMWARE_GENERIC:
        return "Generic";
    case FIRMWARE_UNKNOWN:
        return "Unknown";
    default:
        return "Invalid";
    }
}

void MAVLinkProcessor::logStatistics()
{
    uint32_t currentMs = millis();
    uint32_t periodMs = currentMs - stats.lastUpdateMs;

    if (periodMs == 0)
        periodMs = 1; // Prevent division by zero

    float messageRate = (stats.totalMessages * 1000.0f) / periodMs;

    ESP_LOGI(TAG, "===== MAVLink Stats (10s) =====");
    ESP_LOGI(TAG, "Firmware: %s (%d heartbeats)", getFirmwareTypeString(), heartbeatCount);
    ESP_LOGI(TAG, "Total Messages: %lu (%.1f msg/s)",
             stats.totalMessages, messageRate);
    ESP_LOGI(TAG, "Valid Messages: %lu (%.1f%% success rate)",
             stats.validMessages,
             stats.totalMessages > 0 ? (stats.validMessages * 100.0f / stats.totalMessages) : 0.0f);
    ESP_LOGI(TAG, "Errors: CRC=%lu, Parse=%lu, Seq=%lu",
             stats.crcErrors, stats.parseErrors, stats.sequenceErrors);

    // Check if we have any message types to show
    if (stats.messageTypes.empty())
    {
        ESP_LOGI(TAG, "No messages received yet");
    }
    else
    {
        // Find top 5 message types
        struct MessageTypeCount
        {
            uint32_t id;
            uint32_t count;
        };

        std::vector<MessageTypeCount> sortedTypes;
        for (const auto &pair : stats.messageTypes)
        {
            sortedTypes.push_back({pair.first, pair.second});
        }

        // Sort by count descending
        std::sort(sortedTypes.begin(), sortedTypes.end(),
                  [](const MessageTypeCount &a, const MessageTypeCount &b)
                  {
                      return a.count > b.count;
                  });

        ESP_LOGI(TAG, "Top Message Types:");
        size_t topCount = std::min(sortedTypes.size(), size_t(5));
        for (size_t i = 0; i < topCount; i++)
        {
            const char *msgName = "UNKNOWN";
            switch (sortedTypes[i].id)
            {
            case 0:
                msgName = "HEARTBEAT";
                break;
            case 1:
                msgName = "SYS_STATUS";
                break;
            case 2:
                msgName = "SYSTEM_TIME";
                break;
            case 24:
                msgName = "GPS_RAW_INT";
                break;
            case 27:
                msgName = "RAW_IMU";
                break;
            case 29:
                msgName = "SCALED_PRESSURE";
                break;
            case 30:
                msgName = "ATTITUDE";
                break;
            case 33:
                msgName = "GLOBAL_POSITION_INT";
                break;
            case 34:
                msgName = "RC_CHANNELS_SCALED";
                break;
            case 36:
                msgName = "SERVO_OUTPUT_RAW";
                break;
            case 42:
                msgName = "MISSION_CURRENT";
                break;
            case 65:
                msgName = "RC_CHANNELS";
                break;
            case 74:
                msgName = "VFR_HUD";
                break;
            case 111:
                msgName = "TIMESYNC";
                break;
            case 125:
                msgName = "POWER_STATUS";
                break;
            case 147:
                msgName = "BATTERY_STATUS";
                break;
            case 241:
                msgName = "VIBRATION";
                break;
            case 242:
                msgName = "HOME_POSITION";
                break;
            }
            ESP_LOGI(TAG, "  - %s(%lu): %lu",
                     msgName, sortedTypes[i].id, sortedTypes[i].count);
        }
    }

    ESP_LOGI(TAG, "Active for: %lus", currentMs / 1000);
    ESP_LOGI(TAG, "==============================");
}

mavlink_message_t MAVLinkProcessor::buildArmDisarmCommand(uint8_t targetSystem, uint8_t targetComponent, bool arm)
{
    mavlink_message_t msg;
    mavlink_command_long_t cmd = {};
    
    cmd.target_system = targetSystem;
    cmd.target_component = targetComponent;
    cmd.command = MAV_CMD_COMPONENT_ARM_DISARM;
    cmd.param1 = arm ? 1.0f : 0.0f;
    cmd.param2 = 0.0f;
    cmd.param3 = 0.0f;
    cmd.param4 = 0.0f;
    cmd.param5 = 0.0f;
    cmd.param6 = 0.0f;
    cmd.param7 = 0.0f;
    cmd.confirmation = 0;
    
    mavlink_msg_command_long_encode(1, 200, &msg, &cmd);
    return msg;
}

mavlink_message_t MAVLinkProcessor::buildSetModeCommand(uint8_t targetSystem, uint8_t targetComponent, uint32_t customMode, uint8_t baseMode)
{
    mavlink_message_t msg;
    mavlink_set_mode_t mode = {};
    
    mode.target_system = targetSystem;
    mode.base_mode = baseMode;
    mode.custom_mode = customMode;
    
    mavlink_msg_set_mode_encode(1, 200, &msg, &mode);
    return msg;
}

mavlink_message_t MAVLinkProcessor::buildCommandLong(uint8_t targetSystem, uint8_t targetComponent, uint16_t command,
                                                   float param1, float param2, float param3, float param4,
                                                   float param5, float param6, float param7)
{
    mavlink_message_t msg;
    mavlink_command_long_t cmd = {};
    
    cmd.target_system = targetSystem;
    cmd.target_component = targetComponent;
    cmd.command = command;
    cmd.param1 = param1;
    cmd.param2 = param2;
    cmd.param3 = param3;
    cmd.param4 = param4;
    cmd.param5 = param5;
    cmd.param6 = param6;
    cmd.param7 = param7;
    cmd.confirmation = 0;
    
    mavlink_msg_command_long_encode(1, 200, &msg, &cmd);
    return msg;
}

mavlink_message_t MAVLinkProcessor::buildCommandInt(uint8_t targetSystem, uint8_t targetComponent, uint16_t command,
                                                  uint8_t frame, uint8_t current, uint8_t autocontinue,
                                                  float param1, float param2, float param3, float param4,
                                                  int32_t x, int32_t y, float z)
{
    mavlink_message_t msg;
    mavlink_command_int_t cmd = {};
    
    cmd.target_system = targetSystem;
    cmd.target_component = targetComponent;
    cmd.command = command;
    cmd.frame = frame;
    cmd.current = current;
    cmd.autocontinue = autocontinue;
    cmd.param1 = param1;
    cmd.param2 = param2;
    cmd.param3 = param3;
    cmd.param4 = param4;
    cmd.x = x;
    cmd.y = y;
    cmd.z = z;
    
    mavlink_msg_command_int_encode(1, 200, &msg, &cmd);
    return msg;
}

mavlink_message_t MAVLinkProcessor::buildSetPositionTargetLocalNed(uint8_t targetSystem, uint8_t targetComponent,
                                                                 uint32_t timeBootMs, uint8_t coordinateFrame,
                                                                 uint16_t typeMask, float x, float y, float z,
                                                                 float vx, float vy, float vz,
                                                                 float afx, float afy, float afz,
                                                                 float yaw, float yawRate)
{
    mavlink_message_t msg;
    mavlink_set_position_target_local_ned_t pos = {};
    
    pos.target_system = targetSystem;
    pos.target_component = targetComponent;
    pos.time_boot_ms = timeBootMs;
    pos.coordinate_frame = coordinateFrame;
    pos.type_mask = typeMask;
    pos.x = x;
    pos.y = y;
    pos.z = z;
    pos.vx = vx;
    pos.vy = vy;
    pos.vz = vz;
    pos.afx = afx;
    pos.afy = afy;
    pos.afz = afz;
    pos.yaw = yaw;
    pos.yaw_rate = yawRate;
    
    mavlink_msg_set_position_target_local_ned_encode(1, 200, &msg, &pos);
    return msg;
}

// Parameter command builders

mavlink_message_t MAVLinkProcessor::buildParameterRequestRead(uint8_t targetSystem, uint8_t targetComponent,
                                                            const char* paramId, int16_t paramIndex)
{
    mavlink_message_t msg;
    mavlink_param_request_read_t param_req = {};
    
    param_req.target_system = targetSystem;
    param_req.target_component = targetComponent;
    param_req.param_index = paramIndex;
    
    if (paramId && strlen(paramId) > 0) {
        strncpy(param_req.param_id, paramId, sizeof(param_req.param_id));
        param_req.param_id[sizeof(param_req.param_id) - 1] = '\0'; // Ensure null termination
    } else {
        memset(param_req.param_id, 0, sizeof(param_req.param_id));
    }
    
    mavlink_msg_param_request_read_encode(1, 200, &msg, &param_req);
    return msg;
}

mavlink_message_t MAVLinkProcessor::buildParameterRequestList(uint8_t targetSystem, uint8_t targetComponent)
{
    mavlink_message_t msg;
    mavlink_param_request_list_t param_list_req = {};
    
    param_list_req.target_system = targetSystem;
    param_list_req.target_component = targetComponent;
    
    mavlink_msg_param_request_list_encode(1, 200, &msg, &param_list_req);
    return msg;
}

mavlink_message_t MAVLinkProcessor::buildParameterSet(uint8_t targetSystem, uint8_t targetComponent,
                                                    const char* paramId, float paramValue, uint8_t paramType)
{
    mavlink_message_t msg;
    mavlink_param_set_t param_set = {};
    
    param_set.target_system = targetSystem;
    param_set.target_component = targetComponent;
    param_set.param_value = paramValue;
    param_set.param_type = paramType;
    
    if (paramId && strlen(paramId) > 0) {
        strncpy(param_set.param_id, paramId, sizeof(param_set.param_id));
        param_set.param_id[sizeof(param_set.param_id) - 1] = '\0'; // Ensure null termination
    } else {
        memset(param_set.param_id, 0, sizeof(param_set.param_id));
    }
    
    mavlink_msg_param_set_encode(1, 200, &msg, &param_set);
    return msg;
}