#include "HealthMonitor.h"
#include <esp_system.h>
#include <esp_task_wdt.h>
#include <esp_log.h>
#include <EventManager/EventManager.h>
#include <ResourceStorage/ResourceStorage.h>
#include <ArduinoJson.h>

static const char* TAG = "HealthMonitor";

HealthMonitor* HealthMonitor::instance = nullptr;

HealthMonitor* HealthMonitor::getInstance() {
    if (instance == nullptr) {
        instance = new HealthMonitor();
    }
    return instance;
}

HealthMonitor::HealthMonitor() 
    : monitorTask(nullptr)
    , checkInterval(5000)
    , isRunning(false)
    , memoryThreshold(10240)  // 10KB default
    , cpuThreshold(80.0f)     // 80% default
    , lastIdleTime(0)
    , lastTotalTime(0) {
    
    health.uptime = 0;
    health.freeHeap = 0;
    health.minFreeHeap = 0;
    health.largestFreeBlock = 0;
    health.cpuUsage = 0.0f;
    health.temperature = 0.0f;
    health.lowMemoryWarning = false;
    health.systemHealthy = true;
}

bool HealthMonitor::begin(uint32_t intervalMs) {
    if (isRunning) {
        ESP_LOGW(TAG, "Health monitor already running");
        return true;
    }

    checkInterval = intervalMs;
    
    // Create monitor task
    BaseType_t result = xTaskCreate(
        monitorTaskFunction,
        "HealthMonitor",
        4096,  // Stack size
        this,
        2,     // Priority
        &monitorTask
    );

    if (result != pdPASS) {
        ESP_LOGE(TAG, "Failed to create health monitor task");
        return false;
    }

    isRunning = true;
    ESP_LOGI(TAG, "Health monitor started (interval: %ums)", intervalMs);
    return true;
}

void HealthMonitor::stop() {
    if (!isRunning) {
        return;
    }

    isRunning = false;
    
    if (monitorTask != nullptr) {
        vTaskDelete(monitorTask);
        monitorTask = nullptr;
    }
    
    ESP_LOGI(TAG, "Health monitor stopped");
}

void HealthMonitor::monitorTaskFunction(void* parameter) {
    HealthMonitor* monitor = static_cast<HealthMonitor*>(parameter);
    
    while (monitor->isRunning) {
        monitor->updateSystemMetrics();
        monitor->updateTaskInfo();
        monitor->updateComponentHealth();
        monitor->calculateCPUUsage();
        monitor->checkThresholds();
        monitor->publishHealthEvents();
        
        vTaskDelay(pdMS_TO_TICKS(monitor->checkInterval));
    }
    
    vTaskDelete(nullptr);
}

void HealthMonitor::updateSystemMetrics() {
    health.uptime = millis();
    health.freeHeap = ESP.getFreeHeap();
    health.minFreeHeap = ESP.getMinFreeHeap();
    health.largestFreeBlock = ESP.getMaxAllocHeap();
    health.temperature = getTemperature();
    
    // Check for low memory condition
    health.lowMemoryWarning = (health.freeHeap < memoryThreshold);
}

void HealthMonitor::updateTaskInfo() {
    health.tasks.clear();
    
    UBaseType_t taskCount = uxTaskGetNumberOfTasks();
    TaskStatus_t* taskArray = new TaskStatus_t[taskCount];
    
    if (taskArray == nullptr) {
        ESP_LOGE(TAG, "Failed to allocate memory for task array");
        return;
    }

    uint32_t totalRunTime;
    UBaseType_t actualTaskCount = uxTaskGetSystemState(taskArray, taskCount, &totalRunTime);
    
    for (UBaseType_t i = 0; i < actualTaskCount; i++) {
        TaskInfo taskInfo;
        taskInfo.name = taskArray[i].pcTaskName;
        taskInfo.stackHighWaterMark = taskArray[i].usStackHighWaterMark;
        taskInfo.runtime = taskArray[i].ulRunTimeCounter;
        taskInfo.priority = taskArray[i].uxCurrentPriority;
        taskInfo.state = (eTaskState)taskArray[i].eCurrentState;
        taskInfo.handle = taskArray[i].xHandle;
        
        health.tasks.push_back(taskInfo);
    }
    
    delete[] taskArray;
}

