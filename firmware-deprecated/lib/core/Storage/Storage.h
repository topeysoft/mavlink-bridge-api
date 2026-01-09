#pragma once

#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>
#include <functional>
#ifdef ARDUINO_ARCH_NATIVE
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#else
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#endif

enum class StorageResult {
    SUCCESS,
    FILE_NOT_FOUND,
    WRITE_FAILED,
    READ_FAILED,
    FILESYSTEM_FULL,
    CORRUPTION_DETECTED,
    BACKUP_FAILED,
    RESTORE_FAILED,
    INVALID_SIZE,
    FILESYSTEM_ERROR
};

struct StorageConfig {
    static const size_t MAX_FILE_SIZE = 4096;  // 4KB limit
    static const uint8_t MAX_BACKUPS = 3;
    static const char* CONFIG_FILE;
    static const char* BACKUP_PREFIX;
    static const char* TEMP_SUFFIX;
    
    static const uint32_t CHECKSUM_MAGIC = 0xDEADBEEF;
};

struct FileHeader {
    uint32_t magic;
    uint32_t version;
    uint32_t checksum;
    uint32_t dataSize;
    uint64_t timestamp;
    
    FileHeader() : magic(StorageConfig::CHECKSUM_MAGIC), version(1), 
                   checksum(0), dataSize(0), timestamp(0) {}
};

class Storage {
private:
    static Storage* instance;
    bool isInitialized;
    SemaphoreHandle_t storageMutex;
    
    static const size_t BUFFER_SIZE = StorageConfig::MAX_FILE_SIZE + sizeof(FileHeader);
    uint8_t readBuffer[BUFFER_SIZE];
    uint8_t writeBuffer[BUFFER_SIZE];
    
    uint32_t calculateChecksum(const uint8_t* data, size_t length);
    bool validateFileIntegrity(const String& filePath);
    StorageResult createBackup(const String& filePath);
    StorageResult rotateBackups(const String& basePath);
    String getBackupPath(const String& basePath, uint8_t backupIndex);
    String getTempPath(const String& filePath);
    bool fileExists(const String& filePath);
    size_t getFileSize(const String& filePath);
    StorageResult writeFileAtomic(const String& filePath, const uint8_t* data, size_t dataSize);
    StorageResult readFileWithValidation(const String& filePath, uint8_t* buffer, size_t& dataSize);
    
public:
    Storage();
    ~Storage();
    
    static Storage* getInstance();
    StorageResult begin();
    void end();
    
    StorageResult writeConfig(const uint8_t* data, size_t dataSize, uint32_t version = 1);
    StorageResult readConfig(uint8_t* buffer, size_t& dataSize, uint32_t& version);
    StorageResult backupConfig();
    StorageResult restoreFromBackup(uint8_t backupIndex = 0);
    
    StorageResult writeFile(const String& filePath, const uint8_t* data, size_t dataSize);
    StorageResult readFile(const String& filePath, uint8_t* buffer, size_t& dataSize);
    StorageResult deleteFile(const String& filePath);
    
    bool hasValidConfig();
    StorageResult validateFilesystem();
    StorageResult defragment();
    
    size_t getTotalSpace();
    size_t getUsedSpace();
    size_t getFreeSpace();
    
    bool isHealthy();
    
    uint8_t getAvailableBackupCount();
    uint64_t getConfigTimestamp();
    
    String getLastError() const { return lastError; }
    
private:
    String lastError;
    void setLastError(const String& error) { lastError = error; }
};