#include "RTCMEndpoints.h"
#include <NTRIPClient/NTRIPClient.h>
#include <RTCMReceivers/TCPRTCMClient.h>
#include <RTCMReceivers/UDPRTCMClient.h>
#include <RTCMParser/RTCMParser.h>
#include <MAVLinkConverter/MAVLinkConverter.h>
#include <EventManager/EventManager.h>
#include <esp_log.h>

static const char *TAG = "RTCMEndpoints";

// Static members
std::unique_ptr<RTCMClient> RTCMEndpoints::currentClient = nullptr;
ConfigManager *RTCMEndpoints::configMgr = nullptr;
SemaphoreHandle_t RTCMEndpoints::clientMutex = xSemaphoreCreateMutex();
uint32_t RTCMEndpoints::startTime = 0;
bool RTCMEndpoints::isRunning = false;

// MAVLink converter instance (shared)
static MAVLinkConverter mavlinkConverter;

void RTCMEndpoints::registerRoutes(HttpServer *server, ConfigManager *configManager)
{
    configMgr = configManager;

    server->addRoute("/api/rtcm/start", NetworkLib::HttpMethod::POST, handleStart);
    server->addRoute("/api/rtcm/stop", NetworkLib::HttpMethod::POST, handleStop);
    server->addRoute("/api/rtcm/status", NetworkLib::HttpMethod::GET, handleStatus);
    server->addRoute("/api/rtcm/config", NetworkLib::HttpMethod::GET, handleConfig);

    ESP_LOGI(TAG, "RTCM endpoints registered");
}

void RTCMEndpoints::handleStart(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res)
{
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, req.body);

    if (error)
    {
        res.statusCode = 400;
        DynamicJsonDocument errorDoc(256);
        errorDoc["error"] = "Invalid JSON";
        errorDoc["details"] = error.c_str();
        serializeJson(errorDoc, res.body);
        return;
    }

    // Validate configuration
    DynamicJsonDocument errors(512);
    if (!validateConfig(doc, errors))
    {
        res.statusCode = 400;
        DynamicJsonDocument errorDoc(512);
        errorDoc["error"] = "Invalid configuration";
        errorDoc["errors"] = errors;
        serializeJson(errorDoc, res.body);
        return;
    }

    xSemaphoreTake(clientMutex, portMAX_DELAY);

    // Stop existing client if any
    if (currentClient)
    {
        currentClient->disconnect();
        currentClient.reset();
    }

    // Create new client
    currentClient = createClient(doc);
    if (!currentClient)
    {
        xSemaphoreGive(clientMutex);
        res.statusCode = 500;
        DynamicJsonDocument errorDoc(256);
        errorDoc["error"] = "Failed to create RTCM client";
        serializeJson(errorDoc, res.body);
        return;
    }

    // Set up data callback to handle RTCM data
    currentClient->setDataCallback([](const uint8_t *data, size_t length)
                                   {
                                       // Parse RTCM message
                                       RTCMParser::RTCMMessage msg;
                                       if (RTCMParser::parseMessage(data, length, msg))
                                       {
                                           ESP_LOGI(TAG, "Received RTCM message type %d (%s), %d bytes",
                                                    msg.messageType,
                                                    RTCMParser::getMessageTypeName(msg.messageType),
                                                    length);

                                           // Emit event
                                           DynamicJsonDocument event(512);
                                           event["type"] = "rtcm_data";
                                           event["messageType"] = msg.messageType;
                                           event["messageName"] = RTCMParser::getMessageTypeName(msg.messageType);
                                           event["length"] = length;
                                           event["stationId"] = msg.stationId;
                                           EventManager::getInstance()->publishAsync(EventType::RTCM_DATA_RECEIVED, event.as<JsonObjectConst>());
                                       }

                                       // TODO: Forward to flight controller via MAVLink or raw
                                       // This would use the MAVLinkConverter if configured
                                   });

    // Set up state callback
    currentClient->setStateCallback([](RTCMClient::State state)
                                    {
        DynamicJsonDocument event(512);
        event["state"] = (int)state;
        event["stateName"] = state == RTCMClient::CONNECTED ? "connected" :
                            state == RTCMClient::CONNECTING ? "connecting" :
                            state == RTCMClient::ERROR ? "error" : "disconnected";
        EventManager::getInstance()->publishAsync(EventType::RTCM_CLIENT_STARTED, event.as<JsonObjectConst>()); });

    // Attempt to connect
    if (!currentClient->connect())
    {
        currentClient.reset();
        xSemaphoreGive(clientMutex);
        res.statusCode = 500;
        DynamicJsonDocument errorDoc(256);
        errorDoc["error"] = "Failed to connect to RTCM source";
        serializeJson(errorDoc, res.body);
        return;
    }

    startTime = millis();
    isRunning = true;

    // Save configuration
    RTCMConfig rtcmConfig;
    rtcmConfig.enabled = doc["enabled"] | true;
    rtcmConfig.source.type = doc["source"]["type"] | "ntrip";
    rtcmConfig.source.host = doc["source"]["host"] | "";
    rtcmConfig.source.port = doc["source"]["port"] | 2101;
    rtcmConfig.source.mountpoint = doc["source"]["mountpoint"] | "";
    rtcmConfig.source.username = doc["source"]["username"] | "";
    rtcmConfig.source.password = doc["source"]["password"] | "";
    configMgr->updateRTCMConfig(rtcmConfig);
    configMgr->saveConfiguration();

    xSemaphoreGive(clientMutex);

    // Return success
    DynamicJsonDocument response(256);
    response["success"] = true;
    response["message"] = "RTCM client started";
    serializeJson(response, res.body);
}

