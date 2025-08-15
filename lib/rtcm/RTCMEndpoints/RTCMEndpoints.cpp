#include "RTCMEndpoints.h"
#include "../NTRIPClient/NTRIPClient.h"
#include "../RTCMReceivers/TCPRTCMClient.h"
#include "../RTCMReceivers/UDPRTCMClient.h"
#include "../RTCMParser/RTCMParser.h"
#include "../../mavlink/MAVLinkConverter/MAVLinkConverter.h"
#include "../../core/EventManager/EventManager.h"
#include <esp_log.h>

static const char* TAG = "RTCMEndpoints";

// Static members
std::unique_ptr<RTCMClient> RTCMEndpoints::currentClient = nullptr;
ConfigManager* RTCMEndpoints::configMgr = nullptr;
SemaphoreHandle_t RTCMEndpoints::clientMutex = xSemaphoreCreateMutex();
uint32_t RTCMEndpoints::startTime = 0;
bool RTCMEndpoints::isRunning = false;

// MAVLink converter instance (shared)
static MAVLinkConverter mavlinkConverter;

void RTCMEndpoints::registerRoutes(HttpServer* server, ConfigManager* configManager) {
    configMgr = configManager;
    
    server->on("/api/rtcm/start", HTTP_POST, handleStart);
    server->on("/api/rtcm/stop", HTTP_POST, handleStop);
    server->on("/api/rtcm/status", HTTP_GET, handleStatus);
    server->on("/api/rtcm/config", HTTP_GET, handleConfig);
    
    ESP_LOGI(TAG, "RTCM endpoints registered");
}

void RTCMEndpoints::handleStart(HttpRequest& req, HttpResponse& res) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, req.body);
    
    if (error) {
        res.setStatus(400);
        JsonDocument errorDoc;
        errorDoc["error"] = "Invalid JSON";
        errorDoc["details"] = error.c_str();
        res.json(errorDoc);
        return;
    }
    
    // Validate configuration
    JsonDocument errors;
    if (!validateConfig(doc, errors)) {
        res.setStatus(400);
        JsonDocument errorDoc;
        errorDoc["error"] = "Invalid configuration";
        errorDoc["errors"] = errors;
        res.json(errorDoc);
        return;
    }
    
    xSemaphoreTake(clientMutex, portMAX_DELAY);
    
    // Stop existing client if any
    if (currentClient) {
        currentClient->disconnect();
        currentClient.reset();
    }
    
    // Create new client
    currentClient = createClient(doc);
    if (!currentClient) {
        xSemaphoreGive(clientMutex);
        res.setStatus(500);
        JsonDocument errorDoc;
        errorDoc["error"] = "Failed to create RTCM client";
        res.json(errorDoc);
        return;
    }
    
    // Set up data callback to handle RTCM data
    currentClient->setDataCallback([](const uint8_t* data, size_t length) {
        // Parse RTCM message
        RTCMParser::RTCMMessage msg;
        if (RTCMParser::parseMessage(data, length, msg)) {
            ESP_LOGI(TAG, "Received RTCM message type %d (%s), %d bytes",
                    msg.messageType, 
                    RTCMParser::getMessageTypeName(msg.messageType),
                    length);
            
            // Emit event
            JsonDocument event;
            event["type"] = "rtcm_data";
            event["messageType"] = msg.messageType;
            event["messageName"] = RTCMParser::getMessageTypeName(msg.messageType);
            event["length"] = length;
            event["stationId"] = msg.stationId;
            EventManager::getInstance().emit("rtcm_data_received", event);
        }
        
        // TODO: Forward to flight controller via MAVLink or raw
        // This would use the MAVLinkConverter if configured
    });
    
    // Set up state callback
    currentClient->setStateCallback([](RTCMClient::State state) {
        JsonDocument event;
        event["state"] = (int)state;
        event["stateName"] = state == RTCMClient::CONNECTED ? "connected" :
                            state == RTCMClient::CONNECTING ? "connecting" :
                            state == RTCMClient::ERROR ? "error" : "disconnected";
        EventManager::getInstance().emit("rtcm_state_change", event);
    });
    
    // Attempt to connect
    if (!currentClient->connect()) {
        currentClient.reset();
        xSemaphoreGive(clientMutex);
        res.setStatus(500);
        JsonDocument errorDoc;
        errorDoc["error"] = "Failed to connect to RTCM source";
        res.json(errorDoc);
        return;
    }
    
    startTime = millis();
    isRunning = true;
    
    // Save configuration
    JsonDocument& config = configMgr->getConfig();
    config["rtcm"] = doc;
    configMgr->saveConfig();
    
    xSemaphoreGive(clientMutex);
    
    // Return success
    JsonDocument response;
    response["success"] = true;
    response["message"] = "RTCM client started";
    res.json(response);
}

