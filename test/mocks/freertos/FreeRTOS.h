#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>

// Mock FreeRTOS types and constants
typedef void* TaskHandle_t;
typedef void* SemaphoreHandle_t;
typedef void* QueueHandle_t;
typedef void (*TaskFunction_t)(void*);

typedef uint32_t TickType_t;
typedef uint32_t BaseType_t;
typedef uint32_t UBaseType_t;

// Forward declaration - removed to avoid redefinition

#define pdTRUE 1
#define pdFALSE 0
#define pdPASS 1
#define pdFAIL 0

#define portMAX_DELAY 0xffffffffUL
#define portTICK_PERIOD_MS 1

// Include SemaphoreHandle_t type here to avoid order issues
#ifndef SEMAPHORE_HANDLE_TYPE_DEFINED
#define SEMAPHORE_HANDLE_TYPE_DEFINED
// Already defined above
#endif

// Mock task priorities
#define tskIDLE_PRIORITY 0
#define configMAX_PRIORITIES 25

// Mock functions (no-op implementations for testing)
inline void vTaskDelay(TickType_t xTicksToDelay) { (void)xTicksToDelay; }
inline TickType_t xTaskGetTickCount() { return 0; }
inline void vTaskDelete(TaskHandle_t xTask) { (void)xTask; }

// Task status functions
inline UBaseType_t uxTaskGetNumberOfTasks(void) {
    return 5; // Mock number of tasks
}

// Task system state function declaration moved after TaskStatus_t definition

inline TaskHandle_t xTaskGetCurrentTaskHandle(void) {
    return (TaskHandle_t)0x5678; // Mock handle
}

// Task creation function for ESP32
inline BaseType_t xTaskCreatePinnedToCore(
    TaskFunction_t pxTaskCode,
    const char * const pcName,
    const uint32_t usStackDepth,
    void * const pvParameters,
    UBaseType_t uxPriority,
    TaskHandle_t * const pxCreatedTask,
    const BaseType_t xCoreID
) {
    (void)pxTaskCode; (void)pcName; (void)usStackDepth;
    (void)pvParameters; (void)uxPriority; (void)pxCreatedTask; (void)xCoreID;
    if (pxCreatedTask) *pxCreatedTask = (TaskHandle_t)0x9999;
    return pdPASS;
}

// Time conversion macros
#define pdMS_TO_TICKS(ms) ((TickType_t)(ms))

// Additional types (UBaseType_t already defined above)

// Task state enum (from task.h)
typedef enum {
    eRunning = 0,
    eReady,
    eBlocked,
    eSuspended,
    eDeleted,
    eInvalid
} eTaskState;

// Task status structure
typedef struct {
    TaskHandle_t xHandle;
    const char* pcTaskName;
    UBaseType_t xTaskNumber;
    UBaseType_t eCurrentState;
    UBaseType_t uxCurrentPriority;
    UBaseType_t uxBasePriority;
    uint32_t ulRunTimeCounter;
    void* pxStackBase;
    uint16_t usStackHighWaterMark;
} TaskStatus_t;

// Task system state function
inline UBaseType_t uxTaskGetSystemState(TaskStatus_t* const pxTaskStatusArray,
                                        const UBaseType_t uxArraySize,
                                        uint32_t* const pulTotalRunTime) {
    (void)pxTaskStatusArray;
    (void)uxArraySize;
    if (pulTotalRunTime) *pulTotalRunTime = 10000;
    return 5; // Mock return
}

// Mock functions (avoiding duplicates from semphr.h)
inline void vSemaphoreDelete(SemaphoreHandle_t xSemaphore) { 
    (void)xSemaphore; 
}

inline UBaseType_t uxQueueMessagesWaiting(QueueHandle_t xQueue) { 
    (void)xQueue; 
    return 0; 
}

// Semaphore functions (avoid duplication with semphr.h)
inline SemaphoreHandle_t xSemaphoreCreateMutex(void) {
    return (SemaphoreHandle_t)0x1;
}

inline BaseType_t xSemaphoreTake(SemaphoreHandle_t xSemaphore, TickType_t xBlockTime) {
    (void)xSemaphore; (void)xBlockTime;
    return pdTRUE;
}

inline BaseType_t xSemaphoreGive(SemaphoreHandle_t xSemaphore) {
    (void)xSemaphore;
    return pdTRUE;
}

#endif // ARDUINO_ARCH_NATIVE