#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include <vector>
#include <functional>

enum class NVSResult {
    SUCCESS,
    NOT_INITIALIZED,
    KEY_NOT_FOUND,
    WRITE_FAILED,
    READ_FAILED,
    INVALID_NAMESPACE,
    INVALID_KEY,
    INVALID_VALUE,
    STORAGE_FULL,
    NAMESPACE_FULL
};

struct WiFiCredential {
    String ssid;
    String password;
    
    WiFiCredential() : ssid(""), password("") {}
    WiFiCredential(const String& s, const String& p) 
        : ssid(s), password(p) {}
};

class NVSManager {
private:
    static NVSManager* instance;
    Preferences preferences;
    bool isInitialized;
    
    // Namespace names
    static const char* NAMESPACE_SYSTEM;
    static const char* NAMESPACE_WIFI;
    static const char* NAMESPACE_DEVICE;
    
    // Key limits
    static const uint8_t MAX_KEY_LENGTH = 15;  // NVS key length limit
    
    // System keys
    static const char* KEY_DEVICE_NAME;
    static const char* KEY_DEVICE_ID;
    static const char* KEY_MDNS_HOSTNAME;
    static const char* KEY_CONFIG_VERSION;
    
    // WiFi keys
    static const char* KEY_WIFI_SSID;
    static const char* KEY_WIFI_PASS;
    static const char* KEY_WIFI_AUTO_CONNECT;
    
    String lastError;
    
public:
    NVSManager();
    ~NVSManager();
    
    static NVSManager* getInstance();
    NVSResult begin();
    void end();
    
    // Generic storage operations
    NVSResult putString(const String& key, const String& value, const String& ns = "");
    NVSResult getString(const String& key, String& value, const String& ns = "");
    NVSResult putInt(const String& key, int32_t value, const String& ns = "");
    NVSResult getInt(const String& key, int32_t& value, const String& ns = "");
    NVSResult putBool(const String& key, bool value, const String& ns = "");
    NVSResult getBool(const String& key, bool& value, const String& ns = "");
    NVSResult putBytes(const String& key, const uint8_t* data, size_t length, const String& ns = "");
    NVSResult getBytes(const String& key, uint8_t* buffer, size_t& length, const String& ns = "");
    NVSResult remove(const String& key, const String& ns = "");
    NVSResult clear(const String& ns = "");
    
    // WiFi credential management
    NVSResult saveWiFiCredential(const WiFiCredential& credential);
    NVSResult getWiFiCredential(WiFiCredential& credential);
    NVSResult removeWiFiCredential();
    bool hasWiFiCredential();
    
    // System configuration
    NVSResult setDeviceName(const String& name);
    NVSResult getDeviceName(String& name);
    NVSResult setDeviceId(const String& id);
    NVSResult getDeviceId(String& id);
    NVSResult setMDNSHostname(const String& hostname);
    NVSResult getMDNSHostname(String& hostname);
    NVSResult setConfigVersion(uint32_t version);
    NVSResult getConfigVersion(uint32_t& version);
    NVSResult setAutoConnect(bool enabled);
    NVSResult getAutoConnect(bool& enabled);
    
    // Utility functions
    bool hasKey(const String& key, const String& ns = "");
    size_t getUsedEntries(const String& ns = "");
    size_t getFreeEntries();
    String getLastError() const { return lastError; }
    
    // Migration support
    NVSResult migrateFromJSON(const String& jsonData);
    NVSResult exportToJSON(String& jsonData);
    
private:
    void setLastError(const String& error) { lastError = error; }
    bool openNamespace(const String& ns, bool readOnly = false);
    void closeNamespace();
};