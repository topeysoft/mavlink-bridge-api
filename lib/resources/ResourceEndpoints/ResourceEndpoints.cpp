#include "ResourceEndpoints.h"

ResourceEndpoints* ResourceEndpoints::instance = nullptr;

ResourceEndpoints::ResourceEndpoints()
    : server(nullptr), storage(nullptr), wsServer(nullptr), responseDoc(JSON_BUFFER_SIZE) {
    memset(responseBuffer, 0, sizeof(responseBuffer));
}

ResourceEndpoints::~ResourceEndpoints() {
}

ResourceEndpoints* ResourceEndpoints::getInstance() {
    if (instance == nullptr) {
        instance = new ResourceEndpoints();
    }
    return instance;
}

void ResourceEndpoints::begin(AsyncWebServer* webServer, WebSocketServer* websocketServer) {
    server = webServer;
    wsServer = websocketServer;
    storage = ResourceStorage::getInstance();

    registerRoutes();
    Serial.println("ResourceEndpoints::begin() - Endpoints registered");
}

void ResourceEndpoints::registerRoutes() {
    if (server == nullptr) {
        return;
    }

    // Zone endpoints
    server->on("/api/zones", HTTP_GET,
               [this](AsyncWebServerRequest* request) { handleListZones(request); });

    server->on("/api/zones", HTTP_POST,
               [](AsyncWebServerRequest* request) {},
               nullptr,
               [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
                   if (index == 0) {
                       handleCreateZone(request, data, len);
                   }
               });

    server->on("^\\/api\\/zones\\/([a-zA-Z0-9\\-]+)$", HTTP_GET,
               [this](AsyncWebServerRequest* request) { handleGetZone(request); });

    server->on("^\\/api\\/zones\\/([a-zA-Z0-9\\-]+)$", HTTP_PUT,
               [](AsyncWebServerRequest* request) {},
               nullptr,
               [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
                   if (index == 0) {
                       handleUpdateZone(request, data, len);
                   }
               });

    server->on("^\\/api\\/zones\\/([a-zA-Z0-9\\-]+)$", HTTP_DELETE,
               [this](AsyncWebServerRequest* request) { handleDeleteZone(request); });

    // Mission endpoints
    server->on("/api/missions", HTTP_GET,
               [this](AsyncWebServerRequest* request) { handleListMissions(request); });

    server->on("/api/missions", HTTP_POST,
               [](AsyncWebServerRequest* request) {},
               nullptr,
               [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
                   if (index == 0) {
                       handleCreateMission(request, data, len);
                   }
               });

    server->on("^\\/api\\/missions\\/([a-zA-Z0-9\\-]+)$", HTTP_GET,
               [this](AsyncWebServerRequest* request) { handleGetMission(request); });

    server->on("^\\/api\\/missions\\/([a-zA-Z0-9\\-]+)$", HTTP_PUT,
               [](AsyncWebServerRequest* request) {},
               nullptr,
               [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
                   if (index == 0) {
                       handleUpdateMission(request, data, len);
                   }
               });

    server->on("^\\/api\\/missions\\/([a-zA-Z0-9\\-]+)$", HTTP_DELETE,
               [this](AsyncWebServerRequest* request) { handleDeleteMission(request); });

    // Sync endpoint
    server->on("/api/resources/sync", HTTP_GET,
               [this](AsyncWebServerRequest* request) { handleGetSyncMetadata(request); });
}

// Helper methods

void ResourceEndpoints::sendJsonResponse(AsyncWebServerRequest* request, int code,
                                         const JsonDocument& doc) {
    size_t len = serializeJson(doc, responseBuffer, sizeof(responseBuffer));
    AsyncWebServerResponse* response = request->beginResponse(code, "application/json", responseBuffer);
    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    request->send(response);
}

void ResourceEndpoints::sendError(AsyncWebServerRequest* request, int code,
                                  const char* message) {
    responseDoc.clear();
    responseDoc["error"] = message;
    sendJsonResponse(request, code, responseDoc);
}

