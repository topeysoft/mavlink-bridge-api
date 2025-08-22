#pragma once

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include "../DataRouter/DataRouter.h"
#include "../USBOTGManager/USBOTGManager.h"
#include "../UARTManager/UARTManager.h"
#include "../../mavlink/MAVLinkProcessor/MAVLinkProcessor.h"

class CommunicationEndpoints {
public:
    static void setupEndpoints(AsyncWebServer& server);
    
private:
    static void handleGetStatus(AsyncWebServerRequest* request);
    static void handleGetStatistics(AsyncWebServerRequest* request);
    static void handleGetConfiguration(AsyncWebServerRequest* request);
    static void handleUpdateConfiguration(AsyncWebServerRequest* request);
    
    static void handleSetRoutingMode(AsyncWebServerRequest* request);
    static void handleSwitchInterface(AsyncWebServerRequest* request);
    static void handleGetAvailableInterfaces(AsyncWebServerRequest* request);
    static void handleDetectInterfaces(AsyncWebServerRequest* request);
    static void handleTestInterface(AsyncWebServerRequest* request);
    static void handleGetInterfaceHealth(AsyncWebServerRequest* request);
    
    static void handleSetMAVLinkProcessing(AsyncWebServerRequest* request);
    static void handleGetMAVLinkFilter(AsyncWebServerRequest* request);
    static void handleSetMAVLinkFilter(AsyncWebServerRequest* request);
    static void handleClearMAVLinkFilter(AsyncWebServerRequest* request);
    static void handleSendMAVLinkCommand(AsyncWebServerRequest* request);
    
    // Parameter management endpoints
    static void handleParameterStream(AsyncWebServerRequest* request);
    static void handleRequestParameters(AsyncWebServerRequest* request);
    static void handleSetParameter(AsyncWebServerRequest* request);
    static void handleRequestParameterList(AsyncWebServerRequest* request);
    
    static void handleSendData(AsyncWebServerRequest* request);
    static void handleResetStatistics(AsyncWebServerRequest* request);
    static void handleRestart(AsyncWebServerRequest* request);
    
    static void handleGetUSBStats(AsyncWebServerRequest* request);
    static void handleGetUSBDevices(AsyncWebServerRequest* request);
    static void handleGetUARTStats(AsyncWebServerRequest* request);
    static void handleGetMAVLinkStats(AsyncWebServerRequest* request);
    
    static JsonObject buildStatusJson(DynamicJsonDocument& doc);
    static JsonObject buildStatisticsJson(DynamicJsonDocument& doc);
    static JsonObject buildConfigurationJson(DynamicJsonDocument& doc);
    static JsonArray buildInterfacesArray(DynamicJsonDocument& doc);
    
    static const char* interfaceToString(DataRouter::Interface iface);
    static const char* routingModeToString(DataRouter::RoutingMode mode);
    static DataRouter::Interface stringToInterface(const String& str);
    static DataRouter::RoutingMode stringToRoutingMode(const String& str);
    
    static bool validateJsonRequest(AsyncWebServerRequest* request, DynamicJsonDocument& doc);
    static void sendJsonResponse(AsyncWebServerRequest* request, const DynamicJsonDocument& doc, int statusCode = 200);
    static void sendErrorResponse(AsyncWebServerRequest* request, const String& message, int statusCode = 400);
};