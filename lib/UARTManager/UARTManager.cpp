#include "UARTManager.h"
#include "EventManager.h"
#include <esp_log.h>
#include <driver/uart.h>

static const char* TAG = "UARTManager";

const UARTManager::BaudRate UARTManager::SUPPORTED_BAUDS[] = {
    BAUD_57600,
    BAUD_115200,
    BAUD_230400,
    BAUD_460800,
    BAUD_921600
};

const size_t UARTManager::SUPPORTED_BAUDS_COUNT = sizeof(SUPPORTED_BAUDS) / sizeof(SUPPORTED_BAUDS[0]);

UARTManager* UARTManager::instance = nullptr;

UARTManager::UARTManager() : 
    rxBufferPos(0),
    txBufferPos(0),
    uartTask(nullptr),
    txMutex(nullptr),
    rxMutex(nullptr),
    connected(false),
    initialized(false),
    serial(nullptr) {
    
    memset(&config, 0, sizeof(config));
    memset(&stats, 0, sizeof(stats));
    memset(rxBuffer, 0, sizeof(rxBuffer));
    memset(txBuffer, 0, sizeof(txBuffer));
}

UARTManager::~UARTManager() {
    end();
}

UARTManager* UARTManager::getInstance() {
    if (instance == nullptr) {
        instance = new UARTManager();
    }
    return instance;
}

bool UARTManager::begin(const Config& cfg) {
    if (initialized) {
        ESP_LOGW(TAG, "Already initialized");
        return true;
    }
    
    ESP_LOGI(TAG, "Initializing UART on pins RX:%d TX:%d at %d baud", 
             cfg.rxPin, cfg.txPin, cfg.baudRate);
    
    config = cfg;
    
    txMutex = xSemaphoreCreateMutex();
    rxMutex = xSemaphoreCreateMutex();
    
    if (!txMutex || !rxMutex) {
        ESP_LOGE(TAG, "Failed to create mutexes");
        return false;
    }
    
    serial = new HardwareSerial(config.uartNum);
    
    serial->begin(config.baudRate, SERIAL_8N1, config.rxPin, config.txPin);
    
    if (config.flowControl && config.rtsPin != 255 && config.ctsPin != 255) {
        uart_set_hw_flow_ctrl((uart_port_t)config.uartNum, UART_HW_FLOWCTRL_CTS_RTS, 122);
        uart_set_pin((uart_port_t)config.uartNum, config.txPin, config.rxPin, 
                     config.rtsPin, config.ctsPin);
    }
    
    xTaskCreate(
        uartTaskFunction,
        "uart_task",
        4096,
        this,
        configMAX_PRIORITIES - 3,
        &uartTask
    );
    
    if (config.autoBaud) {
        BaudRate detectedBaud = detectBaudRate();
        if (detectedBaud != config.baudRate) {
            ESP_LOGI(TAG, "Auto-detected baud rate: %d", detectedBaud);
            setBaudRate(detectedBaud);
        }
    }
    
    initialized = true;
    stats.lastUpdateMs = millis();
    
    ESP_LOGI(TAG, "UART initialized successfully");
    return true;
}

void UARTManager::end() {
    if (!initialized) {
        return;
    }
    
    ESP_LOGI(TAG, "Shutting down UART");
    
    if (uartTask) {
        vTaskDelete(uartTask);
        uartTask = nullptr;
    }
    
    if (serial) {
        serial->end();
        delete serial;
        serial = nullptr;
    }
    
    if (txMutex) {
        vSemaphoreDelete(txMutex);
        txMutex = nullptr;
    }
    
    if (rxMutex) {
        vSemaphoreDelete(rxMutex);
        rxMutex = nullptr;
    }
    
    initialized = false;
    connected = false;
    
    ESP_LOGI(TAG, "UART shutdown complete");
}

UARTManager::BaudRate UARTManager::detectBaudRate() {
    if (!serial) {
        return config.baudRate;
    }
    
    ESP_LOGI(TAG, "Starting baud rate detection");
    
    for (size_t i = 0; i < SUPPORTED_BAUDS_COUNT; i++) {
        BaudRate testBaud = SUPPORTED_BAUDS[i];
        ESP_LOGD(TAG, "Testing baud rate: %d", testBaud);
        
        if (testBaudRate(testBaud)) {
            ESP_LOGI(TAG, "Detected baud rate: %d", testBaud);
            return testBaud;
        }
    }
    
    ESP_LOGW(TAG, "Could not detect baud rate, using default: %d", config.baudRate);
    return config.baudRate;
}

bool UARTManager::setBaudRate(BaudRate baud) {
    if (!serial) {
        return false;
    }
    
    ESP_LOGI(TAG, "Setting baud rate to: %d", baud);
    
    serial->updateBaudRate(baud);
    config.baudRate = baud;
    
    vTaskDelay(pdMS_TO_TICKS(100));
    
    return true;
}

UARTManager::BaudRate UARTManager::getCurrentBaudRate() const {
    return config.baudRate;
}

