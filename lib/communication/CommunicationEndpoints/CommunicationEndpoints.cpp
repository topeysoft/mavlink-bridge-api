#include "CommunicationEndpoints.h"
#include <esp_log.h>

static const char* TAG = "CommunicationEndpoints";

void CommunicationEndpoints::setupEndpoints(AsyncWebServer& server) {
    ESP_LOGI(TAG, "Setting up communication endpoints");
    
    // Declare all variables at the beginning to avoid goto issues
    size_t initialFreeHeap = ESP.getFreeHeap();
    size_t heapAfterStatus, heapAfterInterface, finalFreeHeap;
    
    ESP_LOGI(TAG, "Initial free heap: %zu bytes", initialFreeHeap);
    
    if (initialFreeHeap < 4096) {
        ESP_LOGE(TAG, "Insufficient memory for endpoint registration");
        return;
    }
    
    // Status and statistics endpoints (critical)
    ESP_LOGI(TAG, "Registering status endpoints...");
    server.on("/api/communication/status", HTTP_GET, handleGetStatus);
    server.on("/api/communication/statistics", HTTP_GET, handleGetStatistics);
    server.on("/api/communication/config", HTTP_GET, handleGetConfiguration);
    server.on("/api/communication/config", HTTP_PATCH, handleUpdateConfiguration);
    
    heapAfterStatus = ESP.getFreeHeap();
    ESP_LOGI(TAG, "After status endpoints, free heap: %zu bytes", heapAfterStatus);
    
    // Interface management endpoints
    if (ESP.getFreeHeap() < 2048) {
        ESP_LOGW(TAG, "Low memory, skipping interface endpoints");
        goto minimal_endpoints;
    }
    
    ESP_LOGI(TAG, "Registering interface management endpoints...");
    server.on("/api/communication/routing-mode", HTTP_POST, handleSetRoutingMode);
    server.on("/api/communication/interface", HTTP_POST, handleSwitchInterface);
    server.on("/api/communication/interfaces", HTTP_GET, handleGetAvailableInterfaces);
    server.on("/api/communication/detect", HTTP_POST, handleDetectInterfaces);
    server.on("/api/communication/test", HTTP_POST, handleTestInterface);
    server.on("/api/communication/health", HTTP_GET, handleGetInterfaceHealth);
    
    heapAfterInterface = ESP.getFreeHeap();
    ESP_LOGI(TAG, "After interface endpoints, free heap: %zu bytes", heapAfterInterface);
    
    // MAVLink endpoints
    if (ESP.getFreeHeap() < 1536) {
        ESP_LOGW(TAG, "Low memory, skipping MAVLink endpoints");
        goto minimal_endpoints;
    }
    
    ESP_LOGI(TAG, "Registering MAVLink endpoints...");
    server.on("/api/communication/mavlink/processing", HTTP_POST, handleSetMAVLinkProcessing);
    server.on("/api/communication/mavlink/filter", HTTP_GET, handleGetMAVLinkFilter);
    server.on("/api/communication/mavlink/filter", HTTP_POST, handleSetMAVLinkFilter);
    server.on("/api/communication/mavlink/filter", HTTP_DELETE, handleClearMAVLinkFilter);
    server.on("/api/mavlink/command", HTTP_POST, handleSendMAVLinkCommand);
    
    // Data and control endpoints
    if (ESP.getFreeHeap() < 1024) {
        ESP_LOGW(TAG, "Low memory, skipping data/control endpoints");
        goto minimal_endpoints;
    }
    
    ESP_LOGI(TAG, "Registering data and control endpoints...");
    server.on("/api/communication/send", HTTP_POST, handleSendData);
    server.on("/api/communication/statistics/reset", HTTP_POST, handleResetStatistics);
    server.on("/api/communication/restart", HTTP_POST, handleRestart);
    
    // Individual interface statistics
    ESP_LOGI(TAG, "Registering statistics endpoints...");
    server.on("/api/communication/usb/stats", HTTP_GET, handleGetUSBStats);
    server.on("/api/communication/usb/devices", HTTP_GET, handleGetUSBDevices);
    server.on("/api/communication/uart/stats", HTTP_GET, handleGetUARTStats);
    server.on("/api/communication/mavlink/stats", HTTP_GET, handleGetMAVLinkStats);
    
    ESP_LOGI(TAG, "All communication endpoints configured successfully");
    return;

minimal_endpoints:
    ESP_LOGW(TAG, "Operating with minimal endpoint set due to memory constraints");
    finalFreeHeap = ESP.getFreeHeap();
    ESP_LOGI(TAG, "Final free heap: %zu bytes", finalFreeHeap);
}

