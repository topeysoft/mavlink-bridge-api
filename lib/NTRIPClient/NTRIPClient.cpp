#include "NTRIPClient.h"
#include <esp_log.h>
#include <cstring>
#include <base64.h>

static const char* TAG = "NTRIPClient";

NTRIPClient::NTRIPClient(const Config& cfg) 
    : config(cfg)
    , lastGGATime(0)
    , ggaInterval(10000)  // Send GGA every 10 seconds
    , reconnectDelay(1000)
    , lastReconnectAttempt(0)
    , authenticated(false) {
    snprintf(userAgent, sizeof(userAgent), "NTRIP ESP32Client/1.0");
}

NTRIPClient::~NTRIPClient() {
    disconnect();
}

bool NTRIPClient::connect() {
    if (currentState == CONNECTED) {
        return true;
    }
    
    setState(CONNECTING);
    
    ESP_LOGI(TAG, "Connecting to %s:%d/%s", config.host, config.port, config.mountpoint);
    
    // Connect TCP
    if (!tcpClient.connect(config.host, config.port)) {
        ESP_LOGE(TAG, "Failed to connect to NTRIP caster");
        setState(ERROR);
        return false;
    }
    
    // Send HTTP request
    if (!sendRequest()) {
        ESP_LOGE(TAG, "Failed to send NTRIP request");
        tcpClient.stop();
        setState(ERROR);
        return false;
    }
    
    // Parse response
    if (!parseResponse()) {
        ESP_LOGE(TAG, "Failed to parse NTRIP response");
        tcpClient.stop();
        setState(ERROR);
        return false;
    }
    
    setState(CONNECTED);
    authenticated = true;
    
    // Start receive task
    if (receiveTask == nullptr) {
        xTaskCreate(ntripTaskFunction, "NTRIP_Task", 4096, this, 5, &receiveTask);
    }
    
    // Send initial position if configured
    if (config.sendPosition) {
        sendNMEAPosition();
    }
    
    return true;
}

void NTRIPClient::disconnect() {
    if (receiveTask != nullptr) {
        vTaskDelete(receiveTask);
        receiveTask = nullptr;
    }
    
    if (tcpClient.connected()) {
        tcpClient.stop();
    }
    
    authenticated = false;
    setState(DISCONNECTED);
}

bool NTRIPClient::sendRequest() {
    char request[512];
    int len = 0;
    
    // Build GET request
    len = snprintf(request, sizeof(request),
                   "GET /%s HTTP/1.0\r\n"
                   "User-Agent: %s\r\n"
                   "Accept: */*\r\n"
                   "Connection: close\r\n",
                   config.mountpoint,
                   userAgent);
    
    // Add authorization if needed
    if (strlen(config.username) > 0) {
        char auth[128];
        snprintf(auth, sizeof(auth), "%s:%s", config.username, config.password);
        
        char encoded[256];
        base64_encode((uint8_t*)auth, strlen(auth), encoded);
        
        len += snprintf(request + len, sizeof(request) - len,
                       "Authorization: Basic %s\r\n", encoded);
    }
    
    // Add NTRIP version
    len += snprintf(request + len, sizeof(request) - len,
                   "Ntrip-Version: Ntrip/2.0\r\n\r\n");
    
    ESP_LOGD(TAG, "Sending request:\n%s", request);
    
    size_t written = tcpClient.write((uint8_t*)request, len);
    return written == len;
}

bool NTRIPClient::parseResponse() {
    char response[512];
    size_t responseLen = 0;
    uint32_t startTime = millis();
    
    // Read response headers
    while (millis() - startTime < 5000) {
        if (tcpClient.available()) {
            char c = tcpClient.read();
            if (responseLen < sizeof(response) - 1) {
                response[responseLen++] = c;
                response[responseLen] = '\0';
                
                // Check for end of headers
                if (responseLen >= 4 && 
                    strstr(response, "\r\n\r\n") != nullptr) {
                    break;
                }
            }
        }
        delay(1);
    }
    
    ESP_LOGD(TAG, "Response:\n%s", response);
    
    // Check for ICY 200 OK or HTTP/1.x 200 OK
    if (strstr(response, "ICY 200 OK") != nullptr ||
        strstr(response, "HTTP/1.0 200 OK") != nullptr ||
        strstr(response, "HTTP/1.1 200 OK") != nullptr) {
        ESP_LOGI(TAG, "NTRIP connection established");
        return true;
    }
    
    // Check for SOURCETABLE
    if (strstr(response, "SOURCETABLE 200 OK") != nullptr) {
        ESP_LOGI(TAG, "Received source table");
        // Could parse and display available mountpoints
        return false;
    }
    
    // Check for authentication failure
    if (strstr(response, "401 Unauthorized") != nullptr) {
        ESP_LOGE(TAG, "Authentication failed");
        return false;
    }
    
    // Check for not found
    if (strstr(response, "404 Not Found") != nullptr) {
        ESP_LOGE(TAG, "Mountpoint not found");
        return false;
    }
    
    ESP_LOGE(TAG, "Unknown response");
    return false;
}

