#include "DataRouter.h"
#include "../../core/EventManager/EventManager.h"
#include <esp_log.h>

static const char* TAG = "DataRouter";

DataRouter* DataRouter::instance = nullptr;

DataRouter::DataRouter() : 
    activeInterface(NONE),
    preferredInterface(USB_OTG),
    mode(AUTO),
    mavlinkProcessor(nullptr),
    usbManager(nullptr),
    uartManager(nullptr),
    routerTask(nullptr),
    routerMutex(nullptr),
    upstreamQueue(nullptr),
    downstreamQueue(nullptr),
    mavlinkProcessingEnabled(true),
    initialized(false),
    lastHealthCheck(0) {
    
    memset(&stats, 0, sizeof(stats));
    memset(interfaceHealthCheck, 0, sizeof(interfaceHealthCheck));
}

DataRouter::~DataRouter() {
    end();
}

DataRouter* DataRouter::getInstance() {
    if (instance == nullptr) {
        instance = new DataRouter();
    }
    return instance;
}

bool DataRouter::begin(RoutingMode routingMode) {
    if (initialized) {
        ESP_LOGW(TAG, "Already initialized");
        return true;
    }
    
    ESP_LOGI(TAG, "Initializing Data Router with mode: %s", routingModeToString(routingMode));
    
    mode = routingMode;
    
    routerMutex = xSemaphoreCreateMutex();
    upstreamQueue = xQueueCreate(32, sizeof(DataPacket));
    downstreamQueue = xQueueCreate(32, sizeof(DataPacket));
    
    if (!routerMutex || !upstreamQueue || !downstreamQueue) {
        ESP_LOGE(TAG, "Failed to create synchronization objects");
        return false;
    }
    
    mavlinkProcessor = MAVLinkProcessor::getInstance();
    usbManager = USBOTGManager::getInstance();
    uartManager = UARTManager::getInstance();
    
    if (!mavlinkProcessor || !usbManager || !uartManager) {
        ESP_LOGE(TAG, "Failed to get manager instances");
        return false;
    }
    
    usbManager->onData([this](uint8_t* data, size_t length) {
        handleUSBData(data, length);
    });
    
    uartManager->onData([this](uint8_t* data, size_t length) {
        handleUARTData(data, length);
    });
    
    mavlinkProcessor->onMessage([this](const MAVLinkMessage& message) {
        handleMAVLinkMessage(message);
    });
    
    usbManager->onConnect([this]() {
        ESP_LOGI(TAG, "USB connected");
        if (mode == AUTO || mode == USB_PRIORITY) {
            switchInterface(USB_OTG);
        }
    });
    
    usbManager->onDisconnect([this]() {
        ESP_LOGI(TAG, "USB disconnected");
        if (activeInterface == USB_OTG) {
            if (mode == AUTO || mode == USB_PRIORITY) {
                switchInterface(UART);
            } else if (mode == USB_ONLY) {
                switchInterface(NONE);
            }
        }
    });
    
    uartManager->onConnect([this]() {
        ESP_LOGI(TAG, "UART connected");
        if (mode == UART_ONLY || (mode != USB_ONLY && !isInterfaceConnected(USB_OTG))) {
            switchInterface(UART);
        }
    });
    
    uartManager->onDisconnect([this]() {
        ESP_LOGI(TAG, "UART disconnected");
        if (activeInterface == UART) {
            if (mode == AUTO || mode == USB_PRIORITY) {
                switchInterface(USB_OTG);
            } else if (mode == UART_ONLY) {
                switchInterface(NONE);
            }
        }
    });
    
    xTaskCreate(
        routerTaskFunction,
        "data_router_task",
        8192,
        this,
        configMAX_PRIORITIES - 1,
        &routerTask
    );
    
    detectActiveInterface();
    
    // Start MAVLink stats logging every 10 seconds
    mavlinkProcessor->startStatsLogging(10000);
    
    initialized = true;
    stats.lastUpdateMs = millis();
    
    ESP_LOGI(TAG, "Data Router initialized successfully");
    return true;
}