void CommunicationEndpoints::handleGetStatus(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    JsonObject status = buildStatusJson(doc);
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleGetStatistics(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    JsonObject stats = buildStatisticsJson(doc);
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleGetConfiguration(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    JsonObject config = buildConfigurationJson(doc);
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleUpdateConfiguration(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    if (!validateJsonRequest(request, doc)) {
        sendErrorResponse(request, "Invalid JSON in request body");
        return;
    }
    
    DataRouter* router = DataRouter::getInstance();
    
    if (doc.containsKey("routingMode")) {
        DataRouter::RoutingMode mode = stringToRoutingMode(doc["routingMode"]);
        router->setRoutingMode(mode);
    }
    
    if (doc.containsKey("mavlinkProcessing")) {
        bool enabled = doc["mavlinkProcessing"];
        router->enableMAVLinkProcessing(enabled);
    }
    
    if (doc.containsKey("mavlinkFilter")) {
        JsonObject filterObj = doc["mavlinkFilter"];
        MAVLinkProcessor::Filter filter;
        
        if (filterObj.containsKey("enableFilter")) {
            filter.enableFilter = filterObj["enableFilter"];
        }
        
        if (filterObj.containsKey("allowedMessageIds")) {
            JsonArray msgIds = filterObj["allowedMessageIds"];
            for (JsonVariant id : msgIds) {
                filter.allowedMessageIds.push_back(id.as<uint32_t>());
            }
        }
        
        if (filterObj.containsKey("allowedSystemIds")) {
            JsonArray sysIds = filterObj["allowedSystemIds"];
            for (JsonVariant id : sysIds) {
                filter.allowedSystemIds.push_back(id.as<uint8_t>());
            }
        }
        
        if (filterObj.containsKey("allowedComponentIds")) {
            JsonArray compIds = filterObj["allowedComponentIds"];
            for (JsonVariant id : compIds) {
                filter.allowedComponentIds.push_back(id.as<uint8_t>());
            }
        }
        
        router->setMAVLinkFilter(filter);
    }
    
    DynamicJsonDocument responseDoc(512);
    responseDoc["success"] = true;
    responseDoc["message"] = "Configuration updated successfully";
    sendJsonResponse(request, responseDoc);
}

void CommunicationEndpoints::handleSetRoutingMode(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    if (!validateJsonRequest(request, doc)) {
        sendErrorResponse(request, "Invalid JSON in request body");
        return;
    }
    
    if (!doc.containsKey("mode")) {
        sendErrorResponse(request, "Missing 'mode' parameter");
        return;
    }
    
    DataRouter::RoutingMode mode = stringToRoutingMode(doc["mode"]);
    DataRouter* router = DataRouter::getInstance();
    router->setRoutingMode(mode);
    
    DynamicJsonDocument responseDoc(512);
    responseDoc["success"] = true;
    responseDoc["mode"] = routingModeToString(mode);
    sendJsonResponse(request, responseDoc);
}

void CommunicationEndpoints::handleSwitchInterface(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    if (!validateJsonRequest(request, doc)) {
        sendErrorResponse(request, "Invalid JSON in request body");
        return;
    }
    
    if (!doc.containsKey("interface")) {
        sendErrorResponse(request, "Missing 'interface' parameter");
        return;
    }
    
    DataRouter::Interface iface = stringToInterface(doc["interface"]);
    DataRouter* router = DataRouter::getInstance();
    
    if (router->switchInterface(iface)) {
        DynamicJsonDocument responseDoc(512);
        responseDoc["success"] = true;
        responseDoc["interface"] = interfaceToString(iface);
        sendJsonResponse(request, responseDoc);
    } else {
        sendErrorResponse(request, "Failed to switch interface", 500);
    }
}

void CommunicationEndpoints::handleGetAvailableInterfaces(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    JsonArray interfaces = buildInterfacesArray(doc);
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleDetectInterfaces(AsyncWebServerRequest* request) {
    DataRouter* router = DataRouter::getInstance();
    USBOTGManager* usb = USBOTGManager::getInstance();
    UARTManager* uart = UARTManager::getInstance();
    
    DynamicJsonDocument doc(1024);
    JsonArray interfaces = doc["interfaces"].to<JsonArray>();
    
    if (usb && usb->isConnected()) {
        interfaces.add("usb_otg");
    }
    
    if (uart && uart->isConnected()) {
        interfaces.add("uart");
    }
    
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleTestInterface(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    if (!validateJsonRequest(request, doc)) {
        sendErrorResponse(request, "Invalid JSON in request body");
        return;
    }
    
    if (!doc.containsKey("interface")) {
        sendErrorResponse(request, "Missing 'interface' parameter");
        return;
    }
    
    DataRouter::Interface iface = stringToInterface(doc["interface"]);
    bool success = false;
    
    switch (iface) {
        case DataRouter::USB_OTG: {
            USBOTGManager* usb = USBOTGManager::getInstance();
            success = usb && usb->isConnected();
            break;
        }
        case DataRouter::UART: {
            UARTManager* uart = UARTManager::getInstance();
            success = uart && uart->isConnected();
            break;
        }
        default:
            success = false;
            break;
    }
    
    DynamicJsonDocument responseDoc(512);
    responseDoc["success"] = success;
    responseDoc["interface"] = interfaceToString(iface);
    sendJsonResponse(request, responseDoc);
}

void CommunicationEndpoints::handleGetInterfaceHealth(AsyncWebServerRequest* request) {
    USBOTGManager* usb = USBOTGManager::getInstance();
    UARTManager* uart = UARTManager::getInstance();
    
    DynamicJsonDocument doc(1024);
    doc["usb_otg"] = usb ? usb->isConnected() : false;
    doc["uart"] = uart ? uart->isConnected() : false;
    doc["none"] = true;
    
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleSetMAVLinkProcessing(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    if (!validateJsonRequest(request, doc)) {
        sendErrorResponse(request, "Invalid JSON in request body");
        return;
    }
    
    if (!doc.containsKey("enabled")) {
        sendErrorResponse(request, "Missing 'enabled' parameter");
        return;
    }
    
    bool enabled = doc["enabled"];
    DataRouter* router = DataRouter::getInstance();
    router->enableMAVLinkProcessing(enabled);
    
    DynamicJsonDocument responseDoc(512);
    responseDoc["success"] = true;
    responseDoc["enabled"] = enabled;
    sendJsonResponse(request, responseDoc);
}

void CommunicationEndpoints::handleGetMAVLinkFilter(AsyncWebServerRequest* request) {
    MAVLinkProcessor* processor = MAVLinkProcessor::getInstance();
    MAVLinkProcessor::Filter filter = processor->getMessageFilter();
    
    DynamicJsonDocument doc(1024);
    doc["enableFilter"] = filter.enableFilter;
    
    JsonArray msgIds = doc["allowedMessageIds"].to<JsonArray>();
    for (uint32_t id : filter.allowedMessageIds) {
        msgIds.add(id);
    }
    
    JsonArray sysIds = doc["allowedSystemIds"].to<JsonArray>();
    for (uint8_t id : filter.allowedSystemIds) {
        sysIds.add(id);
    }
    
    JsonArray compIds = doc["allowedComponentIds"].to<JsonArray>();
    for (uint8_t id : filter.allowedComponentIds) {
        compIds.add(id);
    }
    
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleSetMAVLinkFilter(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    if (!validateJsonRequest(request, doc)) {
        sendErrorResponse(request, "Invalid JSON in request body");
        return;
    }
    
    MAVLinkProcessor::Filter filter;
    
    if (doc.containsKey("enableFilter")) {
        filter.enableFilter = doc["enableFilter"];
    }
    
    if (doc.containsKey("allowedMessageIds")) {
        JsonArray msgIds = doc["allowedMessageIds"];
        for (JsonVariant id : msgIds) {
            filter.allowedMessageIds.push_back(id.as<uint32_t>());
        }
    }
    
    if (doc.containsKey("allowedSystemIds")) {
        JsonArray sysIds = doc["allowedSystemIds"];
        for (JsonVariant id : sysIds) {
            filter.allowedSystemIds.push_back(id.as<uint8_t>());
        }
    }
    
    if (doc.containsKey("allowedComponentIds")) {
        JsonArray compIds = doc["allowedComponentIds"];
        for (JsonVariant id : compIds) {
            filter.allowedComponentIds.push_back(id.as<uint8_t>());
        }
    }
    
    DataRouter* router = DataRouter::getInstance();
    router->setMAVLinkFilter(filter);
    
    DynamicJsonDocument responseDoc(512);
    responseDoc["success"] = true;
    responseDoc["message"] = "MAVLink filter updated";
    sendJsonResponse(request, responseDoc);
}

void CommunicationEndpoints::handleClearMAVLinkFilter(AsyncWebServerRequest* request) {
    MAVLinkProcessor* processor = MAVLinkProcessor::getInstance();
    processor->clearMessageFilter();
    
    DynamicJsonDocument doc(1024);
    doc["success"] = true;
    doc["message"] = "MAVLink filter cleared";
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleSendData(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    if (!validateJsonRequest(request, doc)) {
        sendErrorResponse(request, "Invalid JSON in request body");
        return;
    }
    
    if (!doc.containsKey("data")) {
        sendErrorResponse(request, "Missing 'data' parameter");
        return;
    }
    
    String data = doc["data"];
    DataRouter* router = DataRouter::getInstance();
    
    router->routeDownstream((uint8_t*)data.c_str(), data.length());
    
    DynamicJsonDocument responseDoc(512);
    responseDoc["success"] = true;
    responseDoc["bytesSent"] = data.length();
    sendJsonResponse(request, responseDoc);
}

void CommunicationEndpoints::handleResetStatistics(AsyncWebServerRequest* request) {
    DataRouter* router = DataRouter::getInstance();
    MAVLinkProcessor* processor = MAVLinkProcessor::getInstance();
    USBOTGManager* usb = USBOTGManager::getInstance();
    UARTManager* uart = UARTManager::getInstance();
    
    router->resetStatistics();
    processor->resetStatistics();
    if (usb) usb->resetStatistics();
    if (uart) uart->resetStatistics();
    
    DynamicJsonDocument doc(1024);
    doc["success"] = true;
    doc["message"] = "Statistics reset successfully";
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleRestart(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    doc["success"] = true;
    doc["message"] = "Communication system restart initiated";
    sendJsonResponse(request, doc);
    
    vTaskDelay(pdMS_TO_TICKS(100));
    
    DataRouter* router = DataRouter::getInstance();
    router->end();
    router->begin();
}

void CommunicationEndpoints::handleGetUSBStats(AsyncWebServerRequest* request) {
    USBOTGManager* usb = USBOTGManager::getInstance();
    
    DynamicJsonDocument doc(1024);
    if (usb) {
        USBOTGManager::Statistics stats = usb->getStatistics();
        doc["connected"] = usb->isConnected();
        doc["state"] = (int)usb->getState();
        doc["bytesReceived"] = stats.bytesReceived;
        doc["bytesSent"] = stats.bytesSent;
        doc["packetsReceived"] = stats.packetsReceived;
        doc["packetsSent"] = stats.packetsSent;
        doc["dataRate"] = stats.dataRate;
    } else {
        doc["error"] = "USB manager not available";
    }
    
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleGetUSBDevices(AsyncWebServerRequest* request) {
    USBOTGManager* usb = USBOTGManager::getInstance();
    
    DynamicJsonDocument doc(1024);
    if (usb) {
        USBOTGManager::DeviceInfo deviceInfo = usb->getDeviceInfo();
        
        JsonArray devices = doc["devices"].to<JsonArray>();
        
        if (usb->isConnected()) {
            JsonObject device = devices.createNestedObject();
            device["vid"] = deviceInfo.vid;
            device["pid"] = deviceInfo.pid;
            device["vendor"] = deviceInfo.vendor;
            device["product"] = deviceInfo.product;
            device["is_flight_controller"] = deviceInfo.isFlightController;
            device["is_identified"] = deviceInfo.isIdentified;
            device["state"] = (int)usb->getState();
            device["interface"] = "usb_otg";
        }
        
        doc["connected_count"] = usb->isConnected() ? 1 : 0;
        doc["manager_state"] = (int)usb->getState();
    } else {
        doc["error"] = "USB manager not available";
        doc["connected_count"] = 0;
        doc["devices"] = JsonArray();
    }
    
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleGetUARTStats(AsyncWebServerRequest* request) {
    UARTManager* uart = UARTManager::getInstance();
    
    DynamicJsonDocument doc(1024);
    if (uart) {
        UARTManager::Statistics stats = uart->getStatistics();
        doc["connected"] = uart->isConnected();
        doc["baudRate"] = (int)uart->getCurrentBaudRate();
        doc["bytesReceived"] = stats.bytesReceived;
        doc["bytesSent"] = stats.bytesSent;
        doc["packetsReceived"] = stats.packetsReceived;
        doc["packetsSent"] = stats.packetsSent;
        doc["dataRate"] = stats.dataRate;
        doc["crcErrors"] = stats.crcErrors;
        doc["framingErrors"] = stats.framingErrors;
    } else {
        doc["error"] = "UART manager not available";
    }
    
    sendJsonResponse(request, doc);
}

void CommunicationEndpoints::handleGetMAVLinkStats(AsyncWebServerRequest* request) {
    MAVLinkProcessor* processor = MAVLinkProcessor::getInstance();
    
    DynamicJsonDocument doc(1024);
    if (processor) {
        MAVLinkProcessor::MessageStats stats = processor->getStatistics();
        doc["totalMessages"] = stats.totalMessages;
        doc["crcErrors"] = stats.crcErrors;
        doc["parseErrors"] = stats.parseErrors;
        doc["sequenceErrors"] = stats.sequenceErrors;
        
        JsonObject messageTypes = doc["messageTypes"].to<JsonObject>();
        for (const auto& pair : stats.messageTypes) {
            messageTypes[String(pair.first)] = pair.second;
        }
    } else {
        doc["error"] = "MAVLink processor not available";
    }
    
    sendJsonResponse(request, doc);
}

JsonObject CommunicationEndpoints::buildStatusJson(DynamicJsonDocument& doc) {
    DataRouter* router = DataRouter::getInstance();
    
    JsonObject status = doc.to<JsonObject>();
    status["initialized"] = true;
    status["activeInterface"] = interfaceToString(router->getActiveInterface());
    status["routingMode"] = routingModeToString(router->getRoutingMode());
    status["lastActivity"] = millis();
    status["uptime"] = millis();
    
    JsonArray interfaces = status["interfacesAvailable"].to<JsonArray>();
    USBOTGManager* usb = USBOTGManager::getInstance();
    UARTManager* uart = UARTManager::getInstance();
    
    if (usb && usb->isConnected()) {
        interfaces.add("usb_otg");
    }
    if (uart && uart->isConnected()) {
        interfaces.add("uart");
    }
    
    return status;
}

JsonObject CommunicationEndpoints::buildStatisticsJson(DynamicJsonDocument& doc) {
    DataRouter* router = DataRouter::getInstance();
    DataRouter::RouteStats routeStats = router->getStatistics();
    
    JsonObject stats = doc.to<JsonObject>();
    stats["activeInterface"] = interfaceToString(routeStats.activeInterface);
    stats["routingMode"] = routingModeToString(router->getRoutingMode());
    
    JsonObject dataFlow = stats["dataFlow"].to<JsonObject>();
    dataFlow["interface"] = interfaceToString(routeStats.activeInterface);
    dataFlow["upstreamRate"] = routeStats.upstreamRate;
    dataFlow["downstreamRate"] = routeStats.downstreamRate;
    dataFlow["packetsReceived"] = routeStats.upstreamPackets;
    dataFlow["packetsSent"] = routeStats.downstreamPackets;
    dataFlow["bytesReceived"] = routeStats.upstreamBytes;
    dataFlow["bytesSent"] = routeStats.downstreamBytes;
    dataFlow["interfaceSwitches"] = routeStats.interfaceSwitches;
    dataFlow["lastSwitchMs"] = routeStats.lastSwitchMs;
    
    return stats;
}

JsonObject CommunicationEndpoints::buildConfigurationJson(DynamicJsonDocument& doc) {
    DataRouter* router = DataRouter::getInstance();
    
    JsonObject config = doc.to<JsonObject>();
    config["routingMode"] = routingModeToString(router->getRoutingMode());
    config["preferredInterface"] = interfaceToString(router->getActiveInterface());
    config["mavlinkProcessing"] = router->isMAVLinkProcessingEnabled();
    
    return config;
}

JsonArray CommunicationEndpoints::buildInterfacesArray(DynamicJsonDocument& doc) {
    JsonArray interfaces = doc["interfaces"].to<JsonArray>();
    
    USBOTGManager* usb = USBOTGManager::getInstance();
    UARTManager* uart = UARTManager::getInstance();
    
    if (usb && usb->isConnected()) {
        interfaces.add("usb_otg");
    }
    if (uart && uart->isConnected()) {
        interfaces.add("uart");
    }
    
    return interfaces;
}

const char* CommunicationEndpoints::interfaceToString(DataRouter::Interface iface) {
    return DataRouter::interfaceToString(iface);
}

const char* CommunicationEndpoints::routingModeToString(DataRouter::RoutingMode mode) {
    return DataRouter::routingModeToString(mode);
}

DataRouter::Interface CommunicationEndpoints::stringToInterface(const String& str) {
    if (str == "usb_otg") return DataRouter::USB_OTG;
    if (str == "uart") return DataRouter::UART;
    return DataRouter::NONE;
}

DataRouter::RoutingMode CommunicationEndpoints::stringToRoutingMode(const String& str) {
    if (str == "auto") return DataRouter::AUTO;
    if (str == "usb_priority") return DataRouter::USB_PRIORITY;
    if (str == "uart_only") return DataRouter::UART_ONLY;
    if (str == "usb_only") return DataRouter::USB_ONLY;
    return DataRouter::AUTO;
}

bool CommunicationEndpoints::validateJsonRequest(AsyncWebServerRequest* request, DynamicJsonDocument& doc) {
    if (!request->hasParam("plain", true)) {
        return false;
    }
    
    String body = request->getParam("plain", true)->value();
    DeserializationError error = deserializeJson(doc, body);
    
    return error == DeserializationError::Ok;
}

void CommunicationEndpoints::sendJsonResponse(AsyncWebServerRequest* request, const DynamicJsonDocument& doc, int statusCode) {
    String response;
    serializeJson(doc, response);
    request->send(statusCode, "application/json", response);
}

void CommunicationEndpoints::sendErrorResponse(AsyncWebServerRequest* request, const String& message, int statusCode) {
    DynamicJsonDocument doc(1024);
    doc["error"] = message;
    doc["success"] = false;
    sendJsonResponse(request, doc, statusCode);
}

void CommunicationEndpoints::handleSendMAVLinkCommand(AsyncWebServerRequest* request) {
    DynamicJsonDocument doc(1024);
    if (!validateJsonRequest(request, doc)) {
        sendErrorResponse(request, "Invalid JSON in request body");
        return;
    }
    
    if (!doc.containsKey("commandType")) {
        sendErrorResponse(request, "Missing 'commandType' parameter");
        return;
    }
    
    String commandType = doc["commandType"];
    uint8_t targetSystem = doc.containsKey("targetSystem") ? doc["targetSystem"].as<uint8_t>() : 1;
    uint8_t targetComponent = doc.containsKey("targetComponent") ? doc["targetComponent"].as<uint8_t>() : 1;
    
    mavlink_message_t message;
    bool validCommand = false;
    
    if (commandType == "arm") {
        message = MAVLinkProcessor::buildArmDisarmCommand(targetSystem, targetComponent, true);
        validCommand = true;
    }
    else if (commandType == "disarm") {
        message = MAVLinkProcessor::buildArmDisarmCommand(targetSystem, targetComponent, false);
        validCommand = true;
    }
    else if (commandType == "setMode") {
        if (!doc.containsKey("customMode")) {
            sendErrorResponse(request, "Missing 'customMode' parameter for setMode command");
            return;
        }
        uint32_t customMode = doc["customMode"];
        uint8_t baseMode = doc.containsKey("baseMode") ? doc["baseMode"].as<uint8_t>() : 0;
        message = MAVLinkProcessor::buildSetModeCommand(targetSystem, targetComponent, customMode, baseMode);
        validCommand = true;
    }
    else if (commandType == "commandLong") {
        if (!doc.containsKey("command")) {
            sendErrorResponse(request, "Missing 'command' parameter for commandLong");
            return;
        }
        uint16_t command = doc["command"];
        float param1 = doc.containsKey("param1") ? doc["param1"].as<float>() : 0.0f;
        float param2 = doc.containsKey("param2") ? doc["param2"].as<float>() : 0.0f;
        float param3 = doc.containsKey("param3") ? doc["param3"].as<float>() : 0.0f;
        float param4 = doc.containsKey("param4") ? doc["param4"].as<float>() : 0.0f;
        float param5 = doc.containsKey("param5") ? doc["param5"].as<float>() : 0.0f;
        float param6 = doc.containsKey("param6") ? doc["param6"].as<float>() : 0.0f;
        float param7 = doc.containsKey("param7") ? doc["param7"].as<float>() : 0.0f;
        
        message = MAVLinkProcessor::buildCommandLong(targetSystem, targetComponent, command,
                                                   param1, param2, param3, param4, param5, param6, param7);
        validCommand = true;
    }
    else if (commandType == "commandInt") {
        if (!doc.containsKey("command")) {
            sendErrorResponse(request, "Missing 'command' parameter for commandInt");
            return;
        }
        uint16_t command = doc["command"];
        uint8_t frame = doc.containsKey("frame") ? doc["frame"].as<uint8_t>() : 0;
        uint8_t current = doc.containsKey("current") ? doc["current"].as<uint8_t>() : 0;
        uint8_t autocontinue = doc.containsKey("autocontinue") ? doc["autocontinue"].as<uint8_t>() : 0;
        float param1 = doc.containsKey("param1") ? doc["param1"].as<float>() : 0.0f;
        float param2 = doc.containsKey("param2") ? doc["param2"].as<float>() : 0.0f;
        float param3 = doc.containsKey("param3") ? doc["param3"].as<float>() : 0.0f;
        float param4 = doc.containsKey("param4") ? doc["param4"].as<float>() : 0.0f;
        int32_t x = doc.containsKey("x") ? doc["x"].as<int32_t>() : 0;
        int32_t y = doc.containsKey("y") ? doc["y"].as<int32_t>() : 0;
        float z = doc.containsKey("z") ? doc["z"].as<float>() : 0.0f;
        
        message = MAVLinkProcessor::buildCommandInt(targetSystem, targetComponent, command, frame, current, autocontinue,
                                                  param1, param2, param3, param4, x, y, z);
        validCommand = true;
    }
    else if (commandType == "setPositionTarget") {
        uint32_t timeBootMs = doc.containsKey("timeBootMs") ? doc["timeBootMs"].as<uint32_t>() : millis();
        uint8_t coordinateFrame = doc.containsKey("coordinateFrame") ? doc["coordinateFrame"].as<uint8_t>() : 1;
        uint16_t typeMask = doc.containsKey("typeMask") ? doc["typeMask"].as<uint16_t>() : 0x0FF8;
        float x = doc.containsKey("x") ? doc["x"].as<float>() : 0.0f;
        float y = doc.containsKey("y") ? doc["y"].as<float>() : 0.0f;
        float z = doc.containsKey("z") ? doc["z"].as<float>() : 0.0f;
        float vx = doc.containsKey("vx") ? doc["vx"].as<float>() : 0.0f;
        float vy = doc.containsKey("vy") ? doc["vy"].as<float>() : 0.0f;
        float vz = doc.containsKey("vz") ? doc["vz"].as<float>() : 0.0f;
        float afx = doc.containsKey("afx") ? doc["afx"].as<float>() : 0.0f;
        float afy = doc.containsKey("afy") ? doc["afy"].as<float>() : 0.0f;
        float afz = doc.containsKey("afz") ? doc["afz"].as<float>() : 0.0f;
        float yaw = doc.containsKey("yaw") ? doc["yaw"].as<float>() : 0.0f;
        float yawRate = doc.containsKey("yawRate") ? doc["yawRate"].as<float>() : 0.0f;
        
        message = MAVLinkProcessor::buildSetPositionTargetLocalNed(targetSystem, targetComponent, timeBootMs, 
                                                                 coordinateFrame, typeMask, x, y, z, 
                                                                 vx, vy, vz, afx, afy, afz, yaw, yawRate);
        validCommand = true;
    }
    
    if (!validCommand) {
        sendErrorResponse(request, "Unknown command type: " + commandType);
        return;
    }
    
    uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
    size_t messageLength = MAVLinkProcessor::serializeMessage(message, buffer, sizeof(buffer));
    
    if (messageLength == 0) {
        sendErrorResponse(request, "Failed to serialize MAVLink message");
        return;
    }
    
    DataRouter* router = DataRouter::getInstance();
    router->routeDownstream(buffer, messageLength);
    
    DynamicJsonDocument responseDoc(512);
    responseDoc["success"] = true;
    responseDoc["commandType"] = commandType;
    responseDoc["targetSystem"] = targetSystem;
    responseDoc["targetComponent"] = targetComponent;
    responseDoc["messageId"] = (int)message.msgid;
    responseDoc["bytesSent"] = messageLength;
    sendJsonResponse(request, responseDoc);
}