size_t UARTManager::write(const uint8_t* data, size_t length) {
    if (!isConnected() || !data || length == 0) {
        return 0;
    }
    
    if (xSemaphoreTake(txMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        return 0;
    }
    
    size_t written = serial->write(data, length);
    
    if (written > 0) {
        stats.bytesSent += written;
        stats.packetsSent++;
    }
    
    xSemaphoreGive(txMutex);
    return written;
}

size_t UARTManager::read(uint8_t* buffer, size_t length) {
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

size_t UARTManager::available() {
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

void UARTManager::flush() {
    if (serial) {
        serial->flush();
    }
}

bool UARTManager::detectMAVLink() {
    if (!serial || !serial->available()) {
        return false;
    }
    
    uint8_t testBuffer[64];
    size_t bytesRead = 0;
    uint32_t startTime = millis();
    
    while (millis() - startTime < 2000 && bytesRead < sizeof(testBuffer)) {
        if (serial->available()) {
            testBuffer[bytesRead++] = serial->read();
        } else {
            vTaskDelay(pdMS_TO_TICKS(10));
        }
    }
    
    return validateMAVLinkFrame(testBuffer, bytesRead);
}

bool UARTManager::isConnected() const {
    return connected && initialized;
}

UARTManager::Statistics UARTManager::getStatistics() const {
    return stats;
}

void UARTManager::resetStatistics() {
    if (xSemaphoreTake(txMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        memset(&stats, 0, sizeof(stats));
        stats.lastUpdateMs = millis();
        xSemaphoreGive(txMutex);
    }
}

void UARTManager::onConnect(std::function<void()> callback) {
    connectCallback = callback;
}

void UARTManager::onDisconnect(std::function<void()> callback) {
    disconnectCallback = callback;
}

void UARTManager::onData(std::function<void(uint8_t*, size_t)> callback) {
    dataCallback = callback;
}

void UARTManager::uartTaskFunction(void* parameter) {
    UARTManager* manager = static_cast<UARTManager*>(parameter);
    
    ESP_LOGI(TAG, "UART task started");
    
    while (true) {
        manager->processIncomingData();
        manager->updateStatistics();
        
        bool currentlyConnected = manager->serial && manager->serial->available() >= 0;
        if (currentlyConnected != manager->connected) {
            manager->handleConnectionChange(currentlyConnected);
        }
        
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void UARTManager::processIncomingData() {
    if (!serial || !serial->available()) {
        return;
    }
    
    if (xSemaphoreTake(rxMutex, pdMS_TO_TICKS(10)) != pdTRUE) {
        return;
    }
    
    size_t available_space = sizeof(rxBuffer) - rxBufferPos;
    if (available_space > 0) {
        size_t bytes_to_read = min(available_space, (size_t)serial->available());
        
        for (size_t i = 0; i < bytes_to_read; i++) {
            if (serial->available()) {
                rxBuffer[rxBufferPos++] = serial->read();
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
}

void UARTManager::updateStatistics() {
    uint32_t now = millis();
    uint32_t elapsed = now - stats.lastUpdateMs;
    
    if (elapsed >= 1000) {
        float seconds = elapsed / 1000.0f;
        stats.dataRate = (stats.bytesReceived + stats.bytesSent) / seconds;
        stats.lastUpdateMs = now;
    }
}

bool UARTManager::testBaudRate(BaudRate baud) {
    setBaudRate(baud);
    
    vTaskDelay(pdMS_TO_TICKS(500));
    
    return detectMAVLink();
}

bool UARTManager::validateMAVLinkFrame(const uint8_t* data, size_t length) {
    if (!data || length < 8) {
        return false;
    }
    
    for (size_t i = 0; i < length - 7; i++) {
        if (data[i] == 0xFE || data[i] == 0xFD) {
            if (i + 6 < length) {
                uint8_t payload_len = data[i + 1];
                if (payload_len <= 255 && i + 6 + payload_len < length) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

void UARTManager::handleConnectionChange(bool newConnected) {
    if (newConnected != connected) {
        connected = newConnected;
        
        if (connected) {
            ESP_LOGI(TAG, "UART connected");
            
            bool mavlinkDetected = detectMAVLink();
            
            DynamicJsonDocument payloadDoc(256);
            payloadDoc["interface"] = "uart";
            payloadDoc["baudrate"] = (int)config.baudRate;
            payloadDoc["mavlink_detected"] = mavlinkDetected;
            EventManager::getInstance()->publish(EventType::UART_CONNECTED, payloadDoc.as<JsonObjectConst>());
            
            if (connectCallback) {
                connectCallback();
            }
        } else {
            ESP_LOGI(TAG, "UART disconnected");
            
            DynamicJsonDocument payloadDoc(256);
            payloadDoc["interface"] = "uart";
            EventManager::getInstance()->publish(EventType::UART_DISCONNECTED, payloadDoc.as<JsonObjectConst>());
            
            if (disconnectCallback) {
                disconnectCallback();
            }
        }
    }
}