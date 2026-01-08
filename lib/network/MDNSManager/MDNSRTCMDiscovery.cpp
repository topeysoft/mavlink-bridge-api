#include "MDNSRTCMDiscovery.h"
#include <WiFi.h>

namespace NetworkLib {

MDNSRTCMDiscovery::MDNSRTCMDiscovery(MDNSManager* manager) 
    : mdnsManager(manager), foundCallback(nullptr), lostCallback(nullptr),
      serversMutex(nullptr), discoveryTaskHandle(nullptr), isRunning(false),
      lastDiscoveryTime(0) {
    
    serversMutex = xSemaphoreCreateMutex();
}

MDNSRTCMDiscovery::~MDNSRTCMDiscovery() {
    stopDiscovery();
    if (serversMutex != nullptr) {
        vSemaphoreDelete(serversMutex);
    }
}

bool MDNSRTCMDiscovery::startDiscovery() {
    if (isRunning || !mdnsManager || !mdnsManager->getEnabled()) {
        return false;
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("MDNSRTCMDiscovery: WiFi not connected");
        return false;
    }
    
    isRunning = true;
    
    xTaskCreate(
        discoveryTaskFunction,
        "RTCMDiscovery",
        4096,
        this,
        1,
        &discoveryTaskHandle
    );
    
    Serial.println("MDNSRTCMDiscovery: Started RTCM server discovery");
    return true;
}

void MDNSRTCMDiscovery::stopDiscovery() {
    if (!isRunning) {
        return;
    }
    
    isRunning = false;
    
    if (discoveryTaskHandle != nullptr) {
        vTaskDelete(discoveryTaskHandle);
        discoveryTaskHandle = nullptr;
    }
    
    if (xSemaphoreTake(serversMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        discoveredServers.clear();
        xSemaphoreGive(serversMutex);
    }
    
    Serial.println("MDNSRTCMDiscovery: Stopped RTCM server discovery");
}

std::vector<RTCMServerInfo> MDNSRTCMDiscovery::getDiscoveredServers() const {
    std::vector<RTCMServerInfo> result;
    
    if (xSemaphoreTake(serversMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        result = discoveredServers;
        xSemaphoreGive(serversMutex);
    }
    
    return result;
}

RTCMServerInfo* MDNSRTCMDiscovery::findServer(const String& hostname) {
    if (xSemaphoreTake(serversMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        for (auto& server : discoveredServers) {
            if (server.hostname == hostname) {
                xSemaphoreGive(serversMutex);
                return &server;
            }
        }
        xSemaphoreGive(serversMutex);
    }
    
    return nullptr;
}

RTCMServerInfo* MDNSRTCMDiscovery::findServerByIP(const IPAddress& ip, uint16_t port) {
    if (xSemaphoreTake(serversMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        for (auto& server : discoveredServers) {
            if (server.ip == ip && server.port == port) {
                xSemaphoreGive(serversMutex);
                return &server;
            }
        }
        xSemaphoreGive(serversMutex);
    }
    
    return nullptr;
}

String MDNSRTCMDiscovery::createConnectionString(const RTCMServerInfo& server) {
    String result = server.protocol + "://";
    
    if (server.requiresAuth) {
        result += "user:pass@";
    }
    
    result += server.hostname;
    if (server.port != 0) {
        result += ":" + String(server.port);
    }
    
    if (!server.mountpoint.isEmpty()) {
        result += "/" + server.mountpoint;
    }
    
    return result;
}

bool MDNSRTCMDiscovery::parseConnectionString(const String& connectionString, RTCMServerInfo& server) {
    // Simple parser for protocol://[user:pass@]hostname[:port][/mountpoint]
    int protocolEnd = connectionString.indexOf("://");
    if (protocolEnd == -1) {
        return false;
    }
    
    server.protocol = connectionString.substring(0, protocolEnd);
    
    String remaining = connectionString.substring(protocolEnd + 3);
    
    // Check for authentication
    int authEnd = remaining.indexOf("@");
    if (authEnd != -1) {
        server.requiresAuth = true;
        remaining = remaining.substring(authEnd + 1);
    }
    
    // Parse hostname and port
    int portStart = remaining.indexOf(":");
    int pathStart = remaining.indexOf("/");
    
    if (portStart != -1 && (pathStart == -1 || portStart < pathStart)) {
        server.hostname = remaining.substring(0, portStart);
        int portEnd = (pathStart != -1) ? pathStart : remaining.length();
        server.port = remaining.substring(portStart + 1, portEnd).toInt();
    } else {
        int hostnameEnd = (pathStart != -1) ? pathStart : remaining.length();
        server.hostname = remaining.substring(0, hostnameEnd);
        server.port = (server.protocol == "tcp") ? 2101 : 2102; // Default ports
    }
    
    // Parse mountpoint
    if (pathStart != -1) {
        server.mountpoint = remaining.substring(pathStart + 1);
    }
    
    return true;
}

void MDNSRTCMDiscovery::discoveryTaskFunction(void* parameter) {
    MDNSRTCMDiscovery* discovery = static_cast<MDNSRTCMDiscovery*>(parameter);
    discovery->runDiscoveryTask();
}

void MDNSRTCMDiscovery::runDiscoveryTask() {
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(DISCOVERY_INTERVAL);
    
    while (isRunning) {
        if (WiFi.status() == WL_CONNECTED && mdnsManager && mdnsManager->getEnabled()) {
            // Get discovered services from mDNS manager
            auto services = mdnsManager->getDiscoveredServices("rtk-base");
            
            if (xSemaphoreTake(serversMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
                unsigned long now = millis();
                
                // Process discovered services
                for (const auto& service : services) {
                    processDiscoveredService(service);
                }
                
                // Clean up expired servers
                cleanupExpiredServers();
                
                xSemaphoreGive(serversMutex);
            }
        }
        
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

void MDNSRTCMDiscovery::processDiscoveredService(const DiscoveredService& service) {
    // Check if server already exists
    bool found = false;
    for (auto& server : discoveredServers) {
        if (server.hostname == service.hostname && server.port == service.port) {
            // Update existing server
            server.lastSeen = service.lastSeen;
            server.ip = service.ip;
            found = true;
            break;
        }
    }
    
    if (!found) {
        // Add new server
        RTCMServerInfo newServer = createServerInfo(service);
        discoveredServers.push_back(newServer);
        
        Serial.printf("MDNSRTCMDiscovery: Found new RTCM server: %s (%s:%u)\n", 
                     newServer.hostname.c_str(), newServer.ip.toString().c_str(), newServer.port);
        
        if (foundCallback) {
            foundCallback(newServer);
        }
    }
}

void MDNSRTCMDiscovery::cleanupExpiredServers() {
    unsigned long now = millis();
    
    for (auto it = discoveredServers.begin(); it != discoveredServers.end(); ) {
        if (now - it->lastSeen > SERVER_TIMEOUT) {
            Serial.printf("MDNSRTCMDiscovery: Server expired: %s\n", it->hostname.c_str());
            
            if (lostCallback) {
                lostCallback(*it);
            }
            
            it = discoveredServers.erase(it);
        } else {
            ++it;
        }
    }
}

RTCMServerInfo MDNSRTCMDiscovery::createServerInfo(const DiscoveredService& service) {
    RTCMServerInfo server;
    server.hostname = service.hostname;
    server.friendlyName = service.serviceName;
    server.ip = service.ip;
    server.port = service.port;
    server.lastSeen = service.lastSeen;
    
    // Parse TXT records for additional info
    server.protocol = parseTxtRecord(service.txtRecords, "protocol");
    if (server.protocol.isEmpty()) {
        server.protocol = "tcp"; // Default to TCP
    }
    
    server.mountpoint = parseTxtRecord(service.txtRecords, "mountpoint");
    
    String auth = parseTxtRecord(service.txtRecords, "auth");
    server.requiresAuth = (auth == "true" || auth == "1");
    
    return server;
}

String MDNSRTCMDiscovery::parseTxtRecord(const String& txtRecords, const String& key) {
    if (txtRecords.isEmpty()) {
        return "";
    }
    
    String searchKey = key + "=";
    int start = txtRecords.indexOf(searchKey);
    if (start == -1) {
        return "";
    }
    
    start += searchKey.length();
    int end = txtRecords.indexOf(';', start);
    if (end == -1) {
        end = txtRecords.length();
    }
    
    return txtRecords.substring(start, end);
}

} // namespace NetworkLib