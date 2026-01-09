#pragma once

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <vector>
#include <functional>
#include "../../core/CoreCommon.h"

enum class TaskStorageResult {
    SUCCESS,
    TASK_NOT_FOUND,
    WRITE_FAILED,
    READ_FAILED,
    FILESYSTEM_FULL,
    CORRUPTION_DETECTED,
    INVALID_DATA,
    FILESYSTEM_ERROR,
    PARTITION_NOT_MOUNTED,
    COMPRESSION_FAILED,
    DECOMPRESSION_FAILED
};

struct TaskStorageConfig {
    static const size_t MAX_TASK_SIZE = 64 * 1024;  // 64KB per task
    static const uint8_t MAX_TASKS = 100;
    static const char* TASK_DIR;
    static const char* INDEX_FILE;
    static const char* TEMP_SUFFIX;
    
    static const uint32_t STORAGE_MAGIC = 0x7A5B5678;  // Magic number for task storage
    static const uint32_t STORAGE_VERSION = 1;
};

struct TaskStorageHeader {
    uint32_t magic;
    uint32_t version;
    uint32_t checksum;
    uint32_t originalSize;
    uint32_t compressedSize;
    uint64_t timestamp;
    char taskId[37];  // UUID string + null terminator
    
    TaskStorageHeader() : magic(TaskStorageConfig::STORAGE_MAGIC), version(TaskStorageConfig::STORAGE_VERSION),
                         checksum(0), originalSize(0), compressedSize(0), timestamp(0) {
        memset(taskId, 0, sizeof(taskId));
    }
};

struct TaskIndexEntry {
    char taskId[37];
    char fileName[64];
    uint32_t size;
    uint64_t created;
    uint64_t modified;
    bool compressed;
    uint32_t checksum;
};

class TaskStorageManager {
private:
    static TaskStorageManager* instance;
    bool isInitialized;
    SemaphoreHandle_t storageMutex;
    
    std::vector<TaskIndexEntry> taskIndex;
    
    // Compression buffers
    static const size_t COMPRESSION_BUFFER_SIZE = TaskStorageConfig::MAX_TASK_SIZE;
    uint8_t* compressionBuffer;
    uint8_t* decompressionBuffer;
    
    uint32_t calculateChecksum(const uint8_t* data, size_t length);
    TaskStorageResult compressData(const uint8_t* input, size_t inputSize, 
                                  uint8_t* output, size_t& outputSize);
    TaskStorageResult decompressData(const uint8_t* input, size_t inputSize, 
                                   uint8_t* output, size_t& outputSize);
    
    TaskStorageResult loadTaskIndex();
    TaskStorageResult saveTaskIndex();
    TaskStorageResult addToIndex(const TaskIndexEntry& entry);
    TaskStorageResult removeFromIndex(const char* taskId);
    TaskIndexEntry* findInIndex(const char* taskId);
    
    String getTaskFilePath(const char* taskId);
    String getTempFilePath(const char* taskId);
    bool fileExists(const String& filePath);
    size_t getFileSize(const String& filePath);
    
    TaskStorageResult writeTaskAtomic(const char* taskId, const uint8_t* data, 
                                    size_t dataSize, bool compress = true);
    TaskStorageResult readTaskWithValidation(const char* taskId, uint8_t* buffer, 
                                           size_t& dataSize);

public:
    TaskStorageManager();
    ~TaskStorageManager();
    
    static TaskStorageManager* getInstance();
    TaskStorageResult begin();
    void end();
    
    // Core storage operations
    TaskStorageResult storeTask(const char* taskId, const uint8_t* data, size_t dataSize);
    TaskStorageResult loadTask(const char* taskId, uint8_t* buffer, size_t& dataSize);
    TaskStorageResult deleteTask(const char* taskId);
    TaskStorageResult taskExists(const char* taskId, bool& exists);
    
    // Task management
    TaskStorageResult listTasks(std::vector<String>& taskIds);
    TaskStorageResult getTaskInfo(const char* taskId, TaskIndexEntry& info);
    TaskStorageResult getStorageStats(size_t& totalTasks, size_t& totalSize, 
                                    size_t& freeSpace);
    
    // Maintenance operations
    TaskStorageResult validateAllTasks();
    TaskStorageResult repairCorruption();
    TaskStorageResult compactStorage();
    TaskStorageResult clearAllTasks();
    
    // Health monitoring
    bool isHealthy();
    TaskStorageResult getLastError() const { return lastError; }
    String getLastErrorMessage() const { return lastErrorMessage; }
    
    // Statistics
    struct StorageStats {
        uint32_t totalTasks;
        uint32_t corruptedTasks;
        uint32_t totalSize;
        uint32_t compressionRatio;  // Percentage
        uint32_t freeSpace;
        bool healthy;
    };
    
    StorageStats getDetailedStats();

private:
    TaskStorageResult lastError;
    String lastErrorMessage;
    void setLastError(TaskStorageResult error, const String& message);
    
    // Simple compression using run-length encoding + delta compression
    size_t simpleCompress(const uint8_t* input, size_t inputSize, uint8_t* output);
    size_t simpleDecompress(const uint8_t* input, size_t inputSize, uint8_t* output);
};