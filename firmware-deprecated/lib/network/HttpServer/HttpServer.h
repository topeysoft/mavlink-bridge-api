#pragma once

#include "../NetworkCommon.h"
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <functional>

using namespace NetworkLib;

using RouteHandler = std::function<void(const HttpRequest &, HttpResponse &)>;

struct Route
{
    String path;
    HttpMethod method;
    RouteHandler handler;
};

class HttpServer
{
private:
    static HttpServer *instance;
    AsyncWebServer *server;
    Route routes[64];
    uint8_t routeCount;
    static const size_t BUFFER_SIZE = 1024;
    static const uint8_t MAX_ROUTES = 32;
    static const uint8_t MAX_CONCURRENT_CONNECTIONS = 4;

    char jsonBuffer[BUFFER_SIZE];
    DynamicJsonDocument requestDoc;
    DynamicJsonDocument responseDoc;

    void setupCORS();
    void handleNotFound(AsyncWebServerRequest *request);
    void handleRoute(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total);
    Route *findRoute(const String &path, HttpMethod method);
    HttpMethod stringToMethod(const String &methodStr);

public:
    HttpServer();
    ~HttpServer();

    static HttpServer *getInstance();
    void begin(uint16_t port = 80);
    void addRoute(const String &path, HttpMethod method, RouteHandler handler);
    void loop();
    void stop();

    DynamicJsonDocument &getRequestDoc() { return requestDoc; }
    DynamicJsonDocument &getResponseDoc() { return responseDoc; }
    char *getJsonBuffer() { return jsonBuffer; }
    size_t getBufferSize() const { return BUFFER_SIZE; }
    AsyncWebServer *getAsyncServer() { return server; }
};