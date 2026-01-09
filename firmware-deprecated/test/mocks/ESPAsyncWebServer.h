#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>
#include <functional>
#include "Arduino.h"

// Forward declarations
class AsyncWebServer;
class AsyncWebServerRequest;
class AsyncWebServerResponse;
class AsyncWebSocket;
class AsyncWebSocketClient;

// Mock AsyncWebServerRequest
class AsyncWebServerRequest {
public:
    String url() const { return "/"; }
    String method() const { return "GET"; }
    bool hasParam(const String& name) const { (void)name; return false; }
    String arg(const String& name) const { (void)name; return ""; }
    void send(int code, const String& contentType, const String& content) {
        (void)code; (void)contentType; (void)content;
    }
};

// Mock AsyncWebServerResponse
class AsyncWebServerResponse {
public:
    void addHeader(const String& name, const String& value) {
        (void)name; (void)value;
    }
};

// Mock callback types
typedef std::function<void(AsyncWebServerRequest* request)> ArRequestHandlerFunction;
typedef std::function<void(AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total)> ArBodyHandlerFunction;
typedef std::function<void(AsyncWebServerRequest* request, const String& filename, size_t index, uint8_t* data, size_t len, bool final)> ArUploadHandlerFunction;

// Mock AsyncWebServer
class AsyncWebServer {
public:
    AsyncWebServer(uint16_t port) : _port(port) {}
    
    void begin() {}
    void end() {}
    
    void on(const char* uri, ArRequestHandlerFunction onRequest) {
        (void)uri; (void)onRequest;
    }
    
    void on(const char* uri, int method, ArRequestHandlerFunction onRequest) {
        (void)uri; (void)method; (void)onRequest;
    }
    
    void on(const char* uri, int method, ArRequestHandlerFunction onRequest, ArUploadHandlerFunction onUpload) {
        (void)uri; (void)method; (void)onRequest; (void)onUpload;
    }
    
    void on(const char* uri, int method, ArRequestHandlerFunction onRequest, ArUploadHandlerFunction onUpload, ArBodyHandlerFunction onBody) {
        (void)uri; (void)method; (void)onRequest; (void)onUpload; (void)onBody;
    }
    
    void addHandler(void* handler) { (void)handler; }
    void serveStatic(const char* uri, void* fs, const char* path) {
        (void)uri; (void)fs; (void)path;
    }
    
private:
    uint16_t _port;
};

// HTTP methods
#define HTTP_GET 1
#define HTTP_POST 2
#define HTTP_PUT 3
#define HTTP_DELETE 4
#define HTTP_PATCH 5
#define HTTP_HEAD 6
#define HTTP_OPTIONS 7

// Mock WebSocket classes
class AsyncWebSocketClient {
public:
    void text(const String& message) { (void)message; }
    void binary(uint8_t* data, size_t len) { (void)data; (void)len; }
    void ping() {}
    void close() {}
    bool isConnected() { return true; }
    uint32_t id() { return 1; }
};

class AsyncWebSocket {
public:
    AsyncWebSocket(const String& url) : _url(url) {}
    
    void onEvent(std::function<void(AsyncWebSocket*, AsyncWebSocketClient*, int, void*, size_t)> handler) {
        (void)handler;
    }
    
    void textAll(const String& message) { (void)message; }
    void binaryAll(uint8_t* data, size_t len) { (void)data; (void)len; }
    void cleanupClients() {}
    size_t count() { return 0; }
    
private:
    String _url;
};

// WebSocket event types
#define WS_EVT_CONNECT 1
#define WS_EVT_DISCONNECT 2
#define WS_EVT_DATA 3
#define WS_EVT_PONG 4
#define WS_EVT_ERROR 5

#endif // ARDUINO_ARCH_NATIVE