void HealthMonitor::updateComponentHealth() {
    health.components.clear();
    
    for (auto& pair : componentRegistry) {
        ComponentHealth& component = pair.second;
        
        // Run health check if available
        if (component.healthCheck) {
            try {
                bool previousHealth = component.healthy;
                component.healthy = component.healthCheck();
                component.lastUpdate = millis();
                
                // Trigger callback if component failed
                if (previousHealth && !component.healthy && componentFailureCallback) {
                    componentFailureCallback(component.name);
                }
                
                component.status = component.healthy ? "healthy" : "failed";
            } catch (...) {
                component.healthy = false;
                component.status = "error";
                ESP_LOGE(TAG, "Health check failed for component: %s", component.name);
            }
        }
        
        health.components.push_back(component);
    }
}

void HealthMonitor::calculateCPUUsage() {
    uint32_t idleTime = 0;
    uint32_t totalTime = 0;
    
    // Find idle task runtime
    for (const auto& task : health.tasks) {
        totalTime += task.runtime;
        if (strcmp(task.name, "IDLE") == 0 || strcmp(task.name, "IDLE0") == 0) {
            idleTime += task.runtime;
        }
    }
    
    if (lastTotalTime > 0) {
        uint32_t deltaTotal = totalTime - lastTotalTime;
        uint32_t deltaIdle = idleTime - lastIdleTime;
        
        if (deltaTotal > 0) {
            health.cpuUsage = 100.0f * (1.0f - ((float)deltaIdle / (float)deltaTotal));
        }
    }
    
    lastTotalTime = totalTime;
    lastIdleTime = idleTime;
}

void HealthMonitor::checkThresholds() {
    // Check memory threshold
    if (health.freeHeap < memoryThreshold && lowMemoryCallback) {
        lowMemoryCallback(health.freeHeap);
    }
    
    // Check CPU threshold
    if (health.cpuUsage > cpuThreshold && highCPUCallback) {
        highCPUCallback(health.cpuUsage);
    }
    
    // Update overall system health
    health.systemHealthy = !health.lowMemoryWarning && 
                          health.cpuUsage < cpuThreshold;
    
    // Check component health
    for (const auto& component : health.components) {
        if (!component.healthy) {
            health.systemHealthy = false;
            break;
        }
    }
}

void HealthMonitor::publishHealthEvents() {
    EventManager* eventManager = EventManager::getInstance();
    if (!eventManager) {
        return;
    }

    DynamicJsonDocument payload(1024);
    payload["uptime"] = health.uptime;
    payload["freeHeap"] = health.freeHeap;
    payload["minFreeHeap"] = health.minFreeHeap;
    payload["cpuUsage"] = health.cpuUsage;
    payload["temperature"] = health.temperature;
    payload["systemHealthy"] = health.systemHealthy;
    payload["taskCount"] = health.tasks.size();
    payload["componentCount"] = health.components.size();

    // Add unhealthy components
    JsonArray unhealthyComponents = payload["unhealthyComponents"].to<JsonArray>();
    for (const auto& component : health.components) {
        if (!component.healthy) {
            JsonObject comp = unhealthyComponents.createNestedObject();
            comp["name"] = component.name;
            comp["status"] = component.status;
        }
    }

    // Add resource storage metrics
    ResourceStorage* storage = ResourceStorage::getInstance();
    if (storage && storage->isHealthy()) {
        auto stats = storage->getStats();

        JsonObject storageMetrics = payload["storage"].to<JsonObject>();
        storageMetrics["totalWrites"] = stats.totalWrites;
        storageMetrics["totalReads"] = stats.totalReads;
        storageMetrics["failedWrites"] = stats.failedWrites;
        storageMetrics["failedReads"] = stats.failedReads;
        storageMetrics["queueDepth"] = stats.queuedWrites;
        storageMetrics["avgWriteLatency"] = stats.avgWriteLatency;
        storageMetrics["avgReadLatency"] = stats.avgReadLatency;
        storageMetrics["poolUtilization"] = stats.poolUtilization;
        storageMetrics["freeSpace"] = stats.freeSpace;
        storageMetrics["usedSpace"] = stats.usedSpace;
    }

    eventManager->publishAsync(EventType::HEALTH_UPDATE, payload.as<JsonObjectConst>());
}

