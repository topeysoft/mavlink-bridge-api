#include "MemoryManager.h"
#include <esp_log.h>
#include <esp_heap_caps.h>
#include <algorithm>

static const char* TAG = "MemoryManager";

MemoryManager* MemoryManager::instance = nullptr;

MemoryManager* MemoryManager::getInstance() {
    if (instance == nullptr) {
        instance = new MemoryManager();
    }
    return instance;
}

MemoryManager::MemoryManager() 
    : trackingEnabled(false)
    , lowMemoryThreshold(15360)      // 15KB
    , criticalMemoryThreshold(8192)  // 8KB
    , poolAllocations(0)
    , poolFrees(0) {
    
    memset(&stats, 0, sizeof(stats));
}

void MemoryManager::begin() {
    updateStats();
    ESP_LOGI(TAG, "Memory manager initialized");
    ESP_LOGI(TAG, "Total heap: %lu bytes", stats.totalHeap);
    ESP_LOGI(TAG, "Free heap: %lu bytes", stats.freeHeap);
    ESP_LOGI(TAG, "Min free heap: %lu bytes", stats.minFreeHeap);
    ESP_LOGI(TAG, "Largest free block: %lu bytes", stats.largestFreeBlock);
}

MemoryManager::MemoryStats MemoryManager::getStats() {
    updateStats();
    return stats;
}

void MemoryManager::updateStats() {
    stats.totalHeap = ESP.getHeapSize();
    stats.freeHeap = ESP.getFreeHeap();
    stats.minFreeHeap = ESP.getMinFreeHeap();
    stats.largestFreeBlock = ESP.getMaxAllocHeap();
    stats.poolAllocations = poolAllocations;
    stats.poolFrees = poolFrees;
    
    calculateFragmentation();
}

void MemoryManager::calculateFragmentation() {
    if (stats.freeHeap > 0) {
        // Fragmentation = (1 - largest_free_block / total_free) * 100
        stats.fragmentation = (1.0f - (float)stats.largestFreeBlock / (float)stats.freeHeap) * 100.0f;
    } else {
        stats.fragmentation = 100.0f;
    }
}

void MemoryManager::printMemoryMap() const {
    ESP_LOGI(TAG, "=== Memory Map ===");
    ESP_LOGI(TAG, "Total heap: %lu bytes (%.1f KB)", stats.totalHeap, stats.totalHeap / 1024.0f);
    ESP_LOGI(TAG, "Free heap: %lu bytes (%.1f KB)", stats.freeHeap, stats.freeHeap / 1024.0f);
    ESP_LOGI(TAG, "Min free heap: %lu bytes (%.1f KB)", stats.minFreeHeap, stats.minFreeHeap / 1024.0f);
    ESP_LOGI(TAG, "Largest free block: %lu bytes (%.1f KB)", stats.largestFreeBlock, stats.largestFreeBlock / 1024.0f);
    ESP_LOGI(TAG, "Fragmentation: %.1f%%", stats.fragmentation);
    ESP_LOGI(TAG, "Memory usage: %.1f%%", (float)(stats.totalHeap - stats.freeHeap) / stats.totalHeap * 100.0f);
    
    if (trackingEnabled) {
        ESP_LOGI(TAG, "Tracked allocations: %zu", allocations.size());
        ESP_LOGI(TAG, "Total allocations: %lu", stats.allocations);
        ESP_LOGI(TAG, "Total frees: %lu", stats.frees);
    }
    
    ESP_LOGI(TAG, "Pool allocations: %lu", stats.poolAllocations);
    ESP_LOGI(TAG, "Pool frees: %lu", stats.poolFrees);
    
    // Check memory health
    if (isLowMemory()) {
        ESP_LOGW(TAG, "WARNING: Low memory condition detected!");
    }
    if (isCriticalMemory()) {
        ESP_LOGE(TAG, "CRITICAL: Critical memory condition detected!");
    }
}

void MemoryManager::printAllocationReport() const {
    if (!trackingEnabled) {
        ESP_LOGW(TAG, "Allocation tracking is disabled");
        return;
    }
    
    ESP_LOGI(TAG, "=== Allocation Report ===");
    ESP_LOGI(TAG, "Active allocations: %zu", allocations.size());
    
    size_t totalSize = 0;
    for (const auto& pair : allocations) {
        totalSize += pair.second.size;
    }
    
    ESP_LOGI(TAG, "Total allocated: %zu bytes (%.1f KB)", totalSize, totalSize / 1024.0f);
    
    // Show largest allocations
    auto largest = getLargestAllocations(5);
    ESP_LOGI(TAG, "Largest allocations:");
    for (size_t i = 0; i < largest.size(); i++) {
        const auto& alloc = largest[i];
        ESP_LOGI(TAG, "  %zu. %zu bytes at %p%s", 
                 i + 1, alloc.size, alloc.ptr,
                 alloc.location ? alloc.location : "");
    }
}

