#include "CaptivePortal.h"
#include <WiFi.h>

DNSServer CaptivePortal::dnsServer;
bool CaptivePortal::dnsStarted = false;

void CaptivePortal::registerRoutes(HttpServer* server) {
    // Captive portal routes
    server->addRoute("/", HttpMethod::GET, handleRoot);
    server->addRoute("/setup", HttpMethod::GET, handleRoot);
    server->addRoute("/portal", HttpMethod::GET, handleRoot);
    server->addRoute("/portal/connect", HttpMethod::POST, handleConnect);
    server->addRoute("/portal/scan", HttpMethod::GET, handleScan);
    server->addRoute("/portal/status", HttpMethod::GET, handleStatus);
    
    // Catch-all for captive portal
    server->addRoute("/generate_204", HttpMethod::GET, handleRoot); // Android
    server->addRoute("/fwlink", HttpMethod::GET, handleRoot); // Microsoft
    server->addRoute("/hotspot-detect.html", HttpMethod::GET, handleRoot); // Apple
}

void CaptivePortal::startDNSServer() {
    if (!dnsStarted) {
        dnsServer.start(53, "*", WiFi.softAPIP());
        dnsStarted = true;
        Serial.println("DNS Server started for captive portal");
    }
}

void CaptivePortal::stopDNSServer() {
    if (dnsStarted) {
        dnsServer.stop();
        dnsStarted = false;
        Serial.println("DNS Server stopped");
    }
}

void CaptivePortal::loop() {
    if (dnsStarted) {
        dnsServer.processNextRequest();
    }
}

void CaptivePortal::handleRoot(const HttpRequest& req, HttpResponse& res) {
    res.body = getPortalHTML();
    res.statusCode = 200;
    res.contentType = "text/html";
}

void CaptivePortal::handleConnect(const HttpRequest& req, HttpResponse& res) {
    // Parse form data (simplified - would need proper form parsing)
    String ssid = "";
    String password = "";
    
    // Basic form data parsing
    int ssidStart = req.body.indexOf("ssid=");
    int passwordStart = req.body.indexOf("password=");
    
    if (ssidStart != -1) {
        int ssidEnd = req.body.indexOf("&", ssidStart);
        if (ssidEnd == -1) ssidEnd = req.body.length();
        ssid = req.body.substring(ssidStart + 5, ssidEnd);
        ssid.replace("+", " ");
    }
    
    if (passwordStart != -1) {
        int passwordEnd = req.body.indexOf("&", passwordStart);
        if (passwordEnd == -1) passwordEnd = req.body.length();
        password = req.body.substring(passwordStart + 9, passwordEnd);
        password.replace("+", " ");
    }
    
    if (ssid.length() > 0) {
        WiFiManager* wifiManager = WiFiManager::getInstance();
        bool success = wifiManager->connect(ssid, password);
        
        if (success) {
            wifiManager->addSavedNetwork(ssid, password, 1);
            res.body = "<html><body><h1>Connecting...</h1><p>Attempting to connect to: " + ssid + "</p></body></html>";
        } else {
            res.body = "<html><body><h1>Error</h1><p>Failed to connect. <a href='/'>Try again</a></p></body></html>";
        }
    } else {
        res.body = "<html><body><h1>Error</h1><p>Missing SSID. <a href='/'>Try again</a></p></body></html>";
    }
    
    res.statusCode = 200;
    res.contentType = "text/html";
}

void CaptivePortal::handleScan(const HttpRequest& req, HttpResponse& res) {
    res.body = getNetworkOptionsHTML();
    res.statusCode = 200;
    res.contentType = "text/html";
}

void CaptivePortal::handleStatus(const HttpRequest& req, HttpResponse& res) {
    WiFiManager* wifiManager = WiFiManager::getInstance();
    WiFiManager::State state = wifiManager->getState();
    
    if (state == WiFiManager::CONNECTED) {
        WiFiManager::ConnectionInfo info = wifiManager->getConnectionInfo();
        res.body = "<html><body><h1>Connected!</h1><p>Network: " + info.ssid + "</p><p>IP: " + info.ip.toString() + "</p></body></html>";
    } else if (state == WiFiManager::CONNECTING) {
        res.body = "<html><body><h1>Connecting...</h1><p>Please wait...</p></body></html>";
    } else {
        res.body = "<html><body><h1>Connection Failed</h1><p><a href='/'>Try again</a></p></body></html>";
    }
    
    res.statusCode = 200;
    res.contentType = "text/html";
}

String CaptivePortal::getPortalHTML() {
    return "<html><head><title>MAVLinkBridge Setup</title></head><body>"
           "<h1>MAVLinkBridge WiFi Setup</h1>"
           "<form action='/portal/connect' method='POST'>"
           "<p>Network Name: <input type='text' name='ssid' required></p>"
           "<p>Password: <input type='password' name='password'></p>"
           "<p><input type='submit' value='Connect'></p>"
           "</form>"
           "<p><a href='/portal/scan'>Scan for networks</a></p>"
           "</body></html>";
}

String CaptivePortal::getNetworkOptionsHTML() {
    WiFiManager* wifiManager = WiFiManager::getInstance();
    std::vector<WiFiNetwork> networks = wifiManager->scan(true);
    
    String html = "<html><head><title>Available Networks</title></head><body>";
    html += "<h1>Available Networks</h1>";
    
    if (networks.size() == 0) {
        html += "<p>No networks found</p>";
    } else {
        html += "<ul>";
        for (const auto& network : networks) {
            String secure = (network.authMode != WIFI_AUTH_OPEN) ? " (Secure)" : " (Open)";
            html += "<li>" + network.ssid + secure + " (RSSI: " + String(network.rssi) + ")</li>";
        }
        html += "</ul>";
    }
    
    html += "<p><a href='/'>Back to setup</a></p>";
    html += "</body></html>";
    
    return html;
}

bool CaptivePortal::isSetupComplete() {
    WiFiManager* wifiManager = WiFiManager::getInstance();
    return (wifiManager->getState() == WiFiManager::CONNECTED);
}