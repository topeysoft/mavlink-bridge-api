#include "TCPRTCMClient.h"
#include <esp_log.h>
#include <cstring>

static const char* TAG = "TCPRTCMClient";

TCPRTCMClient::TCPRTCMClient(const char* hostAddr, uint16_t portNum)
    : port(portNum)
    , reconnectDelay(1000)
    , lastReconnectAttempt(0)
    , connectionTimeout(5000) {
    strncpy(host, hostAddr, sizeof(host) - 1);
    host[sizeof(host) - 1] = '\0';
}

TCPRTCMClient::~TCPRTCMClient() {
    disconnect();
}

bool TCPRTCMClient::connect() {
    if (currentState == CONNECTED) {
        return true;
    }
    
    setState(CONNECTING);
    
    ESP_LOGI(TAG, "Connecting to TCP server %s:%d", host, port);
    
    // Connect with timeout
    uint32_t startTime = millis();
    tcpClient.setTimeout(connectionTimeout / 1000);  // Convert to seconds
    
    if (!tcpClient.connect(host, port)) {
        ESP_LOGE(TAG, "Failed to connect to TCP server");
        setState(ERROR);
        return false;
    }
    
    ESP_LOGI(TAG, "Connected to TCP server");
    setState(CONNECTED);
    
    // Start receive task
    if (receiveTask == nullptr) {
        xTaskCreate(tcpTaskFunction, "TCP_RTCM_Task", 4096, this, 5, &receiveTask);
    }
    
    return true;
}

void TCPRTCMClient::disconnect() {
    if (receiveTask != nullptr) {
        vTaskDelete(receiveTask);
        receiveTask = nullptr;
    }
    
    if (tcpClient.connected()) {
        tcpClient.stop();
    }
    
    setState(DISCONNECTED);
}

void TCPRTCMClient::tcpTaskFunction(void* parameter) {
    TCPRTCMClient* client = static_cast<TCPRTCMClient*>(parameter);
    client->runReceiveTask();
    vTaskDelete(nullptr);
}

void TCPRTCMClient::runReceiveTask() {
    uint8_t tempBuffer[512];
    uint32_t lastReceiveTime = millis();
    
    while (currentState == CONNECTED) {
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
}