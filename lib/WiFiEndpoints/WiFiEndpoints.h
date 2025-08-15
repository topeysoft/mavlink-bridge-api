#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include "../HttpServer/HttpServer.h"
#include "../WiFiManager/WiFiManager.h"

class WiFiEndpoints {
public:
    static void registerRoutes(HttpServer* server);

private:
    static void handleConnect(const HttpRequest& req, HttpResponse& res);
    static void handleDisconnect(const HttpRequest& req, HttpResponse& res);
    static void handleStatus(const HttpRequest& req, HttpResponse& res);
    static void handleScan(const HttpRequest& req, HttpResponse& res);
    static void handleAddNetwork(const HttpRequest& req, HttpResponse& res);
    static void handleRemoveNetwork(const HttpRequest& req, HttpResponse& res);
    static void handleGetNetworks(const HttpRequest& req, HttpResponse& res);

    // Public utility methods
    static String authModeToString(wifi_auth_mode_t authMode);
    static String stateToString(WiFiManager::State state);

private:
    // Helper methods
    static bool validateConnectRequest(const JsonObject& body, String& error);
    static bool validateNetworkRequest(const JsonObject& body, String& error);
    static void writeError(HttpResponse& res, int statusCode, const String& code, const String& message);
    static void writeSuccess(HttpResponse& res, const JsonObject& data = JsonObject());
};