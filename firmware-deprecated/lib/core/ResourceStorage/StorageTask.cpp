#include "StorageTask.h"

StorageTask::StorageTask(uint32_t intervalMs, uint32_t batch)
    : ManagedTask(TaskManager::TaskConfig{
          .name = "storage",
          .stackSize = 3072,
          .priority = 1,
          .watchdogTimeout = 5000,
          .startImmediately = false,
          .coreId = 0
      }),
      storage(nullptr),
      processInterval(intervalMs),
      lastProcessTime(0),
      batchSize(batch),
      totalProcessed(0),
      totalFailed(0) {
}

StorageTask::~StorageTask() {
    stop();
}

void StorageTask::onStart() {
    Serial.println("StorageTask::onStart() - Storage task starting");
    storage = ResourceStorage::getInstance();
    lastProcessTime = millis();
    totalProcessed = 0;
    totalFailed = 0;
}

void StorageTask::onStop() {
    Serial.println("StorageTask::onStop() - Storage task stopping");
    storage = nullptr;
}

void StorageTask::run() {
    if (storage == nullptr) {
        Serial.println("StorageTask::run() - ERROR: Storage not initialized");
        delay(1000);
        return;
    }

    while (!shouldExit()) {
        uint32_t currentTime = millis();

        // Process write queue at configured interval
        if (currentTime - lastProcessTime >= processInterval) {
            lastProcessTime = currentTime;

            // Process batch of pending writes
            uint32_t processed = 0;
            while (processed < batchSize && storage->processNextWrite()) {
                processed++;
                totalProcessed++;
                feedWatchdog();
            }

            if (processed > 0) {
                Serial.printf("StorageTask: Processed %u writes, queue depth: %u\n",
                              processed, storage->getQueueDepth());
            }

            // Feed watchdog even if no writes processed
            feedWatchdog();
        }

        // Small delay to prevent busy-wait
        if (delayWithExit(10)) {
            break;
        }
    }

    Serial.println("StorageTask::run() - Task exiting");
}

uint32_t StorageTask::getQueueDepth() const {
    if (storage == nullptr) {
        return 0;
    }
    return storage->getQueueDepth();
}
