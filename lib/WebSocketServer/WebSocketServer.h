#pragma once

#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <functional>

enum class WebSocketEventType {
    STATUS,
    CONFIG_CHANGED,
    RTCM_DATA,
    ERROR_EVENT,
    LOG
};

struct WebSocketMessage {
    WebSocketEventType type;
    DynamicJsonDocument payload;
    
    WebSocketMessage(size_t capacity = 256) : payload(capacity) {}
};

struct WebSocketClient {
    uint32_t id;
    AsyncWebSocketClient* client;
    unsigned long lastPing;
    bool isAlive;
    
    WebSocketClient() : id(0), client(nullptr), lastPing(0), isAlive(false) {}
};

using MessageHandler = std::function<void(uint32_t clientId, const WebSocketMessage&)>;

class WebSocketServer {
private:
    static WebSocketServer* instance;
    AsyncWebSocket* ws;
    WebSocketClient clients[3];
    static const uint8_t MAX_CLIENTS = 3;
    static const uint32_t PING_INTERVAL = 10000;
    static const uint32_t CLIENT_TIMEOUT = 30000;
    static const size_t BUFFER_SIZE = 512;
    
    char messageBuffer[BUFFER_SIZE];
    DynamicJsonDocument messageDoc;
    MessageHandler messageHandler;
    
    void handleWebSocketEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);
    WebSocketClient* findClient(uint32_t clientId);
    WebSocketClient* addClient(AsyncWebSocketClient* client);
    void removeClient(uint32_t clientId);
    void handleClientMessage(uint32_t clientId, uint8_t* data, size_t len);
    void sendPing(WebSocketClient* client);
    void checkClientHealth();
    WebSocketEventType stringToEventType(const String& typeStr);
    String eventTypeToString(WebSocketEventType type);
    
public:
    WebSocketServer();
    ~WebSocketServer();
    
    static WebSocketServer* getInstance();
    void begin(const String& path = "/ws");
    void attachToServer(AsyncWebServer* server);
    void loop();
    void stop();
    
    void setMessageHandler(MessageHandler handler);
    void broadcast(WebSocketEventType type, const JsonObjectConst& payload);
    void sendToClient(uint32_t clientId, WebSocketEventType type, const JsonObjectConst& payload);
    void broadcastMessage(const WebSocketMessage& message);
    void sendMessage(uint32_t clientId, const WebSocketMessage& message);
    
    uint8_t getClientCount() const;
    bool isClientConnected(uint32_t clientId) const;
    
    DynamicJsonDocument& getMessageDoc() { return messageDoc; }
    char* getMessageBuffer() { return messageBuffer; }
    size_t getBufferSize() const { return BUFFER_SIZE; }
};