bool ResourceEndpoints::parseJsonBody(AsyncWebServerRequest* request, uint8_t* data,
                                      size_t len, JsonDocument& doc) {
    DeserializationError error = deserializeJson(doc, data, len);
    if (error) {
        sendError(request, 400, "Invalid JSON");
        return false;
    }
    return true;
}

void ResourceEndpoints::broadcastResourceChange(const char* eventType, ResourceType type,
                                                const char* id, const JsonDocument& data) {
    if (wsServer == nullptr) {
        return;
    }

    responseDoc.clear();
    JsonObject payload = responseDoc.to<JsonObject>();
    payload["id"] = id;
    payload["type"] = static_cast<int>(type);
    payload["data"] = data.as<JsonObjectConst>();
    payload["timestamp"] = esp_timer_get_time();

    // Determine WebSocket event type based on event name
    WebSocketEventType wsEventType;
    String eventStr(eventType);

    if (eventStr == "zone:created") wsEventType = WebSocketEventType::ZONE_CREATED;
    else if (eventStr == "zone:updated") wsEventType = WebSocketEventType::ZONE_UPDATED;
    else if (eventStr == "zone:deleted") wsEventType = WebSocketEventType::ZONE_DELETED;
    else if (eventStr == "mission:created") wsEventType = WebSocketEventType::MISSION_CREATED;
    else if (eventStr == "mission:updated") wsEventType = WebSocketEventType::MISSION_UPDATED;
    else if (eventStr == "mission:deleted") wsEventType = WebSocketEventType::MISSION_DELETED;
    else wsEventType = WebSocketEventType::STATUS;

    // Broadcast to all WebSocket clients
    wsServer->broadcast(wsEventType, payload);
}

// Zone handlers

void ResourceEndpoints::handleListZones(AsyncWebServerRequest* request) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    // Check for 'since' parameter for incremental sync
    uint64_t since = 0;
    if (request->hasParam("since")) {
        since = request->getParam("since")->value().toInt();
    }

    std::vector<ResourceMetadata> zones = storage->listResources(ResourceType::ZONE, since);

    responseDoc.clear();
    JsonArray zonesArray = responseDoc.createNestedArray("zones");
    JsonArray deletedArray = responseDoc.createNestedArray("deleted");

    for (const auto& meta : zones) {
        JsonObject zoneObj = zonesArray.createNestedObject();
        zoneObj["id"] = meta.id;
        zoneObj["version"] = meta.version;
        zoneObj["timestamp"] = meta.timestamp;
        zoneObj["size"] = meta.size;
    }

    responseDoc["version"] = esp_timer_get_time();
    responseDoc["count"] = zones.size();

    sendJsonResponse(request, 200, responseDoc);
}

void ResourceEndpoints::handleGetZone(AsyncWebServerRequest* request) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    String id = request->pathArg(0);

    char buffer[4096];
    size_t bufferSize = sizeof(buffer);
    ResourceResult result = storage->readResource(ResourceType::ZONE, id.c_str(),
                                                   buffer, bufferSize);

    if (result == ResourceResult::NOT_FOUND) {
        sendError(request, 404, "Zone not found");
        return;
    } else if (result != ResourceResult::SUCCESS) {
        sendError(request, 500, "Failed to read zone");
        return;
    }

    AsyncWebServerResponse* response = request->beginResponse(200, "application/json", buffer);
    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    request->send(response);
}

void ResourceEndpoints::handleCreateZone(AsyncWebServerRequest* request, uint8_t* data,
                                         size_t len) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    DynamicJsonDocument doc(4096);
    if (!parseJsonBody(request, data, len, doc)) {
        return;
    }

    const char* id = doc["id"];
    if (id == nullptr || strlen(id) == 0) {
        sendError(request, 400, "Missing zone ID");
        return;
    }

    // Serialize the document to string for storage
    String jsonStr;
    serializeJson(doc, jsonStr);

    ResourceResult result = storage->queueWrite(ResourceType::ZONE, id,
                                                jsonStr.c_str(), jsonStr.length());

    if (result == ResourceResult::QUEUE_FULL) {
        sendError(request, 503, "Write queue full, try again");
        return;
    } else if (result != ResourceResult::SUCCESS) {
        sendError(request, 500, "Failed to queue zone write");
        return;
    }

    // Broadcast change
    broadcastResourceChange("zone:created", ResourceType::ZONE, id, doc);

    responseDoc.clear();
    responseDoc["id"] = id;
    responseDoc["status"] = "queued";
    sendJsonResponse(request, 202, responseDoc);
}

