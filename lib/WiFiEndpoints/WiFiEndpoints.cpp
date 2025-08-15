#include "WiFiEndpoints.h"

void WiFiEndpoints::registerRoutes(HttpServer* server) {
    // WiFi connection management
    server->addRoute("/api/wifi/connect", HttpMethod::POST, handleConnect);
    server->addRoute("/api/wifi/disconnect", HttpMethod::POST, handleDisconnect);
    server->addRoute("/api/wifi/status", HttpMethod::GET, handleStatus);
    server->addRoute("/api/wifi/scan", HttpMethod::GET, handleScan);
    
    // Saved networks management
    server->addRoute("/api/wifi/networks", HttpMethod::GET, handleGetNetworks);
    server->addRoute("/api/wifi/networks", HttpMethod::POST, handleAddNetwork);
    server->addRoute("/api/wifi/networks", HttpMethod::DELETE, handleRemoveNetwork);
}

void WiFiEndpoints::handleConnect(const HttpRequest& req, HttpResponse& res) {
    DynamicJsonDocument doc(512);
    
    // Parse request body
    DeserializationError error = deserializeJson(doc, req.body);
    if (error) {
        writeError(res, 400, "INVALID_JSON", "Invalid JSON in request body");
        return;
    }
    
    JsonObject body = doc.as<JsonObject>();
    String validationError;
    if (!validateConnectRequest(body, validationError)) {
        writeError(res, 400, "VALIDATION_ERROR", validationError);
        return;
    }
    
    String ssid = body["ssid"].as<String>();
    String password = body["password"].as<String>();
    
    WiFiManager* wifiManager = WiFiManager::getInstance();
    
    // Check if already connected to this network
    if (wifiManager->getState() == WiFiManager::CONNECTED && 
        wifiManager->getConnectionInfo().ssid == ssid) {
        writeError(res, 409, "ALREADY_CONNECTED", "Already connected to " + ssid);
        return;
    }
    
    // Check if currently connecting
    if (wifiManager->getState() == WiFiManager::CONNECTING) {
        writeError(res, 409, "CONNECTION_IN_PROGRESS", "Connection already in progress");
        return;
    }
    
    // Attempt connection
    bool result = wifiManager->connect(ssid, password);
    if (!result) {
        writeError(res, 500, "CONNECTION_FAILED", "Failed to initiate connection");
        return;
    }
    
    // Optionally save network if requested
    if (body.containsKey("save") && body["save"].as<bool>()) {
        uint8_t priority = body.containsKey("priority") ? body["priority"].as<uint8_t>() : 0;
        wifiManager->addSavedNetwork(ssid, password, priority);
    }
    
    DynamicJsonDocument response(256);
    response["ssid"] = ssid;
    response["state"] = "connecting";
    response["message"] = "Connection initiated";
    
    writeSuccess(res, response.as<JsonObject>());
}

void WiFiEndpoints::handleDisconnect(const HttpRequest& req, HttpResponse& res) {
    WiFiManager* wifiManager = WiFiManager::getInstance();
    
    if (wifiManager->getState() == WiFiManager::DISCONNECTED) {
        writeError(res, 409, "NOT_CONNECTED", "WiFi is not connected");
        return;
    }
    
    wifiManager->disconnect();
    
    DynamicJsonDocument response(128);
    response["message"] = "Disconnection initiated";
    
    writeSuccess(res, response.as<JsonObject>());
}

