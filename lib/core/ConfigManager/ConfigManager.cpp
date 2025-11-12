#include "ConfigManager.h"

ConfigManager* ConfigManager::instance = nullptr;

ConfigManager::ConfigManager() 
    : isDirty(false), isInitialized(false), configDoc(CONFIG_BUFFER_SIZE), changeHandler(nullptr), storage(nullptr), nvsManager(nullptr) {
    memset(configBuffer, 0, CONFIG_BUFFER_SIZE);
    storage = Storage::getInstance();
    nvsManager = NVSManager::getInstance();
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

    Serial.println("ConfigManager::begin() - Starting initialization");

    // Initialize NVS Manager
    NVSResult nvsResult = nvsManager->begin();
    if (nvsResult != NVSResult::SUCCESS) {
        Serial.printf("ConfigManager: Warning - NVS initialization failed: %s\n", nvsManager->getLastError().c_str());
    } else {
        Serial.println("ConfigManager: NVS initialized successfully");
    }

    // Initialize storage
    if (storage->begin() != StorageResult::SUCCESS) {
        Serial.println("ConfigManager::begin() - Failed to initialize storage, using defaults");
        currentConfig = defaultConfig;
    } else {
        // Try to load configuration from storage
        Serial.println("ConfigManager::begin() - Storage initialized, attempting to load config");
        if (!loadConfiguration()) {
            Serial.println("ConfigManager::begin() - No valid configuration found, using defaults");
            currentConfig = defaultConfig;
            // Save defaults to storage
            saveConfiguration();
        } else {
            Serial.println("ConfigManager::begin() - Configuration loaded successfully");
        }
    }

    // Load critical configs from NVS (overrides storage values)
    if (nvsResult == NVSResult::SUCCESS) {
        Serial.println("ConfigManager::begin() - Loading critical configs from NVS");
        loadCriticalConfigsFromNVS();
    }

    Serial.printf("ConfigManager::begin() - Initialization complete. RTCM enabled=%d, host=%s, port=%d\n",
                 currentConfig.rtcm.enabled,
                 currentConfig.rtcm.source.host.c_str(),
                 currentConfig.rtcm.source.port);

    isInitialized = true;
    isDirty = false;
}

void ConfigManager::setDefaults() {
    defaultConfig.version = 1;
    defaultConfig.device.name = "ESP32-MAVLinkBridge";
    defaultConfig.device.mode = "usb_otg";
    
    defaultConfig.connection.type = "wifi";
    defaultConfig.connection.wifi.ssid = "";
    defaultConfig.connection.wifi.password = "";
    defaultConfig.connection.wifi.autoConnect = true;
    defaultConfig.connection.wifi.apModeEnabled = true;
    defaultConfig.connection.wifi.apSSID = "MAVLinkBridge-Setup";
    defaultConfig.connection.wifi.apPassword = "mavlinkbridge123";
    
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
    
    // Sync critical configs to NVS
    syncCriticalConfigsToNVS();
    
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

    // Auto-save to storage
    saveConfiguration();

    // Sync critical configs to NVS
    syncCriticalConfigsToNVS();

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

    // Auto-save to storage
    saveConfiguration();

    // Sync critical configs to NVS
    syncCriticalConfigsToNVS();

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

    // Auto-save to storage
    saveConfiguration();

    // Sync critical configs to NVS
    syncCriticalConfigsToNVS();

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

    // Auto-save to storage
    saveConfiguration();

    // Sync critical configs to NVS
    syncCriticalConfigsToNVS();

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
        // WiFi SSID can be empty (stored in NVS instead), but if provided, must be valid length
        if (config.connection.type == "wifi" && config.connection.wifi.ssid.length() > 32) {
            return ConfigValidationResult::INVALID_WIFI_SSID;
        }
    }
    
    if (!validateRTCMConfig(config.rtcm)) {
        if (!isValidRTCMSourceType(config.rtcm.source.type)) {
            return ConfigValidationResult::INVALID_RTCM_SOURCE_TYPE;
        }
        // Host validation removed - RTCM can be enabled without host configured yet
        // The RTCM service itself will handle the case of missing host gracefully
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
        // WiFi SSID can be empty (stored in NVS), but if provided, must be valid length
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
        
        // Validate saved network
        if (config.wifi.ssid.length() > 32) {
            return false;
        }
        if (config.wifi.password.length() > 64) {
            return false;
        }
    }
    
    return true;
}

