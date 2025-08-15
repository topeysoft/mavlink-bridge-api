#include <Arduino.h>
#include <WiFi.h>
#include "../lib/WiFiManager/WiFiManager.h"
#include "../lib/WiFiEndpoints/WiFiEndpoints.h"
#include "../lib/HttpServer/HttpServer.h"
#include "../lib/EventManager/EventManager.h"
#include "../lib/ConfigManager/ConfigManager.h"

// Global instances
WiFiManager* wifiManager = nullptr;
HttpServer* httpServer = nullptr;
EventManager* eventManager = nullptr;
ConfigManager* configManager = nullptr;

// Example event handler for WiFi events
void onWiFiConnected(const Event& e) {
    Serial.println("WiFi Connected Event:");
    Serial.printf("  SSID: %s\n", e.payload["ssid"].as<String>().c_str());
    Serial.printf("  IP: %s\n", e.payload["ip"].as<String>().c_str());
    Serial.printf("  RSSI: %d dBm\n", e.payload["rssi"].as<int>());
}

void onWiFiDisconnected(const Event& e) {
    Serial.println("WiFi Disconnected Event:");
    Serial.printf("  Reason: %s\n", e.payload["reason"].as<String>().c_str());
}

void onWiFiSignalUpdate(const Event& e) {
    Serial.printf("Signal Update: %d dBm (%d%%)\n", 
                  e.payload["rssi"].as<int>(), 
                  e.payload["quality"].as<int>());
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("=== WiFi Management Example ===");
    
    // Initialize Event Manager
    eventManager = EventManager::getInstance();
    eventManager->begin();
    
    // Subscribe to WiFi events
    eventManager->subscribe(EventType::WIFI_CONNECTED, onWiFiConnected);
    eventManager->subscribe(EventType::WIFI_DISCONNECTED, onWiFiDisconnected);
    eventManager->subscribe(EventType::WIFI_SIGNAL_UPDATE, onWiFiSignalUpdate);
    
    // Initialize Configuration Manager
    configManager = ConfigManager::getInstance();
    configManager->begin();
    
    // Initialize WiFi Manager
    wifiManager = WiFiManager::getInstance();
    wifiManager->begin();
    
    Serial.println("✓ WiFi Manager initialized");
    
    // Initialize HTTP Server with WiFi endpoints
    httpServer = HttpServer::getInstance();
    WiFiEndpoints::registerRoutes(httpServer);
    httpServer->begin(80);
    
    Serial.println("✓ HTTP Server with WiFi endpoints started");
    
    // Example 1: Add saved networks
    Serial.println("\n1. Adding saved networks...");
    wifiManager->addSavedNetwork("HomeWiFi", "homepassword", 2);
    wifiManager->addSavedNetwork("OfficeWiFi", "officepassword", 1);
    Serial.println("✓ Saved networks added");
    
    // Example 2: Scan for networks
    Serial.println("\n2. Scanning for available networks...");
    std::vector<WiFiNetwork> networks = wifiManager->scan(true);
    Serial.printf("Found %d networks:\n", networks.size());
    
    for (const auto& network : networks) {
        String authStr = WiFiEndpoints::authModeToString(network.authMode);
        Serial.printf("  - %s (%s, %d dBm, Ch:%d)\n", 
                     network.ssid.c_str(), 
                     authStr.c_str(),
                     network.rssi, 
                     network.channel);
    }
    
    // Example 3: Try auto-connect
    Serial.println("\n3. Attempting auto-connect...");
    wifiManager->tryAutoConnect();
    
    // Print current state
    WiFiManager::State state = wifiManager->getState();
    Serial.printf("Current WiFi state: %s\n", WiFiEndpoints::stateToString(state).c_str());
    
    if (state == WiFiManager::AP_MODE) {
        Serial.printf("Access Point active: %s\n", WiFi.softAPSSID().c_str());
        Serial.printf("AP IP: %s\n", WiFi.softAPIP().toString().c_str());
        Serial.println("Connect to the AP and visit http://192.168.4.1 for setup");
    }
    
    Serial.println("\nSetup complete. Monitoring WiFi events...");
}

