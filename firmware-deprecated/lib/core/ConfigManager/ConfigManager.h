#pragma once

#include "../CoreCommon.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <functional>
#include "../Storage/Storage.h"
#include "../NVSManager/NVSManager.h"

struct DeviceConfig {
    String name;
    String mode; // "usb_otg" or "uart"
    
    DeviceConfig() : name("ESP32-MAVLinkBridge"), mode("usb_otg") {}
};

struct WiFiConfig {
    String ssid;           // Currently saved network SSID
    String password;       // Currently saved network password
    bool autoConnect;
    bool apModeEnabled;
    String apSSID;
    String apPassword;
    
    WiFiConfig() : ssid(""), password(""), autoConnect(true), apModeEnabled(true), 
                   apSSID("MAVLinkBridge-Setup"), apPassword("mavlinkbridge123") {}
};

struct ConnectionConfig {
    String type; // "wifi" or "ethernet"
    WiFiConfig wifi;
    
    ConnectionConfig() : type("wifi") {}
};

struct RTCMSourceConfig {
    String type; // "ntrip", "tcp", "udp"
    String host;
    uint16_t port;
    String mountpoint;
    String username;
    String password;
    
    RTCMSourceConfig() : type("ntrip"), host(""), port(2101), mountpoint(""), username(""), password("") {}
};

struct RTCMOutputConfig {
    String name;
    String protocol;   // "raw" or "mavlink"
    String transport;  // "tcp", "udp", "espnow", "serial"
    bool enabled;
    DynamicJsonDocument params;  // Transport-specific parameters

    RTCMOutputConfig() : name(""), protocol("raw"), transport("serial"), enabled(true), params(512) {}
};

struct RTCMConfig {
    bool enabled;
    RTCMSourceConfig source;
    std::vector<RTCMOutputConfig> outputs;  // Multiple output targets

    RTCMConfig() : enabled(false) {}
};

struct MDNSConfig {
    bool enabled;
    String hostname;
    bool discoveryEnabled;
    
    MDNSConfig() : enabled(true), hostname("yardrover"), discoveryEnabled(true) {}
};

struct Configuration {
    uint32_t version;
    DeviceConfig device;
    ConnectionConfig connection;
    RTCMConfig rtcm;
    MDNSConfig mdns;
    
    Configuration() : version(1) {}
};

enum class ConfigValidationResult {
    VALID,
    INVALID_DEVICE_NAME,
    INVALID_DEVICE_MODE,
    INVALID_CONNECTION_TYPE,
    INVALID_WIFI_SSID,
    INVALID_RTCM_SOURCE_TYPE,
    INVALID_RTCM_HOST,
    INVALID_RTCM_PORT,
    INVALID_JSON_STRUCTURE,
    VERSION_CONFLICT,
    STORAGE_ERROR
};

using ConfigChangeHandler = std::function<void(const Configuration&, const Configuration&)>;

class ConfigManager {
private:
    static ConfigManager* instance;
    Configuration currentConfig;
    Configuration defaultConfig;
    bool isDirty;
    bool isInitialized;
    
    static const size_t CONFIG_BUFFER_SIZE = 2048;
    char configBuffer[CONFIG_BUFFER_SIZE];
    DynamicJsonDocument configDoc;
    
    ConfigChangeHandler changeHandler;
    Storage* storage;
    NVSManager* nvsManager;
    
    void setDefaults();
    bool validateDeviceConfig(const DeviceConfig& config) const;
    bool validateConnectionConfig(const ConnectionConfig& config) const;
    bool validateRTCMConfig(const RTCMConfig& config) const;
    bool validateMDNSConfig(const MDNSConfig& config) const;
    bool isValidDeviceMode(const String& mode) const;
    bool isValidConnectionType(const String& type) const;
    bool isValidRTCMSourceType(const String& type) const;
    bool isValidPort(uint16_t port) const;
    
    void serializeConfiguration(const Configuration& config, JsonObject& obj) const;
    void serializeDeviceConfig(const DeviceConfig& config, JsonObject& obj) const;
    void serializeConnectionConfig(const ConnectionConfig& config, JsonObject& obj) const;
    void serializeRTCMConfig(const RTCMConfig& config, JsonObject& obj) const;
    void serializeMDNSConfig(const MDNSConfig& config, JsonObject& obj) const;
    
    bool deserializeDeviceConfig(const JsonObject& obj, DeviceConfig& config) const;
    bool deserializeConnectionConfig(const JsonObject& obj, ConnectionConfig& config) const;
    bool deserializeRTCMConfig(const JsonObject& obj, RTCMConfig& config) const;
    bool deserializeMDNSConfig(const JsonObject& obj, MDNSConfig& config) const;
    
public:
    ConfigManager();
    ~ConfigManager();
    
    static ConfigManager* getInstance();
    void begin();
    
    const Configuration& getConfiguration() const { return currentConfig; }
    Configuration& getConfiguration() { return currentConfig; }
    const DeviceConfig& getDeviceConfig() const { return currentConfig.device; }
    const ConnectionConfig& getConnectionConfig() const { return currentConfig.connection; }
    const RTCMConfig& getRTCMConfig() const { return currentConfig.rtcm; }
    const MDNSConfig& getMDNSConfig() const { return currentConfig.mdns; }
    
    bool setConfiguration(const Configuration& config);
    bool setConfiguration(const Configuration& config, uint32_t expectedVersion);
    bool updateDeviceConfig(const DeviceConfig& config);
    bool updateConnectionConfig(const ConnectionConfig& config);
    bool updateRTCMConfig(const RTCMConfig& config);
    bool updateMDNSConfig(const MDNSConfig& config);
    
    bool loadConfiguration();
    bool saveConfiguration();
    bool backupConfiguration();
    bool restoreConfiguration(uint8_t backupIndex = 0);
    
    ConfigValidationResult validateConfiguration(const Configuration& config) const;
    bool loadFromJson(const String& json);
    String saveToJson() const;
    
    bool deserializeConfiguration(const JsonObject& obj, Configuration& config) const;
    
    bool isDirtyConfig() const { return isDirty; }
    void markClean() { isDirty = false; }
    void resetToDefaults();
    
    void setChangeHandler(ConfigChangeHandler handler);
    
    DynamicJsonDocument& getConfigDoc() { return configDoc; }
    char* getConfigBuffer() { return configBuffer; }
    size_t getBufferSize() const { return CONFIG_BUFFER_SIZE; }
    
    // NVS integration
    bool syncCriticalConfigsToNVS();
    bool loadCriticalConfigsFromNVS();
};