#pragma once

#include <Arduino.h>
#include <DNSServer.h>
#include "../HttpServer/HttpServer.h"
#include "../WiFiManager/WiFiManager.h"

class CaptivePortal {
public:
    static void registerRoutes(HttpServer* server);
    static void startDNSServer();
    static void stopDNSServer();
    static void loop();

private:
    static DNSServer dnsServer;
    static bool dnsStarted;
    
    // Route handlers
    static void handleRoot(const HttpRequest& req, HttpResponse& res);
    static void handleConnect(const HttpRequest& req, HttpResponse& res);
    static void handleScan(const HttpRequest& req, HttpResponse& res);
    static void handleStatus(const HttpRequest& req, HttpResponse& res);
    
    // Utility methods
    static String getPortalHTML();
    static String getNetworkOptionsHTML();
    static bool isSetupComplete();
};