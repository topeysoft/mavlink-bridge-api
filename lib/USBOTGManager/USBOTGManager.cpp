#include "USBOTGManager.h"
#include "USBFlightControllerDatabase.h"
#include "EventManager.h"
#include <esp_log.h>

// TinyUSB not available in current build environment
// Using USB Serial (CDC) instead for now
#ifdef ARDUINO_USB_CDC_ON_BOOT
#include <USB.h>
#endif

static const char* TAG = "USBOTGManager";

USBOTGManager* USBOTGManager::instance = nullptr;

USBOTGManager::USBOTGManager() : 
    currentState(NOT_INITIALIZED),
    rxBufferPos(0),
    txBufferPos(0),
    usbTask(nullptr),
    txMutex(nullptr),
    rxMutex(nullptr),
    initialized(false) {
    
    memset(&stats, 0, sizeof(stats));
    memset(rxBuffer, 0, sizeof(rxBuffer));
    memset(txBuffer, 0, sizeof(txBuffer));
    
    deviceInfo.vid = 0x0000;
    deviceInfo.pid = 0x0000;
    deviceInfo.vendor = "Unknown";
    deviceInfo.product = "Unknown";
    deviceInfo.isFlightController = false;
    deviceInfo.isIdentified = false;
}

USBOTGManager::~USBOTGManager() {
    end();
}

USBOTGManager* USBOTGManager::getInstance() {
    if (instance == nullptr) {
        instance = new USBOTGManager();
    }
    return instance;
}

bool USBOTGManager::begin() {
    if (initialized) {
        ESP_LOGW(TAG, "Already initialized");
        return true;
    }
    
    ESP_LOGI(TAG, "Initializing USB OTG CDC");
    
    txMutex = xSemaphoreCreateMutex();
    rxMutex = xSemaphoreCreateMutex();
    
    if (!txMutex || !rxMutex) {
        ESP_LOGE(TAG, "Failed to create mutexes");
        return false;
    }
    
    // Initialize USB CDC (simplified implementation)
#ifdef ARDUINO_USB_CDC_ON_BOOT
    USB.begin();
    Serial.begin(115200);
#endif
    
    xTaskCreate(
        usbTaskFunction,
        "usb_otg_task",
        4096,
        this,
        configMAX_PRIORITIES - 2,
        &usbTask
    );
    
    currentState = INITIALIZED;
    initialized = true;
    stats.lastUpdateMs = millis();
    
    ESP_LOGI(TAG, "USB OTG CDC initialized successfully");
    return true;
}

void USBOTGManager::end() {
    if (!initialized) {
        return;
    }
    
    ESP_LOGI(TAG, "Shutting down USB OTG");
    
    if (usbTask) {
        vTaskDelete(usbTask);
        usbTask = nullptr;
    }
    
    if (txMutex) {
        vSemaphoreDelete(txMutex);
        txMutex = nullptr;
    }
    
    if (rxMutex) {
        vSemaphoreDelete(rxMutex);
        rxMutex = nullptr;
    }
    
    // Cleanup USB CDC
#ifdef ARDUINO_USB_CDC_ON_BOOT
    // USB.end() not available, but Serial.end() is
    Serial.end();
#endif
    
    currentState = NOT_INITIALIZED;
    initialized = false;
    
    ESP_LOGI(TAG, "USB OTG shutdown complete");
}

USBOTGManager::State USBOTGManager::getState() const {
    return currentState;
}

USBOTGManager::Statistics USBOTGManager::getStatistics() const {
    return stats;
}

USBOTGManager::DeviceInfo USBOTGManager::getDeviceInfo() const {
    return deviceInfo;
}

