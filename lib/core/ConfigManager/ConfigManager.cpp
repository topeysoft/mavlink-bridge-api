#include "ConfigManager.h"

ConfigManager* ConfigManager::instance = nullptr;

ConfigManager::ConfigManager() 
    : isDirty(false), isInitialized(false), configDoc(CONFIG_BUFFER_SIZE), changeHandler(nullptr), storage(nullptr) {
    memset(configBuffer, 0, CONFIG_BUFFER_SIZE);
    storage = Storage::getInstance();
    setDefaults();
}

ConfigManager::~ConfigManager() {
    // Nothing to clean up
}

ConfigManager* ConfigManager::getInstance() {
    if (instance == nullptr) {
        instance = new ConfigManager();
    }
    return instance;
}

void ConfigManager::begin() {
    if (isInitialized) {
        return;
    }
    
    // Initialize storage
    if (storage->begin() != StorageResult::SUCCESS) {
        Serial.println("Failed to initialize storage, using defaults");
        currentConfig = defaultConfig;
    } else {
        // Try to load configuration from storage
        if (!loadConfiguration()) {
            Serial.println("No valid configuration found, using defaults");
            currentConfig = defaultConfig;
            // Save defaults to storage
            saveConfiguration();
        }
    }
    
    isInitialized = true;
    isDirty = false;
}

void ConfigManager::setDefaults() {
    defaultConfig.version = 1;
    defaultConfig.device.name = "ESP32-MAVLinkBridge";
    defaultConfig.device.mode = "usb_otg";
    
    defaultConfig.connection.type = "wifi";
    defaultConfig.connection.wifi.ssid = "";
    defaultConfig.connection.wifi.autoConnect = true;
    defaultConfig.connection.wifi.apModeEnabled = true;
    defaultConfig.connection.wifi.apSSID = "MAVLinkBridge-Setup";
    defaultConfig.connection.wifi.apPassword = "mavlinkbridge123";
    defaultConfig.connection.wifi.networkCount = 0;
    
    defaultConfig.rtcm.enabled = false;
    defaultConfig.rtcm.source.type = "ntrip";
    defaultConfig.rtcm.source.host = "";
    defaultConfig.rtcm.source.port = 2101;
    defaultConfig.rtcm.source.mountpoint = "";
    defaultConfig.rtcm.source.username = "";
    defaultConfig.rtcm.source.password = "";
}

bool ConfigManager::setConfiguration(const Configuration& config) {
    if (validateConfiguration(config) != ConfigValidationResult::VALID) {
        return false;
    }
    
    Configuration oldConfig = currentConfig;
    Configuration newConfig = config;
    newConfig.version = currentConfig.version + 1; // Increment version
    
    currentConfig = newConfig;
    isDirty = true;
    
    if (changeHandler != nullptr) {
        changeHandler(oldConfig, currentConfig);
    }
    
    // Auto-save to storage
    saveConfiguration();
    
    return true;
}

bool ConfigManager::setConfiguration(const Configuration& config, uint32_t expectedVersion) {
    if (validateConfiguration(config) != ConfigValidationResult::VALID) {
        return false;
    }
    
    // Check for version conflict (optimistic locking)
    if (currentConfig.version != expectedVersion) {
        return false;
    }
    
    return setConfiguration(config);
}

bool ConfigManager::updateDeviceConfig(const DeviceConfig& config) {
    if (!validateDeviceConfig(config)) {
        return false;
    }
    
    Configuration oldConfig = currentConfig;
    currentConfig.device = config;
    isDirty = true;
    
    if (changeHandler != nullptr) {
        changeHandler(oldConfig, currentConfig);
    }
    
    return true;
}

bool ConfigManager::updateConnectionConfig(const ConnectionConfig& config) {
    if (!validateConnectionConfig(config)) {
        return false;
    }
    
    Configuration oldConfig = currentConfig;
    currentConfig.connection = config;
    isDirty = true;
    
    if (changeHandler != nullptr) {
        changeHandler(oldConfig, currentConfig);
    }
    
    return true;
}