void ResourceEndpoints::handleUpdateZone(AsyncWebServerRequest* request, uint8_t* data,
                                         size_t len) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    String id = request->pathArg(0);

    // Check if zone exists
    if (storage->resourceExists(ResourceType::ZONE, id.c_str()) != ResourceResult::SUCCESS) {
        sendError(request, 404, "Zone not found");
        return;
    }

    DynamicJsonDocument doc(4096);
    if (!parseJsonBody(request, data, len, doc)) {
        return;
    }

    // Ensure ID matches
    doc["id"] = id;

    String jsonStr;
    serializeJson(doc, jsonStr);

    ResourceResult result = storage->queueWrite(ResourceType::ZONE, id.c_str(),
                                                jsonStr.c_str(), jsonStr.length());

    if (result != ResourceResult::SUCCESS) {
        sendError(request, 500, "Failed to queue zone update");
        return;
    }

    // Broadcast change
    broadcastResourceChange("zone:updated", ResourceType::ZONE, id.c_str(), doc);

    responseDoc.clear();
    responseDoc["id"] = id;
    responseDoc["status"] = "queued";
    sendJsonResponse(request, 202, responseDoc);
}

void ResourceEndpoints::handleDeleteZone(AsyncWebServerRequest* request) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    String id = request->pathArg(0);

    ResourceResult result = storage->deleteResource(ResourceType::ZONE, id.c_str());

    if (result == ResourceResult::NOT_FOUND) {
        sendError(request, 404, "Zone not found");
        return;
    } else if (result != ResourceResult::SUCCESS) {
        sendError(request, 500, "Failed to delete zone");
        return;
    }

    // Broadcast deletion
    responseDoc.clear();
    broadcastResourceChange("zone:deleted", ResourceType::ZONE, id.c_str(), responseDoc);

    responseDoc["id"] = id;
    responseDoc["status"] = "deleted";
    sendJsonResponse(request, 200, responseDoc);
}

// Mission handlers (similar pattern to zones)

void ResourceEndpoints::handleListMissions(AsyncWebServerRequest* request) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    uint64_t since = 0;
    if (request->hasParam("since")) {
        since = request->getParam("since")->value().toInt();
    }

    std::vector<ResourceMetadata> missions = storage->listResources(ResourceType::MISSION, since);

    responseDoc.clear();
    JsonArray missionsArray = responseDoc.createNestedArray("missions");

    for (const auto& meta : missions) {
        JsonObject missionObj = missionsArray.createNestedObject();
        missionObj["id"] = meta.id;
        missionObj["version"] = meta.version;
        missionObj["timestamp"] = meta.timestamp;
        missionObj["size"] = meta.size;
    }

    responseDoc["version"] = esp_timer_get_time();
    responseDoc["count"] = missions.size();

    sendJsonResponse(request, 200, responseDoc);
}

void ResourceEndpoints::handleGetMission(AsyncWebServerRequest* request) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    String id = request->pathArg(0);

    char buffer[4096];
    size_t bufferSize = sizeof(buffer);
    ResourceResult result = storage->readResource(ResourceType::MISSION, id.c_str(),
                                                   buffer, bufferSize);

    if (result == ResourceResult::NOT_FOUND) {
        sendError(request, 404, "Mission not found");
        return;
    } else if (result != ResourceResult::SUCCESS) {
        sendError(request, 500, "Failed to read mission");
        return;
    }

    AsyncWebServerResponse* response = request->beginResponse(200, "application/json", buffer);
    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    request->send(response);
}