HealthMonitor::SystemHealth HealthMonitor::getSystemHealth() {
    return health;
}

bool HealthMonitor::isSystemHealthy() const {
    return health.systemHealthy;
}

void HealthMonitor::registerComponent(const char* name, HealthCheckCallback healthCheck) {
    ComponentHealth component;
    component.name = name;
    component.healthy = true;
    component.status = "unknown";
    component.lastUpdate = 0;
    component.healthCheck = healthCheck;
    
    componentRegistry[std::string(name)] = component;
    ESP_LOGI(TAG, "Registered component: %s", name);
}

void HealthMonitor::unregisterComponent(const char* name) {
    componentRegistry.erase(std::string(name));
    ESP_LOGI(TAG, "Unregistered component: %s", name);
}

void HealthMonitor::setMemoryThreshold(uint32_t minFreeBytes) {
    memoryThreshold = minFreeBytes;
    ESP_LOGI(TAG, "Memory threshold set to %u bytes", minFreeBytes);
}

void HealthMonitor::setCPUThreshold(float maxUsage) {
    cpuThreshold = maxUsage;
    ESP_LOGI(TAG, "CPU threshold set to %.1f%%", maxUsage);
}

void HealthMonitor::onLowMemory(MemoryCallback callback) {
    lowMemoryCallback = callback;
}

void HealthMonitor::onHighCPU(CPUCallback callback) {
    highCPUCallback = callback;
}

void HealthMonitor::onComponentFailure(ComponentCallback callback) {
    componentFailureCallback = callback;
}

void HealthMonitor::updateComponentHealth(const char* name, bool healthy, const char* status) {
    auto it = componentRegistry.find(std::string(name));
    if (it != componentRegistry.end()) {
        it->second.healthy = healthy;
        it->second.lastUpdate = millis();
        if (status) {
            it->second.status = status;
        }
    }
}

void HealthMonitor::triggerHealthCheck() {
    if (isRunning) {
        updateSystemMetrics();
        updateTaskInfo();
        updateComponentHealth();
        calculateCPUUsage();
        checkThresholds();
    }
}

uint32_t HealthMonitor::getUptime() const {
    return health.uptime;
}

uint32_t HealthMonitor::getFreeHeap() const {
    return health.freeHeap;
}

uint32_t HealthMonitor::getMinFreeHeap() const {
    return health.minFreeHeap;
}

float HealthMonitor::getCPUUsage() const {
    return health.cpuUsage;
}

size_t HealthMonitor::getTaskCount() const {
    return health.tasks.size();
}

size_t HealthMonitor::getHealthyComponentCount() const {
    size_t count = 0;
    for (const auto& component : health.components) {
        if (component.healthy) {
            count++;
        }
    }
    return count;
}

float HealthMonitor::getTemperature() {
    // ESP32 internal temperature sensor (if available)
    // This is a rough approximation - actual implementation may vary
    uint32_t raw = analogRead(36); // ADC1_CH0 for temperature
    return (raw * 0.1f) - 30.0f;   // Rough conversion
}

eTaskState HealthMonitor::getTaskState(TaskHandle_t task) {
    return eTaskGetState(task);
}

const char* HealthMonitor::taskStateToString(eTaskState state) {
    switch (state) {
        case eRunning: return "Running";
        case eReady: return "Ready";
        case eBlocked: return "Blocked";
        case eSuspended: return "Suspended";
        case eDeleted: return "Deleted";
        default: return "Unknown";
    }
}