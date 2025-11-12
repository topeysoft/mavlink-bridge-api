#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>
#include "esp_timer.h"

// ESP system functions (mock)
typedef enum {
    ESP_RST_UNKNOWN = 0,
    ESP_RST_POWERON,
    ESP_RST_EXT,
    ESP_RST_SW,
    ESP_RST_PANIC,
    ESP_RST_INT_WDT,
    ESP_RST_TASK_WDT,
    ESP_RST_WDT,
    ESP_RST_DEEPSLEEP,
    ESP_RST_BROWNOUT,
    ESP_RST_SDIO
} esp_reset_reason_t;

inline esp_reset_reason_t esp_reset_reason(void) {
    return ESP_RST_POWERON; // Mock as power on reset
}

inline void esp_restart(void) {
    // Mock restart - do nothing in tests
}

inline uint32_t esp_get_free_heap_size(void) {
    return 100000; // Mock 100KB free heap
}

inline uint32_t esp_get_minimum_free_heap_size(void) {
    return 50000; // Mock 50KB min free heap
}

// ESP class mock for compatibility
class ESPClass {
public:
    uint32_t getFreeHeap() { return esp_get_free_heap_size(); }
    uint32_t getMinFreeHeap() { return esp_get_minimum_free_heap_size(); }
    uint32_t getHeapSize() { return 200000; } // Mock total heap size
    void restart() { esp_restart(); }
    esp_reset_reason_t getResetReason() { return esp_reset_reason(); }
    const char* getChipModel() { return "ESP32-S3 (Mock)"; }
    uint32_t getMaxAllocHeap() { return 50000; } // Mock max alloc heap
};

extern ESPClass ESP;

// Additional ESP32 types and constants
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1

// Mock error name function
inline const char* esp_err_to_name(esp_err_t error) {
    switch(error) {
        case ESP_OK: return "ESP_OK";
        case ESP_FAIL: return "ESP_FAIL";
        default: return "UNKNOWN_ERROR";
    }
}


#endif // ARDUINO_ARCH_NATIVE