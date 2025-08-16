#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include <functional>
#include "TaskStorageManager.h"
#include "../Task.h"

enum class TaskBackupFormat {
    JSON = 0,           // Human-readable JSON format
    COMPRESSED_JSON = 1, // Compressed JSON format
    BINARY = 2          // Binary format for maximum efficiency
};

struct TaskBackupHeader {
    uint32_t magic;           // Backup file magic number
    uint32_t version;         // Backup format version
    uint32_t taskCount;       // Number of tasks in backup
    uint32_t totalSize;       // Total size of backup data
    uint64_t timestamp;       // Backup creation timestamp
    TaskBackupFormat format;  // Backup format used
    uint32_t checksum;        // Backup integrity checksum
    char deviceId[37];        // Device ID that created backup
    char description[128];    // Optional backup description
    
    TaskBackupHeader() : magic(0xBACKUP01), version(1), taskCount(0), 
                        totalSize(0), timestamp(0), format(TaskBackupFormat::JSON),
                        checksum(0) {
        memset(deviceId, 0, sizeof(deviceId));
        memset(description, 0, sizeof(description));
    }
};

struct TaskExportOptions {
    TaskBackupFormat format = TaskBackupFormat::JSON;
    bool includeMetadata = true;
    bool includeWaypoints = true;
    bool compressData = false;
    std::vector<String> taskIds; // Empty = export all tasks
    String description;
    
    TaskExportOptions() {}
};

struct TaskImportOptions {
    bool overwriteExisting = false;
    bool validateBeforeImport = true;
    bool createBackupBeforeImport = true;
    std::function<void(int, int)> progressCallback; // (current, total)
    
    TaskImportOptions() {}
};

struct TaskBackupStats {
    uint32_t tasksExported;
    uint32_t tasksImported;
    uint32_t totalSize;
    uint32_t compressionRatio; // Percentage if compression used
    uint32_t processingTime;   // Milliseconds
    bool successful;
    String errorMessage;
    
    TaskBackupStats() : tasksExported(0), tasksImported(0), totalSize(0),
                       compressionRatio(100), processingTime(0), successful(false) {}
};

class TaskBackupManager {
private:
    static TaskBackupManager* instance;
    bool isInitialized;
    SemaphoreHandle_t backupMutex;
    
    // Buffer management
    static const size_t BACKUP_BUFFER_SIZE = 64 * 1024; // 64KB buffer
    uint8_t* backupBuffer;
    
    // Progress tracking
    std::function<void(int, int, const String&)> progressCallback;
    
    // Helper methods
    TaskStorageResult generateDeviceId(char* deviceId, size_t bufferSize);
    uint32_t calculateBackupChecksum(const uint8_t* data, size_t size);
    TaskStorageResult validateBackupIntegrity(const uint8_t* data, size_t size);
    
    // Format-specific methods
    TaskStorageResult exportToJson(const std::vector<Task>& tasks, 
                                  const TaskExportOptions& options,
                                  String& output);
    TaskStorageResult exportToBinary(const std::vector<Task>& tasks,
                                   const TaskExportOptions& options,
                                   uint8_t* buffer, size_t& bufferSize);
    
    TaskStorageResult importFromJson(const String& jsonData,
                                   const TaskImportOptions& options,
                                   std::vector<Task>& tasks);
    TaskStorageResult importFromBinary(const uint8_t* data, size_t dataSize,
                                     const TaskImportOptions& options,
                                     std::vector<Task>& tasks);
    
    // Compression helpers
    size_t compressJsonData(const String& input, uint8_t* output, size_t outputSize);
    String decompressJsonData(const uint8_t* input, size_t inputSize);

public:
    TaskBackupManager();
    ~TaskBackupManager();
    
    static TaskBackupManager* getInstance();
    TaskStorageResult begin();
    void end();
    
    // Export operations
    TaskStorageResult exportTasks(const TaskExportOptions& options, 
                                String& outputData);
    TaskStorageResult exportTasksToFile(const String& filePath,
                                      const TaskExportOptions& options);
    TaskStorageResult exportTasksToBuffer(const TaskExportOptions& options,
                                        uint8_t* buffer, size_t& bufferSize);
    
    // Import operations
    TaskStorageResult importTasks(const String& inputData,
                                const TaskImportOptions& options);
    TaskStorageResult importTasksFromFile(const String& filePath,
                                        const TaskImportOptions& options);
    TaskStorageResult importTasksFromBuffer(const uint8_t* buffer, size_t bufferSize,
                                          const TaskImportOptions& options);
    
    // Backup operations
    TaskStorageResult createFullBackup(const String& backupPath,
                                     const TaskExportOptions& options = TaskExportOptions());
    TaskStorageResult restoreFromBackup(const String& backupPath,
                                      const TaskImportOptions& options = TaskImportOptions());
    
    // Validation and preview
    TaskStorageResult validateBackupFile(const String& filePath, TaskBackupHeader& header);
    TaskStorageResult previewBackup(const String& filePath, 
                                  std::vector<String>& taskNames);
    
    // Batch operations
    TaskStorageResult exportSpecificTasks(const std::vector<String>& taskIds,
                                        const TaskExportOptions& options,
                                        String& outputData);
    TaskStorageResult mergeBackups(const std::vector<String>& backupPaths,
                                 const String& outputPath,
                                 const TaskExportOptions& options = TaskExportOptions());
    
    // Utility methods
    TaskStorageResult getBackupInfo(const String& filePath, TaskBackupHeader& info);
    TaskStorageResult compareBackups(const String& backup1Path, const String& backup2Path,
                                   std::vector<String>& differences);
    
    // Statistics and monitoring
    TaskBackupStats getLastOperationStats() const { return lastStats; }
    bool isOperationInProgress() const { return operationInProgress; }
    
    // Progress tracking
    void setProgressCallback(std::function<void(int, int, const String&)> callback) {
        progressCallback = callback;
    }
    
    // Format utilities
    static String getFormatName(TaskBackupFormat format);
    static TaskBackupFormat parseFormatName(const String& formatName);
    static size_t estimateBackupSize(const std::vector<String>& taskIds, 
                                   TaskBackupFormat format);

private:
    TaskBackupStats lastStats;
    bool operationInProgress;
    
    void updateProgress(int current, int total, const String& operation);
    void resetStats();
    void finalizeStats(bool success, const String& error = "");
    
    TaskStorageResult loadTasksFromStorage(const std::vector<String>& taskIds,
                                         std::vector<Task>& tasks);
    TaskStorageResult saveTasksToStorage(const std::vector<Task>& tasks,
                                       const TaskImportOptions& options);
    
    // Internal backup file operations
    TaskStorageResult writeBackupFile(const String& filePath, 
                                    const TaskBackupHeader& header,
                                    const uint8_t* data, size_t dataSize);
    TaskStorageResult readBackupFile(const String& filePath,
                                   TaskBackupHeader& header,
                                   uint8_t* data, size_t& dataSize);
};