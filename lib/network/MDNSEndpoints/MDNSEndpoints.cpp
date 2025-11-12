#include "MDNSEndpoints.h"

NetworkLib::MDNSManager* MDNSEndpoints::mdnsMgr = nullptr;
ConfigManager* MDNSEndpoints::configMgr = nullptr;
HttpServer* MDNSEndpoints::httpServer = nullptr;

void MDNSEndpoints::registerRoutes(HttpServer* server, NetworkLib::MDNSManager* mdnsManager, ConfigManager* configManager) {
    httpServer = server;
    mdnsMgr = mdnsManager;
    configMgr = configManager;
    
    server->addRoute("/api/mdns/status", HttpMethod::GET, handleStatus);
    server->addRoute("/api/mdns/discover", HttpMethod::POST, handleDiscover);
    server->addRoute("/api/mdns/config", HttpMethod::GET, handleConfig);
    server->addRoute("/api/mdns/config", HttpMethod::PATCH, handleUpdateConfig);
}

void MDNSEndpoints::handleStatus(const HttpRequest& req, HttpResponse& res) {
    if (!mdnsMgr || !httpServer) {
        res.statusCode = 500;
        res.body = "{\"error\":\"mDNS manager not available\"}";
        return;
    }
    
    DynamicJsonDocument& doc = httpServer->getResponseDoc();
    doc.clear();
    
    doc["enabled"] = mdnsMgr->getEnabled();
    doc["hostname"] = mdnsMgr->getHostname();
    
    // Advertised services
    JsonArray advertisedArray = doc.createNestedArray("advertisedServices");
    auto advertisedServices = mdnsMgr->getAdvertisedServices();
    for (const auto& service : advertisedServices) {
        JsonObject serviceObj = advertisedArray.createNestedObject();
        serviceObj["name"] = service.serviceName;
        serviceObj["type"] = service.serviceType;
        serviceObj["port"] = service.port;
        serviceObj["hostname"] = service.hostname;
        if (!service.txtRecords.isEmpty()) {
            serviceObj["txtRecords"] = service.txtRecords;
        }
    }
    
    // Discovered services
    JsonArray discoveredArray = doc.createNestedArray("discoveredServices");
    auto discoveredServices = mdnsMgr->getDiscoveredServices();
    for (const auto& service : discoveredServices) {
        JsonObject serviceObj = discoveredArray.createNestedObject();
        serviceObj["hostname"] = service.hostname;
        serviceObj["name"] = service.serviceName;
        serviceObj["type"] = service.serviceType;
        serviceObj["ip"] = service.ip.toString();
        serviceObj["port"] = service.port;
        serviceObj["lastSeen"] = service.lastSeen;
        if (!service.txtRecords.isEmpty()) {
            serviceObj["txtRecords"] = service.txtRecords;
        }
    }
    
    serializeJson(doc, res.body);
}

void MDNSEndpoints::handleDiscover(const HttpRequest& req, HttpResponse& res) {
    if (!mdnsMgr || !httpServer) {
        res.statusCode = 500;
        res.body = "{\"error\":\"mDNS manager not available\"}";
        return;
    }
    
    DynamicJsonDocument& doc = httpServer->getResponseDoc();
    doc.clear();
    
    String serviceType = "rtcm"; // Default to RTCM discovery
    
    if (!req.body.isEmpty()) {
        DynamicJsonDocument requestDoc(256);
        if (deserializeJson(requestDoc, req.body) == DeserializationError::Ok) {
            if (requestDoc.containsKey("serviceType")) {
                serviceType = String(requestDoc["serviceType"].as<const char*>());
            }
        }
    }
    
    if (mdnsMgr->startDiscovery(serviceType)) {
        doc["success"] = true;
        doc["message"] = "Discovery started for " + serviceType + " services";
        doc["serviceType"] = serviceType;
        
        // Return current discovered services
        JsonArray servicesArray = doc.createNestedArray("services");
        auto services = mdnsMgr->getDiscoveredServices(serviceType);
        for (const auto& service : services) {
            JsonObject serviceObj = servicesArray.createNestedObject();
            serviceObj["hostname"] = service.hostname;
            serviceObj["ip"] = service.ip.toString();
            serviceObj["port"] = service.port;
            serviceObj["lastSeen"] = service.lastSeen;
        }
    } else {
        doc["success"] = false;
        doc["error"] = "Failed to start discovery";
        res.statusCode = 500;
    }
    
    serializeJson(doc, res.body);
}

void MDNSEndpoints::handleConfig(const HttpRequest& req, HttpResponse& res) {
    if (!configMgr || !httpServer) {
        res.statusCode = 500;
        res.body = "{\"error\":\"Configuration manager not available\"}";
        return;
    }
    
    DynamicJsonDocument& doc = httpServer->getResponseDoc();
    doc.clear();
    
    const MDNSConfig& config = configMgr->getMDNSConfig();
    doc["enabled"] = config.enabled;
    doc["hostname"] = config.hostname;
    doc["discoveryEnabled"] = config.discoveryEnabled;
    
    serializeJson(doc, res.body);
}

void MDNSEndpoints::handleUpdateConfig(const HttpRequest& req, HttpResponse& res) {
    if (!configMgr || !httpServer) {
        res.statusCode = 500;
        res.body = "{\"error\":\"Configuration manager not available\"}";
        return;
    }
    
    DynamicJsonDocument& doc = httpServer->getResponseDoc();
    doc.clear();
    
    if (req.body.isEmpty()) {
        res.statusCode = 400;
        doc["error"] = "Empty request body";
        serializeJson(doc, res.body);
        return;
    }
    
    DynamicJsonDocument requestDoc(512);
    DeserializationError error = deserializeJson(requestDoc, req.body);
    if (error) {
        res.statusCode = 400;
        doc["error"] = "Invalid JSON: " + String(error.c_str());
        serializeJson(doc, res.body);
        return;
    }
    
    MDNSConfig newConfig = configMgr->getMDNSConfig();
    
    if (requestDoc.containsKey("enabled")) {
        newConfig.enabled = requestDoc["enabled"];
    }
    
    if (requestDoc.containsKey("hostname")) {
        newConfig.hostname = String(requestDoc["hostname"].as<const char*>());
    }
    
    if (requestDoc.containsKey("discoveryEnabled")) {
        newConfig.discoveryEnabled = requestDoc["discoveryEnabled"];
    }
    
    if (configMgr->updateMDNSConfig(newConfig)) {
        configMgr->saveConfiguration();
        
        // Update mDNS manager if available
        if (mdnsMgr) {
            mdnsMgr->setEnabled(newConfig.enabled);
            mdnsMgr->setHostname(newConfig.hostname);
        }
        
        doc["success"] = true;
        doc["message"] = "mDNS configuration updated";
        doc["config"]["enabled"] = newConfig.enabled;
        doc["config"]["hostname"] = newConfig.hostname;
        doc["config"]["discoveryEnabled"] = newConfig.discoveryEnabled;
    } else {
        res.statusCode = 400;
        doc["error"] = "Invalid configuration";
    }
    
    serializeJson(doc, res.body);
}