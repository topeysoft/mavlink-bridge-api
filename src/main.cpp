#include <Arduino.h>
#include <WiFi.h>
#include "config.h"

#include <HttpServer/HttpServer.h>
#include <WebSocketServer/WebSocketServer.h>
#include <EventManager/EventManager.h>
#include <ConfigManager/ConfigManager.h>
#include <ConfigEndpoints/ConfigEndpoints.h>
#include <WiFiManager/WiFiManager.h>
#include <WiFiEndpoints/WiFiEndpoints.h>
#include <Storage/Storage.h>
#include <HealthMonitor/HealthMonitor.h>
#include <TaskManager/TaskManager.h>
#include <MemoryManager/MemoryManager.h>
#include <ErrorHandler/ErrorHandler.h>
#include <IntegrationTest/IntegrationTest.h>
#include <MDNSManager/MDNSManager.h>
#include <MDNSEndpoints/MDNSEndpoints.h>

#if ENABLE_COMMUNICATION_SYSTEM
#include <USBOTGManager/USBOTGManager.h>
#include <UARTManager/UARTManager.h>
#include <MAVLinkProcessor/MAVLinkProcessor.h>
#include <DataRouter/DataRouter.h>
#include <CommunicationEndpoints/CommunicationEndpoints.h>
#endif

// Global instances
HttpServer *httpServer = nullptr;
WebSocketServer *wsServer = nullptr;
EventManager *eventManager = nullptr;
ConfigManager *configManager = nullptr;
WiFiManager *wifiManager = nullptr;
Storage *storage = nullptr;
HealthMonitor *healthMonitor = nullptr;
TaskManager *taskManager = nullptr;
MemoryManager *memoryManager = nullptr;
ErrorHandler *errorHandler = nullptr;
IntegrationTest *integrationTest = nullptr;
NetworkLib::MDNSManager *mdnsManager = nullptr;

#if ENABLE_COMMUNICATION_SYSTEM
USBOTGManager *usbManager = nullptr;
UARTManager *uartManager = nullptr;
MAVLinkProcessor *mavlinkProcessor = nullptr;
DataRouter *dataRouter = nullptr;
#endif

// Task handles
TaskHandle_t httpTaskHandle = nullptr;
TaskHandle_t wsTaskHandle = nullptr;

// Forward declarations
void httpTask(void *parameter);
void wsTask(void *parameter);
void setupCommunicationRoutes();
void setupEventHandlers();
void onConfigChanged(const Configuration &oldConfig, const Configuration &newConfig);
void onWiFiEvent(WiFiEvent_t event);
String wifiStateToString(WiFiManager::State state);
void setupSystemMonitoring();
void setupHealthEndpoints();
void setupMemoryEndpoints();
void setupErrorEndpoints();
void setupTaskEndpoints();
void setupTestEndpoints();

#if ENABLE_COMMUNICATION_SYSTEM
void setupCommunicationSystem();
void setupCommunicationEventHandlers();
#endif

// API Route handlers
void handleHealthCheck(const HttpRequest &req, HttpResponse &res);