void RTCMEndpoints::handleStop(HttpRequest& req, HttpResponse& res) {
    xSemaphoreTake(clientMutex, portMAX_DELAY);
    
    if (!currentClient) {
        xSemaphoreGive(clientMutex);
        res.setStatus(400);
        JsonDocument errorDoc;
        errorDoc["error"] = "No RTCM client running";
        res.json(errorDoc);
        return;
    }
    
    currentClient->disconnect();
    currentClient.reset();
    isRunning = false;
    
    // Clear configuration
    JsonDocument& config = configMgr->getConfig();
    config["rtcm"]["enabled"] = false;
    configMgr->saveConfig();
    
    xSemaphoreGive(clientMutex);
    
    JsonDocument response;
    response["success"] = true;
    response["message"] = "RTCM client stopped";
    res.json(response);
}

void RTCMEndpoints::handleStatus(HttpRequest& req, HttpResponse& res) {
    JsonDocument status;
    
    xSemaphoreTake(clientMutex, portMAX_DELAY);
    
    status["running"] = (currentClient != nullptr && isRunning);
    
    if (currentClient) {
        RTCMClient::State state = currentClient->getState();
        status["state"] = state == RTCMClient::CONNECTED ? "connected" :
                         state == RTCMClient::CONNECTING ? "connecting" :
                         state == RTCMClient::ERROR ? "error" : "disconnected";
        
        RTCMClient::Statistics stats = currentClient->getStatistics();
        JsonDocument statsDoc;
        statsDoc["messagesReceived"] = stats.messagesReceived;
        statsDoc["bytesReceived"] = stats.bytesReceived;
        statsDoc["crcErrors"] = stats.crcErrors;
        statsDoc["dataRate"] = stats.dataRate;
        statsDoc["lastMessageTime"] = stats.lastMessageTime;
        
        // Message type breakdown
        JsonDocument messageTypes;
        for (const auto& pair : stats.messageTypeCounts) {
            String key = String(pair.first);
            messageTypes[key] = pair.second;
        }
        statsDoc["messageTypes"] = messageTypes;
        
        status["statistics"] = statsDoc;
        status["uptime"] = isRunning ? (millis() - startTime) / 1000 : 0;
        status["clientType"] = currentClient->getTypeName();
    }
    
    xSemaphoreGive(clientMutex);
    
    res.json(status);
}

void RTCMEndpoints::handleConfig(HttpRequest& req, HttpResponse& res) {
    JsonDocument& config = configMgr->getConfig();
    
    if (config.containsKey("rtcm")) {
        res.json(config["rtcm"]);
    } else {
        JsonDocument defaultConfig;
        defaultConfig["enabled"] = false;
        defaultConfig["source"]["type"] = "ntrip";
        defaultConfig["source"]["host"] = "";
        defaultConfig["source"]["port"] = 2101;
        defaultConfig["source"]["mountpoint"] = "";
        defaultConfig["outputFormat"] = "raw";
        res.json(defaultConfig);
    }
}

