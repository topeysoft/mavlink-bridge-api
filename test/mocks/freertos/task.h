#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include "FreeRTOS.h"

// Task creation functions (mock)
typedef void (*TaskFunction_t)(void*);

inline BaseType_t xTaskCreate(
    TaskFunction_t pxTaskCode,
    const char * const pcName,
    const uint32_t usStackDepth,
    void * const pvParameters,
    const BaseType_t uxPriority,
    TaskHandle_t * const pxCreatedTask
) {
    (void)pxTaskCode; (void)pcName; (void)usStackDepth; 
    (void)pvParameters; (void)uxPriority; (void)pxCreatedTask;
    return pdPASS;
}

// Task utilities
inline void vTaskSuspend(TaskHandle_t xTaskToSuspend) {
    (void)xTaskToSuspend;
}

inline void vTaskResume(TaskHandle_t xTaskToResume) {
    (void)xTaskToResume;
}

// xTaskGetCurrentTaskHandle already defined in FreeRTOS.h

// Task state definitions - defined in FreeRTOS.h to avoid redefinition

inline eTaskState eTaskGetState(TaskHandle_t xTask) {
    (void)xTask;
    return eRunning; // Mock as always running
}

// Additional task utility functions
inline uint32_t uxTaskGetStackHighWaterMark(TaskHandle_t xTask) {
    (void)xTask;
    return 1000; // Mock stack high water mark
}

inline uint32_t uxTaskPriorityGet(TaskHandle_t xTask) {
    (void)xTask;
    return 1; // Mock priority
}

// uxTaskGetNumberOfTasks already defined in FreeRTOS.h

#endif // ARDUINO_ARCH_NATIVE