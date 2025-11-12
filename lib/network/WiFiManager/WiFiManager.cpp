#include "WiFiManager.h"
#include <esp_wifi.h>

WiFiManager* WiFiManager::instance = nullptr;

// Exponential backoff delays: 1s, 2s, 4s, 8s, 16s, 30s
const uint16_t WiFiManager::RECONNECT_DELAYS[MAX_RECONNECT_ATTEMPTS] = {
    1000, 2000, 4000, 8000, 16000, 30000
};

WiFiManager::WiFiManager() 
    : currentState(DISCONNECTED), previousState(DISCONNECTED), wifiTaskHandle(nullptr), 
      reconnectAttempts(0), lastReconnectTime(0), lastSignalCheck(0),
      eventManager(nullptr), configManager(nullptr), nvsManager(nullptr), connectingSsid(""), 
      isScanning(false), lastScanTime(0) {
    eventManager = EventManager::getInstance();
    configManager = ConfigManager::getInstance();
    nvsManager = NVSManager::getInstance();
    memset(connectionInfo.bssid, 0, 6);
}

WiFiManager::~WiFiManager() {
    if (wifiTaskHandle != nullptr) {
        vTaskDelete(wifiTaskHandle);
    }
}

WiFiManager* WiFiManager::getInstance() {
    if (instance == nullptr) {
        instance = new WiFiManager();
    }
    return instance;
}

void WiFiManager::begin() {
    // Initialize NVS Manager
    NVSResult nvsResult = nvsManager->begin();
    if (nvsResult != NVSResult::SUCCESS) {
        Serial.printf("WiFiManager: Warning - NVS initialization failed: %s\n", nvsManager->getLastError().c_str());
        Serial.println("WiFiManager: Continuing with ConfigManager only");
    } else {
        Serial.println("WiFiManager: NVS initialized successfully");
    }
    
    // Set WiFi mode
    WiFi.mode(WIFI_AP_STA);
    
    // Register WiFi event handler
    WiFi.onEvent([](WiFiEvent_t event) {
        WiFiManager::getInstance()->handleWiFiEvent(event);
    });
    
    // Create WiFi management task
    xTaskCreate(
        wifiTaskFunction,
        "WiFiManager",
        4096,
        this,
        2,
        &wifiTaskHandle
    );
    
    Serial.println("WiFiManager initialized");
    
    // Try auto-connect if enabled
    const Configuration& config = configManager->getConfiguration();
    if (config.connection.wifi.autoConnect) {
        tryAutoConnect();
    } else if (config.connection.wifi.apModeEnabled) {
        startAccessPoint();
    }
}

bool WiFiManager::connect(const String& ssid, const String& password) {
    if (currentState == CONNECTING) {
        Serial.println("Already connecting, please wait");
        return false;
    }
    
    if (currentState == CONNECTED && connectionInfo.ssid == ssid) {
        Serial.println("Already connected to " + ssid);
        return true;
    }
    
    Serial.printf("Connecting to WiFi: %s\n", ssid.c_str());
    connectingSsid = ssid;
    return connectToNetwork(ssid, password);
}

void WiFiManager::disconnect() {
    Serial.println("WiFi disconnect requested");
    connectingSsid = "";
    WiFi.disconnect();
    setState(DISCONNECTED);
    publishConnectionEvent("", "user_request");
}

WiFiManager::ConnectionInfo WiFiManager::getConnectionInfo() {
    // Update connection info if we're connected
    if (currentState == CONNECTED) {
        updateConnectionInfo();
    }
    return connectionInfo;
}

void WiFiManager::startAccessPoint() {
    const Configuration& config = configManager->getConfiguration();
    startAccessPoint(config.connection.wifi.apSSID, config.connection.wifi.apPassword);
}

void WiFiManager::startAccessPoint(const String& ssid, const String& password) {
    Serial.printf("Starting Access Point: %s\n", ssid.c_str());
    
    bool success;
    if (password.length() > 0) {
        success = WiFi.softAP(ssid.c_str(), password.c_str());
    } else {
        success = WiFi.softAP(ssid.c_str());
    }
    
    if (success) {
        setState(AP_MODE);
        
        DynamicJsonDocument payload(256);
        payload["ssid"] = ssid;
        payload["ip"] = WiFi.softAPIP().toString();
        eventManager->publishAsync(EventType::WIFI_AP_MODE_STARTED, payload.as<JsonObjectConst>());
        
        Serial.printf("Access Point started: %s (%s)\n", 
                     ssid.c_str(), WiFi.softAPIP().toString().c_str());
    } else {
        Serial.println("Failed to start Access Point");
        setState(ERROR);
    }
}