void DataRouter::end() {
    if (!initialized) {
        return;
    }
    
    ESP_LOGI(TAG, "Shutting down Data Router");
    
    if (routerTask) {
        vTaskDelete(routerTask);
        routerTask = nullptr;
    }
    
    if (routerMutex) {
        vSemaphoreDelete(routerMutex);
        routerMutex = nullptr;
    }
    
    if (upstreamQueue) {
        vQueueDelete(upstreamQueue);
        upstreamQueue = nullptr;
    }
    
    if (downstreamQueue) {
        vQueueDelete(downstreamQueue);
        downstreamQueue = nullptr;
    }
    
    activeInterface = NONE;
    initialized = false;
    
    ESP_LOGI(TAG, "Data Router shutdown complete");
}

void DataRouter::setRoutingMode(RoutingMode newMode) {
    if (xSemaphoreTake(routerMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        RoutingMode oldMode = mode;
        mode = newMode;
        
        ESP_LOGI(TAG, "Routing mode changed from %s to %s", 
                 routingModeToString(oldMode), routingModeToString(newMode));
        
        detectActiveInterface();
        
        xSemaphoreGive(routerMutex);
    }
}

DataRouter::RoutingMode DataRouter::getRoutingMode() const {
    return mode;
}

DataRouter::Interface DataRouter::getActiveInterface() const {
    return activeInterface;
}

DataRouter::Interface DataRouter::getPreferredInterface() const {
    return preferredInterface;
}

bool DataRouter::switchInterface(Interface newInterface) {
    if (!validateInterface(newInterface)) {
        return false;
    }
    
    if (xSemaphoreTake(routerMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        return false;
    }
    
    Interface oldInterface = activeInterface;
    
    if (oldInterface != newInterface) {
        handleInterfaceSwitch(newInterface);
    }
    
    xSemaphoreGive(routerMutex);
    return true;
}

void DataRouter::routeUpstream(const uint8_t* data, size_t length) {
    if (!data || length == 0 || !initialized) {
        ESP_LOGW(TAG, "⚠️ DataRouter: Cannot route upstream - invalid parameters");
        Serial.printf("⚠️ DataRouter: Cannot route upstream - data=%p, length=%d, init=%s\n", 
                      data, length, initialized ? "true" : "false");
        return;
    }
    
    ESP_LOGI(TAG, "📤 DataRouter: Routing %d bytes upstream to processing queue", length);
    Serial.printf("📤 DataRouter: Queuing %d bytes for MAVLink processing\n", length);
    
    DataPacket packet;
    packet.length = min(length, sizeof(packet.data));
    memcpy(packet.data, data, packet.length);
    packet.source = activeInterface;
    packet.timestamp = millis();
    
    BaseType_t queueResult = xQueueSend(upstreamQueue, &packet, 0);
    if (queueResult != pdTRUE) {
        ESP_LOGW(TAG, "⚠️ Upstream queue full, dropping packet");
        Serial.printf("⚠️ DataRouter: Upstream queue full - packet dropped!\n");
    } else {
        ESP_LOGI(TAG, "✅ DataRouter: Packet queued successfully for processing");
        Serial.printf("✅ DataRouter: Packet queued for processing\n");
    }
}

void DataRouter::routeDownstream(const uint8_t* data, size_t length) {
    if (!data || length == 0 || !initialized) {
        return;
    }
    
    DataPacket packet;
    packet.length = min(length, sizeof(packet.data));
    memcpy(packet.data, data, packet.length);
    packet.source = NONE; 
    packet.timestamp = millis();
    
    if (xQueueSend(downstreamQueue, &packet, 0) != pdTRUE) {
        ESP_LOGW(TAG, "Downstream queue full, dropping packet");
    }
}

void DataRouter::enableMAVLinkProcessing(bool enable) {
    mavlinkProcessingEnabled = enable;
    ESP_LOGI(TAG, "MAVLink processing %s", enable ? "enabled" : "disabled");
}

bool DataRouter::isMAVLinkProcessingEnabled() const {
    return mavlinkProcessingEnabled;
}

void DataRouter::setMAVLinkFilter(const MAVLinkProcessor::Filter& filter) {
    if (mavlinkProcessor) {
        mavlinkProcessor->setMessageFilter(filter);
    }
}

DataRouter::RouteStats DataRouter::getStatistics() const {
    return stats;
}

void DataRouter::resetStatistics() {
    if (xSemaphoreTake(routerMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        memset(&stats, 0, sizeof(stats));
        stats.activeInterface = activeInterface;
        stats.lastUpdateMs = millis();
        xSemaphoreGive(routerMutex);
    }
}

void DataRouter::onInterfaceSwitch(std::function<void(Interface, Interface)> callback) {
    interfaceSwitchCallback = callback;
}

void DataRouter::onStatistics(std::function<void(const RouteStats&)> callback) {
    statsCallback = callback;
}

const char* DataRouter::interfaceToString(Interface iface) {
    switch (iface) {
        case NONE: return "none";
        case USB_OTG: return "usb_otg";
        case UART: return "uart";
        default: return "unknown";
    }
}

const char* DataRouter::routingModeToString(RoutingMode mode) {
    switch (mode) {
        case AUTO: return "auto";
        case USB_PRIORITY: return "usb_priority";
        case UART_ONLY: return "uart_only";
        case USB_ONLY: return "usb_only";
        default: return "unknown";
    }
}

void DataRouter::routerTaskFunction(void* parameter) {
    DataRouter* router = static_cast<DataRouter*>(parameter);
    
    ESP_LOGI(TAG, "Router task started");
    
    while (true) {
        router->processRouting();
        router->updateInterfaceHealth();
        router->updateStatistics();
        
        vTaskDelay(pdMS_TO_TICKS(5));
    }
}

void DataRouter::processRouting() {
    DataPacket packet;
    
    while (xQueueReceive(upstreamQueue, &packet, 0) == pdTRUE) {
        ESP_LOGI(TAG, "🔄 DataRouter: Processing upstream packet - %d bytes from %s", 
                 packet.length, interfaceToString(packet.source));
        Serial.printf("🔄 DataRouter: Processing %d bytes from %s\n", 
                      packet.length, interfaceToString(packet.source));
        
        if (mavlinkProcessingEnabled) {
            ESP_LOGI(TAG, "📡 DataRouter: Sending to MAVLink processor");
            Serial.printf("📡 DataRouter: Sending to MAVLink processor\n");
            
            // Log first few bytes for MAVLink debugging
            Serial.printf("   Data: ");
            for (int i = 0; i < min(8, (int)packet.length); i++) {
                Serial.printf("0x%02X ", packet.data[i]);
            }
            Serial.printf("\n");
            
            mavlinkProcessor->processData(packet.data, packet.length);
            ESP_LOGI(TAG, "✅ DataRouter: MAVLink processing completed");
        } else {
            ESP_LOGW(TAG, "⚠️ DataRouter: MAVLink processing disabled - skipping");
            Serial.printf("⚠️ DataRouter: MAVLink processing disabled\n");
        }
        
        stats.upstreamBytes += packet.length;
        stats.upstreamPackets++;
        
        DynamicJsonDocument payloadDoc(512);
        payloadDoc["interface"] = interfaceToString(activeInterface);
        payloadDoc["upstreamRate"] = stats.upstreamRate;
        payloadDoc["downstreamRate"] = stats.downstreamRate;
        payloadDoc["packetsReceived"] = (int)stats.upstreamPackets;
        payloadDoc["packetsSent"] = (int)stats.downstreamPackets;
        payloadDoc["bytesReceived"] = (int)stats.upstreamBytes;
        payloadDoc["bytesSent"] = (int)stats.downstreamBytes;
        EventManager::getInstance()->publish(EventType::COMMUNICATION_STATS, payloadDoc.as<JsonObjectConst>());
    }
    
    while (xQueueReceive(downstreamQueue, &packet, 0) == pdTRUE) {
        if (sendToInterface(activeInterface, packet.data, packet.length)) {
            stats.downstreamBytes += packet.length;
            stats.downstreamPackets++;
        }
    }
}

void DataRouter::detectActiveInterface() {
    Interface newInterface = NONE;
    
    switch (mode) {
        case AUTO:
        case USB_PRIORITY:
            if (isInterfaceConnected(USB_OTG)) {
                newInterface = USB_OTG;
            } else if (isInterfaceConnected(UART)) {
                newInterface = UART;
            }
            break;
            
        case UART_ONLY:
            if (isInterfaceConnected(UART)) {
                newInterface = UART;
            }
            break;
            
        case USB_ONLY:
            if (isInterfaceConnected(USB_OTG)) {
                newInterface = USB_OTG;
            }
            break;
    }
    
    if (newInterface != activeInterface) {
        switchInterface(newInterface);
    }
}

void DataRouter::handleInterfaceSwitch(Interface newInterface) {
    Interface oldInterface = activeInterface;
    activeInterface = newInterface;
    stats.interfaceSwitches++;
    stats.lastSwitchMs = millis();
    
    ESP_LOGI(TAG, "Interface switched from %s to %s", 
             interfaceToString(oldInterface), interfaceToString(newInterface));
    
    DynamicJsonDocument payloadDoc(256);
    payloadDoc["from"] = interfaceToString(oldInterface);
    payloadDoc["to"] = interfaceToString(newInterface);
    payloadDoc["reason"] = "auto_detect";
    EventManager::getInstance()->publish(EventType::INTERFACE_SWITCHED, payloadDoc.as<JsonObjectConst>());
    
    if (interfaceSwitchCallback) {
        interfaceSwitchCallback(oldInterface, newInterface);
    }
}

bool DataRouter::validateInterface(Interface iface) {
    switch (iface) {
        case NONE:
            return true;
        case USB_OTG:
            return (mode != UART_ONLY);
        case UART:
            return (mode != USB_ONLY);
        default:
            return false;
    }
}

void DataRouter::updateInterfaceHealth() {
    uint32_t now = millis();
    
    if (now - lastHealthCheck >= 5000) {
        interfaceHealthCheck[USB_OTG] = isInterfaceConnected(USB_OTG) ? now : 0;
        interfaceHealthCheck[UART] = isInterfaceConnected(UART) ? now : 0;
        lastHealthCheck = now;
        
        detectActiveInterface();
    }
}

void DataRouter::updateStatistics() {
    uint32_t now = millis();
    uint32_t elapsed = now - stats.lastUpdateMs;
    
    if (elapsed >= 1000) {
        float seconds = elapsed / 1000.0f;
        stats.upstreamRate = stats.upstreamBytes / seconds;
        stats.downstreamRate = stats.downstreamBytes / seconds;
        stats.activeInterface = activeInterface;
        stats.lastUpdateMs = now;
        
        if (statsCallback) {
            statsCallback(stats);
        }
    }
}

void DataRouter::handleUSBData(uint8_t* data, size_t length) {
    ESP_LOGI(TAG, "🔄 DataRouter: Received USB data - %d bytes", length);
    Serial.printf("🔄 DataRouter: Received USB data - %d bytes\n", length);
    Serial.printf("   Active interface: %s\n", interfaceToString(activeInterface));
    
    if (activeInterface == USB_OTG) {
        ESP_LOGI(TAG, "✅ DataRouter: Routing %d bytes upstream to MAVLink processor", length);
        Serial.printf("✅ DataRouter: Routing to MAVLink processor\n");
        
        // Log first few bytes for debugging
        Serial.printf("   Data: ");
        for (int i = 0; i < min(8, (int)length); i++) {
            Serial.printf("0x%02X ", data[i]);
        }
        Serial.printf("\n");
        
        routeUpstream(data, length);
    } else {
        ESP_LOGW(TAG, "⚠️ DataRouter: USB data received but interface not active (current: %s)", 
                 interfaceToString(activeInterface));
        Serial.printf("⚠️ DataRouter: USB data ignored - wrong interface (current: %s)\n", 
                      interfaceToString(activeInterface));
    }
}

void DataRouter::handleUARTData(uint8_t* data, size_t length) {
    if (activeInterface == UART) {
        routeUpstream(data, length);
    }
}

void DataRouter::handleMAVLinkMessage(const MAVLinkMessage& message) {
    ESP_LOGD(TAG, "MAVLink message: ID=%lu, SYS=%d, COMP=%d", 
             message.msgid, message.sysid, message.compid);
}

bool DataRouter::sendToInterface(Interface iface, const uint8_t* data, size_t length) {
    switch (iface) {
        case USB_OTG:
            return usbManager && usbManager->write(data, length) == length;
        case UART:
            return uartManager && uartManager->write(data, length) == length;
        default:
            return false;
    }
}

size_t DataRouter::readFromInterface(Interface iface, uint8_t* buffer, size_t maxLength) {
    switch (iface) {
        case USB_OTG:
            return usbManager ? usbManager->read(buffer, maxLength) : 0;
        case UART:
            return uartManager ? uartManager->read(buffer, maxLength) : 0;
        default:
            return 0;
    }
}

bool DataRouter::isInterfaceConnected(Interface iface) {
    switch (iface) {
        case USB_OTG:
            return usbManager && usbManager->isConnected();
        case UART:
            return uartManager && uartManager->isConnected();
        case NONE:
            return false;
        default:
            return false;
    }
}