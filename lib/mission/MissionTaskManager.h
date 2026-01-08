#pragma once

#include <Arduino.h>
#include <vector>
#include <map>
#include <functional>
#include "Task.h"
#include "storage/TaskStorageManager.h"
#include "storage/TaskBackupManager.h"
#include "../mavlink/MAVLinkProcessor/MAVLinkProcessor.h"
#include "../communication/CommunicationCommon.h"

enum class TaskExecutionResult {
    SUCCESS = 0,
    TASK_NOT_FOUND = 1,
    INVALID_TASK = 2,
    ALREADY_EXECUTING = 3,
    EXECUTION_FAILED = 4,
    CANCELLED_BY_USER = 5,
    TIMEOUT = 6,
    COMMUNICATION_ERROR = 7,
    VEHICLE_NOT_READY = 8
};

struct TaskExecutionState {
    String taskId;
    TaskStatus status;
    uint32_t startTime;
    uint32_t lastUpdateTime;
    uint16_t currentWaypointIndex;
    uint16_t totalWaypoints;
    float progress;                    // 0.0 to 1.0
    float distanceRemaining;          // meters
    uint32_t estimatedTimeRemaining;  // seconds
    String lastError;
    
    TaskExecutionState() : status(TaskStatus::CREATED), startTime(0), lastUpdateTime(0),
                          currentWaypointIndex(0), totalWaypoints(0), progress(0.0),
                          distanceRemaining(0.0), estimatedTimeRemaining(0) {}
};

struct TaskExecutionOptions {
    bool validateBeforeExecution = true;
    bool autoRetryOnFailure = false;
    uint8_t maxRetries = 3;
    uint32_t timeoutSeconds = 3600;    // 1 hour default
    uint8_t targetSystem = 1;
    uint8_t targetComponent = 1;
    
    // Execution callbacks
    std::function<void(const String&, TaskStatus)> statusCallback;
    std::function<void(const String&, float)> progressCallback;
    std::function<void(const String&, const String&)> errorCallback;
    
    TaskExecutionOptions() {}
};

class MissionTaskManager {
private:
    static MissionTaskManager* instance;
    bool isInitialized;
    SemaphoreHandle_t managerMutex;
    
    // Current execution state
    std::map<String, TaskExecutionState> activeExecutions;
    std::vector<String> executionQueue;
    String currentExecutingTaskId;
    
    // MAVLink integration
    MAVLinkProcessor* mavlinkProcessor;
    std::function<void(const MAVLinkMessage&)> messageCallback;
    
    // Event callbacks
    std::function<void(const String&, TaskStatus, TaskStatus)> taskStatusChangeCallback;
    std::function<void(const String&, TaskExecutionResult)> taskCompletionCallback;
    std::function<void(const String&, const TaskExecutionState&)> executionProgressCallback;
    
    // Execution management
    TaskExecutionResult startTaskExecution(const String& taskId, const TaskExecutionOptions& options);
    TaskExecutionResult stopTaskExecution(const String& taskId, bool force = false);
    TaskExecutionResult pauseTaskExecution(const String& taskId);
    TaskExecutionResult resumeTaskExecution(const String& taskId);
    
    // MAVLink mission conversion and management
    TaskStorageResult convertTaskToMission(const Task& task, std::vector<mavlink_mission_item_int_t>& missionItems);
    TaskExecutionResult uploadMissionToVehicle(const std::vector<mavlink_mission_item_int_t>& missionItems,
                                              const TaskExecutionOptions& options);
    TaskExecutionResult startMissionExecution(const TaskExecutionOptions& options);
    
    // Status monitoring
    void updateExecutionProgress(const String& taskId, const TaskExecutionState& state);
    void handleMissionProgress(const mavlink_message_t& message);
    void handleMissionCurrent(const mavlink_message_t& message);
    void handleMissionItemReached(const mavlink_message_t& message);
    void handleMissionAck(const mavlink_message_t& message);
    
    // Utility methods
    bool isTaskExecuting(const String& taskId) const;
    TaskExecutionState* getExecutionState(const String& taskId);
    void cleanupExecution(const String& taskId);
    void notifyStatusChange(const String& taskId, TaskStatus oldStatus, TaskStatus newStatus);

public:
    MissionTaskManager();
    ~MissionTaskManager();
    
