#pragma once

#include <Arduino.h>
#include "../HttpServer/HttpServer.h"
#include "../ConfigManager/ConfigManager.h"
#include "../JsonPatch/JsonPatch.h"
#include "../EventManager/EventManager.h"

class ConfigEndpoints {
private:
    static ConfigManager* configManager;
    static EventManager* eventManager;
    static const size_t RESPONSE_BUFFER_SIZE = 2048;
    
    static void handleGetConfig(const HttpRequest& req, HttpResponse& res);
    static void handlePostConfig(const HttpRequest& req, HttpResponse& res);
    static void handlePatchConfig(const HttpRequest& req, HttpResponse& res);
    
    static void sendErrorResponse(HttpResponse& res, int statusCode, const String& message);
    static void sendSuccessResponse(HttpResponse& res, const String& data = "");
    static bool validateContentType(const HttpRequest& req, const String& expectedType);
    static bool parseJsonFromRequest(const HttpRequest& req, DynamicJsonDocument& doc);
    static uint32_t extractVersionFromHeaders(const HttpRequest& req);
    static void setVersionHeaders(HttpResponse& res, uint32_t version);
    
public:
    static void registerRoutes(HttpServer* server);
    static void initialize();
};