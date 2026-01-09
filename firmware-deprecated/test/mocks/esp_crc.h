#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>

// Mock CRC functions
inline uint32_t esp_crc32_le(uint32_t crc, const uint8_t* buf, uint32_t len) {
    (void)buf; (void)len;
    return crc ^ 0xDEADBEEF; // Simple mock CRC
}

inline uint16_t esp_crc16_le(uint16_t crc, const uint8_t* buf, uint32_t len) {
    (void)buf; (void)len;
    return crc ^ 0xBEEF; // Simple mock CRC
}

#endif // ARDUINO_ARCH_NATIVE