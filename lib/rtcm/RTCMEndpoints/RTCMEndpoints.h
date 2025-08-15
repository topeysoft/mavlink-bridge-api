#pragma once

#include "../../network/HttpServer/HttpServer.h"
#include "../RTCMClient/RTCMClient.h"
#include "../../core/ConfigManager/ConfigManager.h"
#include <memory>

class RTCMEndpoints {
public:
    static void registerRoutes(HttpServer* server, ConfigManager* configManager);
    
    // Get current RTCM client instance
    static RTCMClient* getCurrentClient();
    
    // Stop and cleanup current client
    static void stopCurrentClient();

private:
    static void handleStart(HttpRequest& req, HttpResponse& res);
    static void handleStop(HttpRequest& req, HttpResponse& res);
    static void handleStatus(HttpRequest& req, HttpResponse& res);
    static void handleConfig(HttpRequest& req, HttpResponse& res);
    
    static std::unique_ptr<RTCMClient> createClient(const JsonDocument& config);
    static bool validateConfig(const JsonDocument& config, JsonDocument& errors);
    
    static std::unique_ptr<RTCMClient> currentClient;
    static ConfigManager* configMgr;
    static SemaphoreHandle_t clientMutex;
    
    // Statistics tracking
    static uint32_t startTime;
    static bool isRunning;
};