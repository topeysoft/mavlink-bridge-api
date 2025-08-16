#include "MAVLinkProcessor.h"
#include "EventManager/EventManager.h"
#include <esp_log.h>
#include <algorithm>
#include <common/mavlink.h>

static const char *TAG = "MAVLinkProcessor";

// MAVLink channel for this processor
static const uint8_t MAVLINK_CHANNEL = 0;

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
    mavlink_reset_channel_status(MAVLINK_CHANNEL);

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
        uint8_t result = mavlink_parse_char(MAVLINK_CHANNEL, data[i], &message, &status);

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

                // Publish event
                DynamicJsonDocument payloadDoc(256);
                payloadDoc["messageId"] = (int)message.msgid;
                payloadDoc["systemId"] = (int)message.sysid;
                payloadDoc["componentId"] = (int)message.compid;
                payloadDoc["length"] = (int)message.len;
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
            ESP_LOGI(TAG, "Stats logging started (interval: %lums)", intervalMs);
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
            case 24:
                msgName = "GPS_RAW_INT";
                break;
            case 30:
                msgName = "ATTITUDE";
                break;
            case 33:
                msgName = "GLOBAL_POSITION_INT";
                break;
            case 74:
                msgName = "VFR_HUD";
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