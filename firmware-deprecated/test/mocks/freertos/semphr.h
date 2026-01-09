#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include "FreeRTOS.h"

// Note: Main semaphore functions are defined in FreeRTOS.h to avoid duplicates

// Additional semaphore creation functions  
inline SemaphoreHandle_t xSemaphoreCreateBinary(void) {
    return (SemaphoreHandle_t)0x2;
}

inline SemaphoreHandle_t xSemaphoreCreateCounting(BaseType_t uxMaxCount, BaseType_t uxInitialCount) {
    (void)uxMaxCount; (void)uxInitialCount;
    return (SemaphoreHandle_t)0x3;
}

#endif // ARDUINO_ARCH_NATIVE