void WiFiEndpoints::handleStatus(const HttpRequest& req, HttpResponse& res) {
    WiFiManager* wifiManager = WiFiManager::getInstance();
    WiFiManager::ConnectionInfo connInfo = wifiManager->getConnectionInfo();
    WiFiManager::State state = wifiManager->getState();
    
    DynamicJsonDocument response(512);
    response["state"] = stateToString(state);
    response["connected"] = (state == WiFiManager::CONNECTED);
    
    if (state == WiFiManager::CONNECTED) {
        response["ssid"] = connInfo.ssid;
        response["ip"] = connInfo.ip.toString();
        response["gateway"] = connInfo.gateway.toString();
        response["subnet"] = connInfo.subnet.toString();
        response["rssi"] = connInfo.rssi;
        
        // Calculate signal quality
        int quality = 0;
        if (connInfo.rssi >= -50) quality = 100;
        else if (connInfo.rssi >= -60) quality = 80;
        else if (connInfo.rssi >= -70) quality = 60;
        else if (connInfo.rssi >= -80) quality = 40;
        else quality = 20;
        response["quality"] = quality;
        
        // BSSID as hex string
        char bssidStr[18];
        sprintf(bssidStr, "%02X:%02X:%02X:%02X:%02X:%02X",
                connInfo.bssid[0], connInfo.bssid[1], connInfo.bssid[2],
                connInfo.bssid[3], connInfo.bssid[4], connInfo.bssid[5]);
        response["bssid"] = bssidStr;
    } else if (state == WiFiManager::AP_MODE) {
        response["apMode"] = true;
        response["apIP"] = WiFi.softAPIP().toString();
        response["apSSID"] = WiFi.softAPSSID();
        response["connectedClients"] = WiFi.softAPgetStationNum();
    }
    
    writeSuccess(res, response.as<JsonObject>());
}

void WiFiEndpoints::handleScan(const HttpRequest& req, HttpResponse& res) {
    WiFiManager* wifiManager = WiFiManager::getInstance();
    
    // Check for force parameter
    bool forceNew = false;
    if (req.request->hasParam("force")) {
        String forceParam = req.request->getParam("force")->value();
        forceNew = (forceParam == "true");
    }
    
    std::vector<WiFiNetwork> networks = wifiManager->scan(forceNew);
    
    DynamicJsonDocument response(2048);
    JsonArray networksArray = response.createNestedArray("networks");
    
    for (const auto& network : networks) {
        JsonObject netObj = networksArray.createNestedObject();
        netObj["ssid"] = network.ssid;
        netObj["rssi"] = network.rssi;
        netObj["secure"] = (network.authMode != WIFI_AUTH_OPEN);
        netObj["authMode"] = authModeToString(network.authMode);
        netObj["channel"] = network.channel;
        
        // Signal quality
        int quality = 0;
        if (network.rssi >= -50) quality = 100;
        else if (network.rssi >= -60) quality = 80;
        else if (network.rssi >= -70) quality = 60;
        else if (network.rssi >= -80) quality = 40;
        else quality = 20;
        netObj["quality"] = quality;
    }
    
    response["count"] = networks.size();
    response["cached"] = !forceNew;
    
    writeSuccess(res, response.as<JsonObject>());
}

void WiFiEndpoints::handleAddNetwork(const HttpRequest& req, HttpResponse& res) {
    DynamicJsonDocument doc(512);
    
    // Parse request body
    DeserializationError error = deserializeJson(doc, req.body);
    if (error) {
        writeError(res, 400, "INVALID_JSON", "Invalid JSON in request body");
        return;
    }
    
    JsonObject body = doc.as<JsonObject>();
    String validationError;
    if (!validateNetworkRequest(body, validationError)) {
        writeError(res, 400, "VALIDATION_ERROR", validationError);
        return;
    }
    
    String ssid = body["ssid"].as<String>();
    String password = body["password"].as<String>();
    uint8_t priority = body.containsKey("priority") ? body["priority"].as<uint8_t>() : 0;
    
    WiFiManager* wifiManager = WiFiManager::getInstance();
    bool result = wifiManager->addSavedNetwork(ssid, password, priority);
    
    if (!result) {
        writeError(res, 500, "SAVE_FAILED", "Failed to save network (maximum 5 networks allowed)");
        return;
    }
    
    DynamicJsonDocument response(256);
    response["ssid"] = ssid;
    response["priority"] = priority;
    response["message"] = "Network saved successfully";
    
    writeSuccess(res, response.as<JsonObject>());
}

void WiFiEndpoints::handleRemoveNetwork(const HttpRequest& req, HttpResponse& res) {
    // Get SSID from query parameter
    if (!req.request->hasParam("ssid")) {
        writeError(res, 400, "MISSING_SSID", "SSID parameter is required");
        return;
    }
    
    String ssid = req.request->getParam("ssid")->value();
    
    WiFiManager* wifiManager = WiFiManager::getInstance();
    bool result = wifiManager->removeSavedNetwork(ssid);
    
    if (!result) {
        writeError(res, 404, "NETWORK_NOT_FOUND", "Saved network not found: " + ssid);
        return;
    }
    
    DynamicJsonDocument response(256);
    response["ssid"] = ssid;
    response["message"] = "Network removed successfully";
    
    writeSuccess(res, response.as<JsonObject>());
}

