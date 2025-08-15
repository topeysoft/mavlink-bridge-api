#include <Arduino.h>
#include <WiFi.h>
#include "config.h"

#include "../lib/HttpServer/HttpServer.h"
#include "../lib/WebSocketServer/WebSocketServer.h"
#include "../lib/EventManager/EventManager.h"
#include "../lib/ConfigManager/ConfigManager.h"
#include "../lib/ConfigEndpoints/ConfigEndpoints.h"
#include "../lib/WiFiManager/WiFiManager.h"
#include "../lib/WiFiEndpoints/WiFiEndpoints.h"
#include "../lib/CaptivePortal/CaptivePortal.h"
#include "../lib/Storage/Storage.h"

// Global instances
HttpServer* httpServer = nullptr;
WebSocketServer* wsServer = nullptr;
EventManager* eventManager = nullptr;
ConfigManager* configManager = nullptr;
WiFiManager* wifiManager = nullptr;
Storage* storage = nullptr;

// Task handles
TaskHandle_t httpTaskHandle = nullptr;
TaskHandle_t wsTaskHandle = nullptr;

// Forward declarations
void httpTask(void* parameter);
void wsTask(void* parameter);
void setupRoutes();
void setupEventHandlers();
void onConfigChanged(const Configuration& oldConfig, const Configuration& newConfig);
String wifiStateToString(WiFiManager::State state);

// API Route handlers
void handleHealthCheck(const HttpRequest& req, HttpResponse& res);

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("=== MAVLinkBridge ESP32 API Starting ===");
    Serial.println("Stage 3: WiFi Management System");
    
    // Initialize Storage first
    Serial.println("Initializing storage system...");
    storage = Storage::getInstance();
    if (storage->begin() != StorageResult::SUCCESS) {
        Serial.println("⚠️  Storage initialization failed - using memory only");
    } else {
        Serial.printf("✓ Storage initialized (%zu bytes total)\n", storage->getTotalSpace());
    }
    
    // Initialize Event Manager
    eventManager = EventManager::getInstance();
    eventManager->begin();
    Serial.println("✓ Event Manager initialized");
    
    // Configuration Manager with enhanced features
    configManager = ConfigManager::getInstance();
    configManager->begin();
    configManager->setChangeHandler(onConfigChanged);
    Serial.println("✓ Configuration Manager initialized with persistence");
    
    // Initialize WiFi Manager
    wifiManager = WiFiManager::getInstance();
    wifiManager->begin();
    Serial.println("✓ WiFi Manager initialized with auto-reconnection");
    
    // Print current configuration
    const Configuration& config = configManager->getConfiguration();
    Serial.printf("   Version: %u\n", config.version);
    Serial.printf("   Device: %s (%s)\n", config.device.name.c_str(), config.device.mode.c_str());
    
    // HTTP Server with enhanced endpoints
    httpServer = HttpServer::getInstance();
    setupRoutes();
    httpServer->begin(80);
    Serial.println("✓ HTTP Server initialized on port 80");
    
    // WebSocket Server
    wsServer = WebSocketServer::getInstance();
    wsServer->begin("/ws");
    wsServer->attachToServer(httpServer->getAsyncServer());
    setupEventHandlers();
    Serial.println("✓ WebSocket Server initialized on /ws");
    
    // Setup captive portal if in AP mode
    if (wifiManager->getState() == WiFiManager::AP_MODE) {
        CaptivePortal::startDNSServer();
        IPAddress apIP = WiFi.softAPIP();
        Serial.printf("✓ WiFi Access Point active with captive portal\n");
        Serial.printf("   IP: %s\n", apIP.toString().c_str());
        Serial.printf("   Portal: http://%s/\n", apIP.toString().c_str());
    }
    
    // Create tasks for server operations
    xTaskCreate(
        httpTask,
        "HttpTask",
        2048,
        nullptr,
        1,
        &httpTaskHandle
    );
    
    xTaskCreate(
        wsTask,
        "WebSocketTask",
        2048,
        nullptr,
        1,
        &wsTaskHandle
    );
    
    Serial.println("✓ Tasks created");
    
    // Print system information
    Serial.println("=== Stage 3 System Ready ===");
    Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
    Serial.printf("Storage: %zu/%zu bytes used (%.1f%%)\n", 
                  storage->getUsedSpace(), storage->getTotalSpace(),
                  (float)storage->getUsedSpace() / storage->getTotalSpace() * 100);
    Serial.printf("Config backups: %d available\n", storage->getAvailableBackupCount());
    
    Serial.printf("API endpoints:\n");
    Serial.printf("  GET    /api/config     - Get configuration (v%u)\n", config.version);
    Serial.printf("  POST   /api/config     - Replace configuration\n");
    Serial.printf("  PATCH  /api/config     - JSON Patch operations\n");
    Serial.printf("  GET    /api/health     - Health check\n");
    Serial.printf("  GET    /api/status     - System status\n");
    Serial.printf("  POST   /api/wifi/connect    - Connect to WiFi\n");
    Serial.printf("  POST   /api/wifi/disconnect - Disconnect WiFi\n");
    Serial.printf("  GET    /api/wifi/status     - WiFi status\n");
    Serial.printf("  GET    /api/wifi/scan       - Scan networks\n");
    Serial.printf("  GET    /api/wifi/networks   - Saved networks\n");
    Serial.printf("  POST   /api/wifi/networks   - Add network\n");
    Serial.printf("  DELETE /api/wifi/networks   - Remove network\n");
    IPAddress currentIP = (wifiManager->getState() == WiFiManager::CONNECTED) ? 
                          wifiManager->getConnectionInfo().ip : WiFi.softAPIP();
    Serial.printf("  WebSocket: ws://%s/ws - Real-time events\n", currentIP.toString().c_str());
    Serial.println("");
    Serial.println("Features: Config ✓ WiFi ✓ Auto-Reconnect ✓ Events ✓ Persistence ✓");
}

