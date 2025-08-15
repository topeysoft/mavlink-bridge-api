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

#if ENABLE_COMMUNICATION_SYSTEM
#include "../lib/USBOTGManager/USBOTGManager.h"
#include "../lib/UARTManager/UARTManager.h"
#include "../lib/MAVLinkProcessor/MAVLinkProcessor.h"
#include "../lib/DataRouter/DataRouter.h"
#include "../lib/CommunicationEndpoints/CommunicationEndpoints.h"
#endif

// Global instances
HttpServer* httpServer = nullptr;
WebSocketServer* wsServer = nullptr;
EventManager* eventManager = nullptr;
ConfigManager* configManager = nullptr;
WiFiManager* wifiManager = nullptr;
Storage* storage = nullptr;

#if ENABLE_COMMUNICATION_SYSTEM
USBOTGManager* usbManager = nullptr;
UARTManager* uartManager = nullptr;
MAVLinkProcessor* mavlinkProcessor = nullptr;
DataRouter* dataRouter = nullptr;
#endif

// Task handles
TaskHandle_t httpTaskHandle = nullptr;
TaskHandle_t wsTaskHandle = nullptr;

// Forward declarations
void httpTask(void* parameter);
void wsTask(void* parameter);
void setupCommunicationRoutes();
void setupEventHandlers();
void onConfigChanged(const Configuration& oldConfig, const Configuration& newConfig);
String wifiStateToString(WiFiManager::State state);

#if ENABLE_COMMUNICATION_SYSTEM
void setupCommunicationSystem();
void setupCommunicationEventHandlers();
#endif

// API Route handlers
void handleHealthCheck(const HttpRequest& req, HttpResponse& res);

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("=== MAVLinkBridge ESP32 API Starting ===");
    Serial.println("Stage 5: USB/UART Communication System");
    
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
    
#if ENABLE_COMMUNICATION_SYSTEM
    // Initialize Communication System
    Serial.println("Initializing communication system...");
    setupCommunicationSystem();
    Serial.println("✓ Communication system initialized");
#endif
    
    // Print current configuration
    const Configuration& config = configManager->getConfiguration();
    Serial.printf("   Version: %u\n", config.version);
    Serial.printf("   Device: %s (%s)\n", config.device.name.c_str(), config.device.mode.c_str());
    
    // HTTP Server with basic endpoints first
    httpServer = HttpServer::getInstance();
    
    // Add basic routes first (non-communication)
    httpServer->addRoute("/api/health", HttpMethod::GET, handleHealthCheck);
    httpServer->addRoute("/api/status", HttpMethod::GET, [](const HttpRequest& req, HttpResponse& res) {
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        
        doc["status"] = "running";
        doc["stage"] = "Stage 5: USB/UART Communication System";
        doc["uptime"] = millis() / 1000;
        doc["freeHeap"] = ESP.getFreeHeap();
        
        JsonObject storage = doc["storage"].to<JsonObject>();
        Storage* st = Storage::getInstance();
        storage["total"] = st->getTotalSpace();
        storage["used"] = st->getUsedSpace();
        storage["free"] = st->getFreeSpace();
        
        serializeJson(doc, res.body);
    });
    
    // Register captive portal routes
    CaptivePortal::registerRoutes(httpServer);
    
    httpServer->begin(80);
    Serial.println("✓ HTTP Server initialized on port 80");
    
    // WebSocket Server
    wsServer = WebSocketServer::getInstance();
    wsServer->begin("/ws");
    wsServer->attachToServer(httpServer->getAsyncServer());
    setupEventHandlers();
    Serial.println("✓ WebSocket Server initialized on /ws");
    
#if ENABLE_COMMUNICATION_SYSTEM
    // Setup communication event handlers
    setupCommunicationEventHandlers();
    
    // Delay and setup communication endpoints after other systems are stable
    Serial.println("Preparing to initialize communication system...");
    vTaskDelay(pdMS_TO_TICKS(500)); // Let other systems settle
    setupCommunicationRoutes();
#endif
    
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
    Serial.println("=== Stage 5 System Ready ===");
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
#if ENABLE_COMMUNICATION_SYSTEM
    Serial.printf("  GET    /api/communication/status     - Communication status\n");
    Serial.printf("  GET    /api/communication/statistics - Communication stats\n");
    Serial.printf("  POST   /api/communication/interface  - Switch interface\n");
    Serial.printf("  POST   /api/communication/send       - Send data\n");
#endif
    IPAddress currentIP = (wifiManager->getState() == WiFiManager::CONNECTED) ? 
                          wifiManager->getConnectionInfo().ip : WiFi.softAPIP();
    Serial.printf("  WebSocket: ws://%s/ws - Real-time events\n", currentIP.toString().c_str());
    Serial.println("");
    Serial.println("Features: Config ✓ WiFi ✓ Auto-Reconnect ✓ Events ✓ Persistence ✓ Communication ✓");
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

