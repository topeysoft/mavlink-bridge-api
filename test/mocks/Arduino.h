#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <string>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <iostream>
#include <algorithm>
#include <cctype>
#include <cstdarg>

// Forward declare ESP system to ensure it's available
#include "esp_system.h"


// Basic Arduino types
typedef uint8_t byte;
typedef bool boolean;

// Stream class mock for Arduino compatibility
class Stream {
public:
    virtual size_t write(uint8_t data) = 0;
    virtual size_t write(const uint8_t *buffer, size_t size) = 0;
    virtual int available() = 0;
    virtual int read() = 0;
    virtual void flush() {}
};

// Common C++ min function
template<typename T>
constexpr const T& min(const T& a, const T& b) {
    return (b < a) ? b : a;
}

// String class mock
class String {
private:
    std::string data;

public:
    String() : data("") {}
    String(const char* str) : data(str ? str : "") {}
    String(const std::string& str) : data(str) {}
    String(int val) : data(std::to_string(val)) {}
    String(long val) : data(std::to_string(val)) {}
    String(unsigned long val) : data(std::to_string(val)) {}
    String(size_t count, char c) : data(count, c) {}
    
    // Operators
    String& operator=(const char* str) { data = str ? str : ""; return *this; }
    String& operator=(const String& str) { data = str.data; return *this; }
    String operator+(const String& str) const { return String(data + str.data); }
    String operator+(const char* str) const { return String(data + (str ? str : "")); }
    friend String operator+(const char* lhs, const String& rhs) { return String((lhs ? lhs : "") + rhs.data); }
    bool operator==(const String& str) const { return data == str.data; }
    bool operator!=(const String& str) const { return data != str.data; }
    char operator[](size_t index) const { return index < data.length() ? data[index] : '\0'; }
    
    // Methods
    const char* c_str() const { return data.c_str(); }
    size_t length() const { return data.length(); }
    bool isEmpty() const { return data.empty(); }
    int indexOf(const String& str) const { 
        size_t pos = data.find(str.data);
        return pos != std::string::npos ? static_cast<int>(pos) : -1;
    }
    String substring(int start) const {
        if (start >= 0 && start < static_cast<int>(data.length())) {
            return String(data.substr(start));
        }
        return String();
    }
    String substring(int start, int end) const {
        if (start >= 0 && start < static_cast<int>(data.length()) && end > start) {
            return String(data.substr(start, end - start));
        }
        return String();
    }
    
    bool equalsIgnoreCase(const String& str) const {
        std::string lhs = data, rhs = str.data;
        std::transform(lhs.begin(), lhs.end(), lhs.begin(), ::tolower);
        std::transform(rhs.begin(), rhs.end(), rhs.begin(), ::tolower);
        return lhs == rhs;
    }
    
    bool startsWith(const String& prefix) const {
        return data.find(prefix.data) == 0;
    }
    
    char charAt(size_t index) const {
        return index < data.length() ? data[index] : '\0';
    }
    
    int toInt() const {
        return std::stoi(data);
    }
    
    int lastIndexOf(char c) const {
        size_t pos = data.rfind(c);
        return pos != std::string::npos ? static_cast<int>(pos) : -1;
    }
    
    int lastIndexOf(const String& str) const {
        size_t pos = data.rfind(str.data);
        return pos != std::string::npos ? static_cast<int>(pos) : -1;
    }
    
    // For ArduinoJson compatibility
    size_t write(uint8_t c) {
        data += static_cast<char>(c);
        return 1;
    }
    
    size_t write(const uint8_t* buf, size_t size) {
        if (buf) {
            data.append(reinterpret_cast<const char*>(buf), size);
        }
        return size;
    }
    
    bool endsWith(const String& suffix) const {
        return data.length() >= suffix.data.length() && 
               data.substr(data.length() - suffix.data.length()) == suffix.data;
    }
    
    void toCharArray(char* buf, size_t bufsize) const {
        if (buf && bufsize > 0) {
            size_t len = data.length() < bufsize - 1 ? data.length() : bufsize - 1;
            data.copy(buf, len);
            buf[len] = '\0';
        }
    }
    
    // For ArduinoJson compatibility - add read method
    int read() const {
        static size_t pos = 0;
        if (pos < data.length()) {
            return data[pos++];
        }
        pos = 0; // Reset for next use
        return -1;
    }
    
    // ArduinoJson compatibility - implicit conversion to std::string
    operator std::string() const { return data; }
    
    // ArduinoJson compatibility - explicit conversion
    const std::string& toString() const { return data; }
};

// Serial mock
class SerialClass {
public:
    void begin(unsigned long baud) { (void)baud; }
    void println(const char* str) { std::cout << str << std::endl; }
    void println(const String& str) { std::cout << str.c_str() << std::endl; }
    void print(const char* str) { std::cout << str; }
    void print(const String& str) { std::cout << str.c_str(); }
    void printf(const char* format, ...) {
        va_list args;
        va_start(args, format);
        vprintf(format, args);
        va_end(args);
    }
};

extern SerialClass Serial;

// Basic Arduino functions
void delay(unsigned long ms);
unsigned long millis();
bool isDigit(char c);
uint32_t analogRead(uint8_t pin);

// Pin definitions (not used in tests but needed for compilation)
#define HIGH 0x1
#define LOW  0x0
#define INPUT 0x0
#define OUTPUT 0x1

#endif // ARDUINO_ARCH_NATIVE