bool ConfigManager::updateRTCMConfig(const RTCMConfig& config) {
    if (!validateRTCMConfig(config)) {
        return false;
    }
    
    Configuration oldConfig = currentConfig;
    currentConfig.rtcm = config;
    isDirty = true;
    
    if (changeHandler != nullptr) {
        changeHandler(oldConfig, currentConfig);
    }
    
    return true;
}

bool ConfigManager::updateMDNSConfig(const MDNSConfig& config) {
    if (!validateMDNSConfig(config)) {
        return false;
    }
    
    Configuration oldConfig = currentConfig;
    currentConfig.mdns = config;
    isDirty = true;
    
    if (changeHandler != nullptr) {
        changeHandler(oldConfig, currentConfig);
    }
    
    return true;
}

ConfigValidationResult ConfigManager::validateConfiguration(const Configuration& config) const {
    if (!validateDeviceConfig(config.device)) {
        if (config.device.name.length() == 0 || config.device.name.length() > 32) {
            return ConfigValidationResult::INVALID_DEVICE_NAME;
        }
        if (!isValidDeviceMode(config.device.mode)) {
            return ConfigValidationResult::INVALID_DEVICE_MODE;
        }
    }
    
    if (!validateConnectionConfig(config.connection)) {
        if (!isValidConnectionType(config.connection.type)) {
            return ConfigValidationResult::INVALID_CONNECTION_TYPE;
        }
        if (config.connection.type == "wifi" && 
            (config.connection.wifi.ssid.length() == 0 || config.connection.wifi.ssid.length() > 32)) {
            return ConfigValidationResult::INVALID_WIFI_SSID;
        }
    }
    
    if (!validateRTCMConfig(config.rtcm)) {
        if (!isValidRTCMSourceType(config.rtcm.source.type)) {
            return ConfigValidationResult::INVALID_RTCM_SOURCE_TYPE;
        }
        if (config.rtcm.enabled && config.rtcm.source.host.length() == 0) {
            return ConfigValidationResult::INVALID_RTCM_HOST;
        }
        if (!isValidPort(config.rtcm.source.port)) {
            return ConfigValidationResult::INVALID_RTCM_PORT;
        }
    }
    
    return ConfigValidationResult::VALID;
}

bool ConfigManager::validateDeviceConfig(const DeviceConfig& config) const {
    return config.name.length() > 0 && config.name.length() <= 32 && 
           isValidDeviceMode(config.mode);
}

bool ConfigManager::validateConnectionConfig(const ConnectionConfig& config) const {
    if (!isValidConnectionType(config.type)) {
        return false;
    }
    
    if (config.type == "wifi") {
        // Validate current SSID if set
        if (config.wifi.ssid.length() > 32) {
            return false;
        }
        
        // Validate AP settings
        if (config.wifi.apSSID.length() == 0 || config.wifi.apSSID.length() > 32) {
            return false;
        }
        if (config.wifi.apPassword.length() > 0 && config.wifi.apPassword.length() < 8) {
            return false; // WPA2 minimum
        }
        
        // Validate saved networks
        if (config.wifi.networkCount > 5) {
            return false;
        }
        
        for (uint8_t i = 0; i < config.wifi.networkCount; i++) {
            if (config.wifi.networks[i].ssid.length() == 0 || 
                config.wifi.networks[i].ssid.length() > 32) {
                return false;
            }
            if (config.wifi.networks[i].password.length() > 64) {
                return false;
            }
        }
    }
    
    return true;
}

bool ConfigManager::validateRTCMConfig(const RTCMConfig& config) const {
    if (!isValidRTCMSourceType(config.source.type)) {
        return false;
    }
    
    if (config.enabled && config.source.host.length() == 0) {
        return false;
    }
    
    return isValidPort(config.source.port);
}