std::unique_ptr<RTCMClient> RTCMEndpoints::createClient(const JsonDocument& config) {
    const char* sourceType = config["source"]["type"];
    
    if (strcmp(sourceType, "ntrip") == 0) {
        NTRIPClient::Config ntripConfig;
        
        strncpy(ntripConfig.host, config["source"]["host"], sizeof(ntripConfig.host) - 1);
        ntripConfig.port = config["source"]["port"];
        strncpy(ntripConfig.mountpoint, config["source"]["mountpoint"], sizeof(ntripConfig.mountpoint) - 1);
        
        if (config["source"].containsKey("username")) {
            strncpy(ntripConfig.username, config["source"]["username"], sizeof(ntripConfig.username) - 1);
        } else {
            ntripConfig.username[0] = '\0';
        }
        
        if (config["source"].containsKey("password")) {
            strncpy(ntripConfig.password, config["source"]["password"], sizeof(ntripConfig.password) - 1);
        } else {
            ntripConfig.password[0] = '\0';
        }
        
        ntripConfig.sendPosition = config["source"]["sendPosition"] | false;
        if (ntripConfig.sendPosition && config["source"].containsKey("position")) {
            ntripConfig.latitude = config["source"]["position"]["latitude"];
            ntripConfig.longitude = config["source"]["position"]["longitude"];
            ntripConfig.altitude = config["source"]["position"]["altitude"];
        }
        
        return std::make_unique<NTRIPClient>(ntripConfig);
    }
    else if (strcmp(sourceType, "tcp") == 0) {
        const char* host = config["source"]["host"];
        uint16_t port = config["source"]["port"];
        return std::make_unique<TCPRTCMClient>(host, port);
    }
    else if (strcmp(sourceType, "udp") == 0) {
        uint16_t port = config["source"]["port"];
        auto client = std::make_unique<UDPRTCMClient>(port);
        
        // Configure remote endpoint if specified
        if (config["source"].containsKey("remoteHost")) {
            IPAddress remoteIP;
            if (remoteIP.fromString(config["source"]["remoteHost"].as<const char*>())) {
                uint16_t remotePort = config["source"]["remotePort"] | port;
                client->setRemoteEndpoint(remoteIP, remotePort);
            }
        }
        
        return client;
    }
    
    return nullptr;
}

bool RTCMEndpoints::validateConfig(const JsonDocument& config, JsonDocument& errors) {
    bool valid = true;
    
    if (!config.containsKey("source")) {
        errors["source"] = "Source configuration required";
        return false;
    }
    
    const char* sourceType = config["source"]["type"];
    if (!sourceType) {
        errors["source.type"] = "Source type required";
        return false;
    }
    
    if (strcmp(sourceType, "ntrip") == 0) {
        if (!config["source"].containsKey("host") || strlen(config["source"]["host"]) == 0) {
            errors["source.host"] = "Host required for NTRIP";
            valid = false;
        }
        if (!config["source"].containsKey("port")) {
            errors["source.port"] = "Port required for NTRIP";
            valid = false;
        }
        if (!config["source"].containsKey("mountpoint") || strlen(config["source"]["mountpoint"]) == 0) {
            errors["source.mountpoint"] = "Mountpoint required for NTRIP";
            valid = false;
        }
        
        if (config["source"]["sendPosition"]) {
            if (!config["source"].containsKey("position")) {
                errors["source.position"] = "Position required when sendPosition is true";
                valid = false;
            } else {
                if (!config["source"]["position"].containsKey("latitude")) {
                    errors["source.position.latitude"] = "Latitude required";
                    valid = false;
                }
                if (!config["source"]["position"].containsKey("longitude")) {
                    errors["source.position.longitude"] = "Longitude required";
                    valid = false;
                }
            }
        }
    }
    else if (strcmp(sourceType, "tcp") == 0) {
        if (!config["source"].containsKey("host") || strlen(config["source"]["host"]) == 0) {
            errors["source.host"] = "Host required for TCP";
            valid = false;
        }
        if (!config["source"].containsKey("port")) {
            errors["source.port"] = "Port required for TCP";
            valid = false;
        }
    }
    else if (strcmp(sourceType, "udp") == 0) {
        if (!config["source"].containsKey("port")) {
            errors["source.port"] = "Port required for UDP";
            valid = false;
        }
    }
    else {
        errors["source.type"] = "Invalid source type. Must be 'ntrip', 'tcp', or 'udp'";
        valid = false;
    }
    
    return valid;
}

RTCMClient* RTCMEndpoints::getCurrentClient() {
    return currentClient.get();
}

void RTCMEndpoints::stopCurrentClient() {
    xSemaphoreTake(clientMutex, portMAX_DELAY);
    if (currentClient) {
        currentClient->disconnect();
        currentClient.reset();
        isRunning = false;
    }
    xSemaphoreGive(clientMutex);
}