void RTCMEndpoints::handleStop(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res)
{
    xSemaphoreTake(clientMutex, portMAX_DELAY);

    if (!currentClient)
    {
        xSemaphoreGive(clientMutex);
        res.statusCode = 400;
        DynamicJsonDocument errorDoc(256);
        errorDoc["error"] = "No RTCM client running";
        serializeJson(errorDoc, res.body);
        return;
    }

    currentClient->disconnect();
    currentClient.reset();
    isRunning = false;

    // Clear configuration
    RTCMConfig rtcmConfig = configMgr->getRTCMConfig();
    rtcmConfig.enabled = false;
    configMgr->updateRTCMConfig(rtcmConfig);
    configMgr->saveConfiguration();

    xSemaphoreGive(clientMutex);

    DynamicJsonDocument response(256);
    response["success"] = true;
    response["message"] = "RTCM client stopped";
    serializeJson(response, res.body);
}

void RTCMEndpoints::handleStatus(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res)
{
    DynamicJsonDocument status(1024);

    xSemaphoreTake(clientMutex, portMAX_DELAY);

    status["running"] = (currentClient != nullptr && isRunning);

    if (currentClient)
    {
        RTCMClient::State state = currentClient->getState();
        status["state"] = state == RTCMClient::CONNECTED ? "connected" : state == RTCMClient::CONNECTING ? "connecting"
                                                                     : state == RTCMClient::ERROR        ? "error"
                                                                                                         : "disconnected";

        RTCMClient::Statistics stats = currentClient->getStatistics();
        DynamicJsonDocument statsDoc(512);
        statsDoc["messagesReceived"] = stats.messagesReceived;
        statsDoc["bytesReceived"] = stats.bytesReceived;
        statsDoc["crcErrors"] = stats.crcErrors;
        statsDoc["dataRate"] = stats.dataRate;
        statsDoc["lastMessageTime"] = stats.lastMessageTime;

        // Message type breakdown
        DynamicJsonDocument messageTypes(256);
        for (const auto &pair : stats.messageTypeCounts)
        {
            String key = String(pair.first);
            messageTypes[key] = pair.second;
        }
        statsDoc["messageTypes"] = messageTypes;

        status["statistics"] = statsDoc;
        status["uptime"] = isRunning ? (millis() - startTime) / 1000 : 0;
        status["clientType"] = currentClient->getTypeName();
    }

    xSemaphoreGive(clientMutex);

    serializeJson(status, res.body);
}

void RTCMEndpoints::handleConfig(const NetworkLib::HttpRequest &req, NetworkLib::HttpResponse &res)
{
    const RTCMConfig& rtcmConfig = configMgr->getRTCMConfig();
    
    DynamicJsonDocument response(512);
    response["enabled"] = rtcmConfig.enabled;
    response["source"]["type"] = rtcmConfig.source.type;
    response["source"]["host"] = rtcmConfig.source.host;
    response["source"]["port"] = rtcmConfig.source.port;
    response["source"]["mountpoint"] = rtcmConfig.source.mountpoint;
    response["source"]["username"] = rtcmConfig.source.username;
    response["source"]["password"] = rtcmConfig.source.password;
    
    serializeJson(response, res.body);
}

