#ifdef ARDUINO_ARCH_NATIVE

#include "Arduino.h"
#include <thread>
#include <chrono>

// Global Serial object
SerialClass Serial;

// Arduino function implementations
void delay(unsigned long ms) {
    std::this_thread::sleep_for(std::chrono::milliseconds(ms));
}

unsigned long millis() {
    static auto start = std::chrono::steady_clock::now();
    auto now = std::chrono::steady_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(now - start);
    return static_cast<unsigned long>(duration.count());
}

bool isDigit(char c) {
    return c >= '0' && c <= '9';
}

uint32_t analogRead(uint8_t pin) {
    (void)pin; // Silence unused parameter warning
    return 2048; // Mock ADC reading (mid-range for 12-bit ADC)
}

#endif // ARDUINO_ARCH_NATIVE