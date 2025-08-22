#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include <functional>
#include "../mavlink/MAVLinkCommon.h"
#include "storage/TaskStorageManager.h"

enum class TaskType {
    WAYPOINT_MISSION = 0,
    MOWING = 1,
    SPRAYING = 2,
    LEAF_BLOWING = 3,
    TOWING = 4,
    SNOW_REMOVAL = 5,
    PATROLLING = 6,
    SURVEYING = 7,
    CUSTOM = 255
};

enum class TaskStatus {
    CREATED = 0,
    READY = 1,
    EXECUTING = 2,
    PAUSED = 3,
    COMPLETED = 4,
    FAILED = 5,
    CANCELLED = 6
};

enum class TaskPriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    CRITICAL = 3
};

struct TaskWaypoint {
    double latitude;
    double longitude;
    float altitude;
    float speed;          // m/s, 0 = use default
    float yaw;           // radians, NaN = use auto
    float acceptanceRadius; // meters, 0 = use default
    uint16_t command;    // MAVLink command ID
    float param1, param2, param3, param4; // Command-specific parameters
    uint32_t dwellTime;  // milliseconds to wait at waypoint
    
    TaskWaypoint() : latitude(0), longitude(0), altitude(0), speed(0), yaw(NAN), 
                    acceptanceRadius(0), command(16), param1(0), param2(0), 
                    param3(0), param4(0), dwellTime(0) {}
    
    TaskWaypoint(double lat, double lng, float alt) 
        : latitude(lat), longitude(lng), altitude(alt), speed(0), yaw(NAN),
          acceptanceRadius(0), command(16), param1(0), param2(0), 
          param3(0), param4(0), dwellTime(0) {}
};

struct TaskParameters {
    float speed;              // Default speed m/s
    float altitude;           // Default altitude meters
    float acceptanceRadius;   // Default acceptance radius meters
    float loiterTime;         // Default loiter time seconds
    bool returnToLaunch;      // Return to launch when complete
    uint32_t maxExecutionTime; // Maximum execution time in seconds
    
    // Task-specific parameters (JSON blob for flexibility)
    String customParameters;
    
    TaskParameters() : speed(2.0), altitude(10.0), acceptanceRadius(2.0), 
                      loiterTime(0), returnToLaunch(true), maxExecutionTime(3600) {}
};

struct TaskMetadata {
    String id;               // UUID
    String name;
    String description;
    TaskType type;
    TaskStatus status;
    TaskPriority priority;
    uint64_t createdTime;
    uint64_t modifiedTime;
    uint64_t executionStartTime;
    uint64_t executionEndTime;
    String createdBy;
    uint32_t version;
    uint32_t estimatedDuration; // seconds
    
    TaskMetadata() : type(TaskType::WAYPOINT_MISSION), status(TaskStatus::CREATED),
                    priority(TaskPriority::NORMAL), createdTime(0), modifiedTime(0),
                    executionStartTime(0), executionEndTime(0), version(1), 
                    estimatedDuration(0) {}
};

class Task {
private:
    TaskMetadata metadata;
    TaskParameters parameters;
    std::vector<TaskWaypoint> waypoints;
    
    // Compression state
    bool isCompressed;
    uint8_t* compressedData;
    size_t compressedSize;
    size_t originalSize;
    
    // Helper methods
    void generateId();
    uint32_t calculateChecksum() const;
    size_t estimateJsonSize() const;
    
    // Compression methods
    TaskStorageResult compressWaypoints();
    TaskStorageResult decompressWaypoints();
    size_t deltaCompressWaypoints(uint8_t* buffer, size_t bufferSize) const;
    size_t deltaDecompressWaypoints(const uint8_t* buffer, size_t dataSize);
    
    // Serialization helpers
    JsonObject waypointToJson(const TaskWaypoint& wp, JsonDocument& doc) const;
    TaskWaypoint waypointFromJson(const JsonObject& obj) const;

public:
    Task();
    Task(TaskType type, const String& name, const String& description = "");
    Task(const Task& other);
    Task& operator=(const Task& other);
    ~Task();
    
    // Metadata accessors
    const String& getId() const { return metadata.id; }
    const String& getName() const { return metadata.name; }
    void setName(const String& name) { metadata.name = name; updateModifiedTime(); }
    
    const String& getDescription() const { return metadata.description; }
    void setDescription(const String& description) { metadata.description = description; updateModifiedTime(); }
    
    TaskType getType() const { return metadata.type; }
    void setType(TaskType type) { metadata.type = type; updateModifiedTime(); }
    
