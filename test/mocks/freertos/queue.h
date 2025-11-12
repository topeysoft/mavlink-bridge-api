#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include "FreeRTOS.h"

// Queue operations (mock)
inline QueueHandle_t xQueueCreate(BaseType_t uxQueueLength, BaseType_t uxItemSize) {
    (void)uxQueueLength; (void)uxItemSize;
    return (QueueHandle_t)0x4;
}

inline BaseType_t xQueueSend(QueueHandle_t xQueue, const void* pvItemToQueue, TickType_t xTicksToWait) {
    (void)xQueue; (void)pvItemToQueue; (void)xTicksToWait;
    return pdTRUE;
}

inline BaseType_t xQueueReceive(QueueHandle_t xQueue, void* pvBuffer, TickType_t xTicksToWait) {
    (void)xQueue; (void)pvBuffer; (void)xTicksToWait;
    return pdTRUE;
}

inline void vQueueDelete(QueueHandle_t xQueue) {
    (void)xQueue;
}

#endif // ARDUINO_ARCH_NATIVE