    static MissionTaskManager* getInstance();
    TaskStorageResult begin();
    void end();
    
    // Task CRUD operations
    TaskStorageResult createTask(const Task& task);
    TaskStorageResult updateTask(const Task& task);
    TaskStorageResult deleteTask(const String& taskId);
    TaskStorageResult getTask(const String& taskId, Task& task);
    TaskStorageResult listTasks(std::vector<String>& taskIds, TaskType typeFilter = (TaskType)-1);
    TaskStorageResult listTasksByStatus(std::vector<String>& taskIds, TaskStatus status);
    
    // Task execution management
    TaskExecutionResult executeTask(const String& taskId, const TaskExecutionOptions& options = TaskExecutionOptions());
    TaskExecutionResult cancelTask(const String& taskId);
    TaskExecutionResult pauseTask(const String& taskId);
    TaskExecutionResult resumeTask(const String& taskId);
    
    // Queue management
    TaskStorageResult queueTask(const String& taskId, const TaskExecutionOptions& options = TaskExecutionOptions());
    TaskStorageResult removeFromQueue(const String& taskId);
    TaskStorageResult clearQueue();
    TaskStorageResult getQueue(std::vector<String>& queuedTaskIds);
    
    // Status and monitoring
    TaskExecutionResult getExecutionStatus(const String& taskId, TaskExecutionState& state);
    TaskStorageResult getAllExecutionStates(std::vector<TaskExecutionState>& states);
    bool isAnyTaskExecuting() const;
    String getCurrentExecutingTask() const;
    
    // Batch operations
    TaskStorageResult executeTaskBatch(const std::vector<String>& taskIds, 
                                     const TaskExecutionOptions& options = TaskExecutionOptions());
    TaskStorageResult cancelAllTasks();
    TaskStorageResult pauseAllTasks();
    TaskStorageResult resumeAllTasks();
    
    // Import/Export integration
    TaskStorageResult importTasksFromBackup(const String& backupData, 
                                          const TaskImportOptions& options = TaskImportOptions());
    TaskStorageResult exportTasksToBackup(String& backupData,
                                        const TaskExportOptions& options = TaskExportOptions());
    
    // Task templates and patterns
    TaskStorageResult createTaskFromTemplate(TaskType type, const String& name,
                                           const TaskParameters& parameters,
                                           const std::vector<TaskWaypoint>& waypoints,
                                           Task& createdTask);
    
    // Statistics and analytics
    struct TaskStatistics {
        uint32_t totalTasks;
        uint32_t completedTasks;
        uint32_t failedTasks;
        uint32_t averageExecutionTime;
        uint32_t totalExecutionTime;
        std::map<TaskType, uint32_t> tasksByType;
        std::map<TaskStatus, uint32_t> tasksByStatus;
    };
    
    TaskStatistics getTaskStatistics() const;
    
    // Event handling
    void onTaskStatusChange(std::function<void(const String&, TaskStatus, TaskStatus)> callback) {
        taskStatusChangeCallback = callback;
    }
    
    void onTaskCompletion(std::function<void(const String&, TaskExecutionResult)> callback) {
        taskCompletionCallback = callback;
    }
    
    void onExecutionProgress(std::function<void(const String&, const TaskExecutionState&)> callback) {
        executionProgressCallback = callback;
    }
    
    // Configuration
    void setMAVLinkProcessor(MAVLinkProcessor* processor);
    bool isMAVLinkConnected() const;
    
    // Health and diagnostics
    bool isHealthy() const;
    TaskStorageResult validateAllTasks();
    TaskStorageResult repairCorruptedTasks();
    
    // Utility methods
    static String getExecutionResultString(TaskExecutionResult result);
    static TaskExecutionResult parseExecutionResultString(const String& resultStr);

private:
    // Internal state management
    void processExecutionQueue();
    void checkExecutionTimeouts();
    void updateTaskStatuses();
    
    // MAVLink message handlers
    void setupMAVLinkHandlers();
    void teardownMAVLinkHandlers();
    
    // Thread safety
    bool lockManager(uint32_t timeoutMs = portMAX_DELAY);
    void unlockManager();
};