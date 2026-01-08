#include "ResourceStorage.h"
#include <esp_crc.h>

ResourceStorage* ResourceStorage::instance = nullptr;

ResourceStorage::ResourceStorage()
    : isInitialized(false), storageMutex(nullptr), writeQueue(nullptr),
      tasksFS(nullptr), readDoc(JSON_DOC_SIZE), writeDoc(JSON_DOC_SIZE),
      totalWriteTime(0), totalReadTime(0) {
    memset(&stats, 0, sizeof(StorageStats));
}

ResourceStorage::~ResourceStorage() {
    end();
}

ResourceStorage* ResourceStorage::getInstance() {
    if (instance == nullptr) {
        instance = new ResourceStorage();
    }
    return instance;
}

ResourceResult ResourceStorage::begin() {
    if (isInitialized) {
        return ResourceResult::SUCCESS;
    }

    Serial.println("ResourceStorage::begin() - Initializing");

    // Create mutex for thread safety
    storageMutex = xSemaphoreCreateMutex();
    if (storageMutex == nullptr) {
        setLastError("Failed to create storage mutex");
        return ResourceResult::WRITE_FAILED;
    }

    // Create write queue (max 16 pending writes)
    writeQueue = xQueueCreate(16, sizeof(WriteOperation));
    if (writeQueue == nullptr) {
        setLastError("Failed to create write queue");
        vSemaphoreDelete(storageMutex);
        storageMutex = nullptr;
        return ResourceResult::WRITE_FAILED;
    }

    // Mount tasks partition
    if (!LittleFS.begin(true, "/tasks", 10, "tasks")) {
        Serial.println("ResourceStorage::begin() - Failed to mount tasks partition");
        setLastError("Failed to mount tasks partition");
        vSemaphoreDelete(storageMutex);
        vQueueDelete(writeQueue);
        storageMutex = nullptr;
        writeQueue = nullptr;
        return ResourceResult::WRITE_FAILED;
    }

    tasksFS = &LittleFS;

    Serial.printf("ResourceStorage::begin() - Tasks partition mounted\n");
    Serial.printf("ResourceStorage::begin() - Total: %zu, Used: %zu, Free: %zu\n",
                  LittleFS.totalBytes(), LittleFS.usedBytes(),
                  LittleFS.totalBytes() - LittleFS.usedBytes());

    // Create directories if they don't exist
    tasksFS->mkdir("/zones");
    tasksFS->mkdir("/missions");
    tasksFS->mkdir("/settings");

    // Load metadata cache
    ResourceResult result = loadMetadataCache();
    if (result != ResourceResult::SUCCESS && result != ResourceResult::NOT_FOUND) {
        Serial.println("ResourceStorage::begin() - Failed to load metadata cache");
        // Continue anyway, will rebuild cache
    }

    Serial.printf("ResourceStorage::begin() - Loaded %d metadata entries\n",
                  metadataCache.size());

    isInitialized = true;
    return ResourceResult::SUCCESS;
}

void ResourceStorage::end() {
    if (!isInitialized) {
        return;
    }

    // Save metadata before shutdown
    saveMetadataCache();

    if (tasksFS) {
        LittleFS.end();
        tasksFS = nullptr;
    }

    if (writeQueue != nullptr) {
        clearQueue();
        vQueueDelete(writeQueue);
        writeQueue = nullptr;
    }

    if (storageMutex != nullptr) {
        vSemaphoreDelete(storageMutex);
        storageMutex = nullptr;
    }

    metadataCache.clear();
    isInitialized = false;
}

String ResourceStorage::getResourcePath(ResourceType type, const char* id) {
    String basePath;
    switch (type) {
        case ResourceType::ZONE:
            basePath = "/zones/";
            break;
        case ResourceType::MISSION:
            basePath = "/missions/";
            break;
        case ResourceType::USER_SETTINGS:
            basePath = "/settings/";
            break;
        default:
            basePath = "/";
    }
    return basePath + String(id) + ".json";
}

