#include "HttpServer.h"

HttpServer* HttpServer::instance = nullptr;

HttpServer::HttpServer() 
    : server(nullptr), routeCount(0), requestDoc(BUFFER_SIZE), responseDoc(BUFFER_SIZE) {
    memset(jsonBuffer, 0, BUFFER_SIZE);
}

HttpServer::~HttpServer() {
    stop();
}

HttpServer* HttpServer::getInstance() {
    if (instance == nullptr) {
        instance = new HttpServer();
    }
    return instance;
}

void HttpServer::begin(uint16_t port) {
    if (server != nullptr) {
        return;
    }
    
    server = new AsyncWebServer(port);
    
    setupCORS();
    
    server->onNotFound([this](AsyncWebServerRequest *request) {
        handleNotFound(request);
    });
    
    server->onRequestBody([this](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        handleRoute(request, data, len, index, total);
    });
    
    for (uint8_t i = 0; i < routeCount; i++) {
        Route& route = routes[i];
        
        switch (route.method) {
            case HttpMethod::GET:
                server->on(route.path.c_str(), HTTP_GET, 
                    [this, &route](AsyncWebServerRequest *request) {
                        HttpRequest req = {route.path, "", request};
                        HttpResponse res;
                        route.handler(req, res);
                        
                        AsyncWebServerResponse *response = request->beginResponse(res.statusCode, res.contentType, res.body);
                        if (res.cors) {
                            response->addHeader("Access-Control-Allow-Origin", "*");
                            response->addHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
                            response->addHeader("Access-Control-Allow-Headers", "Content-Type");
                        }
                        request->send(response);
                    });
                break;
                
            case HttpMethod::DELETE:
                server->on(route.path.c_str(), HTTP_DELETE, 
                    [this, &route](AsyncWebServerRequest *request) {
                        HttpRequest req = {route.path, "", request};
                        HttpResponse res;
                        route.handler(req, res);
                        
                        AsyncWebServerResponse *response = request->beginResponse(res.statusCode, res.contentType, res.body);
                        if (res.cors) {
                            response->addHeader("Access-Control-Allow-Origin", "*");
                            response->addHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
                            response->addHeader("Access-Control-Allow-Headers", "Content-Type");
                        }
                        request->send(response);
                    });
                break;
                
            case HttpMethod::POST:
            case HttpMethod::PATCH:
                break;
        }
    }
    
    server->begin();
}

void HttpServer::addRoute(const String& path, HttpMethod method, RouteHandler handler) {
    if (routeCount >= MAX_ROUTES) {
        return;
    }
    
    routes[routeCount] = {path, method, handler};
    routeCount++;
}

void HttpServer::setupCORS() {
    server->on("/*", HTTP_OPTIONS, [](AsyncWebServerRequest *request) {
        AsyncWebServerResponse *response = request->beginResponse(200);
        response->addHeader("Access-Control-Allow-Origin", "*");
        response->addHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
        response->addHeader("Access-Control-Allow-Headers", "Content-Type");
        response->addHeader("Access-Control-Max-Age", "86400");
        request->send(response);
    });
}

void HttpServer::handleNotFound(AsyncWebServerRequest *request) {
    responseDoc.clear();
    responseDoc["error"] = "Not Found";
    responseDoc["path"] = request->url();
    
    String response;
    serializeJson(responseDoc, response);
    
    AsyncWebServerResponse *webResponse = request->beginResponse(404, "application/json", response);
    webResponse->addHeader("Access-Control-Allow-Origin", "*");
    request->send(webResponse);
}

void HttpServer::handleRoute(AsyncWebServerRequest *request, uint8_t* data, size_t len, size_t index, size_t total) {
    if (index == 0) {
        memset(jsonBuffer, 0, BUFFER_SIZE);
    }
    
    if (index + len > BUFFER_SIZE) {
        request->send(413, "application/json", "{\"error\":\"Request too large\"}");
        return;
    }
    
    memcpy(jsonBuffer + index, data, len);
    
    if (index + len == total) {
        HttpMethod method = stringToMethod(request->methodToString());
        Route* route = findRoute(request->url(), method);
        
        if (route == nullptr) {
            handleNotFound(request);
            return;
        }
        
        HttpRequest req = {route->path, String(jsonBuffer), request};
        HttpResponse res;
        
        route->handler(req, res);
        
        AsyncWebServerResponse *response = request->beginResponse(res.statusCode, res.contentType, res.body);
        if (res.cors) {
            response->addHeader("Access-Control-Allow-Origin", "*");
            response->addHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
            response->addHeader("Access-Control-Allow-Headers", "Content-Type");
        }
        request->send(response);
    }
}

Route* HttpServer::findRoute(const String& path, HttpMethod method) {
    for (uint8_t i = 0; i < routeCount; i++) {
        if (routes[i].path == path && routes[i].method == method) {
            return &routes[i];
        }
    }
    return nullptr;
}

HttpMethod HttpServer::stringToMethod(const String& methodStr) {
    if (methodStr == "GET") return HttpMethod::GET;
    if (methodStr == "POST") return HttpMethod::POST;
    if (methodStr == "PATCH") return HttpMethod::PATCH;
    return HttpMethod::GET;
}

void HttpServer::loop() {
    // Nothing needed - AsyncWebServer handles everything
}

void HttpServer::stop() {
    if (server != nullptr) {
        server->end();
        delete server;
        server = nullptr;
    }
}