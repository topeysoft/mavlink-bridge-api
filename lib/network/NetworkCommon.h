#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <functional>
#include <vector>

namespace NetworkLib {

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    AP_MODE,
    ERROR
};

enum class HttpMethod {
    GET,
    POST,
    PATCH,
    DELETE
};

enum class WebSocketEventType {
    STATUS,
    CONFIG_CHANGED,
    RTCM_DATA,
    ERROR_EVENT,
    LOG,
    MAVLINK_MESSAGE,
    // Resource sync events
    ZONE_CREATED,
    ZONE_UPDATED,
    ZONE_DELETED,
    MISSION_CREATED,
    MISSION_UPDATED,
    MISSION_DELETED
};


struct HttpRequest {
    String path;
    String body;
    void* request; // AsyncWebServerRequest* - using void* to avoid include dependency
};

struct HttpResponse {
    int statusCode = 200;
    String contentType = "application/json";
    String body = "";
    bool cors = true;
};

struct WebSocketMessage {
    WebSocketEventType type;
    DynamicJsonDocument payload;
    
    WebSocketMessage(size_t capacity = 256) : payload(capacity) {}
};

struct WebSocketClient {
    uint32_t id;
    void* client; // AsyncWebSocketClient* - using void* to avoid include dependency
    unsigned long lastPing;
    bool isAlive;
    
    WebSocketClient() : id(0), client(nullptr), lastPing(0), isAlive(false) {}
};

using RouteHandler = std::function<void(const HttpRequest&, HttpResponse&)>;
using MessageHandler = std::function<void(uint32_t clientId, const WebSocketMessage&)>;

static const uint8_t MAX_RECONNECT_ATTEMPTS = 6;
static const unsigned long SIGNAL_CHECK_INTERVAL = 30000; // 30 seconds
static const unsigned long CONNECTION_TIMEOUT = 10000; // 10 seconds
static const uint32_t PING_INTERVAL = 10000;
static const uint32_t CLIENT_TIMEOUT = 30000;
static const size_t DEFAULT_BUFFER_SIZE = 1024;
static const uint8_t MAX_ROUTES = 16;
static const uint8_t MAX_CLIENTS = 3;
static const uint8_t MAX_CONCURRENT_CONNECTIONS = 4;

const char* getConnectionStateString(ConnectionState state);
const char* getHttpMethodString(HttpMethod method);
const char* getWebSocketEventTypeString(WebSocketEventType type);
HttpMethod stringToHttpMethod(const String& methodStr);
WebSocketEventType stringToWebSocketEventType(const String& typeStr);

} // namespace NetworkLib