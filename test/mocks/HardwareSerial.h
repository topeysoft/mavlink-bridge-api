#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>
#include <cstddef>
#include <iostream>

// Mock HardwareSerial class
class HardwareSerial {
private:
    uint8_t _uart_num;
public:
    HardwareSerial() : _uart_num(0) {}
    HardwareSerial(uint8_t uart_num) : _uart_num(uart_num) {}
    
    void begin(unsigned long baud) { (void)baud; }
    void begin(unsigned long baud, uint32_t config) { (void)baud; (void)config; }
    void begin(unsigned long baud, uint32_t config, int8_t rxPin, int8_t txPin) { 
        (void)baud; (void)config; (void)rxPin; (void)txPin; 
    }
    void end() {}
    void updateBaudRate(unsigned long baud) { (void)baud; }
    
    int available() { return 0; }
    int read() { return -1; }
    int peek() { return -1; }
    void flush() {}
    
    size_t write(uint8_t data) { 
        std::cout << static_cast<char>(data); 
        return 1; 
    }
    
    size_t write(const uint8_t* buffer, size_t size) {
        for (size_t i = 0; i < size; i++) {
            write(buffer[i]);
        }
        return size;
    }
    
    void print(const char* str) { 
        std::cout << str; 
    }
    
    void println(const char* str) { 
        std::cout << str << std::endl; 
    }
    
    void print(int val) { 
        std::cout << val; 
    }
    
    void println(int val) { 
        std::cout << val << std::endl; 
    }
    
    bool available_for_write() { return true; }
    
    operator bool() { return true; }
};

// Mock serial instances
// extern HardwareSerial Serial; // Conflicts with Arduino.h SerialClass Serial
extern HardwareSerial Serial1;
extern HardwareSerial Serial2;

// UART config constants
#define SERIAL_8N1 0x06
#define SERIAL_8N2 0x0E
#define SERIAL_8E1 0x22
#define SERIAL_8E2 0x2A
#define SERIAL_8O1 0x32
#define SERIAL_8O2 0x3A

#endif // ARDUINO_ARCH_NATIVE