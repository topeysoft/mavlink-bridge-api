#pragma once

#include "../MAVLinkCommon.h"
#include <Arduino.h>
#include <vector>
#include <map>
#include <functional>
#include <freertos/FreeRTOS.h>
#include <freertos/timers.h>
#include <common/mavlink.h>

// Wrapper structure to add timestamp to official mavlink_message_t
struct MAVLinkMessage {
    mavlink_message_t msg;
    uint32_t timestamp;
    
    // Helper accessors for compatibility
    uint8_t magic() const { return msg.magic; }
    uint8_t length() const { return msg.len; }
    uint8_t seq() const { return msg.seq; }
    uint8_t sysid() const { return msg.sysid; }
    uint8_t compid() const { return msg.compid; }
    uint32_t msgid() const { return msg.msgid; }
    bool valid() const { return msg.msgid != 0; }
};

class MAVLinkProcessor {
public:
    enum FirmwareType {
        FIRMWARE_UNKNOWN = 0,
        FIRMWARE_ARDUPILOT = 1,
        FIRMWARE_PX4 = 2,
        FIRMWARE_GENERIC = 3
    };

    struct MessageStats {
        uint32_t totalMessages;      // All parsed messages (including invalid)
        uint32_t validMessages;      // Only messages that passed validation
        uint32_t crcErrors;
        uint32_t parseErrors;
        uint32_t sequenceErrors;
        std::map<uint32_t, uint32_t> messageTypes;
        uint32_t lastUpdateMs;
    };
    
    struct Filter {
        std::vector<uint32_t> allowedMessageIds;
        std::vector<uint8_t> allowedSystemIds;
        std::vector<uint8_t> allowedComponentIds;
        bool enableFilter;
    };
    
private:
    static MAVLinkProcessor* instance;
    
    // Official MAVLink parsing state for each channel
    static const uint8_t MAVLINK_COMM_CHANNEL = 0;  // Single channel for now
    mavlink_message_t rxMessage;
    mavlink_status_t rxStatus;
    
    MessageStats stats;
    Filter messageFilter;
    
    std::function<void(const MAVLinkMessage&)> messageCallback;
    std::function<void(const MessageStats&)> statsCallback;
    
    uint8_t expectedSeq[256];
    
    // Firmware detection
    FirmwareType firmwareType;
    uint32_t heartbeatCount;
    
public:
    static MAVLinkProcessor* getInstance();
    
    std::vector<MAVLinkMessage> processData(const uint8_t* data, size_t length);
    
    void setMessageFilter(const Filter& filter);
    Filter getMessageFilter() const;
    void clearMessageFilter();
    
    MessageStats getStatistics() const;
    void resetStatistics();
    
    void onMessage(std::function<void(const MAVLinkMessage&)> callback);
    void onStatistics(std::function<void(const MessageStats&)> callback);
    
    static bool isMAVLinkData(const uint8_t* data, size_t length);
    static size_t serializeMessage(const mavlink_message_t& message, uint8_t* buffer, size_t bufferSize);
    
    // Remove custom checksum functions - use official implementation
    
    void startStatsLogging(uint32_t intervalMs = 10000);
    void stopStatsLogging();
    bool isStatsLoggingEnabled() const;
    
    // Firmware detection
    FirmwareType getFirmwareType() const { return firmwareType; }
    const char* getFirmwareTypeString() const;
    
    // Command building
    static mavlink_message_t buildArmDisarmCommand(uint8_t targetSystem, uint8_t targetComponent, bool arm);
    static mavlink_message_t buildSetModeCommand(uint8_t targetSystem, uint8_t targetComponent, uint32_t customMode, uint8_t baseMode = 0);
    static mavlink_message_t buildCommandLong(uint8_t targetSystem, uint8_t targetComponent, uint16_t command, 
                                            float param1 = 0, float param2 = 0, float param3 = 0, 
                                            float param4 = 0, float param5 = 0, float param6 = 0, float param7 = 0);
    static mavlink_message_t buildCommandInt(uint8_t targetSystem, uint8_t targetComponent, uint16_t command,
                                           uint8_t frame, uint8_t current, uint8_t autocontinue,
                                           float param1, float param2, float param3, float param4,
                                           int32_t x, int32_t y, float z);
    static mavlink_message_t buildSetPositionTargetLocalNed(uint8_t targetSystem, uint8_t targetComponent,
                                                          uint32_t timeBootMs, uint8_t coordinateFrame,
                                                          uint16_t typeMask, float x, float y, float z,
                                                          float vx, float vy, float vz,
                                                          float afx, float afy, float afz,
                                                          float yaw, float yawRate);
    
    // Parameter command builders
    static mavlink_message_t buildParameterRequestRead(uint8_t targetSystem, uint8_t targetComponent,
                                                      const char* paramId, int16_t paramIndex = -1);
    static mavlink_message_t buildParameterRequestList(uint8_t targetSystem, uint8_t targetComponent);
    static mavlink_message_t buildParameterSet(uint8_t targetSystem, uint8_t targetComponent,
                                             const char* paramId, float paramValue, uint8_t paramType);

    // Mission command builders
    static mavlink_message_t buildMissionCount(uint8_t targetSystem, uint8_t targetComponent,
                                               uint16_t count, uint8_t missionType = 0);
    static mavlink_message_t buildMissionItemInt(uint8_t targetSystem, uint8_t targetComponent,
                                                 const mavlink_mission_item_int_t& item);
    static mavlink_message_t buildMissionClear(uint8_t targetSystem, uint8_t targetComponent,
                                              uint8_t missionType = 0);
    static mavlink_message_t buildMissionSetCurrent(uint8_t targetSystem, uint8_t targetComponent,
                                                   uint16_t seq);
    static mavlink_message_t buildMissionRequestList(uint8_t targetSystem, uint8_t targetComponent,
                                                    uint8_t missionType = 0);
    static mavlink_message_t buildMissionRequest(uint8_t targetSystem, uint8_t targetComponent,
                                                uint16_t seq, uint8_t missionType = 0);
    static mavlink_message_t buildMissionAck(uint8_t targetSystem, uint8_t targetComponent,
                                            uint8_t type, uint8_t missionType = 0);
    
private:
    MAVLinkProcessor();
    ~MAVLinkProcessor();
    
    bool shouldFilterMessage(const mavlink_message_t& message);
    void updateStatistics(const mavlink_message_t& message);
    void handleSequenceCheck(const mavlink_message_t& message);
    
    // Remove custom parse state - using official parser
    
    TimerHandle_t statsTimer;
    bool statsLoggingEnabled;
    uint32_t statsLoggingInterval;
    
    void logStatistics();
    static void statsTimerCallback(TimerHandle_t timer);
};