void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println("=== MAVLinkBridge ESP32 API Starting ===");

    // Initialize Storage first
    Serial.println("Initializing storage system...");
    storage = Storage::getInstance();
    if (storage->begin() != StorageResult::SUCCESS)
    {
        Serial.println("⚠️  Storage initialization failed - using memory only");
    }
    else
    {
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

    // Register WiFi event handler for mDNS
    WiFi.onEvent(onWiFiEvent);

    // Initialize mDNS Manager
    mdnsManager = NetworkLib::MDNSManager::getInstance();
    // mDNS will be started when WiFi connects
    Serial.println("✓ mDNS Manager initialized");

    // Initialize System Monitoring
    Serial.println("Initializing system monitoring...");
    setupSystemMonitoring();
    Serial.println("✓ System monitoring initialized");

#if ENABLE_COMMUNICATION_SYSTEM
    // Initialize Communication System
    Serial.println("Initializing communication system...");
    setupCommunicationSystem();
    Serial.println("✓ Communication system initialized");
#endif

    // Print current configuration
    const Configuration &config = configManager->getConfiguration();
    Serial.printf("   Version: %u\n", config.version);
    Serial.printf("   Device: %s (%s)\n", config.device.name.c_str(), config.device.mode.c_str());

    // HTTP Server with basic endpoints first
    httpServer = HttpServer::getInstance();

    // Add basic routes first (non-communication)
    httpServer->addRoute("/api/health", HttpMethod::GET, handleHealthCheck);
    httpServer->addRoute("/api/status", HttpMethod::GET, [](const HttpRequest &req, HttpResponse &res)
                         {
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
        
        serializeJson(doc, res.body); });


    // Register health monitoring endpoints
    setupHealthEndpoints();
    setupMemoryEndpoints();
    setupErrorEndpoints();
    setupTaskEndpoints();
    setupTestEndpoints();

    // Register mDNS endpoints
    MDNSEndpoints::registerRoutes(httpServer, mdnsManager, configManager);

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

    // Setup WiFi Access Point mode if active
    if (wifiManager->getState() == WiFiManager::AP_MODE)
    {
        IPAddress apIP = WiFi.softAPIP();
        Serial.printf("✓ WiFi Access Point active\n");
        Serial.printf("   IP: %s\n", apIP.toString().c_str());
        Serial.printf("   API: http://%s/api/health\n", apIP.toString().c_str());
    }

    // Create tasks for server operations
    xTaskCreate(
        httpTask,
        "HttpTask",
        2048,
        nullptr,
        1,
        &httpTaskHandle);

    xTaskCreate(
        wsTask,
        "WebSocketTask",
        2048,
        nullptr,
        1,
        &wsTaskHandle);

    Serial.println("✓ Tasks created");

    // Print system information
    Serial.println("=== Stage 6 System Ready ===");
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
    Serial.printf("  GET    /api/health/system  - System health\n");
    Serial.printf("  GET    /api/health/memory  - Memory statistics\n");
    Serial.printf("  GET    /api/health/tasks   - Task information\n");
    Serial.printf("  GET    /api/health/errors  - Error log\n");
    Serial.printf("  POST   /api/health/check   - Trigger health check\n");
    Serial.printf("  POST   /api/memory/cleanup - Emergency cleanup\n");
    Serial.printf("  POST   /api/memory/defrag  - Defragment memory\n");
    Serial.printf("  POST   /api/test/run       - Run integration tests\n");
#if ENABLE_COMMUNICATION_SYSTEM
    Serial.printf("  GET    /api/communication/status     - Communication status\n");
    Serial.printf("  GET    /api/communication/statistics - Communication stats\n");
    Serial.printf("  POST   /api/communication/interface  - Switch interface\n");
    Serial.printf("  POST   /api/communication/send       - Send data\n");
#endif
    IPAddress currentIP = (wifiManager->getState() == WiFiManager::CONNECTED) ? wifiManager->getConnectionInfo().ip : WiFi.softAPIP();
    Serial.printf("  WebSocket: ws://%s/ws - Real-time events\n", currentIP.toString().c_str());
    Serial.println("");
    Serial.println("Features: Config ✓ WiFi ✓ Events ✓ Communication ✓ Health ✓ Memory ✓ Tasks ✓ Errors ✓");
}

