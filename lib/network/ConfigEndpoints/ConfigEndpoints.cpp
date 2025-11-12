#include "ConfigEndpoints.h"

ConfigManager* ConfigEndpoints::configManager = nullptr;
EventManager* ConfigEndpoints::eventManager = nullptr;

void ConfigEndpoints::registerRoutes(HttpServer* server) {
    Serial.println("DEBUG: ConfigEndpoints::registerRoutes() called");
    
    if (server == nullptr) {
        Serial.println("ERROR: HttpServer is nullptr in ConfigEndpoints::registerRoutes");
        return;
    }
    
    Serial.println("DEBUG: Initializing ConfigEndpoints...");
    initialize();
    
    Serial.println("DEBUG: Adding /api/config GET route...");
    server->addRoute("/api/config", HttpMethod::GET, handleGetConfig);
    Serial.println("DEBUG: Adding /api/config POST route...");
    server->addRoute("/api/config", HttpMethod::POST, handlePostConfig);
    Serial.println("DEBUG: Adding /api/config PATCH route...");
    server->addRoute("/api/config", HttpMethod::PATCH, handlePatchConfig);
    Serial.println("DEBUG: All ConfigEndpoints routes added");
}

void ConfigEndpoints::initialize() {
    if (configManager == nullptr) {
        configManager = ConfigManager::getInstance();
    }
    
    if (eventManager == nullptr) {
        eventManager = EventManager::getInstance();
    }
}

void ConfigEndpoints::handleGetConfig(const HttpRequest& req, HttpResponse& res) {
    if (configManager == nullptr) {
        sendErrorResponse(res, 500, "Configuration manager not initialized");
        return;
    }

    // Get the current configuration
    Configuration config = configManager->getConfiguration();

    // If WiFi SSID is empty in config, check NVS for actual credentials
    if (config.connection.wifi.ssid.isEmpty()) {
        NVSManager* nvsManager = NVSManager::getInstance();
        if (nvsManager != nullptr) {
            WiFiCredential cred;
            if (nvsManager->getWiFiCredential(cred) == NVSResult::SUCCESS && !cred.ssid.isEmpty()) {
                // Inject the actual WiFi credentials from NVS into the response
                config.connection.wifi.ssid = cred.ssid;
                config.connection.wifi.password = cred.password;
            }
        }
    }

    // Serialize the updated configuration
    DynamicJsonDocument tempDoc(2048);
    JsonObject obj = tempDoc.to<JsonObject>();
    obj["version"] = config.version;

    JsonObject deviceObj = obj.createNestedObject("device");
    deviceObj["name"] = config.device.name;
    deviceObj["mode"] = config.device.mode;

    JsonObject connectionObj = obj.createNestedObject("connection");
    connectionObj["type"] = config.connection.type;
    JsonObject wifiObj = connectionObj.createNestedObject("wifi");
    wifiObj["ssid"] = config.connection.wifi.ssid;
    wifiObj["password"] = config.connection.wifi.password;
    wifiObj["autoConnect"] = config.connection.wifi.autoConnect;
    wifiObj["apModeEnabled"] = config.connection.wifi.apModeEnabled;
    wifiObj["apSSID"] = config.connection.wifi.apSSID;
    wifiObj["apPassword"] = config.connection.wifi.apPassword;

    JsonObject rtcmObj = obj.createNestedObject("rtcm");
    rtcmObj["enabled"] = config.rtcm.enabled;
    JsonObject sourceObj = rtcmObj.createNestedObject("source");
    sourceObj["type"] = config.rtcm.source.type;
    sourceObj["host"] = config.rtcm.source.host;
    sourceObj["port"] = config.rtcm.source.port;
    if (!config.rtcm.source.mountpoint.isEmpty()) {
        sourceObj["mountpoint"] = config.rtcm.source.mountpoint;
    }
    if (!config.rtcm.source.username.isEmpty()) {
        sourceObj["username"] = config.rtcm.source.username;
    }
    if (!config.rtcm.source.password.isEmpty()) {
        sourceObj["password"] = config.rtcm.source.password;
    }

    JsonObject mdnsObj = obj.createNestedObject("mdns");
    mdnsObj["enabled"] = config.mdns.enabled;
    mdnsObj["hostname"] = config.mdns.hostname;
    mdnsObj["discoveryEnabled"] = config.mdns.discoveryEnabled;

    String configJson;
    serializeJson(tempDoc, configJson);

    if (configJson.length() == 0) {
        sendErrorResponse(res, 500, "Failed to serialize configuration");
        return;
    }

    setVersionHeaders(res, config.version);
    sendSuccessResponse(res, configJson);
}