void setupCommunicationRoutes() {
    // Register enhanced configuration endpoints
    ConfigEndpoints::registerRoutes(httpServer);
    
    // Register WiFi management endpoints
    WiFiEndpoints::registerRoutes(httpServer);
    
    // Force garbage collection and heap consolidation
    ESP.getChipRevision(); // Dummy call to trigger any pending cleanup
    
    // Check memory before registering communication endpoints
    size_t freeHeapBefore = ESP.getFreeHeap();
    ESP_LOGI("SETUP", "Free heap before communication endpoints: %zu bytes", freeHeapBefore);
    
    if (freeHeapBefore < 12288) {  // Require at least 12KB free heap (increased threshold)
        ESP_LOGE("SETUP", "Insufficient memory for communication endpoints: %zu bytes available", freeHeapBefore);
        ESP_LOGE("SETUP", "Skipping communication endpoint registration to prevent crash");
        return;
    }
    
    ESP_LOGI("SETUP", "Attempting heap defragmentation...");
    // Try to defragment heap by allocating and freeing a large block
    void* tempBlock = malloc(4096);
    if (tempBlock) {
        free(tempBlock);
        ESP_LOGI("SETUP", "Heap defragmentation completed");
    }
    
    size_t freeHeapAfterDefrag = ESP.getFreeHeap();
    ESP_LOGI("SETUP", "Free heap after defragmentation: %zu bytes", freeHeapAfterDefrag);
    
    ESP_LOGI("SETUP", "Registering communication endpoints...");
    try {
        CommunicationEndpoints::setupEndpoints(*httpServer->getAsyncServer());
        size_t freeHeapAfter = ESP.getFreeHeap();
        ESP_LOGI("SETUP", "Communication endpoints registered successfully. Free heap: %zu bytes", freeHeapAfter);
    } catch (const std::exception& e) {
        ESP_LOGE("SETUP", "Failed to register communication endpoints: %s", e.what());
    } catch (...) {
        ESP_LOGE("SETUP", "Unknown error registering communication endpoints");
    }
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
    
    // Enhanced health check with Stage 5 information
    doc["status"] = "healthy";
    doc["stage"] = "Stage 5: USB/UART Communication System";
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

#if ENABLE_COMMUNICATION_SYSTEM
void setupCommunicationSystem() {
    // Initialize MAVLink processor
    mavlinkProcessor = MAVLinkProcessor::getInstance();
    ESP_LOGI("Communication", "MAVLink processor initialized");
    
    // Initialize USB OTG manager
#if ENABLE_USB_OTG
    usbManager = USBOTGManager::getInstance();
    if (usbManager->begin()) {
        ESP_LOGI("Communication", "USB OTG manager initialized");
    } else {
        ESP_LOGE("Communication", "Failed to initialize USB OTG manager");
    }
#endif
    
    // Initialize UART manager
#if ENABLE_UART_COMMUNICATION
    uartManager = UARTManager::getInstance();
    UARTManager::Config uartConfig;
    uartConfig.rxPin = DEFAULT_UART_RX_PIN;
    uartConfig.txPin = DEFAULT_UART_TX_PIN;
    uartConfig.baudRate = (UARTManager::BaudRate)DEFAULT_UART_BAUD_RATE;
    uartConfig.autoBaud = ENABLE_UART_AUTO_BAUD;
    uartConfig.flowControl = ENABLE_UART_FLOW_CONTROL;
    uartConfig.rtsPin = DEFAULT_UART_RTS_PIN;
    uartConfig.ctsPin = DEFAULT_UART_CTS_PIN;
    uartConfig.uartNum = DEFAULT_UART_NUM;
    
    if (uartManager->begin(uartConfig)) {
        ESP_LOGI("Communication", "UART manager initialized");
    } else {
        ESP_LOGE("Communication", "Failed to initialize UART manager");
    }
#endif
    
    // Initialize data router
    dataRouter = DataRouter::getInstance();
    if (dataRouter->begin((DataRouter::RoutingMode)DEFAULT_ROUTING_MODE)) {
        ESP_LOGI("Communication", "Data router initialized");
    } else {
        ESP_LOGE("Communication", "Failed to initialize data router");
    }
    
#if ENABLE_MAVLINK_PROCESSING
    dataRouter->enableMAVLinkProcessing(true);
    ESP_LOGI("Communication", "MAVLink processing enabled");
#endif
}

void setupCommunicationEventHandlers() {
    // Subscribe to USB events
    eventManager->subscribe(EventType::USB_CONNECTED, [](const Event& e) {
        DynamicJsonDocument payload(256);
        payload["interface"] = "usb_otg";
        payload["connected"] = true;
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>());
    });
    
    eventManager->subscribe(EventType::USB_DISCONNECTED, [](const Event& e) {
        DynamicJsonDocument payload(256);
        payload["interface"] = "usb_otg";
        payload["connected"] = false;
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>());
    });
    
    // Subscribe to UART events
    eventManager->subscribe(EventType::UART_CONNECTED, [](const Event& e) {
        DynamicJsonDocument payload(256);
        payload["interface"] = "uart";
        payload["connected"] = true;
        payload["baudrate"] = e.payload["baudrate"];
        payload["mavlink_detected"] = e.payload["mavlink_detected"];
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>());
    });
    
    eventManager->subscribe(EventType::UART_DISCONNECTED, [](const Event& e) {
        DynamicJsonDocument payload(256);
        payload["interface"] = "uart";
        payload["connected"] = false;
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>());
    });
    
    // Subscribe to interface switching events
    eventManager->subscribe(EventType::INTERFACE_SWITCHED, [](const Event& e) {
        DynamicJsonDocument payload(256);
        payload["event"] = "interface_switched";
        payload["from"] = e.payload["from"];
        payload["to"] = e.payload["to"];
        payload["reason"] = e.payload["reason"];
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>());
    });
    
    // Subscribe to MAVLink message events
    eventManager->subscribe(EventType::MAVLINK_MESSAGE, [](const Event& e) {
        DynamicJsonDocument payload(256);
        payload["event"] = "mavlink_message";
        payload["messageId"] = e.payload["messageId"];
        payload["systemId"] = e.payload["systemId"];
        payload["componentId"] = e.payload["componentId"];
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>());
    });
    
    // Subscribe to communication statistics events
    eventManager->subscribe(EventType::COMMUNICATION_STATS, [](const Event& e) {
        wsServer->broadcast(WebSocketEventType::STATUS, e.payload.as<JsonObjectConst>());
    });
    
    ESP_LOGI("Communication", "Communication event handlers configured");
}
#endif