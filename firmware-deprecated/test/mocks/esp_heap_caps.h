#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstddef>
#include <cstdint>

// Mock heap capabilities
#define MALLOC_CAP_DEFAULT 0
#define MALLOC_CAP_INTERNAL 1
#define MALLOC_CAP_SPIRAM 2
#define MALLOC_CAP_8BIT 4

// Mock heap functions
inline size_t heap_caps_get_free_size(uint32_t caps) { 
    (void)caps; 
    return 100000; // Mock 100KB free
}

inline size_t heap_caps_get_largest_free_block(uint32_t caps) { 
    (void)caps; 
    return 50000; // Mock 50KB largest block
}

inline size_t heap_caps_get_total_size(uint32_t caps) { 
    (void)caps; 
    return 512000; // Mock 512KB total
}

inline void* heap_caps_malloc(size_t size, uint32_t caps) { 
    (void)caps; 
    return malloc(size); 
}

inline void heap_caps_free(void* ptr) { 
    free(ptr); 
}

inline int heap_caps_check_integrity_all(bool print_errors) {
    (void)print_errors;
    return 0; // ESP_OK - heap is fine in mock
}

#endif // ARDUINO_ARCH_NATIVE