void ConfigEndpoints::handlePostConfig(const HttpRequest& req, HttpResponse& res) {
    if (configManager == nullptr) {
        sendErrorResponse(res, 500, "Configuration manager not initialized");
        return;
    }
    
    if (!validateContentType(req, "application/json")) {
        sendErrorResponse(res, 400, "Content-Type must be application/json");
        return;
    }
    
    DynamicJsonDocument doc(RESPONSE_BUFFER_SIZE);
    if (!parseJsonFromRequest(req, doc)) {
        sendErrorResponse(res, 400, "Invalid JSON in request body");
        return;
    }
    
    // Extract expected version from headers (for optimistic locking)
    uint32_t expectedVersion = extractVersionFromHeaders(req);
    
    Configuration newConfig;
    if (!configManager->deserializeConfiguration(doc.as<JsonObject>(), newConfig)) {
        sendErrorResponse(res, 400, "Invalid configuration structure");
        return;
    }
    
    bool success = false;
    if (expectedVersion > 0) {
        success = configManager->setConfiguration(newConfig, expectedVersion);
        if (!success) {
            sendErrorResponse(res, 409, "Version conflict - configuration was modified by another client");
            return;
        }
    } else {
        success = configManager->setConfiguration(newConfig);
    }
    
    if (!success) {
        ConfigValidationResult validationResult = configManager->validateConfiguration(newConfig);
        String errorMsg = "Configuration validation failed";
        
        switch (validationResult) {
            case ConfigValidationResult::INVALID_DEVICE_NAME:
                errorMsg = "Invalid device name - must be 1-32 characters";
                break;
            case ConfigValidationResult::INVALID_DEVICE_MODE:
                errorMsg = "Invalid device mode - must be 'usb_otg' or 'uart'";
                break;
            case ConfigValidationResult::INVALID_CONNECTION_TYPE:
                errorMsg = "Invalid connection type - must be 'wifi' or 'ethernet'";
                break;
            case ConfigValidationResult::INVALID_WIFI_SSID:
                errorMsg = "Invalid WiFi SSID - must be 1-32 characters when using WiFi";
                break;
            case ConfigValidationResult::INVALID_RTCM_SOURCE_TYPE:
                errorMsg = "Invalid RTCM source type - must be 'ntrip', 'tcp', or 'udp'";
                break;
            case ConfigValidationResult::INVALID_RTCM_HOST:
                errorMsg = "Invalid RTCM host - required when RTCM is enabled";
                break;
            case ConfigValidationResult::INVALID_RTCM_PORT:
                errorMsg = "Invalid RTCM port - must be 1-65535";
                break;
            case ConfigValidationResult::STORAGE_ERROR:
                sendErrorResponse(res, 507, "Insufficient storage space");
                return;
            default:
                break;
        }
        
        sendErrorResponse(res, 400, errorMsg);
        return;
    }
    
    // Emit configuration changed event
    if (eventManager != nullptr) {
        DynamicJsonDocument eventPayload(256);
        eventPayload["source"] = "rest_api";
        eventPayload["method"] = "POST";
        eventManager->publishAsync(EventType::CONFIG_CHANGED, eventPayload.as<JsonObjectConst>());
    }
    
    const Configuration& updatedConfig = configManager->getConfiguration();
    setVersionHeaders(res, updatedConfig.version);
    
    sendSuccessResponse(res);
}