bool ConfigManager::validateMDNSConfig(const MDNSConfig& config) const {
    // Validate hostname
    if (config.hostname.length() == 0 || config.hostname.length() > 63) {
        return false;
    }
    
    // Check for valid hostname characters (alphanumeric and hyphens)
    for (int i = 0; i < config.hostname.length(); i++) {
        char c = config.hostname.charAt(i);
        if (!isalnum(c) && c != '-' && c != '_') {
            return false;
        }
    }
    
    // Hostname cannot start or end with hyphen
    if (config.hostname.startsWith("-") || config.hostname.endsWith("-")) {
        return false;
    }
    
    return true;
}

bool ConfigManager::isValidDeviceMode(const String& mode) const {
    return mode == "usb_otg" || mode == "uart";
}

bool ConfigManager::isValidConnectionType(const String& type) const {
    return type == "wifi" || type == "ethernet";
}

bool ConfigManager::isValidRTCMSourceType(const String& type) const {
    return type == "ntrip" || type == "tcp" || type == "udp";
}

bool ConfigManager::isValidPort(uint16_t port) const {
    return port >= 1 && port <= 65535;
}

bool ConfigManager::loadFromJson(const String& json) {
    if (json.length() >= CONFIG_BUFFER_SIZE) {
        return false;
    }
    
    configDoc.clear();
    DeserializationError error = deserializeJson(configDoc, json);
    
    if (error) {
        return false;
    }
    
    Configuration newConfig;
    
    if (!deserializeConfiguration(configDoc.as<JsonObject>(), newConfig)) {
        return false;
    }
    
    // Don't increment version when loading from storage
    Configuration oldConfig = currentConfig;
    currentConfig = newConfig;
    
    if (changeHandler != nullptr) {
        changeHandler(oldConfig, currentConfig);
    }
    
    return true;
}

String ConfigManager::saveToJson() const {
    // Create a temporary document for serialization since we can't modify member in const method
    DynamicJsonDocument tempDoc(CONFIG_BUFFER_SIZE);
    JsonObject obj = tempDoc.to<JsonObject>();
    
    serializeConfiguration(currentConfig, obj);
    
    String result;
    serializeJson(tempDoc, result);
    return result;
}

void ConfigManager::serializeDeviceConfig(const DeviceConfig& config, JsonObject& obj) const {
    obj["name"] = config.name;
    obj["mode"] = config.mode;
}

void ConfigManager::serializeConnectionConfig(const ConnectionConfig& config, JsonObject& obj) const {
    obj["type"] = config.type;
    
    if (config.type == "wifi") {
        JsonObject wifiObj = obj.createNestedObject("wifi");
        wifiObj["ssid"] = config.wifi.ssid;
        wifiObj["autoConnect"] = config.wifi.autoConnect;
        wifiObj["apModeEnabled"] = config.wifi.apModeEnabled;
        wifiObj["apSSID"] = config.wifi.apSSID;
        wifiObj["apPassword"] = config.wifi.apPassword;
        wifiObj["networkCount"] = config.wifi.networkCount;
        
        JsonArray networksArray = wifiObj.createNestedArray("networks");
        for (uint8_t i = 0; i < config.wifi.networkCount; i++) {
            JsonObject networkObj = networksArray.createNestedObject();
            networkObj["ssid"] = config.wifi.networks[i].ssid;
            networkObj["password"] = config.wifi.networks[i].password;
            networkObj["priority"] = config.wifi.networks[i].priority;
        }
    }
}

void ConfigManager::serializeRTCMConfig(const RTCMConfig& config, JsonObject& obj) const {
    obj["enabled"] = config.enabled;
    
    JsonObject sourceObj = obj.createNestedObject("source");
    sourceObj["type"] = config.source.type;
    sourceObj["host"] = config.source.host;
    sourceObj["port"] = config.source.port;
    
    if (!config.source.mountpoint.isEmpty()) {
        sourceObj["mountpoint"] = config.source.mountpoint;
    }
    
    if (!config.source.username.isEmpty()) {
        sourceObj["username"] = config.source.username;
    }
    
    if (!config.source.password.isEmpty()) {
        sourceObj["password"] = config.source.password;
    }
}