void WiFiManager::stopAccessPoint() {
    if (currentState == AP_MODE) {
        WiFi.softAPdisconnect();
        setState(DISCONNECTED);
        eventManager->publishAsync(EventType::WIFI_AP_MODE_STOPPED);
        Serial.println("Access Point stopped");
    }
}

std::vector<WiFiNetwork> WiFiManager::scan(bool forceNew) {
    unsigned long now = millis();
    
    // Return cached results if recent and not forcing new scan
    if (!forceNew && !lastScanResults.empty() && 
        (now - lastScanTime) < 30000) { // 30 second cache
        return lastScanResults;
    }
    
    if (isScanning) {
        return lastScanResults; // Return previous results if currently scanning
    }
    
    Serial.println("Starting WiFi scan...");
    isScanning = true;
    
    int networkCount = WiFi.scanNetworks();
    lastScanResults.clear();
    
    if (networkCount > 0) {
        for (int i = 0; i < networkCount; i++) {
            WiFiNetwork network(
                WiFi.SSID(i),
                WiFi.RSSI(i),
                WiFi.encryptionType(i),
                WiFi.channel(i)
            );
            lastScanResults.push_back(network);
        }
        
        Serial.printf("Found %d networks\n", networkCount);
        lastScanTime = now;
        
        // Publish scan completed event
        DynamicJsonDocument payload(512);
        JsonArray networks = payload.createNestedArray("networks");
        for (const auto& network : lastScanResults) {
            JsonObject netObj = networks.createNestedObject();
            netObj["ssid"] = network.ssid;
            netObj["rssi"] = network.rssi;
            netObj["secure"] = (network.authMode != WIFI_AUTH_OPEN);
            netObj["channel"] = network.channel;
        }
        
        eventManager->publishAsync(EventType::WIFI_SCAN_COMPLETED, payload.as<JsonObjectConst>());
    } else {
        Serial.println("No networks found");
    }
    
    isScanning = false;
    return lastScanResults;
}

bool WiFiManager::saveNetwork(const String& ssid, const String& password) {
    // Save to NVS first (primary storage)
    WiFiCredential cred(ssid, password);
    NVSResult nvsResult = nvsManager->saveWiFiCredential(cred);
    
    if (nvsResult != NVSResult::SUCCESS) {
        Serial.printf("WiFiManager: NVS save failed (%s), using ConfigManager fallback\n", nvsManager->getLastError().c_str());
    } else {
        Serial.printf("WiFiManager: Saved WiFi credential to NVS: %s\n", ssid.c_str());
    }
    
    // Also save to ConfigManager (primary storage when NVS fails)
    Configuration config = configManager->getConfiguration();
    config.connection.wifi.ssid = ssid;
    config.connection.wifi.password = password;
    
    bool configResult = configManager->setConfiguration(config);
    
    if (configResult) {
        Serial.printf("WiFiManager: Saved WiFi credential to ConfigManager: %s\n", ssid.c_str());
        
        // If connected, disable AP mode
        if (currentState == CONNECTED) {
            stopAccessPoint();
        }
    } else {
        Serial.println("WiFiManager: ERROR - Failed to save to both NVS and ConfigManager");
    }
    
    return nvsResult == NVSResult::SUCCESS || configResult;
}

bool WiFiManager::clearSavedNetwork() {
    // Remove from NVS
    bool nvsSuccess = (nvsManager->removeWiFiCredential() == NVSResult::SUCCESS);
    if (!nvsSuccess) {
        Serial.printf("Failed to remove WiFi credential from NVS: %s\n", nvsManager->getLastError().c_str());
    }
    
    // Also clear from ConfigManager
    Configuration config = configManager->getConfiguration();
    config.connection.wifi.ssid = "";
    config.connection.wifi.password = "";
    
    bool configSuccess = configManager->setConfiguration(config);
    
    return nvsSuccess || configSuccess;
}

