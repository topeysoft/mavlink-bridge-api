#include "WebSocketServer.h"

WebSocketServer* WebSocketServer::instance = nullptr;

WebSocketServer::WebSocketServer() 
    : ws(nullptr), messageDoc(BUFFER_SIZE), messageHandler(nullptr) {
    memset(messageBuffer, 0, BUFFER_SIZE);
    for (uint8_t i = 0; i < MAX_CLIENTS; i++) {
        clients[i] = WebSocketClient();
    }
}

WebSocketServer::~WebSocketServer() {
    stop();
}

WebSocketServer* WebSocketServer::getInstance() {
    if (instance == nullptr) {
        instance = new WebSocketServer();
    }
    return instance;
}

void WebSocketServer::begin(const String& path) {
    if (ws != nullptr) {
        return;
    }
    
    ws = new AsyncWebSocket(path);
    
    ws->onEvent([this](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
        handleWebSocketEvent(server, client, type, arg, data, len);
    });
}

void WebSocketServer::attachToServer(AsyncWebServer* server) {
    if (ws != nullptr && server != nullptr) {
        server->addHandler(ws);
    }
}

void WebSocketServer::handleWebSocketEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT: {
            WebSocketClient* wsClient = addClient(client);
            if (wsClient != nullptr) {
                wsClient->lastPing = millis();
                sendPing(wsClient);
            } else {
                client->close(1000, "Server full");
            }
            break;
        }
        
        case WS_EVT_DISCONNECT: {
            removeClient(client->id());
            break;
        }
        
        case WS_EVT_DATA: {
            AwsFrameInfo *info = (AwsFrameInfo*)arg;
            if (info->final && info->index == 0 && info->len == len) {
                if (info->opcode == WS_TEXT) {
                    handleClientMessage(client->id(), data, len);
                }
            }
            break;
        }
        
        case WS_EVT_PONG: {
            WebSocketClient* wsClient = findClient(client->id());
            if (wsClient != nullptr) {
                wsClient->lastPing = millis();
                wsClient->isAlive = true;
            }
            break;
        }
        
        case WS_EVT_ERROR:
            removeClient(client->id());
            break;
    }
}

WebSocketClient* WebSocketServer::findClient(uint32_t clientId) {
    for (uint8_t i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i].client != nullptr && clients[i].id == clientId) {
            return &clients[i];
        }
    }
    return nullptr;
}

WebSocketClient* WebSocketServer::addClient(AsyncWebSocketClient* client) {
    for (uint8_t i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i].client == nullptr) {
            clients[i].id = client->id();
            clients[i].client = static_cast<void*>(client);
            clients[i].lastPing = millis();
            clients[i].isAlive = true;
            return &clients[i];
        }
    }
    return nullptr;
}

void WebSocketServer::removeClient(uint32_t clientId) {
    for (uint8_t i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i].client != nullptr && clients[i].id == clientId) {
            clients[i] = WebSocketClient();
            break;
        }
    }
}

void WebSocketServer::handleClientMessage(uint32_t clientId, uint8_t* data, size_t len) {
    if (len >= BUFFER_SIZE) {
        return;
    }
    
    memcpy(messageBuffer, data, len);
    messageBuffer[len] = '\0';
    
    messageDoc.clear();
    DeserializationError error = deserializeJson(messageDoc, messageBuffer);
    
    if (error) {
        return;
    }
    
    if (!messageDoc.containsKey("type") || !messageDoc.containsKey("payload")) {
        return;
    }
    
    String typeStr = messageDoc["type"];
    WebSocketEventType eventType = stringToEventType(typeStr);
    
    if (messageHandler != nullptr) {
        WebSocketMessage message(256);
        message.type = eventType;
        message.payload = messageDoc["payload"];
        messageHandler(clientId, message);
    }
}

void WebSocketServer::sendPing(WebSocketClient* client) {
    if (client != nullptr && client->client != nullptr) {
        static_cast<AsyncWebSocketClient*>(client->client)->ping();
    }
}

void WebSocketServer::checkClientHealth() {
    unsigned long now = millis();
    
    for (uint8_t i = 0; i < MAX_CLIENTS; i++) {
        WebSocketClient* client = &clients[i];
        if (client->client != nullptr) {
            if (now - client->lastPing > PING_INTERVAL) {
                sendPing(client);
                client->isAlive = false;
            }
            
            if (now - client->lastPing > CLIENT_TIMEOUT) {
                static_cast<AsyncWebSocketClient*>(client->client)->close(1000, "Timeout");
                removeClient(client->id);
            }
        }
    }
}

void WebSocketServer::broadcast(WebSocketEventType type, const JsonObjectConst& payload) {
    messageDoc.clear();
    messageDoc["type"] = eventTypeToString(type);
    messageDoc["payload"] = payload;
    
    String message;
    serializeJson(messageDoc, message);
    
    if (ws != nullptr) {
        ws->textAll(message);
    }
}

void WebSocketServer::sendToClient(uint32_t clientId, WebSocketEventType type, const JsonObjectConst& payload) {
    WebSocketClient* client = findClient(clientId);
    if (client == nullptr || client->client == nullptr) {
        return;
    }
    
    messageDoc.clear();
    messageDoc["type"] = eventTypeToString(type);
    messageDoc["payload"] = payload;
    
    String message;
    serializeJson(messageDoc, message);
    
    static_cast<AsyncWebSocketClient*>(client->client)->text(message);
}

void WebSocketServer::broadcastMessage(const WebSocketMessage& message) {
    broadcast(message.type, message.payload.as<JsonObjectConst>());
}

void WebSocketServer::sendMessage(uint32_t clientId, const WebSocketMessage& message) {
    sendToClient(clientId, message.type, message.payload.as<JsonObjectConst>());
}

void WebSocketServer::setMessageHandler(MessageHandler handler) {
    messageHandler = handler;
}

uint8_t WebSocketServer::getClientCount() const {
    uint8_t count = 0;
    for (uint8_t i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i].client != nullptr) {
            count++;
        }
    }
    return count;
}

bool WebSocketServer::isClientConnected(uint32_t clientId) const {
    for (uint8_t i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i].client != nullptr && clients[i].id == clientId) {
            return true;
        }
    }
    return false;
}

WebSocketEventType WebSocketServer::stringToEventType(const String& typeStr) {
    if (typeStr == "status") return WebSocketEventType::STATUS;
    if (typeStr == "config_changed") return WebSocketEventType::CONFIG_CHANGED;
    if (typeStr == "rtcm_data") return WebSocketEventType::RTCM_DATA;
    if (typeStr == "error") return WebSocketEventType::ERROR_EVENT;
    if (typeStr == "log") return WebSocketEventType::LOG;
    return WebSocketEventType::STATUS;
}

String WebSocketServer::eventTypeToString(WebSocketEventType type) {
    switch (type) {
        case WebSocketEventType::STATUS: return "status";
        case WebSocketEventType::CONFIG_CHANGED: return "config_changed";
        case WebSocketEventType::RTCM_DATA: return "rtcm_data";
        case WebSocketEventType::ERROR_EVENT: return "error";
        case WebSocketEventType::LOG: return "log";
        default: return "status";
    }
}

void WebSocketServer::loop() {
    checkClientHealth();
}

void WebSocketServer::stop() {
    if (ws != nullptr) {
        delete ws;
        ws = nullptr;
    }
    
    for (uint8_t i = 0; i < MAX_CLIENTS; i++) {
        clients[i] = WebSocketClient();
    }
}