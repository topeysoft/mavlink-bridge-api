#pragma once

#include <Arduino.h>
#include <vector>
#include <functional>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <common/mavlink.h>
#include "../mavlink/MAVLinkProcessor/MAVLinkProcessor.h"
#include "../communication/DataRouter/DataRouter.h"

enum class MissionProtocolState {
    IDLE,
    UPLOAD_STARTING,
    UPLOAD_WAITING_REQUEST,
    UPLOAD_SENDING_ITEMS,
    UPLOAD_WAITING_ACK,
    DOWNLOAD_REQUESTING_COUNT,
    DOWNLOAD_WAITING_COUNT,
    DOWNLOAD_REQUESTING_ITEMS,
    DOWNLOAD_WAITING_ITEMS,
    DOWNLOAD_COMPLETE,
    CLEAR_WAITING_ACK,
    SET_CURRENT_WAITING_ACK,
    ERROR,
    TIMEOUT
};

enum class MissionProtocolResult {
    SUCCESS,
    TIMEOUT,
    PROTOCOL_ERROR,
    ACK_ERROR,
    INVALID_DATA,
    COMMUNICATION_ERROR,
    IN_PROGRESS
};

struct MissionProtocolConfig {
    uint32_t timeoutMs = 5000;         // Timeout for each operation
    uint8_t maxRetries = 3;            // Maximum number of retries
    bool autoRetry = false;             // Automatically retry on failure
    uint8_t targetSystem = 1;
    uint8_t targetComponent = 1;
    uint8_t missionType = 0;           // 0=waypoints, 1=fence, 2=rally

    MissionProtocolConfig() {}
};

class MissionProtocolHandler {
public:
    using CompletionCallback = std::function<void(MissionProtocolResult, const String&)>;
    using ProgressCallback = std::function<void(uint16_t current, uint16_t total)>;
    using DownloadCallback = std::function<void(const std::vector<mavlink_mission_item_int_t>&)>;

private:
    static MissionProtocolHandler* instance;

    SemaphoreHandle_t mutex;
    MissionProtocolState state;
    MissionProtocolConfig config;

    // Upload state
    std::vector<mavlink_mission_item_int_t> uploadItems;
    uint16_t uploadNextSeq;
    uint32_t uploadStartTime;

    // Download state
    std::vector<mavlink_mission_item_int_t> downloadItems;
    uint16_t downloadExpectedCount;
    uint16_t downloadNextSeq;
    uint32_t downloadStartTime;

    // Callbacks
    CompletionCallback completionCallback;
    ProgressCallback progressCallback;
    DownloadCallback downloadCallback;

    // MAVLink processor for message handling
    MAVLinkProcessor* mavlinkProcessor;
    DataRouter* dataRouter;
    std::function<void(const MAVLinkMessage&)> messageCallback;

    // Retry logic
    uint8_t currentRetries;
    uint32_t lastCommandTime;

    MissionProtocolHandler();

public:
    ~MissionProtocolHandler();

    static MissionProtocolHandler* getInstance();

    void begin();
    void end();

    // Mission operations
    void uploadMission(const std::vector<mavlink_mission_item_int_t>& items,
                      const MissionProtocolConfig& cfg,
                      CompletionCallback onComplete,
                      ProgressCallback onProgress = nullptr);

    void downloadMission(const MissionProtocolConfig& cfg,
                        DownloadCallback onDownload,
                        CompletionCallback onComplete,
                        ProgressCallback onProgress = nullptr);

    void clearMission(const MissionProtocolConfig& cfg,
                     CompletionCallback onComplete);

    void setCurrentItem(uint16_t seq,
                       const MissionProtocolConfig& cfg,
                       CompletionCallback onComplete);

    // Status
    MissionProtocolState getState() const { return state; }
    bool isBusy() const { return state != MissionProtocolState::IDLE; }
    void cancel();

    // Processing
    void update();  // Call regularly to check timeouts

private:
    // State machine handlers
    void handleUploadState();
    void handleDownloadState();
    void handleClearState();
    void handleSetCurrentState();

    // MAVLink message handlers
    void handleMissionRequest(const mavlink_message_t& msg);
    void handleMissionRequestInt(const mavlink_message_t& msg);
    void handleMissionCount(const mavlink_message_t& msg);
    void handleMissionItemInt(const mavlink_message_t& msg);
    void handleMissionAck(const mavlink_message_t& msg);
    void handleMissionCurrent(const mavlink_message_t& msg);

    // Protocol operations
    void sendMissionCount();
    void sendMissionItem(uint16_t seq);
    void sendMissionRequestList();
    void sendMissionRequestInt(uint16_t seq);
    void sendMissionClearAll();
    void sendMissionSetCurrent(uint16_t seq);

    // Utility
    void sendMAVLinkMessage(const mavlink_message_t& msg);
    void setState(MissionProtocolState newState);
    void complete(MissionProtocolResult result, const String& message = "");
    bool checkTimeout();
    void resetState();

    // Thread safety
    bool lock(uint32_t timeoutMs = portMAX_DELAY);
    void unlock();
};