void loop() {
    // Main loop - keep system running
    static unsigned long lastHealthReport = 0;
    unsigned long now = millis();
    
    // Process captive portal DNS requests
    CaptivePortal::loop();
    
    // Send health status every 30 seconds
    if (now - lastHealthReport > 30000) {
        DynamicJsonDocument payload(256);
        payload["status"] = "healthy";
        payload["uptime"] = now / 1000;
        payload["freeHeap"] = ESP.getFreeHeap();
        payload["wifiConnected"] = (wifiManager->getState() == WiFiManager::CONNECTED);
        
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>());
        eventManager->publishAsync(EventType::HEALTH_UPDATE, payload.as<JsonObjectConst>());
        
        lastHealthReport = now;
    }
    
    delay(1000);
}

void httpTask(void* parameter) {
    while (true) {
        httpServer->loop();
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void wsTask(void* parameter) {
    while (true) {
        wsServer->loop();
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

void setupRoutes() {
    // Register enhanced configuration endpoints
    ConfigEndpoints::registerRoutes(httpServer);
    
    // Register WiFi management endpoints
    WiFiEndpoints::registerRoutes(httpServer);
    
    // Register captive portal routes
    CaptivePortal::registerRoutes(httpServer);
    
    // Keep the existing health endpoint
    httpServer->addRoute("/api/health", HttpMethod::GET, handleHealthCheck);
    
    // Add status endpoint with storage info
    httpServer->addRoute("/api/status", HttpMethod::GET, [](const HttpRequest& req, HttpResponse& res) {
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        
        doc["status"] = "running";
        doc["stage"] = "Stage 2: Configuration Management";
        doc["uptime"] = millis() / 1000;
        doc["freeHeap"] = ESP.getFreeHeap();
        doc["configVersion"] = configManager->getConfiguration().version;
        
        // Storage information
        doc["storage"]["total"] = storage->getTotalSpace();
        doc["storage"]["used"] = storage->getUsedSpace();
        doc["storage"]["free"] = storage->getFreeSpace();
        doc["storage"]["backups"] = storage->getAvailableBackupCount();
        
        // WiFi status
        WiFiManager::State wifiState = wifiManager->getState();
        WiFiManager::ConnectionInfo connInfo = wifiManager->getConnectionInfo();
        
        doc["wifi"]["state"] = wifiStateToString(wifiState);
        doc["wifi"]["connected"] = (wifiState == WiFiManager::CONNECTED);
        doc["wifi"]["apMode"] = (wifiState == WiFiManager::AP_MODE);
        
        if (wifiState == WiFiManager::CONNECTED) {
            doc["wifi"]["ssid"] = connInfo.ssid;
            doc["wifi"]["ip"] = connInfo.ip.toString();
            doc["wifi"]["rssi"] = connInfo.rssi;
        } else if (wifiState == WiFiManager::AP_MODE) {
            doc["wifi"]["apIP"] = WiFi.softAPIP().toString();
            doc["wifi"]["apSSID"] = WiFi.softAPSSID();
        }
        
        serializeJson(doc, res.body);
        res.statusCode = 200;
    });
}

void setupEventHandlers() {
    // Subscribe to configuration changes to broadcast via WebSocket
    eventManager->subscribe(EventType::CONFIG_CHANGED, [](const Event& e) {
        DynamicJsonDocument payload(512);
        payload["section"] = "config";
        payload["changes"] = e.payload.as<JsonObjectConst>();
        
        wsServer->broadcast(WebSocketEventType::CONFIG_CHANGED, payload.as<JsonObjectConst>());
    });
    
    // Subscribe to system errors
    eventManager->subscribe(EventType::SYSTEM_ERROR, [](const Event& e) {
        DynamicJsonDocument payload(256);
        payload["code"] = "SYSTEM_ERROR";
        payload["message"] = "System error occurred";
        payload["severity"] = "medium";
        payload["timestamp"] = millis();
        
        wsServer->broadcast(WebSocketEventType::ERROR_EVENT, payload.as<JsonObjectConst>());
    });
}

void onConfigChanged(const Configuration& oldConfig, const Configuration& newConfig) {
    Serial.println("Configuration changed!");
    
    // Create change event payload
    DynamicJsonDocument changePayload(512);
    
    // Detect device changes
    if (oldConfig.device.name != newConfig.device.name) {
        changePayload["device"]["name"] = newConfig.device.name;
    }
    if (oldConfig.device.mode != newConfig.device.mode) {
        changePayload["device"]["mode"] = newConfig.device.mode;
    }
    
    // Detect connection changes
    if (oldConfig.connection.wifi.ssid != newConfig.connection.wifi.ssid) {
        changePayload["connection"]["wifi"]["ssid"] = newConfig.connection.wifi.ssid;
    }
    if (oldConfig.connection.wifi.autoConnect != newConfig.connection.wifi.autoConnect) {
        changePayload["connection"]["wifi"]["autoConnect"] = newConfig.connection.wifi.autoConnect;
    }
    
    // Detect RTCM changes
    if (oldConfig.rtcm.enabled != newConfig.rtcm.enabled) {
        changePayload["rtcm"]["enabled"] = newConfig.rtcm.enabled;
    }
    if (oldConfig.rtcm.source.host != newConfig.rtcm.source.host) {
        changePayload["rtcm"]["source"]["host"] = newConfig.rtcm.source.host;
    }
    
    // Publish configuration change event
    eventManager->publishAsync(EventType::CONFIG_CHANGED, changePayload.as<JsonObjectConst>());
}

// API Route Implementations

void handleHealthCheck(const HttpRequest& req, HttpResponse& res) {
    DynamicJsonDocument& doc = httpServer->getResponseDoc();
    doc.clear();
    
    // Enhanced health check with Stage 2 information
    doc["status"] = "healthy";
    doc["stage"] = "Stage 2: Configuration Management";
    doc["uptime"] = millis() / 1000;
    doc["freeHeap"] = ESP.getFreeHeap();
    
    // Configuration health
    doc["config"]["version"] = configManager->getConfiguration().version;
    doc["config"]["isDirty"] = configManager->isDirtyConfig();
    
    // Storage health
    size_t freeStorage = storage->getFreeSpace();
    doc["storage"]["freeBytes"] = freeStorage;
    doc["storage"]["healthy"] = freeStorage > 1024; // More than 1KB free
    
    // Overall health assessment
    bool isHealthy = doc["storage"]["healthy"].as<bool>() && ESP.getFreeHeap() > 10000;
    if (!isHealthy) {
        doc["status"] = "degraded";
        res.statusCode = 503;
    } else {
        res.statusCode = 200;
    }
    
    serializeJson(doc, res.body);
}

String wifiStateToString(WiFiManager::State state) {
    switch (state) {
        case WiFiManager::DISCONNECTED: return "disconnected";
        case WiFiManager::CONNECTING: return "connecting";
        case WiFiManager::CONNECTED: return "connected";
        case WiFiManager::AP_MODE: return "ap_mode";
        case WiFiManager::ERROR: return "error";
        default: return "unknown";
    }
}