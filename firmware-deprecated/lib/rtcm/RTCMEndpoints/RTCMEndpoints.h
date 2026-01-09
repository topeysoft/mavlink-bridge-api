#pragma once

#include <HttpServer/HttpServer.h>
#include <RTCMClient/RTCMClient.h>
#include <ConfigManager/ConfigManager.h>
#include <RTCMOutputRouter/RTCMOutputRouter.h>
#include <memory>

class RTCMEndpoints
{
public:
    static void registerRoutes(HttpServer *server, ConfigManager *configManager);

    // Get current RTCM client instance
    static RTCMClient *getCurrentClient();

    // Stop and cleanup current client
    static void stopCurrentClient();

    // Start RTCM client with config (can be called internally)
    static void handleStart(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res);

    // Start RTCM client without saving config (for auto-start from saved config)
    static bool startClient(const DynamicJsonDocument &config);

    // Output configuration endpoints
    static void handleGetOutputs(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res);
    static void handleUpdateOutputs(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res);
    static void handleToggleOutput(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res);

private:
    static void handleStop(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res);
    static void handleStatus(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res);
    static void handleConfig(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res);

    static std::unique_ptr<RTCMClient> createClient(const DynamicJsonDocument &config);
    static bool validateConfig(const DynamicJsonDocument &config, DynamicJsonDocument &errors);

    // Initialize output router from configuration
    static bool initializeOutputRouter();

    static std::unique_ptr<RTCMClient> currentClient;
    static std::unique_ptr<RTCMOutputRouter> outputRouter;
    static ConfigManager *configMgr;
    static SemaphoreHandle_t clientMutex;

    // Statistics tracking
    static uint32_t startTime;
    static bool isRunning;
};