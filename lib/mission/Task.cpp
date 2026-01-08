#include "Task.h"
#include <esp_log.h>
#include <math.h>
// UUID generation will use simple random IDs instead of libuuid

static const char* TAG = "Task";

Task::Task() : isCompressed(false), compressedData(nullptr), compressedSize(0), originalSize(0) {
    generateId();
    metadata.createdTime = millis();
    metadata.modifiedTime = metadata.createdTime;
}

Task::Task(TaskType type, const String& name, const String& description) 
    : isCompressed(false), compressedData(nullptr), compressedSize(0), originalSize(0) {
    generateId();
    metadata.type = type;
    metadata.name = name;
    metadata.description = description;
    metadata.createdTime = millis();
    metadata.modifiedTime = metadata.createdTime;
}

Task::Task(const Task& other) : isCompressed(false), compressedData(nullptr), compressedSize(0), originalSize(0) {
    *this = other;
}

Task& Task::operator=(const Task& other) {
    if (this != &other) {
        cleanup();
        
        metadata = other.metadata;
        parameters = other.parameters;
        
        if (!other.isCompressed) {
            waypoints = other.waypoints;
            isCompressed = false;
        } else {
            // Copy compressed data
            compressedSize = other.compressedSize;
            originalSize = other.originalSize;
            compressedData = (uint8_t*)malloc(compressedSize);
            if (compressedData) {
                memcpy(compressedData, other.compressedData, compressedSize);
                isCompressed = true;
            }
        }
    }
    return *this;
}

Task::~Task() {
    cleanup();
}

void Task::cleanup() {
    if (compressedData) {
        free(compressedData);
        compressedData = nullptr;
    }
    compressedSize = 0;
    originalSize = 0;
    isCompressed = false;
}

void Task::generateId() {
    // Generate a simple UUID-like string
    uint32_t random1 = esp_random();
    uint32_t random2 = esp_random();
    uint32_t random3 = esp_random();
    uint32_t random4 = esp_random();
    
    char uuidStr[37];
    snprintf(uuidStr, sizeof(uuidStr), 
             "%08x-%04x-%04x-%04x-%08x%04x",
             random1,
             (uint16_t)(random2 >> 16),
             (uint16_t)(random2 & 0xFFFF),
             (uint16_t)(random3 >> 16),
             random3 & 0xFFFF,
             (uint16_t)(random4 >> 16));
    
    metadata.id = String(uuidStr);
}

size_t Task::getWaypointCount() const {
    if (isCompressed) {
        // We need to decompress to get the count
        // For now, return 0 to indicate compressed state
        return 0;
    }
    return waypoints.size();
}