void ConfigManager::serializeMDNSConfig(const MDNSConfig& config, JsonObject& obj) const {
    obj["enabled"] = config.enabled;
    obj["hostname"] = config.hostname;
    obj["discoveryEnabled"] = config.discoveryEnabled;
}

bool ConfigManager::deserializeDeviceConfig(const JsonObject& obj, DeviceConfig& config) const {
    if (obj.containsKey("name")) {
        config.name = obj["name"].as<String>();
    }
    
    if (obj.containsKey("mode")) {
        config.mode = obj["mode"].as<String>();
    }
    
    return validateDeviceConfig(config);
}

bool ConfigManager::deserializeConnectionConfig(const JsonObject& obj, ConnectionConfig& config) const {
    if (obj.containsKey("type")) {
        config.type = obj["type"].as<String>();
    }
    
    if (config.type == "wifi" && obj.containsKey("wifi")) {
        JsonObject wifiObj = obj["wifi"];
        if (wifiObj.containsKey("ssid")) {
            config.wifi.ssid = wifiObj["ssid"].as<String>();
        }
        if (wifiObj.containsKey("autoConnect")) {
            config.wifi.autoConnect = wifiObj["autoConnect"];
        }
        if (wifiObj.containsKey("apModeEnabled")) {
            config.wifi.apModeEnabled = wifiObj["apModeEnabled"];
        }
        if (wifiObj.containsKey("apSSID")) {
            config.wifi.apSSID = wifiObj["apSSID"].as<String>();
        }
        if (wifiObj.containsKey("apPassword")) {
            config.wifi.apPassword = wifiObj["apPassword"].as<String>();
        }
        
        // Reset network count and load networks
        config.wifi.networkCount = 0;
        if (wifiObj.containsKey("networks")) {
            JsonArray networksArray = wifiObj["networks"];
            uint8_t count = min(networksArray.size(), (size_t)5);
            config.wifi.networkCount = count;
            
            for (uint8_t i = 0; i < count; i++) {
                JsonObject networkObj = networksArray[i];
                if (networkObj.containsKey("ssid")) {
                    config.wifi.networks[i].ssid = networkObj["ssid"].as<String>();
                }
                if (networkObj.containsKey("password")) {
                    config.wifi.networks[i].password = networkObj["password"].as<String>();
                }
                if (networkObj.containsKey("priority")) {
                    config.wifi.networks[i].priority = networkObj["priority"];
                }
            }
        }
    }
    
    return validateConnectionConfig(config);
}

bool ConfigManager::deserializeRTCMConfig(const JsonObject& obj, RTCMConfig& config) const {
    if (obj.containsKey("enabled")) {
        config.enabled = obj["enabled"];
    }
    
    if (obj.containsKey("source")) {
        JsonObject sourceObj = obj["source"];
        
        if (sourceObj.containsKey("type")) {
            config.source.type = sourceObj["type"].as<String>();
        }
        if (sourceObj.containsKey("host")) {
            config.source.host = sourceObj["host"].as<String>();
        }
        if (sourceObj.containsKey("port")) {
            config.source.port = sourceObj["port"];
        }
        if (sourceObj.containsKey("mountpoint")) {
            config.source.mountpoint = sourceObj["mountpoint"].as<String>();
        }
        if (sourceObj.containsKey("username")) {
            config.source.username = sourceObj["username"].as<String>();
        }
        if (sourceObj.containsKey("password")) {
            config.source.password = sourceObj["password"].as<String>();
        }
    }
    
    return validateRTCMConfig(config);
}

