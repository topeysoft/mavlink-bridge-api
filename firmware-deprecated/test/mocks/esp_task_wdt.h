#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>

// Mock ESP task watchdog functions
typedef struct {
    uint32_t timeout_ms;
} esp_task_wdt_config_t;

inline int esp_task_wdt_init(const esp_task_wdt_config_t* config) {
    (void)config;
    return 0; // ESP_OK
}

inline int esp_task_wdt_deinit(void) {
    return 0; // ESP_OK
}

inline int esp_task_wdt_add(void* handle) {
    (void)handle;
    return 0; // ESP_OK
}

inline int esp_task_wdt_delete(void* handle) {
    (void)handle;
    return 0; // ESP_OK
}

inline int esp_task_wdt_reset(void) {
    return 0; // ESP_OK
}

#endif // ARDUINO_ARCH_NATIVE