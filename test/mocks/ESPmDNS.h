#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include "Arduino.h"

// Mock mDNS class
class MDNSResponder {
public:
    bool begin(const char* hostname) { (void)hostname; return true; }
    void addService(const char* service, const char* proto, uint16_t port) { 
        (void)service; (void)proto; (void)port; 
    }
    void addServiceTxt(const char* service, const char* proto, const char* key, const char* value) {
        (void)service; (void)proto; (void)key; (void)value;
    }
    void end() {}
};

extern MDNSResponder MDNS;

#endif // ARDUINO_ARCH_NATIVE