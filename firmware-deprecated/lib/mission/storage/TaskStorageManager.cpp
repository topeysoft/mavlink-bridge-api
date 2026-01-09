#include "TaskStorageManager.h"
#include <esp_crc.h>
#include <esp_log.h>

static const char* TAG = "TaskStorageManager";

const char* TaskStorageConfig::TASK_DIR = "/tasks";
const char* TaskStorageConfig::INDEX_FILE = "/tasks/index.json";
const char* TaskStorageConfig::TEMP_SUFFIX = ".tmp";

TaskStorageManager* TaskStorageManager::instance = nullptr;

TaskStorageManager* TaskStorageManager::getInstance() {
    if (instance == nullptr) {
        instance = new TaskStorageManager();
    }
    return instance;
}

TaskStorageManager::TaskStorageManager() 
    : isInitialized(false)
    , storageMutex(nullptr)
    , compressionBuffer(nullptr)
    , decompressionBuffer(nullptr)
    , lastError(TaskStorageResult::SUCCESS) {
}

TaskStorageManager::~TaskStorageManager() {
    end();
}

TaskStorageResult TaskStorageManager::begin() {
    if (isInitialized) {
        return TaskStorageResult::SUCCESS;
    }
    
    storageMutex = xSemaphoreCreateMutex();
    if (storageMutex == nullptr) {
        setLastError(TaskStorageResult::FILESYSTEM_ERROR, "Failed to create storage mutex");
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    // Mount LittleFS on the tasks partition
    if (!LittleFS.begin(false, "/tasks", 5, "tasks")) {
        setLastError(TaskStorageResult::PARTITION_NOT_MOUNTED, "Failed to mount tasks partition");
        vSemaphoreDelete(storageMutex);
        storageMutex = nullptr;
        return TaskStorageResult::PARTITION_NOT_MOUNTED;
    }
    
    // Allocate compression buffers
    compressionBuffer = (uint8_t*)malloc(COMPRESSION_BUFFER_SIZE);
    decompressionBuffer = (uint8_t*)malloc(COMPRESSION_BUFFER_SIZE);
    
    if (!compressionBuffer || !decompressionBuffer) {
        setLastError(TaskStorageResult::FILESYSTEM_ERROR, "Failed to allocate compression buffers");
        if (compressionBuffer) free(compressionBuffer);
        if (decompressionBuffer) free(decompressionBuffer);
        LittleFS.end();
        vSemaphoreDelete(storageMutex);
        storageMutex = nullptr;
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    // Create tasks directory if it doesn't exist
    if (!LittleFS.exists(TaskStorageConfig::TASK_DIR)) {
        if (!LittleFS.mkdir(TaskStorageConfig::TASK_DIR)) {
            setLastError(TaskStorageResult::FILESYSTEM_ERROR, "Failed to create tasks directory");
            end();
            return TaskStorageResult::FILESYSTEM_ERROR;
        }
    }
    
    // Load task index
    TaskStorageResult result = loadTaskIndex();
    if (result != TaskStorageResult::SUCCESS && result != TaskStorageResult::TASK_NOT_FOUND) {
        ESP_LOGW(TAG, "Failed to load task index, starting fresh");
        taskIndex.clear();
    }
    
    isInitialized = true;
    ESP_LOGI(TAG, "Task storage manager initialized successfully");
    return TaskStorageResult::SUCCESS;
}

void TaskStorageManager::end() {
    if (!isInitialized) {
        return;
    }
    
    if (storageMutex) {
        xSemaphoreTake(storageMutex, portMAX_DELAY);
        
        // Save current index
        saveTaskIndex();
        
        // Free compression buffers
        if (compressionBuffer) {
            free(compressionBuffer);
            compressionBuffer = nullptr;
        }
        if (decompressionBuffer) {
            free(decompressionBuffer);
            decompressionBuffer = nullptr;
        }
        
        xSemaphoreGive(storageMutex);
        vSemaphoreDelete(storageMutex);
        storageMutex = nullptr;
    }
    
    LittleFS.end();
    isInitialized = false;
    ESP_LOGI(TAG, "Task storage manager stopped");
}

TaskStorageResult TaskStorageManager::storeTask(const char* taskId, const uint8_t* data, size_t dataSize) {
    if (!isInitialized || !taskId || !data || dataSize == 0) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    if (dataSize > TaskStorageConfig::MAX_TASK_SIZE) {
        setLastError(TaskStorageResult::INVALID_DATA, "Task size exceeds maximum limit");
        return TaskStorageResult::INVALID_DATA;
    }
    
    xSemaphoreTake(storageMutex, portMAX_DELAY);
    
    TaskStorageResult result = writeTaskAtomic(taskId, data, dataSize, true);
    
    if (result == TaskStorageResult::SUCCESS) {
        // Update index
        TaskIndexEntry entry;
        strncpy(entry.taskId, taskId, sizeof(entry.taskId) - 1);
        snprintf(entry.fileName, sizeof(entry.fileName), "%s.task", taskId);
        entry.size = dataSize;
        entry.created = millis();
        entry.modified = entry.created;
        entry.compressed = true;
        entry.checksum = calculateChecksum(data, dataSize);
        
        // Remove existing entry if present
        removeFromIndex(taskId);
        addToIndex(entry);
        saveTaskIndex();
    }
    
    xSemaphoreGive(storageMutex);
    return result;
}

TaskStorageResult TaskStorageManager::loadTask(const char* taskId, uint8_t* buffer, size_t& dataSize) {
    if (!isInitialized || !taskId || !buffer) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    xSemaphoreTake(storageMutex, portMAX_DELAY);
    
    TaskStorageResult result = readTaskWithValidation(taskId, buffer, dataSize);
    
    xSemaphoreGive(storageMutex);
    return result;
}

TaskStorageResult TaskStorageManager::deleteTask(const char* taskId) {
    if (!isInitialized || !taskId) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    xSemaphoreTake(storageMutex, portMAX_DELAY);
    
    String filePath = getTaskFilePath(taskId);
    
    TaskStorageResult result = TaskStorageResult::SUCCESS;
    if (LittleFS.exists(filePath)) {
        if (!LittleFS.remove(filePath)) {
            result = TaskStorageResult::WRITE_FAILED;
            setLastError(result, "Failed to delete task file");
        } else {
            removeFromIndex(taskId);
            saveTaskIndex();
        }
    } else {
        result = TaskStorageResult::TASK_NOT_FOUND;
    }
    
    xSemaphoreGive(storageMutex);
    return result;
}

TaskStorageResult TaskStorageManager::taskExists(const char* taskId, bool& exists) {
    if (!isInitialized || !taskId) {
        return TaskStorageResult::INVALID_DATA;
    }
    
    xSemaphoreTake(storageMutex, portMAX_DELAY);
    
    TaskIndexEntry* entry = findInIndex(taskId);
    exists = (entry != nullptr);
    
    xSemaphoreGive(storageMutex);
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskStorageManager::listTasks(std::vector<String>& taskIds) {
    if (!isInitialized) {
        return TaskStorageResult::FILESYSTEM_ERROR;
    }
    
    xSemaphoreTake(storageMutex, portMAX_DELAY);
    
    taskIds.clear();
    for (const auto& entry : taskIndex) {
        taskIds.push_back(String(entry.taskId));
    }
    
    xSemaphoreGive(storageMutex);
    return TaskStorageResult::SUCCESS;
}

// Helper methods implementation

uint32_t TaskStorageManager::calculateChecksum(const uint8_t* data, size_t length) {
    return esp_crc32_le(0, data, length);
}

String TaskStorageManager::getTaskFilePath(const char* taskId) {
    return String(TaskStorageConfig::TASK_DIR) + "/" + String(taskId) + ".task";
}

String TaskStorageManager::getTempFilePath(const char* taskId) {
    return getTaskFilePath(taskId) + TaskStorageConfig::TEMP_SUFFIX;
}

bool TaskStorageManager::fileExists(const String& filePath) {
    return LittleFS.exists(filePath);
}

size_t TaskStorageManager::getFileSize(const String& filePath) {
    File file = LittleFS.open(filePath, "r");
    if (!file) {
        return 0;
    }
    size_t size = file.size();
    file.close();
    return size;
}

TaskStorageResult TaskStorageManager::writeTaskAtomic(const char* taskId, const uint8_t* data, 
                                                     size_t dataSize, bool compress) {
    String tempPath = getTempFilePath(taskId);
    String finalPath = getTaskFilePath(taskId);
    
    File tempFile = LittleFS.open(tempPath, "w");
    if (!tempFile) {
        setLastError(TaskStorageResult::WRITE_FAILED, "Failed to create temporary file");
        return TaskStorageResult::WRITE_FAILED;
    }
    
    // Prepare header
    TaskStorageHeader header;
    strncpy(header.taskId, taskId, sizeof(header.taskId) - 1);
    header.originalSize = dataSize;
    header.timestamp = millis();
    
    const uint8_t* writeData = data;
    size_t writeSize = dataSize;
    
    // Compress if requested and beneficial
    if (compress && dataSize > 64) {  // Only compress larger tasks
        size_t compressedSize = simpleCompress(data, dataSize, compressionBuffer);
        if (compressedSize < dataSize * 0.9) {  // Only use if at least 10% reduction
            writeData = compressionBuffer;
            writeSize = compressedSize;
        }
    }
    
    header.compressedSize = writeSize;
    header.checksum = calculateChecksum(writeData, writeSize);
    
    // Write header
    if (tempFile.write((uint8_t*)&header, sizeof(header)) != sizeof(header)) {
        tempFile.close();
        LittleFS.remove(tempPath);
        setLastError(TaskStorageResult::WRITE_FAILED, "Failed to write header");
        return TaskStorageResult::WRITE_FAILED;
    }
    
    // Write data
    if (tempFile.write(writeData, writeSize) != writeSize) {
        tempFile.close();
        LittleFS.remove(tempPath);
        setLastError(TaskStorageResult::WRITE_FAILED, "Failed to write task data");
        return TaskStorageResult::WRITE_FAILED;
    }
    
    tempFile.close();
    
    // Atomic rename
    if (!LittleFS.rename(tempPath, finalPath)) {
        LittleFS.remove(tempPath);
        setLastError(TaskStorageResult::WRITE_FAILED, "Failed to rename temporary file");
        return TaskStorageResult::WRITE_FAILED;
    }
    
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskStorageManager::readTaskWithValidation(const char* taskId, uint8_t* buffer, 
                                                           size_t& dataSize) {
    String filePath = getTaskFilePath(taskId);
    
    if (!fileExists(filePath)) {
        return TaskStorageResult::TASK_NOT_FOUND;
    }
    
    File file = LittleFS.open(filePath, "r");
    if (!file) {
        setLastError(TaskStorageResult::READ_FAILED, "Failed to open task file");
        return TaskStorageResult::READ_FAILED;
    }
    
    // Read and validate header
    TaskStorageHeader header;
    if (file.read((uint8_t*)&header, sizeof(header)) != sizeof(header)) {
        file.close();
        setLastError(TaskStorageResult::CORRUPTION_DETECTED, "Failed to read header");
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    if (header.magic != TaskStorageConfig::STORAGE_MAGIC) {
        file.close();
        setLastError(TaskStorageResult::CORRUPTION_DETECTED, "Invalid magic number");
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    if (header.originalSize > dataSize) {
        file.close();
        setLastError(TaskStorageResult::INVALID_DATA, "Buffer too small");
        return TaskStorageResult::INVALID_DATA;
    }
    
    // Read compressed data
    if (file.read(compressionBuffer, header.compressedSize) != header.compressedSize) {
        file.close();
        setLastError(TaskStorageResult::READ_FAILED, "Failed to read task data");
        return TaskStorageResult::READ_FAILED;
    }
    
    file.close();
    
    // Verify checksum
    uint32_t checksum = calculateChecksum(compressionBuffer, header.compressedSize);
    if (checksum != header.checksum) {
        setLastError(TaskStorageResult::CORRUPTION_DETECTED, "Checksum mismatch");
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    // Decompress if needed
    if (header.compressedSize != header.originalSize) {
        size_t decompressedSize = simpleDecompress(compressionBuffer, header.compressedSize, buffer);
        if (decompressedSize != header.originalSize) {
            setLastError(TaskStorageResult::DECOMPRESSION_FAILED, "Decompression size mismatch");
            return TaskStorageResult::DECOMPRESSION_FAILED;
        }
    } else {
        memcpy(buffer, compressionBuffer, header.originalSize);
    }
    
    dataSize = header.originalSize;
    return TaskStorageResult::SUCCESS;
}

// Index management methods
TaskStorageResult TaskStorageManager::loadTaskIndex() {
    if (!fileExists(TaskStorageConfig::INDEX_FILE)) {
        return TaskStorageResult::TASK_NOT_FOUND;
    }
    
    File file = LittleFS.open(TaskStorageConfig::INDEX_FILE, "r");
    if (!file) {
        return TaskStorageResult::READ_FAILED;
    }
    
    String jsonStr = file.readString();
    file.close();
    
    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, jsonStr);
    
    if (error) {
        ESP_LOGW(TAG, "Failed to parse task index JSON");
        return TaskStorageResult::CORRUPTION_DETECTED;
    }
    
    taskIndex.clear();
    JsonArray tasks = doc["tasks"].as<JsonArray>();
    
    for (JsonObject task : tasks) {
        TaskIndexEntry entry;
        strncpy(entry.taskId, task["id"], sizeof(entry.taskId) - 1);
        strncpy(entry.fileName, task["file"], sizeof(entry.fileName) - 1);
        entry.size = task["size"];
        entry.created = task["created"];
        entry.modified = task["modified"];
        entry.compressed = task["compressed"];
        entry.checksum = task["checksum"];
        
        taskIndex.push_back(entry);
    }
    
    ESP_LOGI(TAG, "Loaded %d tasks from index", taskIndex.size());
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskStorageManager::saveTaskIndex() {
    File file = LittleFS.open(TaskStorageConfig::INDEX_FILE, "w");
    if (!file) {
        return TaskStorageResult::WRITE_FAILED;
    }
    
    DynamicJsonDocument doc(4096);
    JsonArray tasks = doc.createNestedArray("tasks");
    
    for (const auto& entry : taskIndex) {
        JsonObject task = tasks.createNestedObject();
        task["id"] = entry.taskId;
        task["file"] = entry.fileName;
        task["size"] = entry.size;
        task["created"] = entry.created;
        task["modified"] = entry.modified;
        task["compressed"] = entry.compressed;
        task["checksum"] = entry.checksum;
    }
    
    serializeJson(doc, file);
    file.close();
    
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskStorageManager::addToIndex(const TaskIndexEntry& entry) {
    taskIndex.push_back(entry);
    return TaskStorageResult::SUCCESS;
}

TaskStorageResult TaskStorageManager::removeFromIndex(const char* taskId) {
    auto it = std::remove_if(taskIndex.begin(), taskIndex.end(),
        [taskId](const TaskIndexEntry& entry) {
            return strcmp(entry.taskId, taskId) == 0;
        });
    
    if (it != taskIndex.end()) {
        taskIndex.erase(it, taskIndex.end());
        return TaskStorageResult::SUCCESS;
    }
    
    return TaskStorageResult::TASK_NOT_FOUND;
}

TaskIndexEntry* TaskStorageManager::findInIndex(const char* taskId) {
    for (auto& entry : taskIndex) {
        if (strcmp(entry.taskId, taskId) == 0) {
            return &entry;
        }
    }
    return nullptr;
}

// Simple compression implementation (run-length encoding + delta)
size_t TaskStorageManager::simpleCompress(const uint8_t* input, size_t inputSize, uint8_t* output) {
    if (inputSize == 0) return 0;
    
    size_t outputPos = 0;
    size_t inputPos = 0;
    
    while (inputPos < inputSize && outputPos < COMPRESSION_BUFFER_SIZE - 3) {
        uint8_t currentByte = input[inputPos];
        uint8_t count = 1;
        
        // Count consecutive identical bytes
        while (inputPos + count < inputSize && 
               input[inputPos + count] == currentByte && 
               count < 255) {
            count++;
        }
        
        if (count >= 3) {
            // Use run-length encoding for 3+ consecutive bytes
            output[outputPos++] = 0xFF;  // Escape byte
            output[outputPos++] = count;
            output[outputPos++] = currentByte;
            inputPos += count;
        } else {
            // Copy literal bytes
            output[outputPos++] = currentByte;
            inputPos++;
        }
    }
    
    return outputPos;
}

size_t TaskStorageManager::simpleDecompress(const uint8_t* input, size_t inputSize, uint8_t* output) {
    size_t outputPos = 0;
    size_t inputPos = 0;
    
    while (inputPos < inputSize) {
        if (input[inputPos] == 0xFF && inputPos + 2 < inputSize) {
            // Run-length encoded sequence
            uint8_t count = input[inputPos + 1];
            uint8_t value = input[inputPos + 2];
            
            for (uint8_t i = 0; i < count; i++) {
                output[outputPos++] = value;
            }
            
            inputPos += 3;
        } else {
            // Literal byte
            output[outputPos++] = input[inputPos++];
        }
    }
    
    return outputPos;
}

bool TaskStorageManager::isHealthy() {
    return isInitialized && (lastError == TaskStorageResult::SUCCESS);
}

void TaskStorageManager::setLastError(TaskStorageResult error, const String& message) {
    lastError = error;
    lastErrorMessage = message;
    ESP_LOGE(TAG, "Storage error: %s", message.c_str());
}