bool ConfigManager::deserializeMDNSConfig(const JsonObject& obj, MDNSConfig& config) const {
    if (obj.containsKey("enabled")) {
        config.enabled = obj["enabled"];
    }
    
    if (obj.containsKey("hostname")) {
        config.hostname = obj["hostname"].as<String>();
    }
    
    if (obj.containsKey("discoveryEnabled")) {
        config.discoveryEnabled = obj["discoveryEnabled"];
    }
    
    return validateMDNSConfig(config);
}

void ConfigManager::resetToDefaults() {
    Configuration oldConfig = currentConfig;
    currentConfig = defaultConfig;
    isDirty = true;
    
    if (changeHandler != nullptr) {
        changeHandler(oldConfig, currentConfig);
    }
}

void ConfigManager::setChangeHandler(ConfigChangeHandler handler) {
    changeHandler = handler;
}

bool ConfigManager::loadConfiguration() {
    if (!storage || !isInitialized) {
        return false;
    }
    
    size_t dataSize = 0;
    uint32_t version = 0;
    StorageResult result = storage->readConfig(reinterpret_cast<uint8_t*>(configBuffer), dataSize, version);
    
    if (result != StorageResult::SUCCESS) {
        return false;
    }
    
    configBuffer[dataSize] = '\0'; // Null terminate
    String jsonStr(configBuffer);
    
    return loadFromJson(jsonStr);
}

bool ConfigManager::saveConfiguration() {
    if (!storage || !isInitialized) {
        return false;
    }
    
    String jsonStr = saveToJson();
    if (jsonStr.length() >= CONFIG_BUFFER_SIZE) {
        return false;
    }
    
    jsonStr.toCharArray(configBuffer, CONFIG_BUFFER_SIZE);
    size_t dataSize = jsonStr.length();
    
    StorageResult result = storage->writeConfig(reinterpret_cast<const uint8_t*>(configBuffer), dataSize, currentConfig.version);
    
    if (result == StorageResult::SUCCESS) {
        isDirty = false;
        return true;
    }
    
    return false;
}

bool ConfigManager::backupConfiguration() {
    if (!storage || !isInitialized) {
        return false;
    }
    
    return storage->backupConfig() == StorageResult::SUCCESS;
}

bool ConfigManager::restoreConfiguration(uint8_t backupIndex) {
    if (!storage || !isInitialized) {
        return false;
    }
    
    StorageResult result = storage->restoreFromBackup(backupIndex);
    if (result != StorageResult::SUCCESS) {
        return false;
    }
    
    // Reload configuration after restore
    return loadConfiguration();
}

void ConfigManager::serializeConfiguration(const Configuration& config, JsonObject& obj) const {
    obj["version"] = config.version;
    
    JsonObject deviceObj = obj.createNestedObject("device");
    serializeDeviceConfig(config.device, deviceObj);
    
    JsonObject connectionObj = obj.createNestedObject("connection");
    serializeConnectionConfig(config.connection, connectionObj);
    
    JsonObject rtcmObj = obj.createNestedObject("rtcm");
    serializeRTCMConfig(config.rtcm, rtcmObj);
    
    JsonObject mdnsObj = obj.createNestedObject("mdns");
    serializeMDNSConfig(config.mdns, mdnsObj);
}

bool ConfigManager::deserializeConfiguration(const JsonObject& obj, Configuration& config) const {
    if (obj.containsKey("version")) {
        config.version = obj["version"];
    } else {
        config.version = 1; // Default version
    }
    
    if (obj.containsKey("device")) {
        if (!deserializeDeviceConfig(obj["device"], config.device)) {
            return false;
        }
    }
    
    if (obj.containsKey("connection")) {
        if (!deserializeConnectionConfig(obj["connection"], config.connection)) {
            return false;
        }
    }
    
    if (obj.containsKey("rtcm")) {
        if (!deserializeRTCMConfig(obj["rtcm"], config.rtcm)) {
            return false;
        }
    }
    
    if (obj.containsKey("mdns")) {
        if (!deserializeMDNSConfig(obj["mdns"], config.mdns)) {
            return false;
        }
    }
    
    return true;
}