void USBOTGManager::resetStatistics() {
    if (xSemaphoreTake(txMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        memset(&stats, 0, sizeof(stats));
        stats.lastUpdateMs = millis();
        xSemaphoreGive(txMutex);
    }
}

size_t USBOTGManager::write(const uint8_t* data, size_t length) {
    if (!isConnected() || !data || length == 0) {
        return 0;
    }
    
    if (xSemaphoreTake(txMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        return 0;
    }
    
    size_t written = 0;
    size_t remaining = length;
    
    // Use Serial for USB CDC communication
#ifdef ARDUINO_USB_CDC_ON_BOOT
    if (Serial && Serial.availableForWrite() > 0) {
        written = Serial.write(data, length);
        if (written > 0) {
            stats.bytesSent += written;
            stats.packetsSent++;
        }
        Serial.flush();
    }
#endif
    
    xSemaphoreGive(txMutex);
    return written;
}

size_t USBOTGManager::read(uint8_t* buffer, size_t length) {
    if (!isConnected() || !buffer || length == 0) {
        return 0;
    }
    
    if (xSemaphoreTake(rxMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        return 0;
    }
    
    size_t available_bytes = min(length, rxBufferPos);
    if (available_bytes > 0) {
        memcpy(buffer, rxBuffer, available_bytes);
        
        if (available_bytes < rxBufferPos) {
            memmove(rxBuffer, rxBuffer + available_bytes, rxBufferPos - available_bytes);
        }
        rxBufferPos -= available_bytes;
        
        stats.bytesReceived += available_bytes;
    }
    
    xSemaphoreGive(rxMutex);
    return available_bytes;
}

size_t USBOTGManager::available() {
    if (!isConnected()) {
        return 0;
    }
    
    if (xSemaphoreTake(rxMutex, pdMS_TO_TICKS(10)) != pdTRUE) {
        return 0;
    }
    
    size_t available_bytes = rxBufferPos;
    xSemaphoreGive(rxMutex);
    
    return available_bytes;
}

void USBOTGManager::flush() {
#ifdef ARDUINO_USB_CDC_ON_BOOT
    if (Serial) {
        Serial.flush();
    }
#endif
}

void USBOTGManager::onConnect(std::function<void()> callback) {
    connectCallback = callback;
}

void USBOTGManager::onDisconnect(std::function<void()> callback) {
    disconnectCallback = callback;
}

void USBOTGManager::onData(std::function<void(uint8_t*, size_t)> callback) {
    dataCallback = callback;
}

bool USBOTGManager::isConnected() const {
#ifdef ARDUINO_USB_CDC_ON_BOOT
    return currentState == CONNECTED && Serial;
#else
    return false;
#endif
}

void USBOTGManager::handleUSBEvents() {
    // Simplified USB event handling
#ifdef ARDUINO_USB_CDC_ON_BOOT
    if (Serial) {
        if (currentState != CONNECTED) {
            currentState = CONNECTED;
            deviceMountCallback();
        }
    } else {
        if (currentState == CONNECTED) {
            currentState = INITIALIZED;
            deviceUnmountCallback();
        }
    }
#endif
}

void USBOTGManager::usbTaskFunction(void* parameter) {
    USBOTGManager* manager = static_cast<USBOTGManager*>(parameter);
    
    ESP_LOGI(TAG, "USB task started");
    
    while (true) {
        manager->handleUSBEvents();
        manager->processIncomingData();
        manager->updateStatistics();
        
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}

void USBOTGManager::processIncomingData() {
#ifdef ARDUINO_USB_CDC_ON_BOOT
    if (!Serial || !Serial.available()) {
        return;
    }
    
    if (xSemaphoreTake(rxMutex, pdMS_TO_TICKS(10)) != pdTRUE) {
        return;
    }
    
    size_t available_space = sizeof(rxBuffer) - rxBufferPos;
    if (available_space > 0) {
        size_t bytes_to_read = min(available_space, (size_t)Serial.available());
        
        for (size_t i = 0; i < bytes_to_read; i++) {
            if (Serial.available()) {
                rxBuffer[rxBufferPos++] = Serial.read();
            }
        }
        
        if (bytes_to_read > 0) {
            stats.packetsReceived++;
            
            if (dataCallback) {
                dataCallback(rxBuffer + rxBufferPos - bytes_to_read, bytes_to_read);
            }
        }
    }
    
    xSemaphoreGive(rxMutex);
#endif
}

void USBOTGManager::updateStatistics() {
    uint32_t now = millis();
    uint32_t elapsed = now - stats.lastUpdateMs;
    
    if (elapsed >= 1000) {
        float seconds = elapsed / 1000.0f;
        stats.dataRate = (stats.bytesReceived + stats.bytesSent) / seconds;
        stats.lastUpdateMs = now;
    }
}

void USBOTGManager::identifyConnectedDevice(uint16_t vid, uint16_t pid) {
    deviceInfo.vid = vid;
    deviceInfo.pid = pid;
    deviceInfo.isIdentified = false;
    deviceInfo.isFlightController = false;
    deviceInfo.vendor = "Unknown";
    deviceInfo.product = "Unknown";
    
    // Search the flight controller database
    for (const FlightControllerUSB* fc = known_flight_controllers; fc->vendor != nullptr; fc++) {
        if (fc->vid == vid && fc->pid == pid) {
            deviceInfo.vendor = fc->vendor;
            deviceInfo.product = fc->product;
            deviceInfo.isIdentified = true;
            deviceInfo.isFlightController = true;
            
            ESP_LOGI(TAG, "Identified flight controller: %s %s (VID:0x%04X PID:0x%04X)", 
                     fc->vendor, fc->product, vid, pid);
            return;
        }
    }
    
    // Check if it's a known USB-to-serial adapter (indicates potential flight controller)
    bool isUSBSerial = false;
    if ((vid == 0x0403) ||  // FTDI
        (vid == 0x10C4) ||  // Silicon Labs CP210x
        (vid == 0x1A86)) {  // WCH CH340/CH341
        
        for (const FlightControllerUSB* fc = known_flight_controllers; fc->vendor != nullptr; fc++) {
            if (fc->vid == vid && fc->pid == pid) {
                deviceInfo.vendor = fc->vendor;
                deviceInfo.product = fc->product;
                deviceInfo.isIdentified = true;
                isUSBSerial = true;
                break;
            }
        }
    }
    
    if (deviceInfo.isIdentified) {
        ESP_LOGI(TAG, "Identified USB device: %s %s (VID:0x%04X PID:0x%04X)%s", 
                 deviceInfo.vendor.c_str(), deviceInfo.product.c_str(), vid, pid,
                 isUSBSerial ? " [USB-Serial]" : "");
    } else {
        ESP_LOGW(TAG, "Unknown USB device connected (VID:0x%04X PID:0x%04X)", vid, pid);
    }
}

void USBOTGManager::cdcRxCallback(uint8_t* buffer, uint32_t length) {
    USBOTGManager* manager = getInstance();
    if (manager && manager->dataCallback) {
        manager->dataCallback(buffer, length);
    }
}

void USBOTGManager::cdcTxCompleteCallback() {
}

void USBOTGManager::deviceMountCallback() {
    USBOTGManager* manager = getInstance();
    if (manager) {
        manager->currentState = CONNECTED;
        ESP_LOGI(TAG, "USB device mounted");
        
        // For simplified CDC implementation, we can't detect actual VID/PID
        // In a full TinyUSB implementation, these would be read from the device descriptor
        // Using placeholder values for USB CDC - in real implementation, get from USB descriptor
        uint16_t detected_vid = 0x0000;  // Would be read from device descriptor
        uint16_t detected_pid = 0x0000;  // Would be read from device descriptor
        
        // Identify the connected device
        manager->identifyConnectedDevice(detected_vid, detected_pid);
        
        DynamicJsonDocument payloadDoc(512);
        payloadDoc["interface"] = "usb_otg";
        payloadDoc["speed"] = "full_speed";
        payloadDoc["vid"] = manager->deviceInfo.vid;
        payloadDoc["pid"] = manager->deviceInfo.pid;
        payloadDoc["vendor"] = manager->deviceInfo.vendor;
        payloadDoc["product"] = manager->deviceInfo.product;
        payloadDoc["is_flight_controller"] = manager->deviceInfo.isFlightController;
        payloadDoc["is_identified"] = manager->deviceInfo.isIdentified;
        
        EventManager::getInstance()->publish(EventType::USB_CONNECTED, payloadDoc.as<JsonObjectConst>());
        
        if (manager->connectCallback) {
            manager->connectCallback();
        }
    }
}

void USBOTGManager::deviceUnmountCallback() {
    USBOTGManager* manager = getInstance();
    if (manager) {
        manager->currentState = INITIALIZED;
        ESP_LOGI(TAG, "USB device unmounted");
        
        DynamicJsonDocument payloadDoc(512);
        payloadDoc["interface"] = "usb_otg";
        payloadDoc["vid"] = manager->deviceInfo.vid;
        payloadDoc["pid"] = manager->deviceInfo.pid;
        payloadDoc["vendor"] = manager->deviceInfo.vendor;
        payloadDoc["product"] = manager->deviceInfo.product;
        payloadDoc["is_flight_controller"] = manager->deviceInfo.isFlightController;
        payloadDoc["is_identified"] = manager->deviceInfo.isIdentified;
        
        EventManager::getInstance()->publish(EventType::USB_DISCONNECTED, payloadDoc.as<JsonObjectConst>());
        
        // Reset device info after disconnection
        manager->deviceInfo.vid = 0x0000;
        manager->deviceInfo.pid = 0x0000;
        manager->deviceInfo.vendor = "Unknown";
        manager->deviceInfo.product = "Unknown";
        manager->deviceInfo.isFlightController = false;
        manager->deviceInfo.isIdentified = false;
        
        if (manager->disconnectCallback) {
            manager->disconnectCallback();
        }
    }
}

void USBOTGManager::deviceSuspendCallback(bool suspended) {
    USBOTGManager* manager = getInstance();
    if (manager) {
        manager->currentState = suspended ? SUSPENDED : CONNECTED;
        ESP_LOGI(TAG, "USB device %s", suspended ? "suspended" : "resumed");
    }
}

// TinyUSB callbacks disabled - using simplified USB CDC implementation
// extern "C" {
//     void tud_mount_cb(void) {
//         USBOTGManager::deviceMountCallback();
//     }
//     
//     void tud_umount_cb(void) {
//         USBOTGManager::deviceUnmountCallback();
//     }
//     
//     void tud_suspend_cb(bool remote_wakeup_en) {
//         USBOTGManager::deviceSuspendCallback(true);
//     }
//     
//     void tud_resume_cb(void) {
//         USBOTGManager::deviceSuspendCallback(false);
//     }
// }