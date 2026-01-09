#include "USBOTGManager.h"
#include "USBFlightControllerDatabase.h"
#include "../../core/EventManager/EventManager.h"
#include <esp_log.h>

#ifdef CONFIG_IDF_TARGET_ESP32S3
#include "USBHostImpl.h"
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
    initialized(false)
#ifdef CONFIG_IDF_TARGET_ESP32S3
    , usbHostImpl(nullptr)
#endif
{
    
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
    
    ESP_LOGI(TAG, "Initializing USB OTG Host Mode");
    
    txMutex = xSemaphoreCreateMutex();
    rxMutex = xSemaphoreCreateMutex();
    
    if (!txMutex || !rxMutex) {
        ESP_LOGE(TAG, "Failed to create mutexes");
        return false;
    }
    
    // Initialize USB Host implementation
#ifdef CONFIG_IDF_TARGET_ESP32S3
    ESP_LOGI(TAG, "Initializing USB Host for ESP32-S3");
    usbHostImpl = new USBHostImpl();
    if (!usbHostImpl->begin()) {
        ESP_LOGE(TAG, "Failed to initialize USB Host implementation");
        delete usbHostImpl;
        usbHostImpl = nullptr;
        vSemaphoreDelete(txMutex);
        vSemaphoreDelete(rxMutex);
        return false;
    }
    ESP_LOGI(TAG, "USB Host initialized successfully");
#else
    ESP_LOGW(TAG, "USB Host not available - not ESP32-S3");
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
    
    ESP_LOGI(TAG, "USB OTG Host initialized successfully");
    ESP_LOGI(TAG, "Monitoring USB D+ (GPIO20) and D- (GPIO19) for device detection");
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
    
    // Cleanup USB Host
#ifdef CONFIG_IDF_TARGET_ESP32S3
    if (usbHostImpl) {
        usbHostImpl->end();
        delete usbHostImpl;
        usbHostImpl = nullptr;
    }
#endif
    ESP_LOGI(TAG, "USB cleanup complete");
    
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
    
#ifdef CONFIG_IDF_TARGET_ESP32S3
    if (usbHostImpl && usbHostImpl->isDeviceConnected()) {
        size_t written = usbHostImpl->write(data, length);
        if (written > 0) {
            if (xSemaphoreTake(txMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                stats.bytesSent += written;
                stats.packetsSent++;
                xSemaphoreGive(txMutex);
            }
        }
        return written;
    }
#endif
    
    // Fallback to buffering for non-S3 or when USB host not available
    if (xSemaphoreTake(txMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        return 0;
    }
    
    size_t written = 0;
    size_t available_space = sizeof(txBuffer) - txBufferPos;
    if (available_space > 0) {
        size_t to_write = min(length, available_space);
        memcpy(txBuffer + txBufferPos, data, to_write);
        txBufferPos += to_write;
        written = to_write;
        stats.bytesSent += written;
        stats.packetsSent++;
    }
    
    xSemaphoreGive(txMutex);
    return written;
}

size_t USBOTGManager::read(uint8_t* buffer, size_t length) {
    if (!isConnected() || !buffer || length == 0) {
        return 0;
    }
    
#ifdef CONFIG_IDF_TARGET_ESP32S3
    if (usbHostImpl && usbHostImpl->isDeviceConnected()) {
        size_t read_bytes = usbHostImpl->read(buffer, length);
        if (read_bytes > 0) {
            if (xSemaphoreTake(rxMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                stats.bytesReceived += read_bytes;
                stats.packetsReceived++;
                xSemaphoreGive(rxMutex);
            }
        }
        return read_bytes;
    }
#endif
    
    // Fallback to buffered reading for non-S3 or when USB host not available
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
    
#ifdef CONFIG_IDF_TARGET_ESP32S3
    if (usbHostImpl && usbHostImpl->isDeviceConnected()) {
        return usbHostImpl->available();
    }
#endif
    
    // Fallback for non-S3 or when USB host not available
    if (xSemaphoreTake(rxMutex, pdMS_TO_TICKS(10)) != pdTRUE) {
        return 0;
    }
    
    size_t available_bytes = rxBufferPos;
    xSemaphoreGive(rxMutex);
    
    return available_bytes;
}

void USBOTGManager::flush() {
#ifdef CONFIG_IDF_TARGET_ESP32S3
    if (usbHostImpl && usbHostImpl->isDeviceConnected()) {
        usbHostImpl->flush();
        return;
    }
#endif
    
    // Fallback for non-S3 or when USB host not available
    if (xSemaphoreTake(txMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        txBufferPos = 0;
        xSemaphoreGive(txMutex);
    }
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
#ifdef CONFIG_IDF_TARGET_ESP32S3
    if (usbHostImpl) {
        return usbHostImpl->isDeviceConnected();
    }
#endif
    return currentState == CONNECTED;
}

void USBOTGManager::handleUSBEvents() {
    static bool lastDeviceState = false;
    static uint32_t lastCheckTime = 0;
    uint32_t now = millis();
    
    // Check every 100ms for device connection
    if (now - lastCheckTime < 100) {
        return;
    }
    lastCheckTime = now;
    
    bool deviceConnected = false;
    
#ifdef CONFIG_IDF_TARGET_ESP32S3
    if (usbHostImpl && usbHostImpl->isInitialized()) {
        deviceConnected = usbHostImpl->isDeviceConnected();
        
        // Update device info if connected
        if (deviceConnected && currentState != CONNECTED) {
            auto usbDeviceInfo = usbHostImpl->getDeviceInfo();
            deviceInfo.vid = usbDeviceInfo.vid;
            deviceInfo.pid = usbDeviceInfo.pid;
            deviceInfo.vendor = usbDeviceInfo.vendor;
            deviceInfo.product = usbDeviceInfo.product;
            deviceInfo.isFlightController = usbDeviceInfo.isFlightController;
            deviceInfo.isIdentified = (deviceInfo.vid != 0 && deviceInfo.pid != 0);
        }
    }
#else
    // For non-S3 chips, always false
    static uint32_t logCounter = 0;
    if (++logCounter % 100 == 0) {
        ESP_LOGD(TAG, "USB Host not available on this chip");
    }
#endif
    
    if (deviceConnected != lastDeviceState) {
        lastDeviceState = deviceConnected;
        
        if (deviceConnected) {
            if (currentState != CONNECTED) {
                currentState = CONNECTED;
                ESP_LOGI(TAG, "USB device detected");
                deviceMountCallback();
            }
        } else {
            if (currentState == CONNECTED) {
                currentState = INITIALIZED;
                ESP_LOGI(TAG, "USB device disconnected");
                deviceUnmountCallback();
            }
        }
    }
}

void USBOTGManager::usbTaskFunction(void* parameter) {
    USBOTGManager* manager = static_cast<USBOTGManager*>(parameter);
    
    ESP_LOGI(TAG, "USB task started");
    
    while (true) {
        manager->handleUSBEvents();
        manager->processIncomingData();
        manager->updateStatistics();
        
#ifdef CONFIG_IDF_TARGET_ESP32S3
        // Handle USB host events
        if (manager->usbHostImpl) {
            manager->usbHostImpl->handleEvents();
        }
#endif
        
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void USBOTGManager::processIncomingData() {
    if (!isConnected()) {
        return;
    }
    
#ifdef CONFIG_IDF_TARGET_ESP32S3
    if (usbHostImpl && usbHostImpl->isDeviceConnected()) {
        // Check for available data from USB host implementation
        size_t available = usbHostImpl->available();
        if (available > 0) {
            ESP_LOGD(TAG, "📥 USB OTG: %d bytes available for reading", available);
            
            if (dataCallback) {
                uint8_t tempBuffer[512];
                size_t readSize = min(available, sizeof(tempBuffer));
                size_t bytesRead = usbHostImpl->read(tempBuffer, readSize);
                
                if (bytesRead > 0) {
                    ESP_LOGD(TAG, "📨 USB OTG: Read %d bytes, calling data callback", bytesRead);
                    // Log data forwarding at debug level
                    ESP_LOGD(TAG, "📨 USB OTG: Read %d bytes, forwarding to DataRouter", bytesRead);
                    
                    // Log first few bytes for debugging (verbose level only)
                    if (esp_log_level_get(TAG) >= ESP_LOG_VERBOSE) {
                        ESP_LOGV(TAG, "Data: 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X",
                                 bytesRead > 0 ? tempBuffer[0] : 0,
                                 bytesRead > 1 ? tempBuffer[1] : 0,
                                 bytesRead > 2 ? tempBuffer[2] : 0,
                                 bytesRead > 3 ? tempBuffer[3] : 0,
                                 bytesRead > 4 ? tempBuffer[4] : 0,
                                 bytesRead > 5 ? tempBuffer[5] : 0,
                                 bytesRead > 6 ? tempBuffer[6] : 0,
                                 bytesRead > 7 ? tempBuffer[7] : 0);
                    }
                    
                    // Update statistics
                    if (xSemaphoreTake(rxMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                        stats.bytesReceived += bytesRead;
                        stats.packetsReceived++;
                        xSemaphoreGive(rxMutex);
                    }
                    
                    // Call data callback to forward to DataRouter
                    dataCallback(tempBuffer, bytesRead);
                    ESP_LOGD(TAG, "✅ USB OTG: Data callback completed");
                } else {
                    ESP_LOGW(TAG, "⚠️ USB OTG: Available data but read returned 0 bytes");
                    ESP_LOGD(TAG, "⚠️ USB OTG: Available data but read returned 0");
                }
            } else {
                ESP_LOGW(TAG, "⚠️ USB OTG: Data available but no callback registered!");
                ESP_LOGD(TAG, "⚠️ USB OTG: Data available but no callback registered!");
            }
        }
    }
#endif
    
    // For non-S3 chips or when USB host not available, nothing to process
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
        
        // Get VID/PID from USB Host implementation
        uint16_t detected_vid = manager->deviceInfo.vid;
        uint16_t detected_pid = manager->deviceInfo.pid;
        
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