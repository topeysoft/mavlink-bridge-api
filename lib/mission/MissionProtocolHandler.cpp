#include "MissionProtocolHandler.h"
#include <esp_log.h>

static const char* TAG = "MissionProtocolHandler";

MissionProtocolHandler* MissionProtocolHandler::instance = nullptr;

MissionProtocolHandler::MissionProtocolHandler()
    : mutex(nullptr)
    , state(MissionProtocolState::IDLE)
    , uploadNextSeq(0)
    , uploadStartTime(0)
    , downloadExpectedCount(0)
    , downloadNextSeq(0)
    , downloadStartTime(0)
    , mavlinkProcessor(nullptr)
    , dataRouter(nullptr)
    , currentRetries(0)
    , lastCommandTime(0)
{
}

MissionProtocolHandler::~MissionProtocolHandler() {
    end();
}

MissionProtocolHandler* MissionProtocolHandler::getInstance() {
    if (instance == nullptr) {
        instance = new MissionProtocolHandler();
    }
    return instance;
}

void MissionProtocolHandler::begin() {
    if (mutex != nullptr) {
        return; // Already initialized
    }

    mutex = xSemaphoreCreateMutex();
    if (mutex == nullptr) {
        ESP_LOGE(TAG, "Failed to create mutex");
        return;
    }

    mavlinkProcessor = MAVLinkProcessor::getInstance();
    dataRouter = DataRouter::getInstance();

    // Setup MAVLink message callback
    if (mavlinkProcessor) {
        messageCallback = [this](const MAVLinkMessage& msg) {
            switch (msg.msg.msgid) {
                case MAVLINK_MSG_ID_MISSION_REQUEST:
                    handleMissionRequest(msg.msg);
                    break;
                case MAVLINK_MSG_ID_MISSION_REQUEST_INT:
                    handleMissionRequestInt(msg.msg);
                    break;
                case MAVLINK_MSG_ID_MISSION_COUNT:
                    handleMissionCount(msg.msg);
                    break;
                case MAVLINK_MSG_ID_MISSION_ITEM_INT:
                    handleMissionItemInt(msg.msg);
                    break;
                case MAVLINK_MSG_ID_MISSION_ACK:
                    handleMissionAck(msg.msg);
                    break;
                case MAVLINK_MSG_ID_MISSION_CURRENT:
                    handleMissionCurrent(msg.msg);
                    break;
            }
        };

        mavlinkProcessor->onMessage(messageCallback);
    }

    ESP_LOGI(TAG, "Mission protocol handler initialized");
}

void MissionProtocolHandler::end() {
    if (mutex != nullptr) {
        cancel();
        vSemaphoreDelete(mutex);
        mutex = nullptr;
    }

    completionCallback = nullptr;
    progressCallback = nullptr;
    downloadCallback = nullptr;
    messageCallback = nullptr;
}

void MissionProtocolHandler::uploadMission(const std::vector<mavlink_mission_item_int_t>& items,
                                          const MissionProtocolConfig& cfg,
                                          CompletionCallback onComplete,
                                          ProgressCallback onProgress)
{
    if (!lock(1000)) {
        if (onComplete) {
            onComplete(MissionProtocolResult::COMMUNICATION_ERROR, "Failed to acquire lock");
        }
        return;
    }

    if (state != MissionProtocolState::IDLE) {
        unlock();
        if (onComplete) {
            onComplete(MissionProtocolResult::IN_PROGRESS, "Another operation in progress");
        }
        return;
    }

    if (items.empty()) {
        unlock();
        if (onComplete) {
            onComplete(MissionProtocolResult::INVALID_DATA, "No mission items provided");
        }
        return;
    }

    ESP_LOGI(TAG, "Starting mission upload: %d items", items.size());

    uploadItems = items;
    config = cfg;
    completionCallback = onComplete;
    progressCallback = onProgress;
    uploadNextSeq = 0;
    currentRetries = 0;

    setState(MissionProtocolState::UPLOAD_STARTING);
    sendMissionCount();

    unlock();
}

void MissionProtocolHandler::downloadMission(const MissionProtocolConfig& cfg,
                                            DownloadCallback onDownload,
                                            CompletionCallback onComplete,
                                            ProgressCallback onProgress)
{
    if (!lock(1000)) {
        if (onComplete) {
            onComplete(MissionProtocolResult::COMMUNICATION_ERROR, "Failed to acquire lock");
        }
        return;
    }

    if (state != MissionProtocolState::IDLE) {
        unlock();
        if (onComplete) {
            onComplete(MissionProtocolResult::IN_PROGRESS, "Another operation in progress");
        }
        return;
    }

    ESP_LOGI(TAG, "Starting mission download");

    config = cfg;
    completionCallback = onComplete;
    progressCallback = onProgress;
    downloadCallback = onDownload;
    downloadItems.clear();
    downloadExpectedCount = 0;
    downloadNextSeq = 0;
    currentRetries = 0;

    setState(MissionProtocolState::DOWNLOAD_REQUESTING_COUNT);
    sendMissionRequestList();

    unlock();
}