bool ConfigManager::validateRTCMConfig(const RTCMConfig& config) const {
    if (!isValidRTCMSourceType(config.source.type)) {
        return false;
    }

    // Allow RTCM to be enabled without host configured
    // The RTCM service will handle missing host gracefully

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
        wifiObj["password"] = config.wifi.password;
        wifiObj["autoConnect"] = config.wifi.autoConnect;
        wifiObj["apModeEnabled"] = config.wifi.apModeEnabled;
        wifiObj["apSSID"] = config.wifi.apSSID;
        wifiObj["apPassword"] = config.wifi.apPassword;
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

    // Serialize outputs
    if (!config.outputs.empty()) {
        JsonArray outputsArray = obj.createNestedArray("outputs");
        for (const auto& output : config.outputs) {
            JsonObject outputObj = outputsArray.createNestedObject();
            outputObj["name"] = output.name;
            outputObj["protocol"] = output.protocol;
            outputObj["transport"] = output.transport;
            outputObj["enabled"] = output.enabled;

            // Copy params document
            if (!output.params.isNull()) {
                outputObj["params"] = output.params.as<JsonObjectConst>();
            }
        }
    }
}

void ConfigManager::serializeMDNSConfig(const MDNSConfig& config, JsonObject& obj) const {
    obj["enabled"] = config.enabled;
    obj["hostname"] = config.hostname;
    obj["discoveryEnabled"] = config.discoveryEnabled;
}

bool ConfigManager::deserializeDeviceConfig(const JsonObject& obj, DeviceConfig& config) const {
    if (obj.containsKey("name")) {
        config.name = String(obj["name"].as<const char*>());
    }
    
    if (obj.containsKey("mode")) {
        config.mode = String(obj["mode"].as<const char*>());
    }
    
    return validateDeviceConfig(config);
}

bool ConfigManager::deserializeConnectionConfig(const JsonObject& obj, ConnectionConfig& config) const {
    if (obj.containsKey("type")) {
        config.type = String(obj["type"].as<const char*>());
    }
    
    if (config.type == "wifi" && obj.containsKey("wifi")) {
        JsonObject wifiObj = obj["wifi"];
        if (wifiObj.containsKey("ssid")) {
            config.wifi.ssid = String(wifiObj["ssid"].as<const char*>());
        }
        if (wifiObj.containsKey("password")) {
            config.wifi.password = String(wifiObj["password"].as<const char*>());
        }
        if (wifiObj.containsKey("autoConnect")) {
            config.wifi.autoConnect = wifiObj["autoConnect"];
        }
        if (wifiObj.containsKey("apModeEnabled")) {
            config.wifi.apModeEnabled = wifiObj["apModeEnabled"];
        }
        if (wifiObj.containsKey("apSSID")) {
            config.wifi.apSSID = String(wifiObj["apSSID"].as<const char*>());
        }
        if (wifiObj.containsKey("apPassword")) {
            config.wifi.apPassword = String(wifiObj["apPassword"].as<const char*>());
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
            config.source.type = String(sourceObj["type"].as<const char*>());
        }
        if (sourceObj.containsKey("host")) {
            config.source.host = String(sourceObj["host"].as<const char*>());
        }
        if (sourceObj.containsKey("port")) {
            config.source.port = sourceObj["port"];
        }
        if (sourceObj.containsKey("mountpoint")) {
            config.source.mountpoint = String(sourceObj["mountpoint"].as<const char*>());
        }
        if (sourceObj.containsKey("username")) {
            config.source.username = String(sourceObj["username"].as<const char*>());
        }
        if (sourceObj.containsKey("password")) {
            config.source.password = String(sourceObj["password"].as<const char*>());
        }
    }

    // Deserialize outputs
    if (obj.containsKey("outputs")) {
        JsonArray outputsArray = obj["outputs"];
        config.outputs.clear();

        for (JsonVariantConst outputVar : outputsArray) {
            JsonObjectConst outputObj = outputVar.as<JsonObjectConst>();
            if (!outputObj) continue;

            RTCMOutputConfig output;
            output.name = outputObj["name"] ? String(outputObj["name"].as<const char*>()) : String("");
            output.protocol = outputObj["protocol"] ? String(outputObj["protocol"].as<const char*>()) : String("raw");
            output.transport = outputObj["transport"] ? String(outputObj["transport"].as<const char*>()) : String("serial");
            output.enabled = outputObj["enabled"] | true;

            // Copy params
            if (outputObj.containsKey("params")) {
                output.params.clear();
                output.params.set(outputObj["params"]);
            }

            config.outputs.push_back(output);
        }
    }

    return validateRTCMConfig(config);
}

