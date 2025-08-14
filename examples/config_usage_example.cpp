/*
 * Configuration Management Usage Examples
 * 
 * This file demonstrates how to use the complete configuration management system
 * including REST API endpoints, JSON patch operations, and persistent storage.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <ConfigManager.h>
#include <HttpServer.h>
#include <ConfigEndpoints.h>
#include <JsonPatch.h>
#include <EventManager.h>
#include <Storage.h>

// Global instances
ConfigManager* configManager = nullptr;
HttpServer* httpServer = nullptr;
EventManager* eventManager = nullptr;

void setup() {
    Serial.begin(115200);
    Serial.println("ESP32 MAVLinkBridge Configuration Management Example");
    
    // Initialize event manager first
    eventManager = EventManager::getInstance();
    eventManager->begin();
    
    // Subscribe to configuration change events
    eventManager->subscribe(EventType::CONFIG_CHANGED, [](const Event& event) {
        Serial.println("Configuration changed!");
        if (event.payload.containsKey("source")) {
            Serial.printf("Source: %s\n", event.payload["source"].as<const char*>());
        }
        if (event.payload.containsKey("method")) {
            Serial.printf("Method: %s\n", event.payload["method"].as<const char*>());
        }
    });
    
    // Initialize configuration manager
    configManager = ConfigManager::getInstance();
    configManager->begin();
    
    // Set up configuration change handler
    configManager->setChangeHandler([](const Configuration& oldConfig, const Configuration& newConfig) {
        Serial.println("Configuration updated via ConfigManager:");
        Serial.printf("  Device name changed: %s -> %s\n", 
                     oldConfig.device.name.c_str(), 
                     newConfig.device.name.c_str());
        Serial.printf("  Version: %u -> %u\n", oldConfig.version, newConfig.version);
    });
    
    // Initialize HTTP server
    httpServer = HttpServer::getInstance();
    
    // Register configuration endpoints
    ConfigEndpoints::registerRoutes(httpServer);
    
    // Add a simple status endpoint
    httpServer->addRoute("/api/status", HttpMethod::GET, [](const HttpRequest& req, HttpResponse& res) {
        DynamicJsonDocument doc(256);
        doc["status"] = "running";
        doc["uptime"] = millis();
        doc["freeHeap"] = ESP.getFreeHeap();
        doc["configVersion"] = ConfigManager::getInstance()->getConfiguration().version;
        
        String response;
        serializeJson(doc, response);
        res.body = response;
    });
    
    httpServer->begin(80);
    
    Serial.println("Configuration management system initialized successfully!");
    Serial.println("Available endpoints:");
    Serial.println("  GET    /api/config  - Get current configuration");
    Serial.println("  POST   /api/config  - Replace entire configuration");
    Serial.println("  PATCH  /api/config  - Apply JSON patch operations");
    Serial.println("  GET    /api/status  - Get system status");
    
    // Example: Programmatic configuration updates
    demonstrateConfigurationManagement();
}

void demonstrateConfigurationManagement() {
    Serial.println("\n=== Configuration Management Demonstration ===");
    
    // 1. Get current configuration
    const Configuration& currentConfig = configManager->getConfiguration();
    Serial.printf("Current device name: %s\n", currentConfig.device.name.c_str());
    Serial.printf("Current version: %u\n", currentConfig.version);
    
    // 2. Update device configuration
    Configuration newConfig = currentConfig;
    newConfig.device.name = "Demo-ESP32";
    newConfig.device.mode = "uart";
    
    if (configManager->setConfiguration(newConfig)) {
        Serial.println("✓ Device configuration updated successfully");
    } else {
        Serial.println("✗ Failed to update device configuration");
    }
    
    // 3. Update connection settings
    Configuration connectionConfig = configManager->getConfiguration();
    connectionConfig.connection.wifi.ssid = "DemoNetwork";
    connectionConfig.connection.wifi.autoConnect = false;
    
    if (configManager->setConfiguration(connectionConfig)) {
        Serial.println("✓ Connection configuration updated successfully");
    }
    
    // 4. Demonstrate JSON Patch operations
    demonstrateJsonPatch();
    
    // 5. Demonstrate backup and restore
    demonstrateBackupRestore();
    
    // 6. Show configuration persistence
    demonstratePersistence();
    
    Serial.println("=== Demonstration Complete ===\n");
}

void demonstrateJsonPatch() {
    Serial.println("\n--- JSON Patch Demonstration ---");
    
    // Get current configuration as JSON
    String configJson = configManager->saveToJson();
    DynamicJsonDocument configDoc(2048);
    deserializeJson(configDoc, configJson);
    
    // Create patch operations
    PatchOperation patches[] = {
        JsonPatch::createReplaceOperation("/device/name", JsonVariant("PatchedDevice")),
        JsonPatch::createReplaceOperation("/rtcm/enabled", JsonVariant(true)),
        JsonPatch::createReplaceOperation("/rtcm/source/host", JsonVariant("rtcm.demo.com")),
        JsonPatch::createAddOperation("/device/serial", JsonVariant("12345"))
    };
    
    Serial.println("Applying JSON patch operations:");
    for (int i = 0; i < 4; i++) {
        Serial.printf("  %d. %s %s\n", 
                     i + 1, 
                     JsonPatch::operationToString(patches[i].op).c_str(),
                     patches[i].path.c_str());
    }
    
    JsonPatchResult result = JsonPatch::apply(configDoc, patches, 4);
    if (result == JsonPatchResult::SUCCESS) {
        Serial.println("✓ JSON patch applied successfully");
        
        // Apply patched configuration
        Configuration patchedConfig;
        if (configManager->deserializeConfiguration(configDoc.as<JsonObject>(), patchedConfig)) {
            configManager->setConfiguration(patchedConfig);
            Serial.printf("✓ New device name: %s\n", patchedConfig.device.name.c_str());
            Serial.printf("✓ RTCM enabled: %s\n", patchedConfig.rtcm.enabled ? "true" : "false");
        }
    } else {
        Serial.printf("✗ JSON patch failed: %s\n", JsonPatch::resultToString(result).c_str());
    }
}

void demonstrateBackupRestore() {
    Serial.println("\n--- Backup and Restore Demonstration ---");
    
    // Create a backup
    if (configManager->backupConfiguration()) {
        Serial.println("✓ Configuration backup created");
    } else {
        Serial.println("✗ Failed to create backup");
        return;
    }
    
    // Modify configuration
    Configuration tempConfig = configManager->getConfiguration();
    tempConfig.device.name = "TemporaryName";
    configManager->setConfiguration(tempConfig);
    Serial.printf("✓ Temporarily changed device name to: %s\n", tempConfig.device.name.c_str());
    
    // Restore from backup
    if (configManager->restoreConfiguration(0)) {
        Serial.println("✓ Configuration restored from backup");
        const Configuration& restoredConfig = configManager->getConfiguration();
        Serial.printf("✓ Restored device name: %s\n", restoredConfig.device.name.c_str());
    } else {
        Serial.println("✗ Failed to restore from backup");
    }
}

void demonstratePersistence() {
    Serial.println("\n--- Persistence Demonstration ---");
    
    // Get storage info
    Storage* storage = Storage::getInstance();
    Serial.printf("Storage space - Total: %zu, Used: %zu, Free: %zu bytes\n", 
                  storage->getTotalSpace(), 
                  storage->getUsedSpace(), 
                  storage->getFreeSpace());
    
    Serial.printf("Available backups: %d\n", storage->getAvailableBackupCount());
    Serial.printf("Config timestamp: %llu\n", storage->getConfigTimestamp());
    
    // Force save current configuration
    if (configManager->saveConfiguration()) {
        Serial.println("✓ Configuration saved to persistent storage");
    } else {
        Serial.println("✗ Failed to save configuration");
    }
    
    // Validate filesystem
    if (storage->validateFilesystem() == StorageResult::SUCCESS) {
        Serial.println("✓ Filesystem validation passed");
    } else {
        Serial.println("✗ Filesystem validation failed");
    }
}

void loop() {
    // Handle HTTP server requests
    httpServer->loop();
    
    // Print configuration summary every 30 seconds
    static unsigned long lastPrint = 0;
    if (millis() - lastPrint > 30000) {
        lastPrint = millis();
        
        const Configuration& config = configManager->getConfiguration();
        Serial.println("\n--- Current Configuration Summary ---");
        Serial.printf("Version: %u\n", config.version);
        Serial.printf("Device: %s (%s)\n", config.device.name.c_str(), config.device.mode.c_str());
        Serial.printf("Connection: %s", config.connection.type.c_str());
        if (config.connection.type == "wifi") {
            Serial.printf(" - SSID: %s\n", config.connection.wifi.ssid.c_str());
        } else {
            Serial.println();
        }
        Serial.printf("RTCM: %s", config.rtcm.enabled ? "enabled" : "disabled");
        if (config.rtcm.enabled) {
            Serial.printf(" - %s://%s:%d\n", 
                         config.rtcm.source.type.c_str(),
                         config.rtcm.source.host.c_str(),
                         config.rtcm.source.port);
        } else {
            Serial.println();
        }
        Serial.printf("Free heap: %u bytes\n", ESP.getFreeHeap());
        Serial.println();
    }
    
    delay(100);
}