void loop() {
    static unsigned long lastStatusPrint = 0;
    static unsigned long lastScanExample = 0;
    unsigned long now = millis();
    
    // Print status every 30 seconds
    if (now - lastStatusPrint > 30000) {
        Serial.println("\n--- WiFi Status ---");
        WiFiManager::State state = wifiManager->getState();
        Serial.printf("State: %s\n", WiFiEndpoints::stateToString(state).c_str());
        
        if (state == WiFiManager::CONNECTED) {
            WiFiManager::ConnectionInfo info = wifiManager->getConnectionInfo();
            Serial.printf("Connected to: %s\n", info.ssid.c_str());
            Serial.printf("IP Address: %s\n", info.ip.toString().c_str());
            Serial.printf("Signal: %d dBm\n", info.rssi);
        } else if (state == WiFiManager::AP_MODE) {
            Serial.printf("AP Mode: %s\n", WiFi.softAPSSID().c_str());
            Serial.printf("Connected clients: %d\n", WiFi.softAPgetStationNum());
        }
        
        // Show saved networks
        const Configuration& config = configManager->getConfiguration();
        Serial.printf("Saved networks: %d\n", config.connection.wifi.networkCount);
        for (uint8_t i = 0; i < config.connection.wifi.networkCount; i++) {
            const SavedNetwork& network = config.connection.wifi.networks[i];
            Serial.printf("  - %s (priority: %d)\n", network.ssid.c_str(), network.priority);
        }
        
        lastStatusPrint = now;
    }
    
    // Example: Periodic scan (every 5 minutes)
    if (now - lastScanExample > 300000) { // 5 minutes
        Serial.println("\n--- Periodic Network Scan ---");
        std::vector<WiFiNetwork> networks = wifiManager->scan(true);
        Serial.printf("Scan found %d networks\n", networks.size());
        
        // Show top 3 strongest networks
        if (networks.size() > 0) {
            Serial.println("Strongest networks:");
            for (size_t i = 0; i < std::min(networks.size(), (size_t)3); i++) {
                Serial.printf("  %d. %s (%d dBm)\n", 
                             i + 1, 
                             networks[i].ssid.c_str(), 
                             networks[i].rssi);
            }
        }
        
        lastScanExample = now;
    }
    
    // Example: Manual connection attempt (commented out for safety)
    /*
    static bool connectionAttempted = false;
    if (!connectionAttempted && now > 60000) { // After 1 minute
        Serial.println("\n--- Manual Connection Example ---");
        if (wifiManager->getState() == WiFiManager::DISCONNECTED) {
            // Try to connect to a specific network
            bool success = wifiManager->connect("YourNetworkName", "YourPassword");
            if (success) {
                Serial.println("Connection attempt initiated");
            } else {
                Serial.println("Failed to initiate connection");
            }
        }
        connectionAttempted = true;
    }
    */
    
    // Process HTTP server
    httpServer->loop();
    
    delay(1000);
}

/*
WiFi REST API Usage Examples:

1. Get WiFi Status:
   curl http://192.168.4.1/api/wifi/status

2. Scan for Networks:
   curl http://192.168.4.1/api/wifi/scan
   curl http://192.168.4.1/api/wifi/scan?force=true

3. Connect to Network:
   curl -X POST http://192.168.4.1/api/wifi/connect \
        -H "Content-Type: application/json" \
        -d '{"ssid":"MyNetwork","password":"mypassword","save":true}'

4. Disconnect from WiFi:
   curl -X POST http://192.168.4.1/api/wifi/disconnect

5. Get Saved Networks:
   curl http://192.168.4.1/api/wifi/networks

6. Add Saved Network:
   curl -X POST http://192.168.4.1/api/wifi/networks \
        -H "Content-Type: application/json" \
        -d '{"ssid":"WorkWiFi","password":"workpass","priority":1}'

7. Remove Saved Network:
   curl -X DELETE "http://192.168.4.1/api/wifi/networks?ssid=WorkWiFi"

8. WebSocket Events:
   Connect to ws://192.168.4.1/ws and listen for:
   - wifi_connecting
   - wifi_connected  
   - wifi_disconnected
   - wifi_signal_update
   - wifi_ap_mode_started
   - wifi_ap_mode_stopped
   - wifi_scan_completed
*/