void WiFiEndpoints::handleGetNetworks(const HttpRequest& req, HttpResponse& res) {
    ConfigManager* configManager = ConfigManager::getInstance();
    const Configuration& config = configManager->getConfiguration();
    
    DynamicJsonDocument response(1024);
    JsonArray networksArray = response.createNestedArray("networks");
    
    for (uint8_t i = 0; i < config.connection.wifi.networkCount; i++) {
        const SavedNetwork& network = config.connection.wifi.networks[i];
        JsonObject netObj = networksArray.createNestedObject();
        netObj["ssid"] = network.ssid;
        netObj["priority"] = network.priority;
        // Don't include password for security
    }
    
    response["count"] = config.connection.wifi.networkCount;
    response["maxNetworks"] = 5;
    
    writeSuccess(res, response.as<JsonObject>());
}

bool WiFiEndpoints::validateConnectRequest(const JsonObject& body, String& error) {
    if (!body.containsKey("ssid")) {
        error = "Missing required field: ssid";
        return false;
    }
    
    if (!body.containsKey("password")) {
        error = "Missing required field: password";
        return false;
    }
    
    String ssid = body["ssid"].as<String>();
    String password = body["password"].as<String>();
    
    if (ssid.length() == 0) {
        error = "SSID cannot be empty";
        return false;
    }
    
    if (ssid.length() > 32) {
        error = "SSID too long (max 32 characters)";
        return false;
    }
    
    if (password.length() > 64) {
        error = "Password too long (max 64 characters)";
        return false;
    }
    
    return true;
}

bool WiFiEndpoints::validateNetworkRequest(const JsonObject& body, String& error) {
    if (!validateConnectRequest(body, error)) {
        return false;
    }
    
    if (body.containsKey("priority")) {
        int priority = body["priority"].as<int>();
        if (priority < 0 || priority > 255) {
            error = "Priority must be between 0 and 255";
            return false;
        }
    }
    
    return true;
}

void WiFiEndpoints::writeError(HttpResponse& res, int statusCode, const String& code, const String& message) {
    DynamicJsonDocument doc(256);
    doc["error"]["code"] = code;
    doc["error"]["message"] = message;
    doc["success"] = false;
    
    serializeJson(doc, res.body);
    res.statusCode = statusCode;
}

void WiFiEndpoints::writeSuccess(HttpResponse& res, const JsonObject& data) {
    DynamicJsonDocument doc(1024);
    doc["success"] = true;
    
    if (!data.isNull()) {
        doc["data"] = data;
    }
    
    serializeJson(doc, res.body);
    res.statusCode = 200;
}

String WiFiEndpoints::authModeToString(wifi_auth_mode_t authMode) {
    switch (authMode) {
        case WIFI_AUTH_OPEN: return "open";
        case WIFI_AUTH_WEP: return "wep";
        case WIFI_AUTH_WPA_PSK: return "wpa";
        case WIFI_AUTH_WPA2_PSK: return "wpa2";
        case WIFI_AUTH_WPA_WPA2_PSK: return "wpa/wpa2";
        case WIFI_AUTH_WPA2_ENTERPRISE: return "wpa2-enterprise";
        case WIFI_AUTH_WPA3_PSK: return "wpa3";
        case WIFI_AUTH_WPA2_WPA3_PSK: return "wpa2/wpa3";
        default: return "unknown";
    }
}

String WiFiEndpoints::stateToString(WiFiManager::State state) {
    switch (state) {
        case WiFiManager::DISCONNECTED: return "disconnected";
        case WiFiManager::CONNECTING: return "connecting";
        case WiFiManager::CONNECTED: return "connected";
        case WiFiManager::AP_MODE: return "ap_mode";
        case WiFiManager::ERROR: return "error";
        default: return "unknown";
    }
}