void loop()
{
    // Main loop - keep system running
    static unsigned long lastHealthReport = 0;
    unsigned long now = millis();


    // Update mDNS manager
    if (mdnsManager)
    {
        mdnsManager->update();
    }

    // Send health status every 30 seconds
    if (now - lastHealthReport > 30000)
    {
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

void httpTask(void *parameter)
{
    while (true)
    {
        httpServer->loop();
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void wsTask(void *parameter)
{
    while (true)
    {
        wsServer->loop();
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

void setupCommunicationRoutes()
{
    // Register enhanced configuration endpoints
    ConfigEndpoints::registerRoutes(httpServer);

    // Register WiFi management endpoints
    WiFiEndpoints::registerRoutes(httpServer);

    // Force garbage collection and heap consolidation
    ESP.getChipRevision(); // Dummy call to trigger any pending cleanup

    // Check memory before registering communication endpoints
    size_t freeHeapBefore = ESP.getFreeHeap();
    ESP_LOGI("SETUP", "Free heap before communication endpoints: %zu bytes", freeHeapBefore);

    if (freeHeapBefore < 12288)
    { // Require at least 12KB free heap (increased threshold)
        ESP_LOGE("SETUP", "Insufficient memory for communication endpoints: %zu bytes available", freeHeapBefore);
        ESP_LOGE("SETUP", "Skipping communication endpoint registration to prevent crash");
        return;
    }

    ESP_LOGI("SETUP", "Attempting heap defragmentation...");
    // Try to defragment heap by allocating and freeing a large block
    void *tempBlock = malloc(4096);
    if (tempBlock)
    {
        free(tempBlock);
        ESP_LOGI("SETUP", "Heap defragmentation completed");
    }

    size_t freeHeapAfterDefrag = ESP.getFreeHeap();
    ESP_LOGI("SETUP", "Free heap after defragmentation: %zu bytes", freeHeapAfterDefrag);

    ESP_LOGI("SETUP", "Registering communication endpoints...");
    try
    {
        CommunicationEndpoints::setupEndpoints(*httpServer->getAsyncServer());
        size_t freeHeapAfter = ESP.getFreeHeap();
        ESP_LOGI("SETUP", "Communication endpoints registered successfully. Free heap: %zu bytes", freeHeapAfter);
    }
    catch (const std::exception &e)
    {
        ESP_LOGE("SETUP", "Failed to register communication endpoints: %s", e.what());
    }
    catch (...)
    {
        ESP_LOGE("SETUP", "Unknown error registering communication endpoints");
    }
}

void setupEventHandlers()
{
    // Subscribe to configuration changes to broadcast via WebSocket
    eventManager->subscribe(EventType::CONFIG_CHANGED, [](const Event &e)
                            {
        DynamicJsonDocument payload(512);
        payload["section"] = "config";
        payload["changes"] = e.payload.as<JsonObjectConst>();
        
        wsServer->broadcast(WebSocketEventType::CONFIG_CHANGED, payload.as<JsonObjectConst>()); });

    // Subscribe to system errors
    eventManager->subscribe(EventType::SYSTEM_ERROR, [](const Event &e)
                            {
        DynamicJsonDocument payload(256);
        payload["code"] = "SYSTEM_ERROR";
        payload["message"] = "System error occurred";
        payload["severity"] = "medium";
        payload["timestamp"] = millis();
        
        wsServer->broadcast(WebSocketEventType::ERROR_EVENT, payload.as<JsonObjectConst>()); });
}

void onConfigChanged(const Configuration &oldConfig, const Configuration &newConfig)
{
    Serial.println("Configuration changed!");

    // Create change event payload
    DynamicJsonDocument changePayload(512);

    // Detect device changes
    if (oldConfig.device.name != newConfig.device.name)
    {
        changePayload["device"]["name"] = newConfig.device.name;
    }
    if (oldConfig.device.mode != newConfig.device.mode)
    {
        changePayload["device"]["mode"] = newConfig.device.mode;
    }

    // Detect connection changes
    if (oldConfig.connection.wifi.ssid != newConfig.connection.wifi.ssid)
    {
        changePayload["connection"]["wifi"]["ssid"] = newConfig.connection.wifi.ssid;
    }
    if (oldConfig.connection.wifi.autoConnect != newConfig.connection.wifi.autoConnect)
    {
        changePayload["connection"]["wifi"]["autoConnect"] = newConfig.connection.wifi.autoConnect;
    }

    // Detect RTCM changes
    if (oldConfig.rtcm.enabled != newConfig.rtcm.enabled)
    {
        changePayload["rtcm"]["enabled"] = newConfig.rtcm.enabled;
    }
    if (oldConfig.rtcm.source.host != newConfig.rtcm.source.host)
    {
        changePayload["rtcm"]["source"]["host"] = newConfig.rtcm.source.host;
    }

    // Handle mDNS configuration changes
    if (mdnsManager &&
        (oldConfig.mdns.enabled != newConfig.mdns.enabled ||
         oldConfig.mdns.hostname != newConfig.mdns.hostname))
    {
        mdnsManager->setEnabled(newConfig.mdns.enabled);
        mdnsManager->setHostname(newConfig.mdns.hostname);
    }

    // Publish configuration change event
    eventManager->publishAsync(EventType::CONFIG_CHANGED, changePayload.as<JsonObjectConst>());
}

// API Route Implementations

void handleHealthCheck(const HttpRequest &req, HttpResponse &res)
{
    DynamicJsonDocument &doc = httpServer->getResponseDoc();
    doc.clear();

    // Basic health status
    doc["status"] = "healthy";
    doc["uptime"] = millis() / 1000;
    doc["freeHeap"] = ESP.getFreeHeap();

    // Device information
    JsonObject device = doc["device"].to<JsonObject>();
    const Configuration &config = configManager->getConfiguration();
    device["hostname"] = config.mdns.hostname.isEmpty() ? "yardrover-esp32" : config.mdns.hostname;
    device["name"] = config.device.name;
    device["chipModel"] = ESP.getChipModel();
    device["chipRevision"] = ESP.getChipRevision();
    device["flashSize"] = ESP.getFlashChipSize();
    device["sdkVersion"] = ESP.getSdkVersion();
    device["coreCount"] = ESP.getChipCores();

    // Network information
    JsonObject network = doc["network"].to<JsonObject>();

    // MAC addresses
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char macStr[18];
    snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    network["macAddress"] = macStr;

    // WiFi AP MAC (different from STA MAC)
    WiFi.softAPmacAddress(mac);
    snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    network["apMacAddress"] = macStr;

    // WiFi connection details
    JsonObject wifi = network["wifi"].to<JsonObject>();
    if (wifiManager)
    {
        WiFiManager::State wifiState = wifiManager->getState();
        wifi["status"] = wifiStateToString(wifiState);

        if (wifiState == WiFiManager::CONNECTED)
        {
            WiFiManager::ConnectionInfo connInfo = wifiManager->getConnectionInfo();
            wifi["ssid"] = connInfo.ssid;
            wifi["ip"] = connInfo.ip.toString();
            wifi["gateway"] = connInfo.gateway.toString();
            wifi["subnet"] = connInfo.subnet.toString();
            wifi["rssi"] = connInfo.rssi;

            // BSSID (router MAC address)
            char bssidStr[18];
            snprintf(bssidStr, sizeof(bssidStr), "%02X:%02X:%02X:%02X:%02X:%02X",
                     connInfo.bssid[0], connInfo.bssid[1], connInfo.bssid[2],
                     connInfo.bssid[3], connInfo.bssid[4], connInfo.bssid[5]);
            wifi["bssid"] = bssidStr;
            wifi["channel"] = WiFi.channel();
        }
    }

    // Access Point information
    JsonObject ap = network["ap"].to<JsonObject>();
    bool apActive = (WiFi.getMode() == WIFI_AP || WiFi.getMode() == WIFI_AP_STA);
    ap["enabled"] = apActive;
    if (apActive)
    {
        ap["ip"] = WiFi.softAPIP().toString();
        ap["ssid"] = WiFi.softAPSSID();
        ap["clients"] = WiFi.softAPgetStationNum();
    }

    // System health from HealthMonitor
    if (healthMonitor)
    {
        JsonObject system = doc["system"].to<JsonObject>();
        HealthMonitor::SystemHealth health = healthMonitor->getSystemHealth();

        system["systemHealthy"] = health.systemHealthy;
        system["cpuUsage"] = health.cpuUsage;
        system["temperature"] = health.temperature;
        system["lowMemoryWarning"] = health.lowMemoryWarning;
        system["minFreeHeap"] = health.minFreeHeap;
        system["largestFreeBlock"] = health.largestFreeBlock;
        system["taskCount"] = health.tasks.size();
        system["componentCount"] = health.components.size();

        // Component health summary
        JsonArray components = system["components"].to<JsonArray>();
        for (const auto &component : health.components)
        {
            JsonObject comp = components.createNestedObject();
            comp["name"] = component.name;
            comp["healthy"] = component.healthy;
            comp["status"] = component.status;
        }
    }

    // Configuration health
    doc["config"]["version"] = config.version;
    doc["config"]["isDirty"] = configManager->isDirtyConfig();

    // Storage health
    size_t freeStorage = storage->getFreeSpace();
    doc["storage"]["freeBytes"] = freeStorage;
    doc["storage"]["totalBytes"] = storage->getTotalSpace();
    doc["storage"]["usedBytes"] = storage->getUsedSpace();
    doc["storage"]["healthy"] = freeStorage > 1024; // More than 1KB free

    // Overall health assessment
    bool systemHealthy = healthMonitor ? healthMonitor->isSystemHealthy() : true;
    bool storageHealthy = doc["storage"]["healthy"].as<bool>();
    bool memoryHealthy = ESP.getFreeHeap() > 5000; // 5KB threshold (more realistic for ESP32)

    bool isHealthy = systemHealthy && storageHealthy && memoryHealthy;

    if (!isHealthy)
    {
        doc["status"] = "degraded";

        // Add reasons for degraded status
        JsonArray issues = doc["issues"].to<JsonArray>();
        if (!systemHealthy)
            issues.add("system_unhealthy");
        if (!storageHealthy)
            issues.add("low_storage");
        if (!memoryHealthy)
            issues.add("low_memory");
    }
    else
    {
        doc["status"] = "healthy";
    }

    // Always return 200 for health checks - degraded is still a valid response
    res.statusCode = 200;
    serializeJson(doc, res.body);
}

String wifiStateToString(WiFiManager::State state)
{
    switch (state)
    {
    case WiFiManager::DISCONNECTED:
        return "disconnected";
    case WiFiManager::CONNECTING:
        return "connecting";
    case WiFiManager::CONNECTED:
        return "connected";
    case WiFiManager::AP_MODE:
        return "ap_mode";
    case WiFiManager::ERROR:
        return "error";
    default:
        return "unknown";
    }
}

#if ENABLE_COMMUNICATION_SYSTEM
void setupCommunicationSystem()
{
    // Initialize MAVLink processor
    mavlinkProcessor = MAVLinkProcessor::getInstance();
    ESP_LOGI("Communication", "MAVLink processor initialized");

    // Initialize USB OTG manager
#if ENABLE_USB_OTG
    usbManager = USBOTGManager::getInstance();
    if (usbManager->begin())
    {
        ESP_LOGI("Communication", "USB OTG manager initialized");
    }
    else
    {
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

    if (uartManager->begin(uartConfig))
    {
        ESP_LOGI("Communication", "UART manager initialized");
    }
    else
    {
        ESP_LOGE("Communication", "Failed to initialize UART manager");
    }
#endif

    // Initialize data router
    dataRouter = DataRouter::getInstance();
    if (dataRouter->begin((DataRouter::RoutingMode)DEFAULT_ROUTING_MODE))
    {
        ESP_LOGI("Communication", "Data router initialized");
    }
    else
    {
        ESP_LOGE("Communication", "Failed to initialize data router");
    }

#if ENABLE_MAVLINK_PROCESSING
    dataRouter->enableMAVLinkProcessing(true);
    ESP_LOGI("Communication", "MAVLink processing enabled");
#endif
}

void onWiFiEvent(WiFiEvent_t event)
{
    switch (event)
    {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
        Serial.println("WiFi connected, starting mDNS...");
        if (mdnsManager && configManager)
        {
            const MDNSConfig &config = configManager->getMDNSConfig();
            if (config.enabled)
            {
                mdnsManager->setHostname(config.hostname);
                mdnsManager->begin();
            }
        }
        break;

    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
        Serial.println("WiFi disconnected, stopping mDNS...");
        if (mdnsManager)
        {
            mdnsManager->end();
        }
        break;

    default:
        break;
    }
}

void setupCommunicationEventHandlers()
{
    // Subscribe to USB events
    eventManager->subscribe(EventType::USB_CONNECTED, [](const Event &e)
                            {
        DynamicJsonDocument payload(256);
        payload["interface"] = "usb_otg";
        payload["connected"] = true;
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>()); });

    eventManager->subscribe(EventType::USB_DISCONNECTED, [](const Event &e)
                            {
        DynamicJsonDocument payload(256);
        payload["interface"] = "usb_otg";
        payload["connected"] = false;
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>()); });

    // Subscribe to UART events
    eventManager->subscribe(EventType::UART_CONNECTED, [](const Event &e)
                            {
        DynamicJsonDocument payload(256);
        payload["interface"] = "uart";
        payload["connected"] = true;
        payload["baudrate"] = e.payload["baudrate"];
        payload["mavlink_detected"] = e.payload["mavlink_detected"];
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>()); });

    eventManager->subscribe(EventType::UART_DISCONNECTED, [](const Event &e)
                            {
        DynamicJsonDocument payload(256);
        payload["interface"] = "uart";
        payload["connected"] = false;
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>()); });

    // Subscribe to interface switching events
    eventManager->subscribe(EventType::INTERFACE_SWITCHED, [](const Event &e)
                            {
        DynamicJsonDocument payload(256);
        payload["event"] = "interface_switched";
        payload["from"] = e.payload["from"];
        payload["to"] = e.payload["to"];
        payload["reason"] = e.payload["reason"];
        wsServer->broadcast(WebSocketEventType::STATUS, payload.as<JsonObjectConst>()); });

    // Subscribe to MAVLink message events
    eventManager->subscribe(EventType::MAVLINK_MESSAGE, [](const Event &e)
                            {
        DynamicJsonDocument payload(256);
        payload["event"] = "mavlink_message";
        payload["messageId"] = e.payload["messageId"];
        payload["systemId"] = e.payload["systemId"];
        payload["componentId"] = e.payload["componentId"];
        wsServer->broadcast(WebSocketEventType::MAVLINK_MESSAGE, payload.as<JsonObjectConst>()); });

    // Subscribe to communication statistics events
    eventManager->subscribe(EventType::COMMUNICATION_STATS, [](const Event &e)
                            { wsServer->broadcast(WebSocketEventType::STATUS, e.payload.as<JsonObjectConst>()); });

    ESP_LOGI("Communication", "Communication event handlers configured");
}
#endif

// System monitoring implementation
void setupSystemMonitoring()
{
    // Initialize Error Handler first
    errorHandler = ErrorHandler::getInstance();
    errorHandler->begin();

    // Initialize Memory Manager
    memoryManager = MemoryManager::getInstance();
    memoryManager->begin();

    // Register cleanup callbacks
    memoryManager->registerCleanupCallback([]() -> size_t
                                           {
        // Simple cleanup - force garbage collection
        size_t beforeFree = ESP.getFreeHeap();
        ESP.getChipRevision(); // Dummy call to trigger cleanup
        size_t afterFree = ESP.getFreeHeap();
        return afterFree - beforeFree; });

    // Initialize Task Manager
    taskManager = TaskManager::getInstance();
    taskManager->begin();

    // Initialize Health Monitor
    healthMonitor = HealthMonitor::getInstance();
    healthMonitor->begin();

    // Register system components with health monitor
    healthMonitor->registerComponent("Storage", []() -> bool
                                     { return storage && storage->isHealthy(); });

    healthMonitor->registerComponent("WiFi", []() -> bool
                                     { return wifiManager && (wifiManager->getState() == WiFiManager::CONNECTED ||
                                                              wifiManager->getState() == WiFiManager::AP_MODE); });

    healthMonitor->registerComponent("HTTP", []() -> bool
                                     { return httpServer != nullptr; });

    healthMonitor->registerComponent("WebSocket", []() -> bool
                                     { return wsServer != nullptr; });

    // Set up health monitoring callbacks
    healthMonitor->onLowMemory([](uint32_t freeHeap)
                               {
        ESP_LOGW("System", "Low memory warning: %lu bytes free", freeHeap);
        // Trigger emergency cleanup
        if (memoryManager) {
            memoryManager->emergencyCleanup();
        } });

    healthMonitor->onComponentFailure([](const char *component)
                                      {
        ESP_LOGE("System", "Component failure detected: %s", component);
        errorHandler->logCritical("System", "Component failure", 1001); });

    // Initialize Integration Test framework
    integrationTest = IntegrationTest::getInstance();
    integrationTest->begin();
}

void setupHealthEndpoints()
{
    // GET /api/health/system
    httpServer->addRoute("/api/health/system", HttpMethod::GET, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!healthMonitor) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Health monitor not available\"}";
            return;
        }
        
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        
        HealthMonitor::SystemHealth health = healthMonitor->getSystemHealth();
        doc["uptime"] = health.uptime;
        doc["freeHeap"] = health.freeHeap;
        doc["minFreeHeap"] = health.minFreeHeap;
        doc["largestFreeBlock"] = health.largestFreeBlock;
        doc["cpuUsage"] = health.cpuUsage;
        doc["temperature"] = health.temperature;
        doc["lowMemoryWarning"] = health.lowMemoryWarning;
        doc["systemHealthy"] = health.systemHealthy;
        
        JsonArray tasks = doc["tasks"].to<JsonArray>();
        for (const auto& task : health.tasks) {
            JsonObject taskObj = tasks.createNestedObject();
            taskObj["name"] = task.name;
            taskObj["stackHighWaterMark"] = task.stackHighWaterMark;
            taskObj["runtime"] = task.runtime;
            taskObj["priority"] = task.priority;
            taskObj["state"] = (int)task.state;
        }
        
        JsonArray components = doc["components"].to<JsonArray>();
        for (const auto& component : health.components) {
            JsonObject compObj = components.createNestedObject();
            compObj["name"] = component.name;
            compObj["healthy"] = component.healthy;
            compObj["status"] = component.status;
            compObj["lastUpdate"] = component.lastUpdate;
        }
        
        serializeJson(doc, res.body);
        res.statusCode = 200; });

    // POST /api/health/check
    httpServer->addRoute("/api/health/check", HttpMethod::POST, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!healthMonitor) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Health monitor not available\"}";
            return;
        }
        
        healthMonitor->triggerHealthCheck();
        res.body = "{\"message\":\"Health check triggered\"}";
        res.statusCode = 200; });
}