void NTRIPClient::sendNMEAPosition() {
    if (!tcpClient.connected()) return;
    
    char gga[128];
    generateGGA(gga, sizeof(gga));
    
    ESP_LOGD(TAG, "Sending GGA: %s", gga);
    tcpClient.write((uint8_t*)gga, strlen(gga));
    
    lastGGATime = millis();
}

char* NTRIPClient::generateGGA(char* buffer, size_t bufferSize) {
    // Get current time
    uint32_t now = millis();
    int hours = (now / 3600000) % 24;
    int minutes = (now / 60000) % 60;
    int seconds = (now / 1000) % 60;
    int milliseconds = now % 1000;
    
    // Convert coordinates to NMEA format
    int latDeg = (int)abs(config.latitude);
    double latMin = (abs(config.latitude) - latDeg) * 60.0;
    char latHem = config.latitude >= 0 ? 'N' : 'S';
    
    int lonDeg = (int)abs(config.longitude);
    double lonMin = (abs(config.longitude) - lonDeg) * 60.0;
    char lonHem = config.longitude >= 0 ? 'E' : 'W';
    
    // Build GGA sentence
    snprintf(buffer, bufferSize,
             "$GPGGA,%02d%02d%02d.%02d,%02d%08.5f,%c,%03d%08.5f,%c,1,08,1.0,%.1f,M,0.0,M,,",
             hours, minutes, seconds, milliseconds / 10,
             latDeg, latMin, latHem,
             lonDeg, lonMin, lonHem,
             config.altitude);
    
    // Calculate checksum
    uint8_t checksum = calculateNMEAChecksum(buffer + 1);  // Skip $
    
    // Append checksum
    size_t len = strlen(buffer);
    snprintf(buffer + len, bufferSize - len, "*%02X\r\n", checksum);
    
    return buffer;
}

uint8_t NTRIPClient::calculateNMEAChecksum(const char* sentence) {
    uint8_t checksum = 0;
    
    while (*sentence && *sentence != '*') {
        checksum ^= *sentence++;
    }
    
    return checksum;
}

void NTRIPClient::setPosition(float lat, float lon, float alt) {
    config.latitude = lat;
    config.longitude = lon;
    config.altitude = alt;
}

void NTRIPClient::ntripTaskFunction(void* parameter) {
    NTRIPClient* client = static_cast<NTRIPClient*>(parameter);
    client->runReceiveTask();
    vTaskDelete(nullptr);
}

void NTRIPClient::runReceiveTask() {
    uint8_t tempBuffer[512];
    uint32_t lastReceiveTime = millis();
    
    while (currentState == CONNECTED) {
        // Check if we need to send GGA
        if (config.sendPosition && 
            millis() - lastGGATime > ggaInterval) {
            sendNMEAPosition();
        }
        
        // Check for incoming data
        if (tcpClient.connected() && tcpClient.available()) {
            size_t available = tcpClient.available();
            if (available > sizeof(tempBuffer)) {
                available = sizeof(tempBuffer);
            }
            
            size_t read = tcpClient.read(tempBuffer, available);
            if (read > 0) {
                processRTCMData(tempBuffer, read);
                lastReceiveTime = millis();
            }
        }
        
        // Check for timeout
        if (millis() - lastReceiveTime > 30000) {
            ESP_LOGW(TAG, "No data received for 30 seconds");
            setState(ERROR);
            break;
        }
        
        // Check connection
        if (!tcpClient.connected()) {
            ESP_LOGE(TAG, "Connection lost");
            setState(ERROR);
            break;
        }
        
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    
    // Cleanup
    if (tcpClient.connected()) {
        tcpClient.stop();
    }
    authenticated = false;
}

bool NTRIPClient::waitForData(uint32_t timeout) {
    uint32_t start = millis();
    while (millis() - start < timeout) {
        if (tcpClient.available()) {
            return true;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    return false;
}

bool NTRIPClient::parseSourceTable(const char* data) {
    // This would parse the NTRIP source table if needed
    // For now, just log it
    ESP_LOGI(TAG, "Source table:\n%s", data);
    return true;
}