void MissionProtocolHandler::clearMission(const MissionProtocolConfig& cfg,
                                         CompletionCallback onComplete)
{
    if (!lock(1000)) {
        if (onComplete) {
            onComplete(MissionProtocolResult::COMMUNICATION_ERROR, "Failed to acquire lock");
        }
        return;
    }

    if (state != MissionProtocolState::IDLE) {
        unlock();
        if (onComplete) {
            onComplete(MissionProtocolResult::IN_PROGRESS, "Another operation in progress");
        }
        return;
    }

    ESP_LOGI(TAG, "Clearing mission");

    config = cfg;
    completionCallback = onComplete;
    currentRetries = 0;

    setState(MissionProtocolState::CLEAR_WAITING_ACK);
    sendMissionClearAll();

    unlock();
}

void MissionProtocolHandler::setCurrentItem(uint16_t seq,
                                           const MissionProtocolConfig& cfg,
                                           CompletionCallback onComplete)
{
    if (!lock(1000)) {
        if (onComplete) {
            onComplete(MissionProtocolResult::COMMUNICATION_ERROR, "Failed to acquire lock");
        }
        return;
    }

    if (state != MissionProtocolState::IDLE) {
        unlock();
        if (onComplete) {
            onComplete(MissionProtocolResult::IN_PROGRESS, "Another operation in progress");
        }
        return;
    }

    ESP_LOGI(TAG, "Setting current mission item to %d", seq);

    config = cfg;
    completionCallback = onComplete;
    currentRetries = 0;

    setState(MissionProtocolState::SET_CURRENT_WAITING_ACK);
    sendMissionSetCurrent(seq);

    unlock();
}

void MissionProtocolHandler::cancel() {
    if (lock(1000)) {
        if (state != MissionProtocolState::IDLE) {
            ESP_LOGW(TAG, "Cancelling mission operation");
            complete(MissionProtocolResult::PROTOCOL_ERROR, "Operation cancelled");
        }
        unlock();
    }
}

void MissionProtocolHandler::update() {
    if (!lock(100)) {
        return;
    }

    if (state != MissionProtocolState::IDLE) {
        checkTimeout();
    }

    unlock();
}

// Message handlers

void MissionProtocolHandler::handleMissionRequest(const mavlink_message_t& msg) {
    if (!lock(100)) return;

    mavlink_mission_request_t req;
    mavlink_msg_mission_request_decode(&msg, &req);

    if (state == MissionProtocolState::UPLOAD_WAITING_REQUEST ||
        state == MissionProtocolState::UPLOAD_SENDING_ITEMS) {
        ESP_LOGD(TAG, "Received MISSION_REQUEST for seq %d", req.seq);
        setState(MissionProtocolState::UPLOAD_SENDING_ITEMS);
        sendMissionItem(req.seq);
    }

    unlock();
}

void MissionProtocolHandler::handleMissionRequestInt(const mavlink_message_t& msg) {
    if (!lock(100)) return;

    mavlink_mission_request_int_t req;
    mavlink_msg_mission_request_int_decode(&msg, &req);

    if (state == MissionProtocolState::UPLOAD_WAITING_REQUEST ||
        state == MissionProtocolState::UPLOAD_SENDING_ITEMS) {
        ESP_LOGD(TAG, "Received MISSION_REQUEST_INT for seq %d", req.seq);
        setState(MissionProtocolState::UPLOAD_SENDING_ITEMS);
        sendMissionItem(req.seq);
    }

    unlock();
}

void MissionProtocolHandler::handleMissionCount(const mavlink_message_t& msg) {
    if (!lock(100)) return;

    mavlink_mission_count_t count;
    mavlink_msg_mission_count_decode(&msg, &count);

    if (state == MissionProtocolState::DOWNLOAD_WAITING_COUNT) {
        ESP_LOGI(TAG, "Received MISSION_COUNT: %d items", count.count);
        downloadExpectedCount = count.count;
        downloadItems.clear();
        downloadItems.reserve(count.count);
        downloadNextSeq = 0;

        if (count.count == 0) {
            // No items to download
            complete(MissionProtocolResult::SUCCESS, "No mission items on vehicle");
        } else {
            setState(MissionProtocolState::DOWNLOAD_REQUESTING_ITEMS);
            sendMissionRequestInt(downloadNextSeq);
        }
    }

    unlock();
}