void ResourceEndpoints::handleCreateMission(AsyncWebServerRequest* request, uint8_t* data,
                                            size_t len) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    DynamicJsonDocument doc(4096);
    if (!parseJsonBody(request, data, len, doc)) {
        return;
    }

    const char* id = doc["id"];
    if (id == nullptr || strlen(id) == 0) {
        sendError(request, 400, "Missing mission ID");
        return;
    }

    String jsonStr;
    serializeJson(doc, jsonStr);

    ResourceResult result = storage->queueWrite(ResourceType::MISSION, id,
                                                jsonStr.c_str(), jsonStr.length());

    if (result != ResourceResult::SUCCESS) {
        sendError(request, 500, "Failed to queue mission write");
        return;
    }

    broadcastResourceChange("mission:created", ResourceType::MISSION, id, doc);

    responseDoc.clear();
    responseDoc["id"] = id;
    responseDoc["status"] = "queued";
    sendJsonResponse(request, 202, responseDoc);
}

void ResourceEndpoints::handleUpdateMission(AsyncWebServerRequest* request, uint8_t* data,
                                            size_t len) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    String id = request->pathArg(0);

    if (storage->resourceExists(ResourceType::MISSION, id.c_str()) != ResourceResult::SUCCESS) {
        sendError(request, 404, "Mission not found");
        return;
    }

    DynamicJsonDocument doc(4096);
    if (!parseJsonBody(request, data, len, doc)) {
        return;
    }

    doc["id"] = id;

    String jsonStr;
    serializeJson(doc, jsonStr);

    ResourceResult result = storage->queueWrite(ResourceType::MISSION, id.c_str(),
                                                jsonStr.c_str(), jsonStr.length());

    if (result != ResourceResult::SUCCESS) {
        sendError(request, 500, "Failed to queue mission update");
        return;
    }

    broadcastResourceChange("mission:updated", ResourceType::MISSION, id.c_str(), doc);

    responseDoc.clear();
    responseDoc["id"] = id;
    responseDoc["status"] = "queued";
    sendJsonResponse(request, 202, responseDoc);
}

void ResourceEndpoints::handleDeleteMission(AsyncWebServerRequest* request) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    String id = request->pathArg(0);

    ResourceResult result = storage->deleteResource(ResourceType::MISSION, id.c_str());

    if (result == ResourceResult::NOT_FOUND) {
        sendError(request, 404, "Mission not found");
        return;
    } else if (result != ResourceResult::SUCCESS) {
        sendError(request, 500, "Failed to delete mission");
        return;
    }

    responseDoc.clear();
    broadcastResourceChange("mission:deleted", ResourceType::MISSION, id.c_str(), responseDoc);

    responseDoc["id"] = id;
    responseDoc["status"] = "deleted";
    sendJsonResponse(request, 200, responseDoc);
}

void ResourceEndpoints::handleGetSyncMetadata(AsyncWebServerRequest* request) {
    if (storage == nullptr) {
        sendError(request, 500, "Storage not initialized");
        return;
    }

    responseDoc.clear();

    // Get all zones and missions metadata
    std::vector<ResourceMetadata> zones = storage->listResources(ResourceType::ZONE);
    std::vector<ResourceMetadata> missions = storage->listResources(ResourceType::MISSION);

    responseDoc["zoneCount"] = zones.size();
    responseDoc["missionCount"] = missions.size();
    responseDoc["serverTime"] = esp_timer_get_time();

    ResourceStorage::StorageStats stats = storage->getStats();
    JsonObject statsObj = responseDoc.createNestedObject("stats");
    statsObj["totalWrites"] = stats.totalWrites;
    statsObj["totalReads"] = stats.totalReads;
    statsObj["queueDepth"] = stats.queuedWrites;
    statsObj["freeSpace"] = stats.freeSpace;
    statsObj["usedSpace"] = stats.usedSpace;

    sendJsonResponse(request, 200, responseDoc);
}
