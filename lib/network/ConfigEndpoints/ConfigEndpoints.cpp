#include "ConfigEndpoints.h"

ConfigManager* ConfigEndpoints::configManager = nullptr;
EventManager* ConfigEndpoints::eventManager = nullptr;

void ConfigEndpoints::registerRoutes(HttpServer* server) {
    if (server == nullptr) {
        return;
    }
    
    initialize();
    
    server->addRoute("/api/config", HttpMethod::GET, handleGetConfig);
    server->addRoute("/api/config", HttpMethod::POST, handlePostConfig);
    server->addRoute("/api/config", HttpMethod::PATCH, handlePatchConfig);
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
    
    String configJson = configManager->saveToJson();
    if (configJson.length() == 0) {
        sendErrorResponse(res, 500, "Failed to serialize configuration");
        return;
    }
    
    const Configuration& config = configManager->getConfiguration();
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