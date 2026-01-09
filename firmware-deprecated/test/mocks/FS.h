#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include "Arduino.h"

// Mock file system classes for testing
class File {
private:
    String path;
    bool is_open;

public:
    File() : is_open(false) {}
    File(const String& p) : path(p), is_open(true) {}
    
    operator bool() const { return is_open; }
    bool available() const { return is_open; }
    void close() { is_open = false; }
    size_t size() const { return 1024; } // Mock size
    String name() const { return path; }
    
    // Read/write operations (minimal implementation)
    int read() { return is_open ? 'A' : -1; }
    size_t read(uint8_t* buf, size_t size) { 
        if (!is_open || !buf) return 0;
        memset(buf, 'A', size); 
        return size; 
    }
    size_t write(uint8_t data) { (void)data; return is_open ? 1 : 0; }
    size_t write(const uint8_t* buf, size_t size) { (void)buf; return is_open ? size : 0; }
};

class FS {
public:
    bool begin(bool formatOnFail = false, const char* basePath = "", uint8_t maxOpenFiles = 5, const char* partitionLabel = "") { 
        (void)formatOnFail; (void)basePath; (void)maxOpenFiles; (void)partitionLabel; 
        return true; 
    }
    bool format() { return true; }
    void end() { /* Mock - do nothing */ }
    File open(const String& path, const String& mode = "r") {
        (void)mode;
        return File(path);
    }
    bool exists(const String& path) { (void)path; return true; }
    bool remove(const String& path) { (void)path; return true; }
    bool mkdir(const String& path) { (void)path; return true; }
    bool rmdir(const String& path) { (void)path; return true; }
    bool rename(const String& oldPath, const String& newPath) { (void)oldPath; (void)newPath; return true; }
    size_t totalBytes() { return 1024 * 1024; } // 1MB mock
    size_t usedBytes() { return 512 * 1024; }   // 512KB mock
};

// Mock file system instances
extern FS LittleFS;
extern FS SPIFFS;

#endif // ARDUINO_ARCH_NATIVE