    TaskStatus getStatus() const { return metadata.status; }
    void setStatus(TaskStatus status) { metadata.status = status; updateModifiedTime(); }
    
    TaskPriority getPriority() const { return metadata.priority; }
    void setPriority(TaskPriority priority) { metadata.priority = priority; updateModifiedTime(); }
    
    uint64_t getCreatedTime() const { return metadata.createdTime; }
    uint64_t getModifiedTime() const { return metadata.modifiedTime; }
    uint64_t getExecutionStartTime() const { return metadata.executionStartTime; }
    uint64_t getExecutionEndTime() const { return metadata.executionEndTime; }
    
    uint32_t getVersion() const { return metadata.version; }
    uint32_t getEstimatedDuration() const { return metadata.estimatedDuration; }
    void setEstimatedDuration(uint32_t duration) { metadata.estimatedDuration = duration; updateModifiedTime(); }
    
    // Parameters accessors
    const TaskParameters& getParameters() const { return parameters; }
    void setParameters(const TaskParameters& params) { parameters = params; updateModifiedTime(); }
    
    float getDefaultSpeed() const { return parameters.speed; }
    void setDefaultSpeed(float speed) { parameters.speed = speed; updateModifiedTime(); }
    
    float getDefaultAltitude() const { return parameters.altitude; }
    void setDefaultAltitude(float altitude) { parameters.altitude = altitude; updateModifiedTime(); }
    
    // Waypoint management
    size_t getWaypointCount() const;
    TaskStorageResult addWaypoint(const TaskWaypoint& waypoint);
    TaskStorageResult insertWaypoint(size_t index, const TaskWaypoint& waypoint);
    TaskStorageResult updateWaypoint(size_t index, const TaskWaypoint& waypoint);
    TaskStorageResult removeWaypoint(size_t index);
    TaskStorageResult clearWaypoints();
    
    TaskStorageResult getWaypoint(size_t index, TaskWaypoint& waypoint) const;
    TaskStorageResult getAllWaypoints(std::vector<TaskWaypoint>& waypoints) const;
    
    // Convenience methods for common waypoint patterns
    TaskStorageResult addWaypointLatLng(double lat, double lng, float alt = -1);
    TaskStorageResult addTakeoffWaypoint(double lat, double lng, float alt);
    TaskStorageResult addLandWaypoint(double lat, double lng);
    TaskStorageResult addLoiterWaypoint(double lat, double lng, float alt, float radius, float time);
    TaskStorageResult addReturnToLaunchWaypoint();
    
    // Grid pattern generation moved to client-side for performance
    
    // Mission conversion
    TaskStorageResult generateMissionItems(std::vector<mavlink_mission_item_int_t>& items) const;
    TaskStorageResult loadFromMissionItems(const std::vector<mavlink_mission_item_int_t>& items);
    
    // Serialization
    TaskStorageResult toJson(String& jsonString, bool includeWaypoints = true) const;
    TaskStorageResult fromJson(const String& jsonString);
    TaskStorageResult toCompactJson(String& jsonString) const; // Minimal JSON for transmission
    
    TaskStorageResult toBinary(uint8_t* buffer, size_t& bufferSize) const;
    TaskStorageResult fromBinary(const uint8_t* buffer, size_t bufferSize);
    
    // Storage operations
    TaskStorageResult save() const;
    TaskStorageResult load(const String& taskId);
    TaskStorageResult remove() const;
    
    // Validation
    TaskStorageResult validate() const;
    bool isValid() const;
    TaskStorageResult validateForExecution() const; // Enhanced safety validation for execution
    
    // Statistics moved to client-side for performance
    size_t getMemoryUsage() const;
    float getCompressionRatio() const;
    
    // Execution helpers
    void markExecutionStart() { metadata.executionStartTime = millis(); updateModifiedTime(); }
    void markExecutionEnd() { metadata.executionEndTime = millis(); updateModifiedTime(); }
    uint32_t getExecutionDuration() const;
    
    // Utility methods
    String getTypeString() const;
    String getStatusString() const;
    String getPriorityString() const;
    
    static TaskType parseTypeString(const String& typeStr);
    static TaskStatus parseStatusString(const String& statusStr);
    static TaskPriority parsePriorityString(const String& priorityStr);

private:
    void updateModifiedTime() { 
        metadata.modifiedTime = millis(); 
        metadata.version++;
    }
    
    void cleanup();
    TaskStorageResult ensureDecompressed();
};