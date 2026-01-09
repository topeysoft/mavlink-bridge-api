#pragma once

#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include "../../core/ResourceStorage/ResourceStorage.h"
#include "../../network/WebSocketServer/WebSocketServer.h"

class ResourceEndpoints {
private:
    static ResourceEndpoints* instance;
    AsyncWebServer* server;
    ResourceStorage* storage;
    WebSocketServer* wsServer;

    static const size_t JSON_BUFFER_SIZE = 4096;
    DynamicJsonDocument responseDoc;
    char responseBuffer[JSON_BUFFER_SIZE];

    // Helper methods
    void sendJsonResponse(AsyncWebServerRequest* request, int code, const JsonDocument& doc);
    void sendError(AsyncWebServerRequest* request, int code, const char* message);
    bool parseJsonBody(AsyncWebServerRequest* request, uint8_t* data, size_t len,
                       JsonDocument& doc);
    void broadcastResourceChange(const char* eventType, ResourceType type,
                                  const char* id, const JsonDocument& data);

    // Zone handlers
    void handleListZones(AsyncWebServerRequest* request);
    void handleGetZone(AsyncWebServerRequest* request);
    void handleCreateZone(AsyncWebServerRequest* request, uint8_t* data, size_t len);
    void handleUpdateZone(AsyncWebServerRequest* request, uint8_t* data, size_t len);
    void handleDeleteZone(AsyncWebServerRequest* request);

    // Mission handlers
    void handleListMissions(AsyncWebServerRequest* request);
    void handleGetMission(AsyncWebServerRequest* request);
    void handleCreateMission(AsyncWebServerRequest* request, uint8_t* data, size_t len);
    void handleUpdateMission(AsyncWebServerRequest* request, uint8_t* data, size_t len);
    void handleDeleteMission(AsyncWebServerRequest* request);

    // Sync handlers
    void handleGetSyncMetadata(AsyncWebServerRequest* request);

public:
    ResourceEndpoints();
    ~ResourceEndpoints();

    static ResourceEndpoints* getInstance();
    void begin(AsyncWebServer* webServer, WebSocketServer* websocketServer);
    void registerRoutes();

    void setStorage(ResourceStorage* resourceStorage) { storage = resourceStorage; }
};
