#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>
#include <chrono>

// Mock ESP timer functions
inline int64_t esp_timer_get_time(void) {
    static auto start = std::chrono::steady_clock::now();
    auto now = std::chrono::steady_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(now - start);
    return duration.count();
}

inline uint32_t esp_timer_get_time_us(void) {
    return static_cast<uint32_t>(esp_timer_get_time());
}

inline uint32_t esp_timer_get_time_ms(void) {
    return static_cast<uint32_t>(esp_timer_get_time() / 1000);
}

#endif // ARDUINO_ARCH_NATIVE