TaskStorageResult Task::addWaypoint(const TaskWaypoint& waypoint) {
    TaskStorageResult result = ensureDecompressed();
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    waypoints.push_back(waypoint);
    updateModifiedTime();
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::insertWaypoint(size_t index, const TaskWaypoint& waypoint) {
    TaskStorageResult result = ensureDecompressed();
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    if (index > waypoints.size()) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    waypoints.insert(waypoints.begin() + index, waypoint);
    updateModifiedTime();
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::updateWaypoint(size_t index, const TaskWaypoint& waypoint) {
    TaskStorageResult result = ensureDecompressed();
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    if (index >= waypoints.size()) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    waypoints[index] = waypoint;
    updateModifiedTime();
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::removeWaypoint(size_t index) {
    TaskStorageResult result = ensureDecompressed();
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    if (index >= waypoints.size()) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    waypoints.erase(waypoints.begin() + index);
    updateModifiedTime();
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::clearWaypoints() {
    TaskStorageResult result = ensureDecompressed();
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    waypoints.clear();
    updateModifiedTime();
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::getWaypoint(size_t index, TaskWaypoint& waypoint) const {
    if (isCompressed) {
        return TaskStorageResult::COMPRESSION_FAILED; // Need to decompress first
    }
    
    if (index >= waypoints.size()) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    waypoint = waypoints[index];
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::getAllWaypoints(std::vector<TaskWaypoint>& waypointList) const {
    if (isCompressed) {
        return TaskStorageResult::COMPRESSION_FAILED; // Need to decompress first
    }
    
    waypointList = waypoints;
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::addWaypointLatLng(double lat, double lng, float alt) {
    TaskWaypoint wp(lat, lng, alt < 0 ? parameters.altitude : alt);
    wp.speed = parameters.speed;
    wp.acceptanceRadius = parameters.acceptanceRadius;
    return addWaypoint(wp);
}

TaskStorageResult Task::addTakeoffWaypoint(double lat, double lng, float alt) {
    TaskWaypoint wp(lat, lng, alt);
    wp.command = 22; // MAV_CMD_NAV_TAKEOFF
    wp.speed = parameters.speed;
    return addWaypoint(wp);
}

TaskStorageResult Task::addLandWaypoint(double lat, double lng) {
    TaskWaypoint wp(lat, lng, 0);
    wp.command = 21; // MAV_CMD_NAV_LAND
    return addWaypoint(wp);
}

TaskStorageResult Task::addLoiterWaypoint(double lat, double lng, float alt, float radius, float time) {
    TaskWaypoint wp(lat, lng, alt);
    wp.command = 17; // MAV_CMD_NAV_LOITER_TIME
    wp.param1 = time;
    wp.param3 = radius;
    return addWaypoint(wp);
}

TaskStorageResult Task::addReturnToLaunchWaypoint() {
    TaskWaypoint wp;
    wp.command = 20; // MAV_CMD_NAV_RETURN_TO_LAUNCH
    return addWaypoint(wp);
}

// Pattern generation methods removed - moved to client-side for performance optimization

TaskStorageResult Task::toJson(String& jsonString, bool includeWaypoints) const {
    DynamicJsonDocument doc(8192);
    
    // Metadata
    JsonObject meta = doc.createNestedObject("metadata");
    meta["id"] = metadata.id;
    meta["name"] = metadata.name;
    meta["description"] = metadata.description;
    meta["type"] = (int)metadata.type;
    meta["status"] = (int)metadata.status;
    meta["priority"] = (int)metadata.priority;
    meta["created"] = metadata.createdTime;
    meta["modified"] = metadata.modifiedTime;
    meta["version"] = metadata.version;
    meta["estimatedDuration"] = metadata.estimatedDuration;
    
    // Parameters
    JsonObject params = doc.createNestedObject("parameters");
    params["speed"] = parameters.speed;
    params["altitude"] = parameters.altitude;
    params["acceptanceRadius"] = parameters.acceptanceRadius;
    params["loiterTime"] = parameters.loiterTime;
    params["returnToLaunch"] = parameters.returnToLaunch;
    params["maxExecutionTime"] = parameters.maxExecutionTime;
    if (parameters.customParameters.length() > 0) {
        params["custom"] = parameters.customParameters;
    }
    
    // Waypoints (if requested and not compressed)
    if (includeWaypoints && !isCompressed) {
        JsonArray waypointsArray = doc.createNestedArray("waypoints");
        for (const auto& wp : waypoints) {
            JsonObject wpObj = waypointsArray.createNestedObject();
            wpObj["lat"] = wp.latitude;
            wpObj["lng"] = wp.longitude;
            wpObj["alt"] = wp.altitude;
            wpObj["speed"] = wp.speed;
            wpObj["yaw"] = wp.yaw;
            wpObj["radius"] = wp.acceptanceRadius;
            wpObj["command"] = wp.command;
            wpObj["param1"] = wp.param1;
            wpObj["param2"] = wp.param2;
            wpObj["param3"] = wp.param3;
            wpObj["param4"] = wp.param4;
            wpObj["dwell"] = wp.dwellTime;
        }
    }
    
    serializeJson(doc, jsonString);
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::fromJson(const String& jsonString) {
    DynamicJsonDocument doc(8192);
    DeserializationError error = deserializeJson(doc, jsonString);
    
    if (error) {
        ESP_LOGE(TAG, "Failed to parse task JSON: %s", error.c_str());
        return TaskStorageResult::INVALID_DATA;
    }
    
    // Parse metadata
    if (doc.containsKey("metadata")) {
        JsonObject meta = doc["metadata"];
        metadata.id = String(meta["id"].as<const char*>());
        metadata.name = String(meta["name"].as<const char*>());
        metadata.description = String(meta["description"].as<const char*>());
        metadata.type = (TaskType)meta["type"].as<int>();
        metadata.status = (TaskStatus)meta["status"].as<int>();
        metadata.priority = (TaskPriority)meta["priority"].as<int>();
        metadata.createdTime = meta["created"];
        metadata.modifiedTime = meta["modified"];
        metadata.version = meta["version"];
        metadata.estimatedDuration = meta["estimatedDuration"];
    }
    
    // Parse parameters
    if (doc.containsKey("parameters")) {
        JsonObject params = doc["parameters"];
        parameters.speed = params["speed"];
        parameters.altitude = params["altitude"];
        parameters.acceptanceRadius = params["acceptanceRadius"];
        parameters.loiterTime = params["loiterTime"];
        parameters.returnToLaunch = params["returnToLaunch"];
        parameters.maxExecutionTime = params["maxExecutionTime"];
        parameters.customParameters = String(params["custom"].as<const char*>());
    }
    
    // Parse waypoints
    if (doc.containsKey("waypoints")) {
        waypoints.clear();
        JsonArray waypointsArray = doc["waypoints"];
        for (JsonObject wpObj : waypointsArray) {
            TaskWaypoint wp;
            wp.latitude = wpObj["lat"];
            wp.longitude = wpObj["lng"];
            wp.altitude = wpObj["alt"];
            wp.speed = wpObj["speed"];
            wp.yaw = wpObj["yaw"];
            wp.acceptanceRadius = wpObj["radius"];
            wp.command = wpObj["command"];
            wp.param1 = wpObj["param1"];
            wp.param2 = wpObj["param2"];
            wp.param3 = wpObj["param3"];
            wp.param4 = wpObj["param4"];
            wp.dwellTime = wpObj["dwell"];
            waypoints.push_back(wp);
        }
    }
    
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::save() const {
    TaskStorageManager* storage = TaskStorageManager::getInstance();
    if (!storage) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    String jsonString;
    TaskStorageResult result = toJson(jsonString, true);
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    return storage->storeTask(metadata.id.c_str(), 
                             (const uint8_t*)jsonString.c_str(), 
                             jsonString.length());
}

TaskStorageResult Task::load(const String& taskId) {
    TaskStorageManager* storage = TaskStorageManager::getInstance();
    if (!storage) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    uint8_t buffer[TaskStorageConfig::MAX_TASK_SIZE];
    size_t dataSize = sizeof(buffer);
    
    TaskStorageResult result = storage->loadTask(taskId.c_str(), buffer, dataSize);
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    String jsonString = String((char*)buffer, dataSize);
    return fromJson(jsonString);
}

TaskStorageResult Task::remove() const {
    TaskStorageManager* storage = TaskStorageManager::getInstance();
    if (!storage) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    return storage->deleteTask(metadata.id.c_str());
}

TaskStorageResult Task::validate() const {
    if (metadata.id.isEmpty() || metadata.name.isEmpty()) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    if (!isCompressed && waypoints.empty()) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    // Enhanced safety validation for waypoints
    if (!isCompressed) {
        for (const auto& wp : waypoints) {
            // Geographic bounds validation
            if (abs(wp.latitude) > 90.0 || abs(wp.longitude) > 180.0) {
                return TaskStorageResult::INVALID_DATA;
            }
            
            // Altitude safety limits
            if (wp.altitude < 0.0 || wp.altitude > 120.0) { // Max 120m altitude
                return TaskStorageResult::INVALID_DATA;
            }
            
            // Speed safety limits
            if (wp.speed < 0.0 || wp.speed > 15.0) { // Max 15 m/s speed
                return TaskStorageResult::INVALID_DATA;
            }
            
            // Acceptance radius validation
            if (wp.acceptanceRadius < 0.0 || wp.acceptanceRadius > 100.0) {
                return TaskStorageResult::INVALID_DATA;
            }
        }
        
        // Validate waypoint density (prevent excessive waypoints)
        if (waypoints.size() > 1000) { // Max 1000 waypoints
            return TaskStorageResult::INVALID_DATA;
        }
        
        // Validate distance between consecutive waypoints
        for (size_t i = 1; i < waypoints.size(); i++) {
            const TaskWaypoint& wp1 = waypoints[i-1];
            const TaskWaypoint& wp2 = waypoints[i];
            
            // Calculate distance using Haversine formula
            double dlat = (wp2.latitude - wp1.latitude) * M_PI / 180.0;
            double dlng = (wp2.longitude - wp1.longitude) * M_PI / 180.0;
            double a = sin(dlat/2) * sin(dlat/2) + 
                      cos(wp1.latitude * M_PI / 180.0) * cos(wp2.latitude * M_PI / 180.0) *
                      sin(dlng/2) * sin(dlng/2);
            double c = 2 * atan2(sqrt(a), sqrt(1-a));
            double distance = 6371000 * c; // Earth radius in meters
            
            // Minimum distance check (prevent excessively close waypoints)
            if (distance < 0.1) { // Minimum 10cm between waypoints
                return TaskStorageResult::INVALID_DATA;
            }
            
            // Maximum distance check (prevent excessively far waypoints)
            if (distance > 10000) { // Maximum 10km between waypoints
                return TaskStorageResult::INVALID_DATA;
            }
        }
    }
    
    // Task parameter validation
    if (parameters.speed < 0.1 || parameters.speed > 15.0) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    if (parameters.altitude < 0.0 || parameters.altitude > 120.0) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    if (parameters.maxExecutionTime > 86400) { // Max 24 hours
        return TaskStorageResult::INVALID_DATA;
    }
    
    return TaskStorageResult::SUCCESS;
}

bool Task::isValid() const {
    return validate() == TaskStorageResult::SUCCESS;
}

TaskStorageResult Task::validateForExecution() const {
    // First run standard validation
    TaskStorageResult result = validate();
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    // Additional execution-specific safety checks
    if (!isCompressed && waypoints.size() > 0) {
        // Check for reasonable task execution time
        float totalDistance = 0.0f;
        for (size_t i = 1; i < waypoints.size(); i++) {
            const TaskWaypoint& wp1 = waypoints[i-1];
            const TaskWaypoint& wp2 = waypoints[i];
            
            // Calculate distance using Haversine formula
            double dlat = (wp2.latitude - wp1.latitude) * M_PI / 180.0;
            double dlng = (wp2.longitude - wp1.longitude) * M_PI / 180.0;
            double a = sin(dlat/2) * sin(dlat/2) + 
                      cos(wp1.latitude * M_PI / 180.0) * cos(wp2.latitude * M_PI / 180.0) *
                      sin(dlng/2) * sin(dlng/2);
            double c = 2 * atan2(sqrt(a), sqrt(1-a));
            totalDistance += 6371000 * c;
        }
        
        // Estimated execution time check (prevent excessive missions)
        float estimatedTime = totalDistance / parameters.speed;
        if (estimatedTime > parameters.maxExecutionTime) {
            return TaskStorageResult::INVALID_DATA; // Mission too long
        }
        
        // Battery range check (simplified - assume 10km max range)
        if (totalDistance > 10000) {
            return TaskStorageResult::INVALID_DATA; // Mission exceeds safe range
        }
        
        // Check for safe return path (simplified - ensure mission doesn't end too far from start)
        if (waypoints.size() >= 2) {
            const TaskWaypoint& start = waypoints[0];
            const TaskWaypoint& end = waypoints[waypoints.size() - 1];
            
            double dlat = (end.latitude - start.latitude) * M_PI / 180.0;
            double dlng = (end.longitude - start.longitude) * M_PI / 180.0;
            double a = sin(dlat/2) * sin(dlat/2) + 
                      cos(start.latitude * M_PI / 180.0) * cos(end.latitude * M_PI / 180.0) *
                      sin(dlng/2) * sin(dlng/2);
            double c = 2 * atan2(sqrt(a), sqrt(1-a));
            double returnDistance = 6371000 * c;
            
            // If return distance is too far and returnToLaunch is enabled, it's unsafe
            if (parameters.returnToLaunch && returnDistance > 5000) { // Max 5km return distance
                return TaskStorageResult::INVALID_DATA;
            }
        }
    }
    
    return TaskStorageResult::SUCCESS;
}

// Distance and time calculation methods removed - moved to client-side for performance optimization

TaskStorageResult Task::ensureDecompressed() {
    if (!isCompressed) {
        return TaskStorageResult::SUCCESS;
    }
    
    // Decompress waypoints
    return decompressWaypoints();
}

TaskStorageResult Task::decompressWaypoints() {
    if (!isCompressed || !compressedData) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    // Simple decompression implementation
    // This would use the compressed data to reconstruct waypoints
    // For now, just mark as decompressed
    isCompressed = false;
    return TaskStorageResult::SUCCESS;
}

String Task::getTypeString() const {
    switch (metadata.type) {
        case TaskType::WAYPOINT_MISSION: return "Waypoint Mission";
        case TaskType::MOWING: return "Mowing";
        case TaskType::SPRAYING: return "Spraying";
        case TaskType::LEAF_BLOWING: return "Leaf Blowing";
        case TaskType::TOWING: return "Towing";
        case TaskType::SNOW_REMOVAL: return "Snow Removal";
        case TaskType::PATROLLING: return "Patrolling";
        case TaskType::SURVEYING: return "Surveying";
        case TaskType::CUSTOM: return "Custom";
        default: return "Unknown";
    }
}

String Task::getStatusString() const {
    switch (metadata.status) {
        case TaskStatus::CREATED: return "Created";
        case TaskStatus::READY: return "Ready";
        case TaskStatus::EXECUTING: return "Executing";
        case TaskStatus::PAUSED: return "Paused";
        case TaskStatus::COMPLETED: return "Completed";
        case TaskStatus::FAILED: return "Failed";
        case TaskStatus::CANCELLED: return "Cancelled";
        default: return "Unknown";
    }
}

String Task::getPriorityString() const {
    switch (metadata.priority) {
        case TaskPriority::TASK_LOW: return "Low";
        case TaskPriority::TASK_NORMAL: return "Normal";
        case TaskPriority::TASK_HIGH: return "High";
        case TaskPriority::TASK_CRITICAL: return "Critical";
        default: return "Unknown";
    }
}