void MemoryManager::defragment() {
    ESP_LOGI(TAG, "Attempting heap defragmentation...");
    
    size_t beforeFree = ESP.getFreeHeap();
    size_t beforeLargest = ESP.getMaxAllocHeap();
    
    // Try to defragment by allocating and freeing a large block
    size_t testSize = beforeLargest / 2;
    while (testSize > 1024) {
        void* ptr = malloc(testSize);
        if (ptr) {
            free(ptr);
            break;
        }
        testSize /= 2;
    }
    
    // Force garbage collection if available
    esp_err_t err = heap_caps_check_integrity_all(true);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Heap integrity check failed: %s", esp_err_to_name(err));
    }
    
    updateStats();
    
    ESP_LOGI(TAG, "Defragmentation complete:");
    ESP_LOGI(TAG, "  Free heap: %zu -> %lu bytes", beforeFree, stats.freeHeap);
    ESP_LOGI(TAG, "  Largest block: %zu -> %lu bytes", beforeLargest, stats.largestFreeBlock);
    ESP_LOGI(TAG, "  Fragmentation: %.1f%%", stats.fragmentation);
}

size_t MemoryManager::emergencyCleanup() {
    ESP_LOGW(TAG, "Performing emergency memory cleanup...");
    
    size_t beforeFree = ESP.getFreeHeap();
    size_t totalFreed = 0;
    
    // Call all registered cleanup callbacks
    for (auto& callback : cleanupCallbacks) {
        try {
            size_t freed = callback();
            totalFreed += freed;
            ESP_LOGI(TAG, "Cleanup callback freed %zu bytes", freed);
        } catch (...) {
            ESP_LOGE(TAG, "Cleanup callback threw exception");
        }
    }
    
    // Force defragmentation
    defragment();
    
    size_t afterFree = ESP.getFreeHeap();
    size_t netFreed = afterFree - beforeFree;
    
    ESP_LOGW(TAG, "Emergency cleanup complete: %zu bytes freed (net: %zu bytes)", 
             totalFreed, netFreed);
    
    return netFreed;
}

void MemoryManager::registerCleanupCallback(CleanupCallback callback) {
    cleanupCallbacks.push_back(callback);
    ESP_LOGI(TAG, "Registered cleanup callback (%zu total)", cleanupCallbacks.size());
}

void MemoryManager::enableTracking(bool enable) {
    trackingEnabled = enable;
    if (enable) {
        ESP_LOGI(TAG, "Memory allocation tracking enabled");
    } else {
        ESP_LOGI(TAG, "Memory allocation tracking disabled");
        allocations.clear();
    }
}

bool MemoryManager::isTrackingEnabled() const {
    return trackingEnabled;
}

void MemoryManager::trackAllocation(void* ptr, size_t size, const char* location) {
    if (!trackingEnabled || ptr == nullptr) {
        return;
    }
    
    AllocationInfo info;
    info.ptr = ptr;
    info.size = size;
    info.timestamp = millis();
    info.location = location;
    
    allocations[ptr] = info;
    stats.allocations++;
}

void MemoryManager::trackDeallocation(void* ptr) {
    if (!trackingEnabled || ptr == nullptr) {
        return;
    }
    
    auto it = allocations.find(ptr);
    if (it != allocations.end()) {
        allocations.erase(it);
        stats.frees++;
    }
}

void MemoryManager::setLowMemoryThreshold(uint32_t threshold) {
    lowMemoryThreshold = threshold;
    ESP_LOGI(TAG, "Low memory threshold set to %lu bytes", threshold);
}

void MemoryManager::setCriticalMemoryThreshold(uint32_t threshold) {
    criticalMemoryThreshold = threshold;
    ESP_LOGI(TAG, "Critical memory threshold set to %lu bytes", threshold);
}

bool MemoryManager::isLowMemory() const {
    return stats.freeHeap < lowMemoryThreshold;
}

bool MemoryManager::isCriticalMemory() const {
    return stats.freeHeap < criticalMemoryThreshold;
}

void MemoryManager::recordPoolAllocation() {
    poolAllocations++;
}

void MemoryManager::recordPoolFree() {
    poolFrees++;
}

size_t MemoryManager::findLargestAllocation() const {
    if (!trackingEnabled || allocations.empty()) {
        return 0;
    }
    
    size_t largest = 0;
    for (const auto& pair : allocations) {
        if (pair.second.size > largest) {
            largest = pair.second.size;
        }
    }
    return largest;
}

size_t MemoryManager::countAllocations() const {
    return allocations.size();
}

std::vector<MemoryManager::AllocationInfo> MemoryManager::getLargestAllocations(size_t count) const {
    std::vector<AllocationInfo> allocs;
    
    for (const auto& pair : allocations) {
        allocs.push_back(pair.second);
    }
    
    // Sort by size descending
    std::sort(allocs.begin(), allocs.end(), 
              [](const AllocationInfo& a, const AllocationInfo& b) {
                  return a.size > b.size;
              });
    
    if (allocs.size() > count) {
        allocs.resize(count);
    }
    
    return allocs;
}

bool MemoryManager::isMemoryHealthy() const {
    return !isLowMemory() && stats.fragmentation < 50.0f;
}

float MemoryManager::getFragmentationPercentage() const {
    return stats.fragmentation;
}