String ResourceStorage::getMetadataPath() {
    return "/.metadata.json";
}

uint32_t ResourceStorage::calculateChecksum(const char* data, size_t length) {
    return esp_crc32_le(0, (const uint8_t*)data, length);
}

ResourceResult ResourceStorage::readResource(ResourceType type, const char* id,
                                             char* buffer, size_t& bufferSize) {
    if (!isInitialized || buffer == nullptr) {
        return ResourceResult::INVALID_DATA;
    }

    uint64_t startTime = esp_timer_get_time();

    if (xSemaphoreTake(storageMutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        return ResourceResult::TIMEOUT;
    }

    String path = getResourcePath(type, id);
    ResourceResult result = readFileFromDisk(path, buffer, bufferSize);

    if (result == ResourceResult::SUCCESS) {
        stats.totalReads++;
        uint64_t duration = (esp_timer_get_time() - startTime) / 1000;  // Convert to ms
        totalReadTime += duration;
        stats.avgReadLatency = totalReadTime / stats.totalReads;
    } else {
        stats.failedReads++;
    }

    xSemaphoreGive(storageMutex);
    return result;
}

ResourceResult ResourceStorage::resourceExists(ResourceType type, const char* id) {
    if (!isInitialized) {
        return ResourceResult::INVALID_DATA;
    }

    // Check metadata cache first
    if (findInMetadataCache(id, type) != nullptr) {
        return ResourceResult::SUCCESS;
    }

    // Check filesystem
    String path = getResourcePath(type, id);
    return tasksFS->exists(path) ? ResourceResult::SUCCESS : ResourceResult::NOT_FOUND;
}

ResourceResult ResourceStorage::deleteResource(ResourceType type, const char* id) {
    if (!isInitialized) {
        return ResourceResult::INVALID_DATA;
    }

    if (xSemaphoreTake(storageMutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        return ResourceResult::TIMEOUT;
    }

    String path = getResourcePath(type, id);

    if (!tasksFS->remove(path)) {
        xSemaphoreGive(storageMutex);
        return ResourceResult::NOT_FOUND;
    }

    // Remove from metadata cache
    removeFromMetadataCache(id, type);

    xSemaphoreGive(storageMutex);
    return ResourceResult::SUCCESS;
}

ResourceResult ResourceStorage::queueWrite(ResourceType type, const char* id,
                                           const char* data, size_t dataSize) {
    if (!isInitialized || data == nullptr || dataSize == 0 || dataSize > 4096) {
        return ResourceResult::INVALID_DATA;
    }

    WriteOperation op;
    op.type = type;
    strncpy(op.id, id, sizeof(op.id) - 1);
    op.dataSize = dataSize;
    op.version = 1;

    // Allocate data copy
    op.data = (char*)malloc(dataSize);
    if (op.data == nullptr) {
        return ResourceResult::WRITE_FAILED;
    }
    memcpy(op.data, data, dataSize);

    // Queue the operation
    if (xQueueSend(writeQueue, &op, pdMS_TO_TICKS(100)) != pdTRUE) {
        free(op.data);
        return ResourceResult::QUEUE_FULL;
    }

    stats.queuedWrites++;
    return ResourceResult::SUCCESS;
}

bool ResourceStorage::processNextWrite() {
    if (!isInitialized || writeQueue == nullptr) {
        return false;
    }

    WriteOperation op;
    if (xQueueReceive(writeQueue, &op, 0) != pdTRUE) {
        return false;  // No items in queue
    }

    uint64_t startTime = esp_timer_get_time();

    if (xSemaphoreTake(storageMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        String path = getResourcePath(op.type, op.id);
        ResourceResult result = writeFileToDisk(path, op.data, op.dataSize);

        if (result == ResourceResult::SUCCESS) {
            // Update metadata cache
            ResourceMetadata meta;
            strncpy(meta.id, op.id, sizeof(meta.id) - 1);
            meta.type = op.type;
            meta.version = op.version;
            meta.timestamp = esp_timer_get_time();
            meta.checksum = calculateChecksum(op.data, op.dataSize);
            meta.size = op.dataSize;

            addToMetadataCache(meta);

            stats.totalWrites++;
            uint64_t duration = (esp_timer_get_time() - startTime) / 1000;
            totalWriteTime += duration;
            stats.avgWriteLatency = totalWriteTime / stats.totalWrites;
        } else {
            stats.failedWrites++;
        }

        xSemaphoreGive(storageMutex);
    } else {
        stats.failedWrites++;
    }

    // Free allocated data
    free(op.data);
    stats.queuedWrites--;

    return true;
}

std::vector<ResourceMetadata> ResourceStorage::listResources(ResourceType type,
                                                              uint64_t since) {
    std::vector<ResourceMetadata> result;

    if (!isInitialized) {
        return result;
    }

    if (xSemaphoreTake(storageMutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        return result;
    }

    for (const auto& meta : metadataCache) {
        if (meta.type == type && meta.timestamp >= since) {
            result.push_back(meta);
        }
    }

    xSemaphoreGive(storageMutex);
    return result;
}

ResourceMetadata ResourceStorage::getMetadata(ResourceType type, const char* id) {
    ResourceMetadata meta;

    if (!isInitialized) {
        return meta;
    }

    if (xSemaphoreTake(storageMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        ResourceMetadata* found = findInMetadataCache(id, type);
        if (found != nullptr) {
            meta = *found;
        }
        xSemaphoreGive(storageMutex);
    }

    return meta;
}

ResourceStorage::StorageStats ResourceStorage::getStats() {
    StorageStats currentStats = stats;
    currentStats.poolUtilization = 0;  // Will be updated when pools are used
    currentStats.freeSpace = getFreeSpace();
    currentStats.usedSpace = getUsedSpace();
    return currentStats;
}

size_t ResourceStorage::getFreeSpace() {
    if (!isInitialized || tasksFS == nullptr) {
        return 0;
    }
    return LittleFS.totalBytes() - LittleFS.usedBytes();
}

size_t ResourceStorage::getUsedSpace() {
    if (!isInitialized || tasksFS == nullptr) {
        return 0;
    }
    return LittleFS.usedBytes();
}

size_t ResourceStorage::getTotalSpace() {
    if (!isInitialized || tasksFS == nullptr) {
        return 0;
    }
    return LittleFS.totalBytes();
}

bool ResourceStorage::isHealthy() {
    if (!isInitialized) {
        return false;
    }

    // Check free space (warn if less than 10% free)
    size_t freeSpace = getFreeSpace();
    size_t totalSpace = getTotalSpace();
    if (totalSpace > 0 && (freeSpace * 100 / totalSpace) < 10) {
        return false;
    }

    // Check queue depth (warn if more than 10 pending)
    if (getQueueDepth() > 10) {
        return false;
    }

    // Check write latency (warn if average > 100ms)
    if (stats.avgWriteLatency > 100) {
        return false;
    }

    return true;
}

size_t ResourceStorage::getQueueDepth() const {
    if (writeQueue == nullptr) {
        return 0;
    }
    return uxQueueMessagesWaiting(writeQueue);
}

void ResourceStorage::clearQueue() {
    if (writeQueue == nullptr) {
        return;
    }

    WriteOperation op;
    while (xQueueReceive(writeQueue, &op, 0) == pdTRUE) {
        if (op.data != nullptr) {
            free(op.data);
        }
        stats.queuedWrites--;
    }
}

// Helper method implementations

ResourceResult ResourceStorage::writeFileToDisk(const String& path, const char* data,
                                                size_t dataSize) {
    File file = tasksFS->open(path, "w");
    if (!file) {
        setLastError("Failed to open file for writing: " + path);
        return ResourceResult::WRITE_FAILED;
    }

    size_t written = file.write((const uint8_t*)data, dataSize);
    file.close();

    if (written != dataSize) {
        setLastError("Failed to write complete data");
        return ResourceResult::WRITE_FAILED;
    }

    return ResourceResult::SUCCESS;
}

ResourceResult ResourceStorage::readFileFromDisk(const String& path, char* buffer,
                                                 size_t& bufferSize) {
    if (!tasksFS->exists(path)) {
        return ResourceResult::NOT_FOUND;
    }

    File file = tasksFS->open(path, "r");
    if (!file) {
        setLastError("Failed to open file for reading: " + path);
        return ResourceResult::READ_FAILED;
    }

    size_t fileSize = file.size();
    if (fileSize > bufferSize) {
        file.close();
        setLastError("Buffer too small");
        return ResourceResult::INVALID_DATA;
    }

    size_t bytesRead = file.read((uint8_t*)buffer, fileSize);
    file.close();

    if (bytesRead != fileSize) {
        setLastError("Failed to read complete file");
        return ResourceResult::READ_FAILED;
    }

    bufferSize = bytesRead;
    return ResourceResult::SUCCESS;
}

ResourceResult ResourceStorage::loadMetadataCache() {
    String path = getMetadataPath();

    if (!tasksFS->exists(path)) {
        return ResourceResult::NOT_FOUND;
    }

    File file = tasksFS->open(path, "r");
    if (!file) {
        return ResourceResult::READ_FAILED;
    }

    DeserializationError error = deserializeJson(readDoc, file);
    file.close();

    if (error) {
        setLastError("Failed to parse metadata: " + String(error.c_str()));
        return ResourceResult::PARSE_ERROR;
    }

    metadataCache.clear();
    JsonArray entries = readDoc["entries"].as<JsonArray>();

    for (JsonObject entry : entries) {
        ResourceMetadata meta;
        strncpy(meta.id, entry["id"] | "", sizeof(meta.id) - 1);
        meta.version = entry["version"] | 0;
        meta.timestamp = entry["timestamp"] | 0;
        meta.type = static_cast<ResourceType>(entry["type"] | 0);
        meta.checksum = entry["checksum"] | 0;
        meta.size = entry["size"] | 0;
        metadataCache.push_back(meta);
    }

    return ResourceResult::SUCCESS;
}

ResourceResult ResourceStorage::saveMetadataCache() {
    writeDoc.clear();
    JsonArray entries = writeDoc.createNestedArray("entries");

    for (const auto& meta : metadataCache) {
        JsonObject entry = entries.createNestedObject();
        entry["id"] = meta.id;
        entry["version"] = meta.version;
        entry["timestamp"] = meta.timestamp;
        entry["type"] = static_cast<int>(meta.type);
        entry["checksum"] = meta.checksum;
        entry["size"] = meta.size;
    }

    String path = getMetadataPath();
    File file = tasksFS->open(path, "w");
    if (!file) {
        return ResourceResult::WRITE_FAILED;
    }

    serializeJson(writeDoc, file);
    file.close();

    return ResourceResult::SUCCESS;
}

ResourceResult ResourceStorage::addToMetadataCache(const ResourceMetadata& meta) {
    // Update existing or add new
    for (auto& existing : metadataCache) {
        if (strcmp(existing.id, meta.id) == 0 && existing.type == meta.type) {
            existing = meta;
            return ResourceResult::SUCCESS;
        }
    }

    metadataCache.push_back(meta);
    return ResourceResult::SUCCESS;
}

ResourceResult ResourceStorage::removeFromMetadataCache(const char* id, ResourceType type) {
    for (auto it = metadataCache.begin(); it != metadataCache.end(); ++it) {
        if (strcmp(it->id, id) == 0 && it->type == type) {
            metadataCache.erase(it);
            return ResourceResult::SUCCESS;
        }
    }
    return ResourceResult::NOT_FOUND;
}

ResourceMetadata* ResourceStorage::findInMetadataCache(const char* id, ResourceType type) {
    for (auto& meta : metadataCache) {
        if (strcmp(meta.id, id) == 0 && meta.type == type) {
            return &meta;
        }
    }
    return nullptr;
}
