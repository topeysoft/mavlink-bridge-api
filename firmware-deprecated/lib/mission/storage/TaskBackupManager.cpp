#include "TaskBackupManager.h"
#include <esp_log.h>
#include <esp_system.h>
#include <esp_mac.h>
#include <LittleFS.h>

static const char* TAG = "TaskBackupManager";

TaskBackupManager* TaskBackupManager::instance = nullptr;

TaskBackupManager* TaskBackupManager::getInstance() {
    if (instance == nullptr) {
        instance = new TaskBackupManager();
    }
    return instance;
}

TaskBackupManager::TaskBackupManager() 
    : isInitialized(false)
    , backupMutex(nullptr)
    , backupBuffer(nullptr)
    , operationInProgress(false) {
}

TaskBackupManager::~TaskBackupManager() {
    end();
}

TaskStorageResult TaskBackupManager::begin() {
    if (isInitialized) {
        return TaskStorageResult::SUCCESS;
    }
    
    backupMutex = xSemaphoreCreateMutex();
    if (backupMutex == nullptr) {
        ESP_LOGE(TAG, "Failed to create backup mutex");
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    backupBuffer = (uint8_t*)malloc(BACKUP_BUFFER_SIZE);
    if (!backupBuffer) {
        ESP_LOGE(TAG, "Failed to allocate backup buffer");
        vSemaphoreDelete(backupMutex);
        backupMutex = nullptr;
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    isInitialized = true;
    ESP_LOGI(TAG, "Task backup manager initialized");
    return TaskStorageResult::SUCCESS;
}

void TaskBackupManager::end() {
    if (!isInitialized) {
        return;
    }
    
    if (backupMutex) {
        xSemaphoreTake(backupMutex, portMAX_DELAY);
        
        if (backupBuffer) {
            free(backupBuffer);
            backupBuffer = nullptr;
        }
        
        xSemaphoreGive(backupMutex);
        vSemaphoreDelete(backupMutex);
        backupMutex = nullptr;
    }
    
    isInitialized = false;
    ESP_LOGI(TAG, "Task backup manager stopped");
}

TaskStorageResult TaskBackupManager::exportTasks(const TaskExportOptions& options, String& outputData) {
    if (!isInitialized) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    xSemaphoreTake(backupMutex, portMAX_DELAY);
    operationInProgress = true;
    resetStats();
    
    uint32_t startTime = millis();
    TaskStorageResult result = TaskStorageResult::SUCCESS;
    
    try {
        std::vector<Task> tasks;
        
        // Load tasks from storage
        result = loadTasksFromStorage(options.taskIds, tasks);
        if (result != TaskStorageResult::SUCCESS) {
            finalizeStats(false, "Failed to load tasks from storage");
            operationInProgress = false;
            xSemaphoreGive(backupMutex);
            return result;
        }
        
        updateProgress(0, tasks.size(), "Loading tasks");
        
        // Export based on format
        switch (options.format) {
            case TaskBackupFormat::JSON:
            case TaskBackupFormat::COMPRESSED_JSON:
                result = exportToJson(tasks, options, outputData);
                break;
                
            default:
                result = TaskStorageResult::INVALID_DATA;
                break;
        }
        
        lastStats.tasksExported = tasks.size();
        lastStats.totalSize = outputData.length();
        lastStats.processingTime = millis() - startTime;
        
        updateProgress(tasks.size(), tasks.size(), "Export complete");
        finalizeStats(result == TaskStorageResult::SUCCESS);
        
    } catch (...) {
        result = TaskStorageResult::FILESYSTEM_ERROR;
        finalizeStats(false, "Unexpected error during export");
    }
    
    operationInProgress = false;
    xSemaphoreGive(backupMutex);
    return result;
}

TaskStorageResult TaskBackupManager::exportTasksToFile(const String& filePath, const TaskExportOptions& options) {
    String outputData;
    TaskStorageResult result = exportTasks(options, outputData);
    
    if (result != TaskStorageResult::SUCCESS) {
        return result;
    }
    
    // Write to file
    File file = LittleFS.open(filePath, "w");
    if (!file) {
        finalizeStats(false, "Failed to create export file");
        return TaskStorageResult::WRITE_FAILED;
    }
    
    // Write backup header
    TaskBackupHeader header;
    generateDeviceId(header.deviceId, sizeof(header.deviceId));
    header.taskCount = lastStats.tasksExported;
    header.totalSize = outputData.length();
    header.timestamp = millis();
    header.format = options.format;
    header.checksum = calculateBackupChecksum((const uint8_t*)outputData.c_str(), outputData.length());
    strncpy(header.description, options.description.c_str(), sizeof(header.description) - 1);
    
    if (file.write((uint8_t*)&header, sizeof(header)) != sizeof(header)) {
        file.close();
        finalizeStats(false, "Failed to write backup header");
        return TaskStorageResult::WRITE_FAILED;
    }
    
    // Write data
    if (file.write((uint8_t*)outputData.c_str(), outputData.length()) != outputData.length()) {
        file.close();
        finalizeStats(false, "Failed to write backup data");
        return TaskStorageResult::WRITE_FAILED;
    }
    
    file.close();
    ESP_LOGI(TAG, "Exported %d tasks to %s", lastStats.tasksExported, filePath.c_str());
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskBackupManager::importTasks(const String& inputData, const TaskImportOptions& options) {
    if (!isInitialized) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    xSemaphoreTake(backupMutex, portMAX_DELAY);
    operationInProgress = true;
    resetStats();
    
    uint32_t startTime = millis();
    TaskStorageResult result = TaskStorageResult::SUCCESS;
    
    try {
        std::vector<Task> tasks;
        
        // Import from JSON (assuming JSON format for now)
        result = importFromJson(inputData, options, tasks);
        if (result != TaskStorageResult::SUCCESS) {
            finalizeStats(false, "Failed to parse import data");
            operationInProgress = false;
            xSemaphoreGive(backupMutex);
            return result;
        }
        
        updateProgress(0, tasks.size(), "Parsing tasks");
        
        // Validate tasks if requested
        if (options.validateBeforeImport) {
            for (const auto& task : tasks) {
                if (!task.isValid()) {
                    finalizeStats(false, "Invalid task found in import data");
                    operationInProgress = false;
                    xSemaphoreGive(backupMutex);
                    return TaskStorageResult::INVALID_DATA;
                }
            }
        }
        
        updateProgress(tasks.size() / 2, tasks.size(), "Validating tasks");
        
        // Save tasks to storage
        result = saveTasksToStorage(tasks, options);
        if (result != TaskStorageResult::SUCCESS) {
            finalizeStats(false, "Failed to save tasks to storage");
            operationInProgress = false;
            xSemaphoreGive(backupMutex);
            return result;
        }
        
        lastStats.tasksImported = tasks.size();
        lastStats.processingTime = millis() - startTime;
        
        updateProgress(tasks.size(), tasks.size(), "Import complete");
        finalizeStats(true);
        
    } catch (...) {
        result = TaskStorageResult::FILESYSTEM_ERROR;
        finalizeStats(false, "Unexpected error during import");
    }
    
    operationInProgress = false;
    xSemaphoreGive(backupMutex);
    return result;
}

TaskStorageResult TaskBackupManager::importTasksFromFile(const String& filePath, const TaskImportOptions& options) {
    if (!LittleFS.exists(filePath)) {
        return TaskStorageResult::TASK_NOT_FOUND;
    }
    
    File file = LittleFS.open(filePath, "r");
    if (!file) {
        return TaskStorageResult::READ_FAILED;
    }
    
    // Read and validate header
    TaskBackupHeader header;
    if (file.read((uint8_t*)&header, sizeof(header)) != sizeof(header)) {
        file.close();
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    if (header.magic != 0xBAC0B01) {
        file.close();
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    // Read data
    String inputData = file.readString();
    file.close();
    
    // Verify checksum
    uint32_t checksum = calculateBackupChecksum((const uint8_t*)inputData.c_str(), inputData.length());
    if (checksum != header.checksum) {
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    return importTasks(inputData, options);
}

TaskStorageResult TaskBackupManager::validateBackupFile(const String& filePath, TaskBackupHeader& header) {
    if (!LittleFS.exists(filePath)) {
        return TaskStorageResult::TASK_NOT_FOUND;
    }
    
    File file = LittleFS.open(filePath, "r");
    if (!file) {
        return TaskStorageResult::READ_FAILED;
    }
    
    if (file.read((uint8_t*)&header, sizeof(header)) != sizeof(header)) {
        file.close();
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    file.close();
    
    if (header.magic != 0xBAC0B01) {
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    return TaskStorageResult::SUCCESS;
}

// Helper method implementations

TaskStorageResult TaskBackupManager::generateDeviceId(char* deviceId, size_t bufferSize) {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    
    snprintf(deviceId, bufferSize, "%02x%02x%02x%02x%02x%02x", 
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    
    return TaskStorageResult::SUCCESS;
}

uint32_t TaskBackupManager::calculateBackupChecksum(const uint8_t* data, size_t size) {
    uint32_t checksum = 0;
    for (size_t i = 0; i < size; i++) {
        checksum = ((checksum << 5) + checksum) + data[i]; // djb2 hash
    }
    return checksum;
}

TaskStorageResult TaskBackupManager::exportToJson(const std::vector<Task>& tasks, 
                                                 const TaskExportOptions& options,
                                                 String& output) {
    DynamicJsonDocument doc(16384);
    
    // Backup metadata
    JsonObject meta = doc.createNestedObject("backup");
    meta["version"] = 1;
    meta["timestamp"] = millis();
    meta["taskCount"] = tasks.size();
    meta["format"] = "json";
    if (!options.description.isEmpty()) {
        meta["description"] = options.description;
    }
    
    // Export tasks
    JsonArray tasksArray = doc.createNestedArray("tasks");
    
    for (size_t i = 0; i < tasks.size(); i++) {
        String taskJson;
        TaskStorageResult result = tasks[i].toJson(taskJson, options.includeWaypoints);
        if (result == TaskStorageResult::SUCCESS) {
            DynamicJsonDocument taskDoc(4096);
            deserializeJson(taskDoc, taskJson);
            tasksArray.add(taskDoc.as<JsonObject>());
        }
        
        updateProgress(i + 1, tasks.size(), "Exporting tasks");
    }
    
    serializeJson(doc, output);
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskBackupManager::importFromJson(const String& jsonData,
                                                   const TaskImportOptions& options,
                                                   std::vector<Task>& tasks) {
    DynamicJsonDocument doc(16384);
    DeserializationError error = deserializeJson(doc, jsonData);
    
    if (error) {
        ESP_LOGE(TAG, "Failed to parse import JSON: %s", error.c_str());
        return TaskStorageResult::INVALID_DATA;
    }
    
    tasks.clear();
    
    if (doc.containsKey("tasks")) {
        JsonArray tasksArray = doc["tasks"];
        
        for (JsonObject taskObj : tasksArray) {
            Task task;
            String taskJsonString;
            serializeJson(taskObj, taskJsonString);
            
            TaskStorageResult result = task.fromJson(taskJsonString);
            if (result == TaskStorageResult::SUCCESS) {
                tasks.push_back(task);
            } else {
                ESP_LOGW(TAG, "Failed to parse task from JSON, skipping");
            }
        }
    }
    
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskBackupManager::loadTasksFromStorage(const std::vector<String>& taskIds,
                                                        std::vector<Task>& tasks) {
    TaskStorageManager* storage = TaskStorageManager::getInstance();
    if (!storage) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    tasks.clear();
    
    if (taskIds.empty()) {
        // Load all tasks
        std::vector<String> allTaskIds;
        TaskStorageResult result = storage->listTasks(allTaskIds);
        if (result != TaskStorageResult::SUCCESS) {
            return result;
        }
        
        for (const auto& taskId : allTaskIds) {
            Task task;
            result = task.load(taskId);
            if (result == TaskStorageResult::SUCCESS) {
                tasks.push_back(task);
            }
        }
    } else {
        // Load specific tasks
        for (const auto& taskId : taskIds) {
            Task task;
            TaskStorageResult result = task.load(taskId);
            if (result == TaskStorageResult::SUCCESS) {
                tasks.push_back(task);
            }
        }
    }
    
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskBackupManager::saveTasksToStorage(const std::vector<Task>& tasks,
                                                       const TaskImportOptions& options) {
    TaskStorageManager* storage = TaskStorageManager::getInstance();
    if (!storage) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    for (size_t i = 0; i < tasks.size(); i++) {
        const Task& task = tasks[i];
        
        // Check if task already exists
        bool exists = false;
        TaskStorageResult result = storage->taskExists(task.getId().c_str(), exists);
        
        if (exists && !options.overwriteExisting) {
            ESP_LOGW(TAG, "Task %s already exists, skipping", task.getId().c_str());
            continue;
        }
        
        result = task.save();
        if (result != TaskStorageResult::SUCCESS) {
            ESP_LOGE(TAG, "Failed to save task %s", task.getId().c_str());
            return result;
        }
        
        updateProgress(i + 1, tasks.size(), "Saving tasks");
    }
    
    return TaskStorageResult::SUCCESS;
}

void TaskBackupManager::updateProgress(int current, int total, const String& operation) {
    if (progressCallback) {
        progressCallback(current, total, operation);
    }
}

void TaskBackupManager::resetStats() {
    lastStats = TaskBackupStats();
}

void TaskBackupManager::finalizeStats(bool success, const String& error) {
    lastStats.successful = success;
    if (!success && !error.isEmpty()) {
        lastStats.errorMessage = error;
    }
}

String TaskBackupManager::getFormatName(TaskBackupFormat format) {
    switch (format) {
        case TaskBackupFormat::JSON: return "json";
        case TaskBackupFormat::COMPRESSED_JSON: return "compressed_json";
        case TaskBackupFormat::BINARY: return "binary";
        default: return "unknown";
    }
}

TaskBackupFormat TaskBackupManager::parseFormatName(const String& formatName) {
    if (formatName == "json") return TaskBackupFormat::JSON;
    if (formatName == "compressed_json") return TaskBackupFormat::COMPRESSED_JSON;
    if (formatName == "binary") return TaskBackupFormat::BINARY;
    return TaskBackupFormat::JSON; // Default
}