bool WiFiManager::hasSavedNetwork() const {
    // Check NVS first (but don't fail if NVS is not working)
    bool hasNVSCredential = false;
    try {
        hasNVSCredential = nvsManager->hasWiFiCredential();
    } catch (...) {
        // Ignore NVS errors
    }
    
    // Check ConfigManager
    bool hasConfigCredential = !configManager->getConfiguration().connection.wifi.ssid.isEmpty();
    
    return hasNVSCredential || hasConfigCredential;
}

WiFiCredential WiFiManager::getSavedCredential() const {
    WiFiCredential cred;
    
    // Try NVS first
    NVSResult nvsResult = nvsManager->getWiFiCredential(cred);
    if (nvsResult == NVSResult::SUCCESS && !cred.ssid.isEmpty()) {
        Serial.printf("WiFiManager: Retrieved credential from NVS: %s\n", cred.ssid.c_str());
        return cred;
    }
    
    // Fall back to ConfigManager
    const Configuration& config = configManager->getConfiguration();
    if (!config.connection.wifi.ssid.isEmpty()) {
        cred.ssid = config.connection.wifi.ssid;
        cred.password = config.connection.wifi.password;
        Serial.printf("WiFiManager: Retrieved credential from ConfigManager: %s\n", cred.ssid.c_str());
    } else {
        Serial.println("WiFiManager: No saved credential found in either NVS or ConfigManager");
    }
    
    return cred;
}

void WiFiManager::tryAutoConnect() {
    if (currentState == CONNECTING || currentState == CONNECTED) {
        return;
    }
    
    // Get saved credential if any
    WiFiCredential cred = getSavedCredential();
    
    if (!cred.ssid.isEmpty()) {
        Serial.printf("Auto-connecting to saved network: %s\n", cred.ssid.c_str());
        connect(cred.ssid, cred.password);
    } else {
        Serial.println("No saved network available for auto-connect");
        const Configuration& config = configManager->getConfiguration();
        if (config.connection.wifi.apModeEnabled) {
            startAccessPoint();
        }
    }
}

void WiFiManager::wifiTaskFunction(void* parameter) {
    WiFiManager* manager = static_cast<WiFiManager*>(parameter);
    manager->runWifiTask();
}

void WiFiManager::runWifiTask() {
    while (true) {
        handleStateTransition();
        
        // Check signal strength periodically when connected
        if (currentState == CONNECTED) {
            checkSignalStrength();
        }
        
        vTaskDelay(pdMS_TO_TICKS(1000)); // Run every second
    }
}

void WiFiManager::handleStateTransition() {
    unsigned long now = millis();
    
    switch (currentState) {
        case CONNECTING:
            // Check for connection timeout
            if (now - lastReconnectTime > CONNECTION_TIMEOUT) {
                Serial.println("Connection timeout");
                setState(ERROR);
                attemptReconnection();
            }
            break;
            
        case ERROR:
            // Handle reconnection attempts
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                unsigned long delay = getReconnectDelay(reconnectAttempts);
                if (now - lastReconnectTime > delay) {
                    attemptReconnection();
                }
            } else {
                // Max attempts reached, start AP mode
                checkAndStartAP();
                reconnectAttempts = 0; // Reset for next time
            }
            break;
            
        case DISCONNECTED:
            // Try auto-reconnect if enabled
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !connectingSsid.isEmpty()) {
                unsigned long delay = getReconnectDelay(reconnectAttempts);
                if (now - lastReconnectTime > delay) {
                    attemptReconnection();
                }
            } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                // Max attempts reached, start AP mode
                checkAndStartAP();
                reconnectAttempts = 0; // Reset for next time
            }
            break;
            
        default:
            break;
    }
}

void WiFiManager::attemptReconnection() {
    if (!connectingSsid.isEmpty()) {
        // Try reconnecting to the last attempted network
        WiFiCredential cred = getSavedCredential();
        if (cred.ssid == connectingSsid) {
            Serial.printf("Reconnection attempt %d to: %s\n", 
                         reconnectAttempts + 1, connectingSsid.c_str());
            connectToNetwork(connectingSsid, cred.password);
            return;
        }
    }
    
    // Try auto-connect to saved network
    tryAutoConnect();
}

void WiFiManager::updateConnectionInfo() {
    if (WiFi.status() == WL_CONNECTED) {
        connectionInfo.ssid = WiFi.SSID();
        connectionInfo.rssi = WiFi.RSSI();
        connectionInfo.ip = WiFi.localIP();
        connectionInfo.gateway = WiFi.gatewayIP();
        connectionInfo.subnet = WiFi.subnetMask();
        
        uint8_t* bssid = WiFi.BSSID();
        if (bssid != nullptr) {
            memcpy(connectionInfo.bssid, bssid, 6);
        }
    }
}