bool ConfigManager::deserializeMDNSConfig(const JsonObject& obj, MDNSConfig& config) const {
    if (obj.containsKey("enabled")) {
        config.enabled = obj["enabled"];
    }
    
    if (obj.containsKey("hostname")) {
        config.hostname = String(obj["hostname"].as<const char*>());
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
    if (!storage) {
        Serial.println("ConfigManager::loadConfiguration() - ERROR: Storage instance is null");
        return false;
    }

    size_t dataSize = 0;
    uint32_t version = 0;
    StorageResult result = storage->readConfig(reinterpret_cast<uint8_t*>(configBuffer), dataSize, version);

    if (result != StorageResult::SUCCESS) {
        Serial.printf("ConfigManager::loadConfiguration() - ERROR: Failed to read config (result=%d)\n", (int)result);
        return false;
    }

    configBuffer[dataSize] = '\0'; // Null terminate
    String jsonStr(configBuffer);

    Serial.printf("ConfigManager::loadConfiguration() - Loaded %zu bytes, version %u\n", dataSize, version);
    Serial.printf("ConfigManager::loadConfiguration() - JSON: %s\n", jsonStr.c_str());

    bool success = loadFromJson(jsonStr);
    if (success) {
        Serial.printf("ConfigManager::loadConfiguration() - Config loaded: RTCM enabled=%d, host=%s, port=%d\n",
                     currentConfig.rtcm.enabled,
                     currentConfig.rtcm.source.host.c_str(),
                     currentConfig.rtcm.source.port);
    }
    return success;
}

bool ConfigManager::saveConfiguration() {
    if (!storage) {
        Serial.println("ConfigManager::saveConfiguration() - ERROR: Storage instance is null");
        return false;
    }

    String jsonStr = saveToJson();
    if (jsonStr.length() >= CONFIG_BUFFER_SIZE) {
        Serial.printf("ConfigManager::saveConfiguration() - ERROR: JSON too large (%d >= %d)\n",
                     jsonStr.length(), CONFIG_BUFFER_SIZE);
        return false;
    }

    Serial.printf("ConfigManager::saveConfiguration() - Saving config: RTCM enabled=%d, host=%s, port=%d\n",
                 currentConfig.rtcm.enabled,
                 currentConfig.rtcm.source.host.c_str(),
                 currentConfig.rtcm.source.port);

    jsonStr.toCharArray(configBuffer, CONFIG_BUFFER_SIZE);
    size_t dataSize = jsonStr.length();

    StorageResult result = storage->writeConfig(reinterpret_cast<const uint8_t*>(configBuffer), dataSize, currentConfig.version);

    if (result == StorageResult::SUCCESS) {
        isDirty = false;
        Serial.printf("ConfigManager::saveConfiguration() - SUCCESS: Saved %zu bytes, version %u\n",
                     dataSize, currentConfig.version);
        return true;
    }

    Serial.printf("ConfigManager::saveConfiguration() - ERROR: Write failed (result=%d)\n", (int)result);
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

bool ConfigManager::syncCriticalConfigsToNVS() {
    if (!nvsManager) {
        Serial.println("ConfigManager: Cannot sync to NVS - NVS manager is null");
        return false;
    }
    
    bool success = true;
    
    // Sync device name
    if (nvsManager->setDeviceName(currentConfig.device.name) != NVSResult::SUCCESS) {
        Serial.printf("ConfigManager: Failed to sync device name to NVS: %s\n", nvsManager->getLastError().c_str());
        success = false;
    }
    
    // Sync mDNS hostname
    if (nvsManager->setMDNSHostname(currentConfig.mdns.hostname) != NVSResult::SUCCESS) {
        Serial.printf("ConfigManager: Failed to sync mDNS hostname to NVS: %s\n", nvsManager->getLastError().c_str());
        success = false;
    }
    
    // Sync config version
    if (nvsManager->setConfigVersion(currentConfig.version) != NVSResult::SUCCESS) {
        Serial.printf("ConfigManager: Failed to sync config version to NVS: %s\n", nvsManager->getLastError().c_str());
        success = false;
    }
    
    // Sync auto-connect setting
    if (nvsManager->setAutoConnect(currentConfig.connection.wifi.autoConnect) != NVSResult::SUCCESS) {
        Serial.printf("ConfigManager: Failed to sync auto-connect to NVS: %s\n", nvsManager->getLastError().c_str());
        success = false;
    }
    
    if (success) {
        Serial.println("ConfigManager: Successfully synced critical configs to NVS");
    }
    
    return success;
}

bool ConfigManager::loadCriticalConfigsFromNVS() {
    if (!nvsManager) {
        Serial.println("ConfigManager: Cannot load from NVS - NVS manager is null");
        return false;
    }
    
    bool loaded = false;
    String value;
    bool boolValue;
    uint32_t version;
    
    // Load device name
    if (nvsManager->getDeviceName(value) == NVSResult::SUCCESS && !value.isEmpty()) {
        currentConfig.device.name = value;
        Serial.printf("ConfigManager: Loaded device name from NVS: %s\n", value.c_str());
        loaded = true;
    }
    
    // Load mDNS hostname
    if (nvsManager->getMDNSHostname(value) == NVSResult::SUCCESS && !value.isEmpty()) {
        currentConfig.mdns.hostname = value;
        Serial.printf("ConfigManager: Loaded mDNS hostname from NVS: %s\n", value.c_str());
        loaded = true;
    }
    
    // Load config version
    if (nvsManager->getConfigVersion(version) == NVSResult::SUCCESS) {
        currentConfig.version = version;
        Serial.printf("ConfigManager: Loaded config version from NVS: %u\n", version);
        loaded = true;
    }
    
    // Load auto-connect setting
    if (nvsManager->getAutoConnect(boolValue) == NVSResult::SUCCESS) {
        currentConfig.connection.wifi.autoConnect = boolValue;
        Serial.printf("ConfigManager: Loaded auto-connect from NVS: %s\n", boolValue ? "true" : "false");
        loaded = true;
    }

    // Load WiFi credentials
    WiFiCredential cred;
    if (nvsManager->getWiFiCredential(cred) == NVSResult::SUCCESS && !cred.ssid.isEmpty()) {
        currentConfig.connection.wifi.ssid = cred.ssid;
        currentConfig.connection.wifi.password = cred.password;
        Serial.printf("ConfigManager: Loaded WiFi credentials from NVS: %s\n", cred.ssid.c_str());
        loaded = true;
    }

    if (loaded) {
        Serial.println("ConfigManager: Successfully loaded critical configs from NVS");
        isDirty = true; // Mark as dirty to save to storage on next save
    }

    return loaded;
}