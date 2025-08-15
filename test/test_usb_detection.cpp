#include <Arduino.h>
#include <USBOTGManager/USBOTGManager.h>
#include <esp_log.h>

static const char* TAG = "USB_TEST";

USBOTGManager* usbManager = nullptr;

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    ESP_LOGI(TAG, "=== USB Device Detection Test ===");
    ESP_LOGI(TAG, "Chip: %s", ESP.getChipModel());
    ESP_LOGI(TAG, "Free heap: %d bytes", ESP.getFreeHeap());
    
    // Initialize USB OTG Manager
    usbManager = USBOTGManager::getInstance();
    
    // Set up callbacks
    usbManager->onConnect([]() {
        ESP_LOGI(TAG, "USB device connected!");
        auto deviceInfo = usbManager->getDeviceInfo();
        ESP_LOGI(TAG, "VID: 0x%04X, PID: 0x%04X", deviceInfo.vid, deviceInfo.pid);
        ESP_LOGI(TAG, "Vendor: %s, Product: %s", 
                 deviceInfo.vendor.c_str(), deviceInfo.product.c_str());
    });
    
    usbManager->onDisconnect([]() {
        ESP_LOGI(TAG, "USB device disconnected!");
    });
    
    // Start USB manager
    if (usbManager->begin()) {
        ESP_LOGI(TAG, "USB OTG Manager initialized successfully");
    } else {
        ESP_LOGE(TAG, "Failed to initialize USB OTG Manager");
    }
    
    ESP_LOGI(TAG, "Connect a USB device to test detection...");
}

void loop() {
    static unsigned long lastStatus = 0;
    unsigned long now = millis();
    
    // Print status every 5 seconds
    if (now - lastStatus > 5000) {
        lastStatus = now;
        
        auto state = usbManager->getState();
        const char* stateStr = "Unknown";
        switch(state) {
            case USBOTGManager::NOT_INITIALIZED: stateStr = "Not Initialized"; break;
            case USBOTGManager::INITIALIZED: stateStr = "Initialized"; break;
            case USBOTGManager::CONNECTED: stateStr = "Connected"; break;
            case USBOTGManager::SUSPENDED: stateStr = "Suspended"; break;
            case USBOTGManager::ERROR: stateStr = "Error"; break;
        }
        
        ESP_LOGI(TAG, "USB State: %s", stateStr);
        
        if (state == USBOTGManager::CONNECTED) {
            auto stats = usbManager->getStatistics();
            ESP_LOGI(TAG, "Stats - RX: %u bytes, TX: %u bytes", 
                     stats.bytesReceived, stats.bytesSent);
        }
    }
    
    delay(10);
}