void MissionProtocolHandler::handleMissionItemInt(const mavlink_message_t& msg) {
    if (!lock(100)) return;

    mavlink_mission_item_int_t item;
    mavlink_msg_mission_item_int_decode(&msg, &item);

    if (state == MissionProtocolState::DOWNLOAD_WAITING_ITEMS ||
        state == MissionProtocolState::DOWNLOAD_REQUESTING_ITEMS) {
        ESP_LOGD(TAG, "Received MISSION_ITEM_INT seq %d", item.seq);

        if (item.seq == downloadNextSeq) {
            downloadItems.push_back(item);
            downloadNextSeq++;

            if (progressCallback) {
                progressCallback(downloadNextSeq, downloadExpectedCount);
            }

            if (downloadNextSeq >= downloadExpectedCount) {
                // All items received
                ESP_LOGI(TAG, "Downloaded all %d mission items", downloadItems.size());

                // Send ACK
                mavlink_message_t ackMsg = MAVLinkProcessor::buildMissionAck(
                    config.targetSystem, config.targetComponent,
                    MAV_MISSION_ACCEPTED, config.missionType);
                sendMAVLinkMessage(ackMsg);

                // Call download callback with items
                if (downloadCallback) {
                    downloadCallback(downloadItems);
                }

                complete(MissionProtocolResult::SUCCESS, "Mission download complete");
            } else {
                // Request next item
                setState(MissionProtocolState::DOWNLOAD_REQUESTING_ITEMS);
                sendMissionRequestInt(downloadNextSeq);
            }
        } else {
            ESP_LOGW(TAG, "Received unexpected seq %d, expected %d", item.seq, downloadNextSeq);
        }
    }

    unlock();
}

void MissionProtocolHandler::handleMissionAck(const mavlink_message_t& msg) {
    if (!lock(100)) return;

    mavlink_mission_ack_t ack;
    mavlink_msg_mission_ack_decode(&msg, &ack);

    ESP_LOGI(TAG, "Received MISSION_ACK: type=%d", ack.type);

    if (state == MissionProtocolState::UPLOAD_WAITING_ACK) {
        if (ack.type == MAV_MISSION_ACCEPTED) {
            complete(MissionProtocolResult::SUCCESS, "Mission upload complete");
        } else {
            String errorMsg = "Mission rejected: " + String(ack.type);
            complete(MissionProtocolResult::ACK_ERROR, errorMsg);
        }
    }
    else if (state == MissionProtocolState::CLEAR_WAITING_ACK) {
        if (ack.type == MAV_MISSION_ACCEPTED) {
            complete(MissionProtocolResult::SUCCESS, "Mission cleared");
        } else {
            complete(MissionProtocolResult::ACK_ERROR, "Clear rejected");
        }
    }

    unlock();
}

void MissionProtocolHandler::handleMissionCurrent(const mavlink_message_t& msg) {
    if (!lock(100)) return;

    mavlink_mission_current_t current;
    mavlink_msg_mission_current_decode(&msg, &current);

    if (state == MissionProtocolState::SET_CURRENT_WAITING_ACK) {
        ESP_LOGI(TAG, "Current mission item set to %d", current.seq);
        complete(MissionProtocolResult::SUCCESS, "Current item set");
    }

    unlock();
}

// Protocol operations

void MissionProtocolHandler::sendMissionCount() {
    mavlink_message_t msg = MAVLinkProcessor::buildMissionCount(
        config.targetSystem, config.targetComponent,
        uploadItems.size(), config.missionType);
    sendMAVLinkMessage(msg);

    setState(MissionProtocolState::UPLOAD_WAITING_REQUEST);
    lastCommandTime = millis();
    ESP_LOGI(TAG, "Sent MISSION_COUNT: %d items", uploadItems.size());
}

void MissionProtocolHandler::sendMissionItem(uint16_t seq) {
    if (seq >= uploadItems.size()) {
        ESP_LOGE(TAG, "Invalid sequence number: %d", seq);
        complete(MissionProtocolResult::PROTOCOL_ERROR, "Invalid sequence number");
        return;
    }

    mavlink_message_t msg = MAVLinkProcessor::buildMissionItemInt(
        config.targetSystem, config.targetComponent, uploadItems[seq]);
    sendMAVLinkMessage(msg);

    if (progressCallback) {
        progressCallback(seq + 1, uploadItems.size());
    }

    // Check if this was the last item
    if (seq == uploadItems.size() - 1) {
        setState(MissionProtocolState::UPLOAD_WAITING_ACK);
    } else {
        setState(MissionProtocolState::UPLOAD_WAITING_REQUEST);
    }

    lastCommandTime = millis();
    ESP_LOGD(TAG, "Sent MISSION_ITEM_INT seq %d", seq);
}

