#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <vector>
#include <functional>
#include <map>
#include "../CoreCommon.h"

class HealthMonitor {
public:
    struct TaskInfo {
        const char* name;
        uint32_t stackHighWaterMark;
        uint32_t runtime;
        uint8_t priority;
        eTaskState state;
        TaskHandle_t handle;
    };

    struct ComponentHealth {
        const char* name;
        bool healthy;
        const char* status;
        uint32_t lastUpdate;
        std::function<bool()> healthCheck;
    };

    struct SystemHealth {
        uint32_t uptime;
        uint32_t freeHeap;
        uint32_t minFreeHeap;
        uint32_t largestFreeBlock;
        float cpuUsage;
        float temperature;
        bool lowMemoryWarning;
        bool systemHealthy;
        std::vector<TaskInfo> tasks;
        std::vector<ComponentHealth> components;
    };

    // Callback types
    using MemoryCallback = std::function<void(uint32_t)>;
    using CPUCallback = std::function<void(float)>;
    using ComponentCallback = std::function<void(const char*)>;
    using HealthCheckCallback = std::function<bool()>;

private:
    static HealthMonitor* instance;
    SystemHealth health;
    TaskHandle_t monitorTask;
    uint32_t checkInterval;
    bool isRunning;

    // Thresholds
    uint32_t memoryThreshold;
    float cpuThreshold;

    // Callbacks
    MemoryCallback lowMemoryCallback;
    CPUCallback highCPUCallback;
    ComponentCallback componentFailureCallback;

    // Component registry
    std::map<std::string, ComponentHealth> componentRegistry;

    // CPU usage tracking
    uint32_t lastIdleTime;
    uint32_t lastTotalTime;

public:
    static HealthMonitor* getInstance();
    
    bool begin(uint32_t intervalMs = 5000);
    void stop();

    // Health checks
    SystemHealth getSystemHealth();
    bool isSystemHealthy() const;
    void registerComponent(const char* name, HealthCheckCallback healthCheck);
    void unregisterComponent(const char* name);

    // Thresholds
    void setMemoryThreshold(uint32_t minFreeBytes);
    void setCPUThreshold(float maxUsage);

    // Callbacks
    void onLowMemory(MemoryCallback callback);
    void onHighCPU(CPUCallback callback);
    void onComponentFailure(ComponentCallback callback);

    // Manual health updates
    void updateComponentHealth(const char* name, bool healthy, const char* status = nullptr);
    void triggerHealthCheck();

    // Statistics
    uint32_t getUptime() const;
    uint32_t getFreeHeap() const;
    uint32_t getMinFreeHeap() const;
    float getCPUUsage() const;
    size_t getTaskCount() const;
    size_t getHealthyComponentCount() const;

private:
    HealthMonitor();
    ~HealthMonitor() = default;

    static void monitorTaskFunction(void* parameter);
    void updateSystemMetrics();
    void updateTaskInfo();
    void updateComponentHealth();
    void calculateCPUUsage();
    void checkThresholds();
    void publishHealthEvents();
    
    float getTemperature();
    eTaskState getTaskState(TaskHandle_t task);
    const char* taskStateToString(eTaskState state);
};