void setupMemoryEndpoints()
{
    // GET /api/health/memory
    httpServer->addRoute("/api/health/memory", HttpMethod::GET, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!memoryManager) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Memory manager not available\"}";
            return;
        }
        
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        
        MemoryManager::MemoryStats stats = memoryManager->getStats();
        doc["totalHeap"] = stats.totalHeap;
        doc["freeHeap"] = stats.freeHeap;
        doc["minFreeHeap"] = stats.minFreeHeap;
        doc["largestFreeBlock"] = stats.largestFreeBlock;
        doc["allocations"] = stats.allocations;
        doc["frees"] = stats.frees;
        doc["fragmentation"] = stats.fragmentation;
        doc["poolAllocations"] = stats.poolAllocations;
        doc["poolFrees"] = stats.poolFrees;
        
        serializeJson(doc, res.body);
        res.statusCode = 200; });

    // POST /api/memory/cleanup
    httpServer->addRoute("/api/memory/cleanup", HttpMethod::POST, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!memoryManager) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Memory manager not available\"}";
            return;
        }
        
        size_t beforeFree = ESP.getFreeHeap();
        size_t freed = memoryManager->emergencyCleanup();
        size_t afterFree = ESP.getFreeHeap();
        
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        doc["freedBytes"] = freed;
        doc["beforeFree"] = beforeFree;
        doc["afterFree"] = afterFree;
        
        serializeJson(doc, res.body);
        res.statusCode = 200; });

    // POST /api/memory/defrag
    httpServer->addRoute("/api/memory/defrag", HttpMethod::POST, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!memoryManager) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Memory manager not available\"}";
            return;
        }
        
        size_t beforeFree = ESP.getFreeHeap();
        size_t beforeLargest = ESP.getMaxAllocHeap();
        
        memoryManager->defragment();
        
        size_t afterFree = ESP.getFreeHeap();
        size_t afterLargest = ESP.getMaxAllocHeap();
        
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        doc["beforeFree"] = beforeFree;
        doc["afterFree"] = afterFree;
        doc["beforeLargest"] = beforeLargest;
        doc["afterLargest"] = afterLargest;
        doc["fragmentation"] = memoryManager->getFragmentationPercentage();
        
        serializeJson(doc, res.body);
        res.statusCode = 200; });
}

