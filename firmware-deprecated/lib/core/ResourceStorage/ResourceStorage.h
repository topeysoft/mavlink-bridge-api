#pragma once

#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <functional>
#include <vector>
#ifdef ARDUINO_ARCH_NATIVE
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"
#else
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/queue.h>
#endif

enum class ResourceType {
    ZONE,
    MISSION,
    USER_SETTINGS
};

enum class ResourceResult {
    SUCCESS,
    NOT_FOUND,
    WRITE_FAILED,
    READ_FAILED,
    PARSE_ERROR,
    INVALID_DATA,
    STORAGE_FULL,
    QUEUE_FULL,
    TIMEOUT
};

struct ResourceMetadata {
    char id[37];        // UUID + null terminator
    uint32_t version;
    uint64_t timestamp;
    ResourceType type;
    uint32_t checksum;
    uint32_t size;

    ResourceMetadata() : version(0), timestamp(0), type(ResourceType::ZONE),
                         checksum(0), size(0) {
        memset(id, 0, sizeof(id));
    }
};

struct WriteOperation {
    ResourceType type;
    char id[37];
    char* data;
    size_t dataSize;
    uint32_t version;

    WriteOperation() : type(ResourceType::ZONE), data(nullptr),
                       dataSize(0), version(0) {
        memset(id, 0, sizeof(id));
    }
};

// Memory pool for cached resources
template<typename T, size_t PoolSize>
class ResourcePool {
private:
    struct PoolEntry {
        T data;
        char id[37];
        uint64_t lastAccess;
        bool used;

        PoolEntry() : lastAccess(0), used(false) {
            memset(id, 0, sizeof(id));
        }
    };

    PoolEntry entries[PoolSize];
    size_t allocated;

public:
    ResourcePool() : allocated(0) {}

    T* get(const char* id) {
        for (size_t i = 0; i < PoolSize; i++) {
            if (entries[i].used && strcmp(entries[i].id, id) == 0) {
                entries[i].lastAccess = esp_timer_get_time();
                return &entries[i].data;
            }
        }
        return nullptr;
    }

    T* allocate(const char* id) {
        // Check if already exists
        T* existing = get(id);
        if (existing) return existing;

        // Find free slot
        for (size_t i = 0; i < PoolSize; i++) {
            if (!entries[i].used) {
                entries[i].used = true;
                strncpy(entries[i].id, id, sizeof(entries[i].id) - 1);
                entries[i].lastAccess = esp_timer_get_time();
                allocated++;
                return &entries[i].data;
            }
        }

        // Pool full, evict LRU
        size_t lruIndex = 0;
        uint64_t oldestAccess = entries[0].lastAccess;
        for (size_t i = 1; i < PoolSize; i++) {
            if (entries[i].lastAccess < oldestAccess) {
                oldestAccess = entries[i].lastAccess;
                lruIndex = i;
            }
        }

        entries[lruIndex].used = true;
        strncpy(entries[lruIndex].id, id, sizeof(entries[lruIndex].id) - 1);
        entries[lruIndex].lastAccess = esp_timer_get_time();
        return &entries[lruIndex].data;
    }

    void deallocate(const char* id) {
        for (size_t i = 0; i < PoolSize; i++) {
            if (entries[i].used && strcmp(entries[i].id, id) == 0) {
                entries[i].used = false;
                memset(entries[i].id, 0, sizeof(entries[i].id));
                allocated--;
                return;
            }
        }
    }

    void clear() {
        for (size_t i = 0; i < PoolSize; i++) {
            entries[i].used = false;
            memset(entries[i].id, 0, sizeof(entries[i].id));
        }
        allocated = 0;
    }

    size_t getFreeSlots() const { return PoolSize - allocated; }
    size_t getAllocatedSlots() const { return allocated; }
    float getUtilization() const { return (float)allocated / PoolSize * 100.0f; }
};

class ResourceStorage {
public:
    struct StorageStats {
        uint32_t totalWrites;
        uint32_t totalReads;
        uint32_t failedWrites;
        uint32_t failedReads;
        uint32_t queuedWrites;
        uint32_t avgWriteLatency;
        uint32_t avgReadLatency;
        float poolUtilization;
        size_t freeSpace;
        size_t usedSpace;
    };

private:
    static ResourceStorage* instance;
    bool isInitialized;
    SemaphoreHandle_t storageMutex;
    QueueHandle_t writeQueue;

    // Separate filesystem handles
    fs::FS* tasksFS;

    // Metadata cache (lightweight in-memory index)
    std::vector<ResourceMetadata> metadataCache;

    // JSON document pools
    static const size_t JSON_DOC_SIZE = 4096;
    DynamicJsonDocument readDoc;
    DynamicJsonDocument writeDoc;

    // Statistics
    StorageStats stats;
    uint64_t totalWriteTime;
    uint64_t totalReadTime;

    // Helper methods
    String getResourcePath(ResourceType type, const char* id);
    String getMetadataPath();
    uint32_t calculateChecksum(const char* data, size_t length);
    ResourceResult loadMetadataCache();
    ResourceResult saveMetadataCache();
    ResourceResult addToMetadataCache(const ResourceMetadata& meta);
    ResourceResult removeFromMetadataCache(const char* id, ResourceType type);
    ResourceMetadata* findInMetadataCache(const char* id, ResourceType type);
    ResourceResult writeFileToDisk(const String& path, const char* data, size_t dataSize);
    ResourceResult readFileFromDisk(const String& path, char* buffer, size_t& bufferSize);

public:
    ResourceStorage();
    ~ResourceStorage();

    static ResourceStorage* getInstance();
    ResourceResult begin();
    void end();

    // Synchronous operations (for reads)
    ResourceResult readResource(ResourceType type, const char* id, char* buffer, size_t& bufferSize);
    ResourceResult resourceExists(ResourceType type, const char* id);
    ResourceResult deleteResource(ResourceType type, const char* id);

    // Asynchronous operations (for writes)
    ResourceResult queueWrite(ResourceType type, const char* id, const char* data, size_t dataSize);
    bool processNextWrite();  // Called by StorageTask

    // Metadata operations
    std::vector<ResourceMetadata> listResources(ResourceType type, uint64_t since = 0);
    ResourceMetadata getMetadata(ResourceType type, const char* id);

    // Statistics
    StorageStats getStats();
    size_t getFreeSpace();
    size_t getUsedSpace();
    size_t getTotalSpace();
    bool isHealthy();

    // Queue management
    size_t getQueueDepth() const;
    void clearQueue();

    String getLastError() const { return lastError; }

private:
    String lastError;
    void setLastError(const String& error) { lastError = error; }
};
