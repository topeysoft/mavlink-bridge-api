#include "TaskManager.h"
#include <esp_log.h>
#include <esp_task_wdt.h>
#include <algorithm>

static const char* TAG = "TaskManager";

TaskManager* TaskManager::instance = nullptr;

TaskManager* TaskManager::getInstance() {
    if (instance == nullptr) {
        instance = new TaskManager();
    }
    return instance;
}

TaskManager::TaskManager() 
    : watchdogTask(nullptr)
    , watchdogRunning(false)
    , watchdogCheckInterval(1000) {
}

bool TaskManager::begin(uint32_t watchdogIntervalMs) {
    watchdogCheckInterval = watchdogIntervalMs;
    
    // Create watchdog task
    BaseType_t result = xTaskCreate(
        watchdogTaskFunction,
        "TaskWatchdog",
        2048,
        this,
        3,  // High priority for watchdog
        &watchdogTask
    );

    if (result != pdPASS) {
        ESP_LOGE(TAG, "Failed to create watchdog task");
        return false;
    }

    watchdogRunning = true;
    ESP_LOGI(TAG, "Task manager started with watchdog interval: %ums", watchdogIntervalMs);
    return true;
}

void TaskManager::stop() {
    watchdogRunning = false;
    
    // Stop all managed tasks
    stopAll();
    
    // Stop watchdog task
    if (watchdogTask != nullptr) {
        vTaskDelete(watchdogTask);
        watchdogTask = nullptr;
    }
    
    ESP_LOGI(TAG, "Task manager stopped");
}

void TaskManager::registerTask(ManagedTask* task) {
    if (task == nullptr) {
        ESP_LOGE(TAG, "Cannot register null task");
        return;
    }
    
    // Check if task already registered
    auto it = std::find(tasks.begin(), tasks.end(), task);
    if (it != tasks.end()) {
        ESP_LOGW(TAG, "Task %s already registered", task->getName());
        return;
    }
    
    task->setManager(this);
    tasks.push_back(task);
    ESP_LOGI(TAG, "Registered task: %s", task->getName());
}

void TaskManager::unregisterTask(ManagedTask* task) {
    if (task == nullptr) {
        return;
    }
    
    // Stop task if running
    if (task->isRunning()) {
        task->stop();
    }
    
    // Remove from list
    auto it = std::find(tasks.begin(), tasks.end(), task);
    if (it != tasks.end()) {
        tasks.erase(it);
        ESP_LOGI(TAG, "Unregistered task: %s", task->getName());
    }
}

void TaskManager::startAll() {
    for (auto* task : tasks) {
        if (!task->isRunning()) {
            task->start();
        }
    }
    ESP_LOGI(TAG, "Started all tasks (%zu total)", tasks.size());
}

void TaskManager::stopAll() {
    for (auto* task : tasks) {
        if (task->isRunning()) {
            task->stop();
        }
    }
    ESP_LOGI(TAG, "Stopped all tasks");
}

void TaskManager::printTaskStats() const {
    ESP_LOGI(TAG, "=== Task Statistics ===");
    ESP_LOGI(TAG, "Managed tasks: %zu", tasks.size());
    
    for (const auto* task : tasks) {
        ESP_LOGI(TAG, "Task: %s", task->getName());
        ESP_LOGI(TAG, "  State: %s", task->isRunning() ? "Running" : "Stopped");
        ESP_LOGI(TAG, "  Stack HWM: %u bytes", task->getStackHighWaterMark());
        ESP_LOGI(TAG, "  Runtime: %u ms", task->getRuntime());
        ESP_LOGI(TAG, "  Priority: %u", task->getPriority());
        ESP_LOGI(TAG, "  Watchdog feeds: %u", task->getWatchdogFeeds());
        ESP_LOGI(TAG, "  Watchdog violations: %u", task->getWatchdogViolations());
    }
}

size_t TaskManager::getTaskCount() const {
    return tasks.size();
}

std::vector<TaskManager::ManagedTask*> TaskManager::getTasks() const {
    return tasks;
}

TaskManager::ManagedTask* TaskManager::findTask(const char* name) const {
    for (auto* task : tasks) {
        if (strcmp(task->getName(), name) == 0) {
            return task;
        }
    }
    return nullptr;
}

void TaskManager::setWatchdogInterval(uint32_t intervalMs) {
    watchdogCheckInterval = intervalMs;
    ESP_LOGI(TAG, "Watchdog interval set to %ums", intervalMs);
}

void TaskManager::enableWatchdog(bool enable) {
    watchdogRunning = enable;
    ESP_LOGI(TAG, "Watchdog %s", enable ? "enabled" : "disabled");
}

bool TaskManager::isWatchdogEnabled() const {
    return watchdogRunning;
}

std::vector<TaskManager::TaskStats> TaskManager::getAllTaskStats() const {
    std::vector<TaskStats> stats;
    
    for (const auto* task : tasks) {
        TaskStats stat;
        stat.name = task->getName();
        stat.stackHighWaterMark = task->getStackHighWaterMark();
        stat.runtime = task->getRuntime();
        stat.priority = task->getPriority();
        stat.state = task->getState();
        stat.watchdogFeeds = task->getWatchdogFeeds();
        stat.watchdogViolations = task->getWatchdogViolations();
        stat.healthy = task->isRunning() && (stat.watchdogViolations == 0);
        
        stats.push_back(stat);
    }
    
    return stats;
}

void TaskManager::watchdogTaskFunction(void* parameter) {
    TaskManager* manager = static_cast<TaskManager*>(parameter);
    
    while (manager->watchdogRunning) {
        manager->checkWatchdogs();
        vTaskDelay(pdMS_TO_TICKS(manager->watchdogCheckInterval));
    }
    
    vTaskDelete(nullptr);
}