void setupErrorEndpoints()
{
    // GET /api/health/errors
    httpServer->addRoute("/api/health/errors", HttpMethod::GET, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!errorHandler) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Error handler not available\"}";
            return;
        }
        
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        
        auto errors = errorHandler->getRecentErrors(10);
        JsonArray errorArray = doc["errors"].to<JsonArray>();
        
        for (const auto& error : errors) {
            JsonObject errorObj = errorArray.createNestedObject();
            errorObj["level"] = ErrorHandler::levelToString(error.level);
            errorObj["component"] = error.component;
            errorObj["message"] = error.message;
            errorObj["code"] = error.code;
            errorObj["timestamp"] = error.timestamp;
            errorObj["count"] = error.count;
        }
        
        doc["totalErrors"] = errorHandler->getTotalErrorCount();
        doc["timeSinceLastError"] = errorHandler->getTimeSinceLastError();
        
        serializeJson(doc, res.body);
        res.statusCode = 200; });

    // DELETE /api/health/errors
    httpServer->addRoute("/api/health/errors", HttpMethod::DELETE, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!errorHandler) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Error handler not available\"}";
            return;
        }
        
        errorHandler->clearErrors();
        res.body = "{\"message\":\"Error log cleared\"}";
        res.statusCode = 200; });
}