void ConfigEndpoints::handlePatchConfig(const HttpRequest& req, HttpResponse& res) {
    if (configManager == nullptr) {
        sendErrorResponse(res, 500, "Configuration manager not initialized");
        return;
    }
    
    if (!validateContentType(req, "application/json")) {
        sendErrorResponse(res, 400, "Content-Type must be application/json");
        return;
    }
    
    DynamicJsonDocument doc(RESPONSE_BUFFER_SIZE);
    if (!parseJsonFromRequest(req, doc)) {
        sendErrorResponse(res, 400, "Invalid JSON in request body");
        return;
    }
    
    if (!doc.is<JsonArray>()) {
        sendErrorResponse(res, 400, "Request body must be a JSON array of patch operations");
        return;
    }
    
    JsonArray patchOperations = doc.as<JsonArray>();
    
    // Validate patch operations
    if (!JsonPatch::validateOperations(patchOperations)) {
        sendErrorResponse(res, 400, "Invalid patch operations: " + JsonPatch::getLastError());
        return;
    }
    
    // Extract expected version from headers
    uint32_t expectedVersion = extractVersionFromHeaders(req);
    if (expectedVersion > 0 && configManager->getConfiguration().version != expectedVersion) {
        sendErrorResponse(res, 409, "Version conflict - configuration was modified by another client");
        return;
    }
    
    // Get current configuration and apply patches
    String currentConfigJson = configManager->saveToJson();
    DynamicJsonDocument configDoc(RESPONSE_BUFFER_SIZE);
    
    DeserializationError error = deserializeJson(configDoc, currentConfigJson);
    if (error) {
        sendErrorResponse(res, 500, "Failed to load current configuration");
        return;
    }
    
    // Apply JSON Patch operations
    JsonPatchResult patchResult = JsonPatch::apply(configDoc, patchOperations);
    if (patchResult != JsonPatchResult::SUCCESS) {
        String errorMsg = "Patch operation failed: " + JsonPatch::resultToString(patchResult);
        if (!JsonPatch::getLastError().isEmpty()) {
            errorMsg += " - " + JsonPatch::getLastError();
        }
        
        int statusCode = 400;
        if (patchResult == JsonPatchResult::PATH_NOT_FOUND) {
            statusCode = 400;
        } else if (patchResult == JsonPatchResult::TOO_MANY_OPERATIONS) {
            statusCode = 400;
        }
        
        sendErrorResponse(res, statusCode, errorMsg);
        return;
    }
    
    // Deserialize the patched configuration
    Configuration patchedConfig;
    if (!configManager->deserializeConfiguration(configDoc.as<JsonObject>(), patchedConfig)) {
        sendErrorResponse(res, 400, "Patched configuration is invalid");
        return;
    }
    
    // Apply the patched configuration
    bool success = false;
    if (expectedVersion > 0) {
        success = configManager->setConfiguration(patchedConfig, expectedVersion);
    } else {
        success = configManager->setConfiguration(patchedConfig);
    }
    
    if (!success) {
        ConfigValidationResult validationResult = configManager->validateConfiguration(patchedConfig);
        if (validationResult == ConfigValidationResult::VERSION_CONFLICT) {
            sendErrorResponse(res, 409, "Version conflict - configuration was modified during patch application");
        } else {
            sendErrorResponse(res, 400, "Patched configuration failed validation");
        }
        return;
    }
    
    // Emit configuration changed event
    if (eventManager != nullptr) {
        DynamicJsonDocument eventPayload(512);
        eventPayload["source"] = "rest_api";
        eventPayload["method"] = "PATCH";
        eventPayload["operations"] = patchOperations;
        eventManager->publishAsync(EventType::CONFIG_CHANGED, eventPayload.as<JsonObjectConst>());
    }
    
    const Configuration& updatedConfig = configManager->getConfiguration();
    setVersionHeaders(res, updatedConfig.version);
    
    sendSuccessResponse(res);
}

void ConfigEndpoints::sendErrorResponse(HttpResponse& res, int statusCode, const String& message) {
    res.statusCode = statusCode;
    res.contentType = "application/json";
    
    DynamicJsonDocument errorDoc(256);
    errorDoc["error"] = message;
    errorDoc["status"] = statusCode;
    
    serializeJson(errorDoc, res.body);
}

void ConfigEndpoints::sendSuccessResponse(HttpResponse& res, const String& data) {
    res.statusCode = 200;
    res.contentType = "application/json";
    
    if (data.length() > 0) {
        res.body = data;
    } else {
        res.body = "{\"status\":\"success\"}";
    }
}

bool ConfigEndpoints::validateContentType(const HttpRequest& req, const String& expectedType) {
    if (req.request == nullptr) {
        return false;
    }
    
    // In a real implementation, you would check the Content-Type header
    // This is simplified for the example
    return true;
}

bool ConfigEndpoints::parseJsonFromRequest(const HttpRequest& req, DynamicJsonDocument& doc) {
    if (req.body.length() == 0) {
        return false;
    }
    
    DeserializationError error = deserializeJson(doc, req.body);
    return !error;
}

uint32_t ConfigEndpoints::extractVersionFromHeaders(const HttpRequest& req) {
    if (req.request == nullptr) {
        return 0;
    }
    
    // In a real implementation, you would extract the If-Match or X-Config-Version header
    // This is simplified for the example
    return 0;
}

void ConfigEndpoints::setVersionHeaders(HttpResponse& res, uint32_t version) {
    // In a real implementation, you would set ETag and X-Config-Version headers
    // This is simplified for the example - the headers would be set in the HttpServer
    res.body = res.body; // No-op for now
}