void WiFiManager::checkSignalStrength() {
    unsigned long now = millis();
    if (now - lastSignalCheck > SIGNAL_CHECK_INTERVAL) {
        int8_t rssi = WiFi.RSSI();
        if (rssi != connectionInfo.rssi) {
            connectionInfo.rssi = rssi;
            publishSignalUpdate();
        }
        lastSignalCheck = now;
    }
}

void WiFiManager::setState(State newState) {
    if (currentState != newState) {
        previousState = currentState;
        currentState = newState;
        publishStateEvent();
    }
}

void WiFiManager::publishStateEvent() {
    DynamicJsonDocument payload(256);
    
    switch (currentState) {
        case CONNECTING:
            payload["ssid"] = connectingSsid;
            eventManager->publishAsync(EventType::WIFI_CONNECTING, payload.as<JsonObjectConst>());
            break;
            
        case CONNECTED:
            updateConnectionInfo();
            payload["ssid"] = connectionInfo.ssid;
            payload["ip"] = connectionInfo.ip.toString();
            payload["rssi"] = connectionInfo.rssi;
            eventManager->publishAsync(EventType::WIFI_CONNECTED, payload.as<JsonObjectConst>());
            break;
            
        case DISCONNECTED:
        case ERROR:
            // Will be handled by publishConnectionEvent
            break;
            
        default:
            break;
    }
}

void WiFiManager::publishConnectionEvent(const String& ssid, const String& reason) {
    DynamicJsonDocument payload(256);
    
    if (currentState == DISCONNECTED || currentState == ERROR) {
        payload["reason"] = reason.isEmpty() ? "connection_lost" : reason;
        if (!ssid.isEmpty()) {
            payload["ssid"] = ssid;
        }
        eventManager->publishAsync(EventType::WIFI_DISCONNECTED, payload.as<JsonObjectConst>());
    }
}

void WiFiManager::publishSignalUpdate() {
    DynamicJsonDocument payload(128);
    payload["rssi"] = connectionInfo.rssi;
    
    // Calculate quality percentage (rough approximation)
    int quality = 0;
    if (connectionInfo.rssi >= -50) {
        quality = 100;
    } else if (connectionInfo.rssi >= -60) {
        quality = 80;
    } else if (connectionInfo.rssi >= -70) {
        quality = 60;
    } else if (connectionInfo.rssi >= -80) {
        quality = 40;
    } else {
        quality = 20;
    }
    
    payload["quality"] = quality;
    eventManager->publishAsync(EventType::WIFI_SIGNAL_UPDATE, payload.as<JsonObjectConst>());
}

unsigned long WiFiManager::getReconnectDelay(uint8_t attempt) {
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        return RECONNECT_DELAYS[MAX_RECONNECT_ATTEMPTS - 1];
    }
    return RECONNECT_DELAYS[attempt];
}


bool WiFiManager::connectToNetwork(const String& ssid, const String& password) {
    setState(CONNECTING);
    connectingSsid = ssid;
    lastReconnectTime = millis();
    
    WiFi.begin(ssid.c_str(), password.c_str());
    return true;
}

void WiFiManager::handleWiFiEvent(WiFiEvent_t event) {
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_CONNECTED:
            Serial.printf("Connected to WiFi: %s\n", WiFi.SSID().c_str());
            setState(CONNECTED);
            reconnectAttempts = 0;
            // Disable AP mode when connected
            stopAccessPoint();
            break;
            
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            Serial.println("WiFi disconnected");
            if (currentState == CONNECTED || currentState == CONNECTING) {
                setState(DISCONNECTED);
                publishConnectionEvent(connectionInfo.ssid, "connection_lost");
                reconnectAttempts++;
                lastReconnectTime = millis();
            }
            break;
            
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            Serial.printf("WiFi connected, IP: %s\n", WiFi.localIP().toString().c_str());
            setState(CONNECTED);
            // Disable AP mode when connected
            stopAccessPoint();
            break;
            
        default:
            break;
    }
}

void WiFiManager::checkAndStartAP() {
    const Configuration& config = configManager->getConfiguration();
    if (config.connection.wifi.apModeEnabled && currentState != AP_MODE) {
        startAccessPoint();
    }
}