std::unique_ptr<RTCMClient> RTCMEndpoints::createClient(const DynamicJsonDocument &config)
{
    const char *sourceType = config["source"]["type"];

    if (strcmp(sourceType, "ntrip") == 0)
    {
        NTRIPClient::Config ntripConfig;

        strncpy(ntripConfig.host, config["source"]["host"], sizeof(ntripConfig.host) - 1);
        ntripConfig.port = config["source"]["port"];
        strncpy(ntripConfig.mountpoint, config["source"]["mountpoint"], sizeof(ntripConfig.mountpoint) - 1);

        if (config["source"].containsKey("username"))
        {
            strncpy(ntripConfig.username, config["source"]["username"], sizeof(ntripConfig.username) - 1);
        }
        else
        {
            ntripConfig.username[0] = '\0';
        }

        if (config["source"].containsKey("password"))
        {
            strncpy(ntripConfig.password, config["source"]["password"], sizeof(ntripConfig.password) - 1);
        }
        else
        {
            ntripConfig.password[0] = '\0';
        }

        ntripConfig.sendPosition = config["source"]["sendPosition"] | false;
        if (ntripConfig.sendPosition && config["source"].containsKey("position"))
        {
            ntripConfig.latitude = config["source"]["position"]["latitude"];
            ntripConfig.longitude = config["source"]["position"]["longitude"];
            ntripConfig.altitude = config["source"]["position"]["altitude"];
        }

        return std::make_unique<NTRIPClient>(ntripConfig);
    }
    else if (strcmp(sourceType, "tcp") == 0)
    {
        const char *host = config["source"]["host"];
        uint16_t port = config["source"]["port"];
        return std::make_unique<TCPRTCMClient>(host, port);
    }
    else if (strcmp(sourceType, "udp") == 0)
    {
        uint16_t port = config["source"]["port"];
        auto client = std::make_unique<UDPRTCMClient>(port);

        // Configure remote endpoint if specified
        if (config["source"].containsKey("remoteHost"))
        {
            String remoteHost = config["source"]["remoteHost"].as<String>();
            uint16_t remotePort = config["source"]["remotePort"] | port;

            // Try to parse as IP first, then resolve hostname/mDNS
            IPAddress remoteIP;
            if (remoteIP.fromString(remoteHost.c_str()))
            {
                client->setRemoteEndpoint(remoteIP, remotePort);
            }
            else
            {
                // For hostnames, we would need to resolve DNS first
                // For now, log a warning and skip remote endpoint configuration
                ESP_LOGW(TAG, "Hostname resolution not yet implemented for UDP client: %s", remoteHost.c_str());
                // TODO: Implement hostname resolution using WiFi.hostByName() or mDNS
            }
        }

        return client;
    }

    return nullptr;
}

bool RTCMEndpoints::validateConfig(const DynamicJsonDocument &config, DynamicJsonDocument &errors)
{
    bool valid = true;

    if (!config.containsKey("source"))
    {
        errors["source"] = "Source configuration required";
        return false;
    }

    const char *sourceType = config["source"]["type"];
    if (!sourceType)
    {
        errors["source.type"] = "Source type required";
        return false;
    }

    if (strcmp(sourceType, "ntrip") == 0)
    {
        if (!config["source"].containsKey("host") || strlen(config["source"]["host"]) == 0)
        {
            errors["source.host"] = "Host required for NTRIP";
            valid = false;
        }
        if (!config["source"].containsKey("port"))
        {
            errors["source.port"] = "Port required for NTRIP";
            valid = false;
        }
        if (!config["source"].containsKey("mountpoint") || strlen(config["source"]["mountpoint"]) == 0)
        {
            errors["source.mountpoint"] = "Mountpoint required for NTRIP";
            valid = false;
        }

        if (config["source"]["sendPosition"])
        {
            if (!config["source"].containsKey("position"))
            {
                errors["source.position"] = "Position required when sendPosition is true";
                valid = false;
            }
            else
            {
                if (!config["source"]["position"].containsKey("latitude"))
                {
                    errors["source.position.latitude"] = "Latitude required";
                    valid = false;
                }
                if (!config["source"]["position"].containsKey("longitude"))
                {
                    errors["source.position.longitude"] = "Longitude required";
                    valid = false;
                }
            }
        }
    }
    else if (strcmp(sourceType, "tcp") == 0)
    {
        if (!config["source"].containsKey("host") || strlen(config["source"]["host"]) == 0)
        {
            errors["source.host"] = "Host required for TCP";
            valid = false;
        }
        if (!config["source"].containsKey("port"))
        {
            errors["source.port"] = "Port required for TCP";
            valid = false;
        }
    }
    else if (strcmp(sourceType, "udp") == 0)
    {
        if (!config["source"].containsKey("port"))
        {
            errors["source.port"] = "Port required for UDP";
            valid = false;
        }
    }
    else
    {
        errors["source.type"] = "Invalid source type. Must be 'ntrip', 'tcp', or 'udp'";
        valid = false;
    }

    return valid;
}

RTCMClient *RTCMEndpoints::getCurrentClient()
{
    return currentClient.get();
}

void RTCMEndpoints::stopCurrentClient()
{
    xSemaphoreTake(clientMutex, portMAX_DELAY);
    if (currentClient)
    {
        currentClient->disconnect();
        currentClient.reset();
        isRunning = false;
    }
    xSemaphoreGive(clientMutex);
}