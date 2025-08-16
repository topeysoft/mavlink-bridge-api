#pragma once

#include "HttpServer/HttpServer.h"
#include "MDNSManager/MDNSManager.h"
#include "ConfigManager/ConfigManager.h"

class MDNSEndpoints
{
public:
    static void registerRoutes(HttpServer *server, NetworkLib::MDNSManager *mdnsManager, ConfigManager *configManager);

private:
    static void handleStatus(const HttpRequest &req, HttpResponse &res);
    static void handleDiscover(const HttpRequest &req, HttpResponse &res);
    static void handleConfig(const HttpRequest &req, HttpResponse &res);
    static void handleUpdateConfig(const HttpRequest &req, HttpResponse &res);

    static NetworkLib::MDNSManager *mdnsMgr;
    static ConfigManager *configMgr;
    static HttpServer *httpServer;
};