void MissionProtocolHandler::sendMissionRequestList() {
    mavlink_message_t msg = MAVLinkProcessor::buildMissionRequestList(
        config.targetSystem, config.targetComponent, config.missionType);
    sendMAVLinkMessage(msg);

    setState(MissionProtocolState::DOWNLOAD_WAITING_COUNT);
    lastCommandTime = millis();
    ESP_LOGI(TAG, "Sent MISSION_REQUEST_LIST");
}

void MissionProtocolHandler::sendMissionRequestInt(uint16_t seq) {
    mavlink_message_t msg = MAVLinkProcessor::buildMissionRequest(
        config.targetSystem, config.targetComponent, seq, config.missionType);
    sendMAVLinkMessage(msg);

    setState(MissionProtocolState::DOWNLOAD_WAITING_ITEMS);
    lastCommandTime = millis();
    ESP_LOGD(TAG, "Sent MISSION_REQUEST_INT for seq %d", seq);
}

void MissionProtocolHandler::sendMissionClearAll() {
    mavlink_message_t msg = MAVLinkProcessor::buildMissionClear(
        config.targetSystem, config.targetComponent, config.missionType);
    sendMAVLinkMessage(msg);

    lastCommandTime = millis();
    ESP_LOGI(TAG, "Sent MISSION_CLEAR_ALL");
}

void MissionProtocolHandler::sendMissionSetCurrent(uint16_t seq) {
    mavlink_message_t msg = MAVLinkProcessor::buildMissionSetCurrent(
        config.targetSystem, config.targetComponent, seq);
    sendMAVLinkMessage(msg);

    lastCommandTime = millis();
    ESP_LOGI(TAG, "Sent MISSION_SET_CURRENT: %d", seq);
}

void MissionProtocolHandler::sendMAVLinkMessage(const mavlink_message_t& msg) {
    if (!dataRouter) {
        ESP_LOGE(TAG, "DataRouter not available");
        return;
    }

    uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
    size_t length = MAVLinkProcessor::serializeMessage(msg, buffer, sizeof(buffer));

    if (length > 0) {
        dataRouter->routeDownstream(buffer, length);
    } else {
        ESP_LOGE(TAG, "Failed to serialize MAVLink message");
    }
}

void MissionProtocolHandler::setState(MissionProtocolState newState) {
    if (state != newState) {
        ESP_LOGD(TAG, "State: %d -> %d", (int)state, (int)newState);
        state = newState;
    }
}

void MissionProtocolHandler::complete(MissionProtocolResult result, const String& message) {
    ESP_LOGI(TAG, "Operation complete: %d - %s", (int)result, message.c_str());

    CompletionCallback callback = completionCallback;
    resetState();

    if (callback) {
        callback(result, message);
    }
}

bool MissionProtocolHandler::checkTimeout() {
    if (state == MissionProtocolState::IDLE) {
        return false;
    }

    uint32_t elapsed = millis() - lastCommandTime;
    if (elapsed > config.timeoutMs) {
        ESP_LOGW(TAG, "Operation timeout after %d ms", elapsed);

        if (config.autoRetry && currentRetries < config.maxRetries) {
            currentRetries++;
            ESP_LOGI(TAG, "Retry %d/%d", currentRetries, config.maxRetries);
            // TODO: Implement retry logic based on current state
            return false;
        }

        complete(MissionProtocolResult::TIMEOUT, "Operation timed out");
        return true;
    }

    return false;
}

void MissionProtocolHandler::resetState() {
    state = MissionProtocolState::IDLE;
    uploadItems.clear();
    downloadItems.clear();
    uploadNextSeq = 0;
    downloadNextSeq = 0;
    downloadExpectedCount = 0;
    completionCallback = nullptr;
    progressCallback = nullptr;
    downloadCallback = nullptr;
    currentRetries = 0;
    lastCommandTime = 0;
}

bool MissionProtocolHandler::lock(uint32_t timeoutMs) {
    if (mutex == nullptr) {
        return false;
    }
    return xSemaphoreTake(mutex, pdMS_TO_TICKS(timeoutMs)) == pdTRUE;
}

void MissionProtocolHandler::unlock() {
    if (mutex != nullptr) {
        xSemaphoreGive(mutex);
    }
}
