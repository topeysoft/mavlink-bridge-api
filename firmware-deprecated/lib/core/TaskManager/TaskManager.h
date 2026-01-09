#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <vector>
#include <functional>
#include "../CoreCommon.h"

class TaskManager {
public:
    struct TaskConfig {
        const char* name;
        uint32_t stackSize;
        UBaseType_t priority;
        uint32_t watchdogTimeout;  // 0 = disabled
        bool startImmediately;
        BaseType_t coreId;         // -1 = no affinity, 0/1 = specific core
    };

    class ManagedTask {
    protected:
        TaskHandle_t taskHandle;
        TaskConfig config;
        bool running;
        bool shouldStop;
        uint32_t lastWatchdogFeed;
        TaskManager* manager;
        
        // Statistics
        uint32_t startTime;
        uint32_t totalRuntime;
        uint32_t watchdogFeeds;
        uint32_t watchdogViolations;

    public:
        ManagedTask(const TaskConfig& cfg);
        virtual ~ManagedTask();

        bool start();
        void stop();
        void forceStop();
        bool isRunning() const;
        bool shouldExit() const;

        // Task information
        const char* getName() const;
        uint32_t getStackHighWaterMark() const;
        uint32_t getRuntime() const;
        UBaseType_t getPriority() const;
        eTaskState getState() const;
        uint32_t getWatchdogFeeds() const;
        uint32_t getWatchdogViolations() const;

        // Override this in derived classes
        virtual void run() = 0;
        virtual void onStart() {}
        virtual void onStop() {}
        virtual void onWatchdogTimeout() {}

    protected:
        void feedWatchdog();
        void yield();
        void delay(uint32_t ms);
        bool delayWithExit(uint32_t ms);  // Returns true if should exit
        
        friend class TaskManager;

    private:
        static void taskWrapper(void* parameter);
        void setManager(TaskManager* mgr);
    };

private:
    static TaskManager* instance;
    std::vector<ManagedTask*> tasks;
    TaskHandle_t watchdogTask;
    bool watchdogRunning;
    uint32_t watchdogCheckInterval;

public:
    static TaskManager* getInstance();
    
    bool begin(uint32_t watchdogIntervalMs = 1000);
    void stop();

    void registerTask(ManagedTask* task);
    void unregisterTask(ManagedTask* task);
    void startAll();
    void stopAll();

    // Monitoring
    void printTaskStats() const;
    size_t getTaskCount() const;
    std::vector<ManagedTask*> getTasks() const;
    ManagedTask* findTask(const char* name) const;

    // Watchdog management
    void setWatchdogInterval(uint32_t intervalMs);
    void enableWatchdog(bool enable);
    bool isWatchdogEnabled() const;

    // Statistics
    struct TaskStats {
        const char* name;
        uint32_t stackHighWaterMark;
        uint32_t runtime;
        UBaseType_t priority;
        eTaskState state;
        uint32_t watchdogFeeds;
        uint32_t watchdogViolations;
        bool healthy;
    };
    
    std::vector<TaskStats> getAllTaskStats() const;

private:
    TaskManager();
    ~TaskManager() = default;

    static void watchdogTaskFunction(void* parameter);
    void checkWatchdogs();
    void handleWatchdogTimeout(ManagedTask* task);
    
    friend class ManagedTask;
};