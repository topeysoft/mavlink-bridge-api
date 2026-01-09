#pragma once

#include "../TaskManager/TaskManager.h"
#include "ResourceStorage.h"

class StorageTask : public TaskManager::ManagedTask {
private:
    ResourceStorage* storage;
    uint32_t processInterval;  // Milliseconds between processing batches
    uint32_t lastProcessTime;
    uint32_t batchSize;        // Max items to process per iteration
    uint32_t totalProcessed;
    uint32_t totalFailed;

public:
    StorageTask(uint32_t intervalMs = 100, uint32_t batch = 5);
    ~StorageTask() override;

    void run() override;
    void onStart() override;
    void onStop() override;

    // Statistics
    uint32_t getTotalProcessed() const { return totalProcessed; }
    uint32_t getTotalFailed() const { return totalFailed; }
    uint32_t getQueueDepth() const;

    // Configuration
    void setProcessInterval(uint32_t intervalMs) { processInterval = intervalMs; }
    void setBatchSize(uint32_t batch) { batchSize = batch; }
};
