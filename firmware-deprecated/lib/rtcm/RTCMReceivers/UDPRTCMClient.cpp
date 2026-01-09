#include "UDPRTCMClient.h"
#include <WiFi.h>
#include <esp_log.h>

static const char* TAG = "UDPRTCMClient";

UDPRTCMClient::UDPRTCMClient(uint16_t listenPort)
    : port(listenPort)
    , remotePort(0)
    , acceptAnySource(true) {
}

UDPRTCMClient::~UDPRTCMClient() {
    disconnect();
}

bool UDPRTCMClient::connect() {
    if (currentState == CONNECTED) {
        return true;
    }
    
    setState(CONNECTING);
    
    ESP_LOGI(TAG, "Starting UDP listener on port %d", port);
    
    if (!udp.begin(port)) {
        ESP_LOGE(TAG, "Failed to start UDP listener");
        setState(ERROR);
        return false;
    }
    
    ESP_LOGI(TAG, "UDP listener started");
    setState(CONNECTED);
    
    // Start receive task
    if (receiveTask == nullptr) {
        xTaskCreate(udpTaskFunction, "UDP_RTCM_Task", 4096, this, 5, &receiveTask);
    }
    
    return true;
}

void UDPRTCMClient::disconnect() {
    if (receiveTask != nullptr) {
        vTaskDelete(receiveTask);
        receiveTask = nullptr;
    }
    
    udp.stop();
    setState(DISCONNECTED);
}

void UDPRTCMClient::setRemoteEndpoint(IPAddress ip, uint16_t port) {
    remoteIP = ip;
    remotePort = port;
    acceptAnySource = false;
}

void UDPRTCMClient::udpTaskFunction(void* parameter) {
    UDPRTCMClient* client = static_cast<UDPRTCMClient*>(parameter);
    client->runReceiveTask();
    vTaskDelete(nullptr);
}

void UDPRTCMClient::runReceiveTask() {
    uint8_t tempBuffer[512];
    
    while (currentState == CONNECTED) {
        int packetSize = udp.parsePacket();
        
        if (packetSize > 0) {
            // Check source if configured
            if (!acceptAnySource) {
                if (udp.remoteIP() != remoteIP || udp.remotePort() != remotePort) {
                    ESP_LOGW(TAG, "Ignoring packet from %s:%d", 
                            udp.remoteIP().toString().c_str(), udp.remotePort());
                    udp.clear();
                    continue;
                }
            }
            
            // Read packet
            while (packetSize > 0) {
                size_t toRead = (packetSize > sizeof(tempBuffer)) ? sizeof(tempBuffer) : packetSize;
                size_t read = udp.read(tempBuffer, toRead);
                
                if (read > 0) {
                    processRTCMData(tempBuffer, read);
                    packetSize -= read;
                } else {
                    break;
                }
            }
        }
        
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}