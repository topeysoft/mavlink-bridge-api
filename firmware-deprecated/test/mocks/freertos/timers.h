#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>

// FreeRTOS timer types (mock)
typedef void* TimerHandle_t;
typedef void (*TimerCallbackFunction_t)(TimerHandle_t xTimer);

// FreeRTOS timer functions (mock)
inline TimerHandle_t xTimerCreate(const char* const pcTimerName,
                                  const uint32_t xTimerPeriodInTicks,
                                  const uint8_t uxAutoReload,
                                  void* const pvTimerID,
                                  TimerCallbackFunction_t pxCallbackFunction) {
    (void)pcTimerName;
    (void)xTimerPeriodInTicks;
    (void)uxAutoReload;
    (void)pvTimerID;
    (void)pxCallbackFunction;
    return (TimerHandle_t)0x1234; // Mock handle
}

inline uint8_t xTimerStart(TimerHandle_t xTimer, uint32_t xTicksToWait) {
    (void)xTimer;
    (void)xTicksToWait;
    return 1; // Success
}

inline uint8_t xTimerStop(TimerHandle_t xTimer, uint32_t xTicksToWait) {
    (void)xTimer;
    (void)xTicksToWait;
    return 1; // Success
}

inline uint8_t xTimerDelete(TimerHandle_t xTimer, uint32_t xTicksToWait) {
    (void)xTimer;
    (void)xTicksToWait;
    return 1; // Success
}

inline uint8_t xTimerReset(TimerHandle_t xTimer, uint32_t xTicksToWait) {
    (void)xTimer;
    (void)xTicksToWait;
    return 1; // Success
}

inline uint8_t xTimerChangePeriod(TimerHandle_t xTimer, uint32_t xNewPeriod, uint32_t xTicksToWait) {
    (void)xTimer;
    (void)xNewPeriod;
    (void)xTicksToWait;
    return 1; // Success
}

#define pdTRUE 1
#define pdFALSE 0

#endif // ARDUINO_ARCH_NATIVE