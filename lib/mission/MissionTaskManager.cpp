#include "MissionTaskManager.h"
#include <esp_log.h>
#include <algorithm>

static const char* TAG = "MissionTaskManager";

MissionTaskManager* MissionTaskManager::instance = nullptr;

MissionTaskManager* MissionTaskManager::getInstance() {
    if (instance == nullptr) {
        instance = new MissionTaskManager();
    }
    return instance;
}

MissionTaskManager::MissionTaskManager() 
    : isInitialized(false)
    , managerMutex(nullptr)
    , mavlinkProcessor(nullptr) {
}

MissionTaskManager::~MissionTaskManager() {
    end();
}

TaskStorageResult MissionTaskManager::begin() {
    if (isInitialized) {
        return TaskStorageResult::SUCCESS;
    }
    
    managerMutex = xSemaphoreCreateMutex();
    if (managerMutex == nullptr) {
        ESP_LOGE(TAG, "Failed to create manager mutex");
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    // Initialize storage and backup managers
    TaskStorageManager* storage = TaskStorageManager::getInstance();
    TaskBackupManager* backup = TaskBackupManager::getInstance();
    
    if (!storage || !backup) {
        ESP_LOGE(TAG, "Failed to get storage or backup manager instances");
        vSemaphoreDelete(managerMutex);
        managerMutex = nullptr;
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    TaskStorageResult result = storage->begin();
    if (result != TaskStorageResult::SUCCESS) {
        ESP_LOGE(TAG, "Failed to initialize storage manager");
        vSemaphoreDelete(managerMutex);
        managerMutex = nullptr;
        return result;
    }
    
    result = backup->begin();
    if (result != TaskStorageResult::SUCCESS) {
        ESP_LOGE(TAG, "Failed to initialize backup manager");
        storage->end();
        vSemaphoreDelete(managerMutex);
        managerMutex = nullptr;
        return result;
    }
    
    setupMAVLinkHandlers();
    
    isInitialized = true;
    ESP_LOGI(TAG, "Mission task manager initialized successfully");
    return TaskStorageResult::SUCCESS;
}

void MissionTaskManager::end() {
    if (!isInitialized) {
        return;
    }
    
    if (lockManager(5000)) {
        // Cancel all running tasks
        cancelAllTasks();
        
        // Cleanup
        activeExecutions.clear();
        executionQueue.clear();
        currentExecutingTaskId = "";
        
        teardownMAVLinkHandlers();
        
        unlockManager();
        vSemaphoreDelete(managerMutex);
        managerMutex = nullptr;
    }
    
    isInitialized = false;
    ESP_LOGI(TAG, "Mission task manager stopped");
}

TaskStorageResult MissionTaskManager::createTask(const Task& task) {
    if (!isInitialized) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    if (!lockManager()) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    TaskStorageResult result = task.save();
    
    if (result == TaskStorageResult::SUCCESS) {
        ESP_LOGI(TAG, "Created task: %s (%s)", task.getName().c_str(), task.getId().c_str());
    }
    
    unlockManager();
    return result;
}

TaskStorageResult MissionTaskManager::updateTask(const Task& task) {
    if (!isInitialized) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    if (!lockManager()) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    // Check if task is currently executing
    if (isTaskExecuting(task.getId())) {
        unlockManager();
        ESP_LOGW(TAG, "Cannot update task %s - currently executing", task.getId().c_str());
        return TaskStorageResult::INVALID_DATA;
    }
    
    TaskStorageResult result = task.save();
    
    if (result == TaskStorageResult::SUCCESS) {
        ESP_LOGI(TAG, "Updated task: %s (%s)", task.getName().c_str(), task.getId().c_str());
    }
    
    unlockManager();
    return result;
}

TaskStorageResult MissionTaskManager::deleteTask(const String& taskId) {
    if (!isInitialized) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    if (!lockManager()) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    // Check if task is currently executing
    if (isTaskExecuting(taskId)) {
        // Cancel execution first
        cancelTask(taskId);
    }
    
    // Remove from queue if present
    removeFromQueue(taskId);
    
    // Delete from storage
    Task task;
    TaskStorageResult result = task.load(taskId);
    if (result == TaskStorageResult::SUCCESS) {
        result = task.remove();
        if (result == TaskStorageResult::SUCCESS) {
            ESP_LOGI(TAG, "Deleted task: %s", taskId.c_str());
        }
    }
    
    unlockManager();
    return result;
}

TaskStorageResult MissionTaskManager::getTask(const String& taskId, Task& task) {
    if (!isInitialized) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    return task.load(taskId);
}

TaskStorageResult MissionTaskManager::listTasks(std::vector<String>& taskIds, TaskType typeFilter) {
    if (!isInitialized) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    TaskStorageManager* storage = TaskStorageManager::getInstance();
    if (!storage) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    TaskStorageResult result = storage->listTasks(taskIds);
    
    // Apply type filter if specified
    if (result == TaskStorageResult::SUCCESS && typeFilter != (TaskType)-1) {
        std::vector<String> filteredIds;
        
        for (const auto& taskId : taskIds) {
            Task task;
            if (task.load(taskId) == TaskStorageResult::SUCCESS) {
                if (task.getType() == typeFilter) {
                    filteredIds.push_back(taskId);
                }
            }
        }
        
        taskIds = filteredIds;
    }
    
    return result;
}

TaskExecutionResult MissionTaskManager::executeTask(const String& taskId, const TaskExecutionOptions& options) {
    if (!isInitialized) {
        return TaskExecutionResult::COMMUNICATION_ERROR;
    }
    
    if (!lockManager()) {
        return TaskExecutionResult::COMMUNICATION_ERROR;
    }
    
    // Check if already executing
    if (isTaskExecuting(taskId)) {
        unlockManager();
        return TaskExecutionResult::ALREADY_EXECUTING;
    }
    
    // Load task
    Task task;
    TaskStorageResult result = task.load(taskId);
    if (result != TaskStorageResult::SUCCESS) {
        unlockManager();
        return TaskExecutionResult::TASK_NOT_FOUND;
    }
    
    // Validate task if requested
    if (options.validateBeforeExecution && !task.isValid()) {
        unlockManager();
        return TaskExecutionResult::INVALID_TASK;
    }
    
    // Check if another task is executing and this is not queued
    if (!currentExecutingTaskId.isEmpty() && currentExecutingTaskId != taskId) {
        unlockManager();
        ESP_LOGW(TAG, "Another task is executing, queueing task %s", taskId.c_str());
        return (TaskExecutionResult)queueTask(taskId, options);
    }
    
    TaskExecutionResult execResult = startTaskExecution(taskId, options);
    
    unlockManager();
    return execResult;
}

TaskExecutionResult MissionTaskManager::cancelTask(const String& taskId) {
    if (!isInitialized) {
        return TaskExecutionResult::COMMUNICATION_ERROR;
    }
    
    if (!lockManager()) {
        return TaskExecutionResult::COMMUNICATION_ERROR;
    }
    
    TaskExecutionResult result = stopTaskExecution(taskId, true);
    
    unlockManager();
    return result;
}

TaskExecutionResult MissionTaskManager::startTaskExecution(const String& taskId, const TaskExecutionOptions& options) {
    // Load task
    Task task;
    TaskStorageResult loadResult = task.load(taskId);
    if (loadResult != TaskStorageResult::SUCCESS) {
        return TaskExecutionResult::TASK_NOT_FOUND;
    }
    
    // Create execution state
    TaskExecutionState executionState;
    executionState.taskId = taskId;
    executionState.status = TaskStatus::EXECUTING;
    executionState.startTime = millis();
    executionState.lastUpdateTime = executionState.startTime;
    executionState.totalWaypoints = task.getWaypointCount();
    
    activeExecutions[taskId] = executionState;
    currentExecutingTaskId = taskId;
    
    // Update task status
    task.setStatus(TaskStatus::EXECUTING);
    task.markExecutionStart();
    task.save();
    
    // Convert task to MAVLink mission
    std::vector<mavlink_mission_item_int_t> missionItems;
    TaskStorageResult conversionResult = convertTaskToMission(task, missionItems);
    if (conversionResult != TaskStorageResult::SUCCESS) {
        cleanupExecution(taskId);
        return TaskExecutionResult::EXECUTION_FAILED;
    }
    
    // Upload mission to vehicle
    TaskExecutionResult uploadResult = uploadMissionToVehicle(missionItems, options);
    if (uploadResult != TaskExecutionResult::SUCCESS) {
        cleanupExecution(taskId);
        return uploadResult;
    }
    
    // Start mission execution
    TaskExecutionResult startResult = startMissionExecution(options);
    if (startResult != TaskExecutionResult::SUCCESS) {
        cleanupExecution(taskId);
        return startResult;
    }
    
    // Notify status change
    notifyStatusChange(taskId, TaskStatus::READY, TaskStatus::EXECUTING);
    
    ESP_LOGI(TAG, "Started execution of task: %s", taskId.c_str());
    return TaskExecutionResult::SUCCESS;
}

TaskExecutionResult MissionTaskManager::stopTaskExecution(const String& taskId, bool force) {
    TaskExecutionState* state = getExecutionState(taskId);
    if (!state) {
        return TaskExecutionResult::TASK_NOT_FOUND;
    }
    
    // Update task status
    Task task;
    if (task.load(taskId) == TaskStorageResult::SUCCESS) {
        task.setStatus(force ? TaskStatus::CANCELLED : TaskStatus::COMPLETED);
        task.markExecutionEnd();
        task.save();
    }
    
    // Notify completion
    if (taskCompletionCallback) {
        taskCompletionCallback(taskId, force ? TaskExecutionResult::CANCELLED_BY_USER : TaskExecutionResult::SUCCESS);
    }
    
    // Cleanup
    cleanupExecution(taskId);
    
    // Start next task in queue
    if (!executionQueue.empty()) {
        String nextTaskId = executionQueue.front();
        executionQueue.erase(executionQueue.begin());
        
        // Execute next task (this will unlock and relock)
        unlockManager();
        executeTask(nextTaskId);
        lockManager();
    } else {
        currentExecutingTaskId = "";
    }
    
    ESP_LOGI(TAG, "Stopped execution of task: %s", taskId.c_str());
    return TaskExecutionResult::SUCCESS;
}

TaskStorageResult MissionTaskManager::convertTaskToMission(const Task& task, std::vector<mavlink_mission_item_int_t>& missionItems) {
    missionItems.clear();
    
    std::vector<TaskWaypoint> waypoints;
    TaskStorageResult result = task.getAllWaypoints(waypoints);
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    uint16_t seq = 0;
    for (const auto& wp : waypoints) {
        mavlink_mission_item_int_t item = {};
        
        item.seq = seq++;
        item.frame = MAV_FRAME_GLOBAL_RELATIVE_ALT_INT;
        item.command = wp.command;
        item.current = (seq == 1) ? 1 : 0; // First waypoint is current
        item.autocontinue = 1;
        
        item.param1 = wp.param1;
        item.param2 = wp.param2;
        item.param3 = wp.param3;
        item.param4 = wp.param4;
        
        // Convert to MAVLink coordinate format (degrees * 1e7)
        item.x = (int32_t)(wp.latitude * 1e7);
        item.y = (int32_t)(wp.longitude * 1e7);
        item.z = wp.altitude;
        
        item.mission_type = MAV_MISSION_TYPE_MISSION;
        item.target_system = 0;  // Will be set during upload
        item.target_component = 0;
        
        missionItems.push_back(item);
    }
    
    ESP_LOGI(TAG, "Converted task to %d mission items", missionItems.size());
    return TaskStorageResult::SUCCESS;
}

TaskExecutionResult MissionTaskManager::uploadMissionToVehicle(const std::vector<mavlink_mission_item_int_t>& missionItems,
                                                               const TaskExecutionOptions& options) {
    if (!mavlinkProcessor) {
        ESP_LOGE(TAG, "MAVLink processor not available");
        return TaskExecutionResult::COMMUNICATION_ERROR;
    }
    
    // This is a simplified implementation
    // In a real implementation, you would:
    // 1. Send MISSION_CLEAR_ALL
    // 2. Send MISSION_COUNT
    // 3. Handle MISSION_REQUEST messages
    // 4. Send MISSION_ITEM_INT for each item
    // 5. Handle MISSION_ACK
    
    ESP_LOGI(TAG, "Uploading %d mission items to vehicle", missionItems.size());
    return TaskExecutionResult::SUCCESS;
}

TaskExecutionResult MissionTaskManager::startMissionExecution(const TaskExecutionOptions& options) {
    if (!mavlinkProcessor) {
        return TaskExecutionResult::COMMUNICATION_ERROR;
    }
    
    // Send MISSION_START command
    // This is a simplified implementation
    ESP_LOGI(TAG, "Starting mission execution on vehicle");
    return TaskExecutionResult::SUCCESS;
}

void MissionTaskManager::setupMAVLinkHandlers() {
    if (!mavlinkProcessor) {
        return;
    }

    messageCallback = [this](const MAVLinkMessage& message) {
        switch (message.msg.msgid) {
            case MAVLINK_MSG_ID_MISSION_CURRENT:
                handleMissionCurrent(message.msg);
                break;
            case MAVLINK_MSG_ID_MISSION_ITEM_REACHED:
                handleMissionItemReached(message.msg);
                break;
            case MAVLINK_MSG_ID_MISSION_ACK:
                handleMissionAck(message.msg);
                break;
        }
    };

    mavlinkProcessor->onMessage(messageCallback);
}

void MissionTaskManager::teardownMAVLinkHandlers() {
    // Remove message callbacks
    messageCallback = nullptr;
}

void MissionTaskManager::handleMissionCurrent(const mavlink_message_t& message) {
    mavlink_mission_current_t current;
    mavlink_msg_mission_current_decode(&message, &current);
    
    if (!currentExecutingTaskId.isEmpty()) {
        TaskExecutionState* state = getExecutionState(currentExecutingTaskId);
        if (state) {
            state->currentWaypointIndex = current.seq;
            state->lastUpdateTime = millis();
            state->progress = (float)current.seq / (float)state->totalWaypoints;
            
            updateExecutionProgress(currentExecutingTaskId, *state);
        }
    }
}

void MissionTaskManager::handleMissionItemReached(const mavlink_message_t& message) {
    mavlink_mission_item_reached_t reached;
    mavlink_msg_mission_item_reached_decode(&message, &reached);
    
    ESP_LOGI(TAG, "Mission item %d reached", reached.seq);
}

void MissionTaskManager::handleMissionAck(const mavlink_message_t& message) {
    mavlink_mission_ack_t ack;
    mavlink_msg_mission_ack_decode(&message, &ack);
    
    if (ack.type == MAV_MISSION_ACCEPTED) {
        ESP_LOGI(TAG, "Mission upload accepted");
    } else {
        ESP_LOGW(TAG, "Mission upload failed with result: %d", ack.type);
    }
}

bool MissionTaskManager::isTaskExecuting(const String& taskId) const {
    return activeExecutions.find(taskId) != activeExecutions.end();
}

TaskExecutionState* MissionTaskManager::getExecutionState(const String& taskId) {
    auto it = activeExecutions.find(taskId);
    return (it != activeExecutions.end()) ? &it->second : nullptr;
}

void MissionTaskManager::cleanupExecution(const String& taskId) {
    activeExecutions.erase(taskId);
    if (currentExecutingTaskId == taskId) {
        currentExecutingTaskId = "";
    }
}

void MissionTaskManager::notifyStatusChange(const String& taskId, TaskStatus oldStatus, TaskStatus newStatus) {
    if (taskStatusChangeCallback) {
        taskStatusChangeCallback(taskId, oldStatus, newStatus);
    }
}

void MissionTaskManager::updateExecutionProgress(const String& taskId, const TaskExecutionState& state) {
    if (executionProgressCallback) {
        executionProgressCallback(taskId, state);
    }
}

void MissionTaskManager::setMAVLinkProcessor(MAVLinkProcessor* processor) {
    if (mavlinkProcessor && messageCallback) {
        teardownMAVLinkHandlers();
    }
    
    mavlinkProcessor = processor;
    
    if (mavlinkProcessor && isInitialized) {
        setupMAVLinkHandlers();
    }
}

bool MissionTaskManager::isMAVLinkConnected() const {
    return mavlinkProcessor != nullptr;
}

bool MissionTaskManager::lockManager(uint32_t timeoutMs) {
    if (!managerMutex) {
        return false;
    }
    return xSemaphoreTake(managerMutex, pdMS_TO_TICKS(timeoutMs)) == pdTRUE;
}

void MissionTaskManager::unlockManager() {
    if (managerMutex) {
        xSemaphoreGive(managerMutex);
    }
}

TaskStorageResult MissionTaskManager::queueTask(const String& taskId, const TaskExecutionOptions& options) {
    executionQueue.push_back(taskId);
    ESP_LOGI(TAG, "Queued task: %s", taskId.c_str());
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult MissionTaskManager::cancelAllTasks() {
    for (auto& execution : activeExecutions) {
        stopTaskExecution(execution.first, true);
    }
    executionQueue.clear();
    return TaskStorageResult::SUCCESS;
}

String MissionTaskManager::getExecutionResultString(TaskExecutionResult result) {
    switch (result) {
        case TaskExecutionResult::SUCCESS: return "Success";
        case TaskExecutionResult::TASK_NOT_FOUND: return "Task Not Found";
        case TaskExecutionResult::INVALID_TASK: return "Invalid Task";
        case TaskExecutionResult::ALREADY_EXECUTING: return "Already Executing";
        case TaskExecutionResult::EXECUTION_FAILED: return "Execution Failed";
        case TaskExecutionResult::CANCELLED_BY_USER: return "Cancelled by User";
        case TaskExecutionResult::TIMEOUT: return "Timeout";
        case TaskExecutionResult::COMMUNICATION_ERROR: return "Communication Error";
        case TaskExecutionResult::VEHICLE_NOT_READY: return "Vehicle Not Ready";
        default: return "Unknown";
    }
}