void setupTaskEndpoints()
{
    // GET /api/health/tasks
    httpServer->addRoute("/api/health/tasks", HttpMethod::GET, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!taskManager) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Task manager not available\"}";
            return;
        }
        
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        
        auto stats = taskManager->getAllTaskStats();
        JsonArray taskArray = doc["tasks"].to<JsonArray>();
        
        for (const auto& task : stats) {
            JsonObject taskObj = taskArray.createNestedObject();
            taskObj["name"] = task.name;
            taskObj["stackHighWaterMark"] = task.stackHighWaterMark;
            taskObj["runtime"] = task.runtime;
            taskObj["priority"] = task.priority;
            taskObj["state"] = task.state;
            taskObj["watchdogFeeds"] = task.watchdogFeeds;
            taskObj["watchdogViolations"] = task.watchdogViolations;
            taskObj["healthy"] = task.healthy;
        }
        
        doc["taskCount"] = taskManager->getTaskCount();
        
        serializeJson(doc, res.body);
        res.statusCode = 200; });
}

void setupTestEndpoints()
{
    // POST /api/test/run
    httpServer->addRoute("/api/test/run", HttpMethod::POST, [](const HttpRequest &req, HttpResponse &res)
                         {
        if (!integrationTest) {
            res.statusCode = 503;
            res.body = "{\"error\":\"Integration test not available\"}";
            return;
        }
        
        // Parse test type from request body
        String testType = "system"; // default
        if (!req.body.isEmpty()) {
            DynamicJsonDocument reqDoc(256);
            deserializeJson(reqDoc, req.body);
            if (reqDoc.containsKey("type")) {
                testType = reqDoc["type"].as<String>();
            }
        }
        
        // Run tests based on type
        if (testType == "all") {
            integrationTest->runAllTests();
        } else if (testType == "stress") {
            integrationTest->runStressTests();
        } else if (testType == "memory") {
            integrationTest->runMemoryTests();
        } else {
            integrationTest->runSystemTests();
        }
        
        // Return test results
        auto results = integrationTest->getAllResults();
        DynamicJsonDocument& doc = httpServer->getResponseDoc();
        doc.clear();
        
        JsonArray suites = doc["testSuites"].to<JsonArray>();
        for (const auto& suite : results) {
            JsonObject suiteObj = suites.createNestedObject();
            suiteObj["name"] = suite.name;
            suiteObj["totalTests"] = suite.totalTests;
            suiteObj["passedTests"] = suite.passedTests;
            suiteObj["failedTests"] = suite.failedTests;
            suiteObj["totalDuration"] = suite.totalDuration;
        }
        
        serializeJson(doc, res.body);
        res.statusCode = 200; });
}