void TaskManager::checkWatchdogs() {
    uint32_t currentTime = millis();
    
    for (auto* task : tasks) {
        if (!task->isRunning() || task->config.watchdogTimeout == 0) {
            continue;
        }
        
        uint32_t timeSinceFeed = currentTime - task->lastWatchdogFeed;
        if (timeSinceFeed > task->config.watchdogTimeout) {
            handleWatchdogTimeout(task);
        }
    }
}

void TaskManager::handleWatchdogTimeout(ManagedTask* task) {
    ESP_LOGE(TAG, "Watchdog timeout for task: %s", task->getName());
    
    task->watchdogViolations++;
    task->onWatchdogTimeout();
    
    // Reset watchdog timer
    task->lastWatchdogFeed = millis();
}

// ManagedTask implementation

TaskManager::ManagedTask::ManagedTask(const TaskConfig& cfg) 
    : taskHandle(nullptr)
    , config(cfg)
    , running(false)
    , shouldStop(false)
    , lastWatchdogFeed(0)
    , manager(nullptr)
    , startTime(0)
    , totalRuntime(0)
    , watchdogFeeds(0)
    , watchdogViolations(0) {
}

TaskManager::ManagedTask::~ManagedTask() {
    if (running) {
        forceStop();
    }
}

bool TaskManager::ManagedTask::start() {
    if (running) {
        ESP_LOGW(TAG, "Task %s already running", config.name);
        return true;
    }
    
    shouldStop = false;
    startTime = millis();
    lastWatchdogFeed = startTime;
    
    BaseType_t result;
    if (config.coreId >= 0) {
        result = xTaskCreatePinnedToCore(
            taskWrapper,
            config.name,
            config.stackSize,
            this,
            config.priority,
            &taskHandle,
            config.coreId
        );
    } else {
        result = xTaskCreate(
            taskWrapper,
            config.name,
            config.stackSize,
            this,
            config.priority,
            &taskHandle
        );
    }
    
    if (result != pdPASS) {
        ESP_LOGE(TAG, "Failed to create task: %s", config.name);
        return false;
    }
    
    running = true;
    onStart();
    ESP_LOGI(TAG, "Started task: %s", config.name);
    return true;
}

void TaskManager::ManagedTask::stop() {
    if (!running) {
        return;
    }
    
    shouldStop = true;
    
    // Wait for task to exit gracefully (timeout after 5 seconds)
    uint32_t timeout = millis() + 5000;
    while (running && millis() < timeout) {
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    
    if (running) {
        ESP_LOGW(TAG, "Task %s did not exit gracefully, forcing stop", config.name);
        forceStop();
    }
}

void TaskManager::ManagedTask::forceStop() {
    if (taskHandle != nullptr) {
        vTaskDelete(taskHandle);
        taskHandle = nullptr;
    }
    running = false;
    onStop();
    ESP_LOGI(TAG, "Stopped task: %s", config.name);
}

bool TaskManager::ManagedTask::isRunning() const {
    return running;
}

bool TaskManager::ManagedTask::shouldExit() const {
    return shouldStop;
}

const char* TaskManager::ManagedTask::getName() const {
    return config.name;
}

uint32_t TaskManager::ManagedTask::getStackHighWaterMark() const {
    if (taskHandle != nullptr) {
        return uxTaskGetStackHighWaterMark(taskHandle);
    }
    return 0;
}

uint32_t TaskManager::ManagedTask::getRuntime() const {
    if (running) {
        return millis() - startTime;
    }
    return totalRuntime;
}

UBaseType_t TaskManager::ManagedTask::getPriority() const {
    if (taskHandle != nullptr) {
        return uxTaskPriorityGet(taskHandle);
    }
    return config.priority;
}

eTaskState TaskManager::ManagedTask::getState() const {
    if (taskHandle != nullptr) {
        return eTaskGetState(taskHandle);
    }
    return eDeleted;
}

uint32_t TaskManager::ManagedTask::getWatchdogFeeds() const {
    return watchdogFeeds;
}

uint32_t TaskManager::ManagedTask::getWatchdogViolations() const {
    return watchdogViolations;
}

void TaskManager::ManagedTask::feedWatchdog() {
    lastWatchdogFeed = millis();
    watchdogFeeds++;
}

void TaskManager::ManagedTask::yield() {
    vTaskDelay(pdMS_TO_TICKS(0));
}

void TaskManager::ManagedTask::delay(uint32_t ms) {
    vTaskDelay(pdMS_TO_TICKS(ms));
}

bool TaskManager::ManagedTask::delayWithExit(uint32_t ms) {
    const uint32_t checkInterval = 10;
    uint32_t remaining = ms;
    
    while (remaining > 0 && !shouldStop) {
        uint32_t delayTime = std::min(remaining, checkInterval);
        vTaskDelay(pdMS_TO_TICKS(delayTime));
        remaining -= delayTime;
    }
    
    return shouldStop;
}

void TaskManager::ManagedTask::taskWrapper(void* parameter) {
    ManagedTask* task = static_cast<ManagedTask*>(parameter);
    
    try {
        task->run();
    } catch (const std::exception& e) {
        ESP_LOGE(TAG, "Exception in task %s: %s", task->config.name, e.what());
    } catch (...) {
        ESP_LOGE(TAG, "Unknown exception in task %s", task->config.name);
    }
    
    task->totalRuntime = task->getRuntime();
    task->running = false;
    task->taskHandle = nullptr;
    task->onStop();
    
    vTaskDelete(nullptr);
}

void TaskManager::ManagedTask::setManager(TaskManager* mgr) {
    manager = mgr;
}