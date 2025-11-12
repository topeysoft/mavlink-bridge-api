#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include "Arduino.h"
#include <map>

class Preferences {
private:
    std::map<std::string, std::string> storage;
    std::string namespace_name;
    bool is_open;

public:
    Preferences() : is_open(false) {}
    
    bool begin(const char* name, bool readOnly = false) {
        (void)readOnly;
        namespace_name = name ? name : "";
        is_open = true;
        return true;
    }
    
    void end() {
        is_open = false;
        namespace_name = "";
    }
    
    // String methods
    String getString(const char* key, const String& defaultValue = String()) {
        if (!is_open || !key) return defaultValue;
        std::string full_key = namespace_name + "::" + key;
        auto it = storage.find(full_key);
        return it != storage.end() ? String(it->second.c_str()) : defaultValue;
    }
    
    size_t putString(const char* key, const String& value) {
        if (!is_open || !key) return 0;
        std::string full_key = namespace_name + "::" + key;
        storage[full_key] = value.c_str();
        return value.length();
    }
    
    // Integer methods
    int32_t getInt(const char* key, int32_t defaultValue = 0) {
        String str = getString(key, String(defaultValue));
        return str.toInt();
    }
    
    size_t putInt(const char* key, int32_t value) {
        return putString(key, String(value));
    }
    
    // Boolean methods
    bool getBool(const char* key, bool defaultValue = false) {
        String str = getString(key, defaultValue ? "true" : "false");
        return str.equalsIgnoreCase("true");
    }
    
    size_t putBool(const char* key, bool value) {
        return putString(key, value ? "true" : "false");
    }
    
    // Bytes methods
    size_t getBytes(const char* key, void* buf, size_t maxLen) {
        if (!is_open || !key || !buf) return 0;
        String str = getString(key);
        size_t len = str.length() < maxLen ? str.length() : maxLen;
        memcpy(buf, str.c_str(), len);
        return len;
    }
    
    size_t putBytes(const char* key, const void* value, size_t len) {
        if (!is_open || !key || !value) return 0;
        std::string full_key = namespace_name + "::" + key;
        storage[full_key] = std::string((const char*)value, len);
        return len;
    }
    
    // Other methods
    bool remove(const char* key) {
        if (!is_open || !key) return false;
        std::string full_key = namespace_name + "::" + key;
        return storage.erase(full_key) > 0;
    }
    
    size_t clear() {
        if (!is_open) return 0;
        size_t count = 0;
        auto it = storage.begin();
        while (it != storage.end()) {
            if (it->first.find(namespace_name + "::") == 0) {
                it = storage.erase(it);
                count++;
            } else {
                ++it;
            }
        }
        return count;
    }
    
    bool isKey(const char* key) {
        if (!is_open || !key) return false;
        std::string full_key = namespace_name + "::" + key;
        return storage.find(full_key) != storage.end();
    }
};

#endif // ARDUINO_ARCH_NATIVE