#pragma once

#include <Arduino.h>
#include <cstddef>
#include <map>
#include <vector>
#include <functional>
#include "../CoreCommon.h"

class MemoryManager {
public:
    struct MemoryStats {
        uint32_t totalHeap;
        uint32_t freeHeap;
        uint32_t minFreeHeap;
        uint32_t largestFreeBlock;
        uint32_t allocations;
        uint32_t frees;
        float fragmentation;  // percentage
        uint32_t poolAllocations;
        uint32_t poolFrees;
        uint32_t poolHits;
        uint32_t poolMisses;
    };

    struct AllocationInfo {
        void* ptr;
        size_t size;
        uint32_t timestamp;
        const char* location;
    };

    // Memory pool for frequently allocated objects
    template<typename T, size_t PoolSize>
    class MemoryPool {
    private:
        alignas(T) uint8_t buffer[sizeof(T) * PoolSize];
        bool used[PoolSize];
        size_t allocated;
        uint32_t allocCount;
        uint32_t freeCount;

    public:
        MemoryPool() : allocated(0), allocCount(0), freeCount(0) {
            for (size_t i = 0; i < PoolSize; i++) {
                used[i] = false;
            }
        }

        T* allocate() {
            for (size_t i = 0; i < PoolSize; i++) {
                if (!used[i]) {
                    used[i] = true;
                    allocated++;
                    allocCount++;
                    return reinterpret_cast<T*>(&buffer[i * sizeof(T)]);
                }
            }
            return nullptr;  // Pool exhausted
        }

        void deallocate(T* ptr) {
            if (ptr == nullptr) return;
            
            uintptr_t bufferStart = reinterpret_cast<uintptr_t>(buffer);
            uintptr_t ptrAddr = reinterpret_cast<uintptr_t>(ptr);
            
            if (ptrAddr >= bufferStart && ptrAddr < bufferStart + sizeof(buffer)) {
                size_t index = (ptrAddr - bufferStart) / sizeof(T);
                if (index < PoolSize && used[index]) {
                    used[index] = false;
                    allocated--;
                    freeCount++;
                }
            }
        }

        size_t getFreeSlots() const { return PoolSize - allocated; }
        size_t getAllocatedSlots() const { return allocated; }
        size_t getTotalSlots() const { return PoolSize; }
        uint32_t getAllocCount() const { return allocCount; }
        uint32_t getFreeCount() const { return freeCount; }
        float getUtilization() const { return (float)allocated / PoolSize * 100.0f; }
    };

    // Cleanup callback type
    using CleanupCallback = std::function<size_t()>;

private:
    static MemoryManager* instance;
    MemoryStats stats;
    bool trackingEnabled;
    
    // Allocation tracking (debug mode)
    std::map<void*, AllocationInfo> allocations;
    
    // Emergency cleanup callbacks
    std::vector<CleanupCallback> cleanupCallbacks;
    
    // Memory thresholds
    uint32_t lowMemoryThreshold;
    uint32_t criticalMemoryThreshold;
    
    // Pool statistics
    uint32_t poolAllocations;
    uint32_t poolFrees;

public:
    static MemoryManager* getInstance();

    void begin();
    
    // Statistics
    MemoryStats getStats();
    void updateStats();
    void printMemoryMap() const;
    void printAllocationReport() const;

    // Optimization
    void defragment();
    size_t emergencyCleanup();
    void registerCleanupCallback(CleanupCallback callback);

    // Allocation tracking (debug mode)
    void enableTracking(bool enable);
    bool isTrackingEnabled() const;
    void trackAllocation(void* ptr, size_t size, const char* location = nullptr);
    void trackDeallocation(void* ptr);
    
    // Memory monitoring
    void setLowMemoryThreshold(uint32_t threshold);
    void setCriticalMemoryThreshold(uint32_t threshold);
    bool isLowMemory() const;
    bool isCriticalMemory() const;
    
    // Pool statistics
    void recordPoolAllocation();
    void recordPoolFree();
    
    // Memory analysis
    size_t findLargestAllocation() const;
    size_t countAllocations() const;
    std::vector<AllocationInfo> getLargestAllocations(size_t count = 10) const;
    
    // Memory health
    bool isMemoryHealthy() const;
    float getFragmentationPercentage() const;

private:
    MemoryManager();
    ~MemoryManager() = default;
    
    void calculateFragmentation();
};