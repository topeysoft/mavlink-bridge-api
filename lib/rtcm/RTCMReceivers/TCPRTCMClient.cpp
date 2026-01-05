#include "TCPRTCMClient.h"
#include <esp_log.h>
#include <cstring>

static const char* TAG = "TCPRTCMClient";

TCPRTCMClient::TCPRTCMClient(const char* hostAddr, uint16_t portNum)
    : port(portNum)
    , reconnectDelay(1000)
    , lastReconnectAttempt(0)
    , connectionTimeout(5000)
    , initialDataTimeout(120000)  // 2 minutes for first data
    , dataTimeout(60000) {        // 1 minute after data flowing
    strncpy(host, hostAddr, sizeof(host) - 1);
    host[sizeof(host) - 1] = '\0';
}

TCPRTCMClient::~TCPRTCMClient() {
    disconnect();
}

bool TCPRTCMClient::connect() {
    if (currentState == CONNECTED) {
        ESP_LOGI(TAG, "Already connected to %s:%d", host, port);
        return true;
    }

    // Check WiFi connection first
    wl_status_t wifiStatus = WiFi.status();
    if (wifiStatus != WL_CONNECTED) {
        ESP_LOGE(TAG, "Cannot connect to TCP server: WiFi not connected");
        ESP_LOGE(TAG, "  WiFi status: %d (0=IDLE, 1=NO_SSID, 3=CONNECTED, 4=FAILED, 6=DISCONNECTED)",
                 wifiStatus);
        ESP_LOGE(TAG, "  SSID: %s", WiFi.SSID().c_str());
        ESP_LOGE(TAG, "  Local IP: %s", WiFi.localIP().toString().c_str());
        setState(ERROR);
        return false;
    }

    // Verify we have a valid IP
    IPAddress localIP = WiFi.localIP();
    if (localIP[0] == 0) {
        ESP_LOGE(TAG, "Cannot connect: No valid IP address assigned (WiFi status: %d)", wifiStatus);
        setState(ERROR);
        return false;
    }

    setState(CONNECTING);

    ESP_LOGI(TAG, "Connecting to TCP server %s:%d", host, port);
    ESP_LOGI(TAG, "  WiFi SSID: %s", WiFi.SSID().c_str());
    ESP_LOGI(TAG, "  Local IP: %s", localIP.toString().c_str());
    ESP_LOGI(TAG, "  WiFi RSSI: %d dBm", WiFi.RSSI());
    ESP_LOGI(TAG, "  Gateway: %s", WiFi.gatewayIP().toString().c_str());

    // Connect with timeout
    uint32_t startTime = millis();
    tcpClient.setTimeout(connectionTimeout / 1000);  // Convert to seconds

    if (!tcpClient.connect(host, port)) {
        uint32_t elapsed = millis() - startTime;
        ESP_LOGE(TAG, "Failed to connect to TCP server %s:%d", host, port);
        ESP_LOGE(TAG, "  Timeout: %lu ms (configured: %lu ms)", elapsed, connectionTimeout);
        ESP_LOGE(TAG, "  WiFi RSSI: %d dBm", WiFi.RSSI());
        ESP_LOGE(TAG, "  Gateway reachable: %s", WiFi.gatewayIP().toString().c_str());
        ESP_LOGE(TAG, "  Possible causes:");
        ESP_LOGE(TAG, "    1. RTCM server not running or not reachable");
        ESP_LOGE(TAG, "    2. Firewall blocking connection");
        ESP_LOGE(TAG, "    3. Wrong host/port configuration");
        ESP_LOGE(TAG, "    4. Network routing issue");
        setState(ERROR);
        return false;
    }

    uint32_t connectTime = millis() - startTime;
    ESP_LOGI(TAG, "✓ Connected to TCP server in %lu ms", connectTime);
    ESP_LOGI(TAG, "  Remote IP: %s", tcpClient.remoteIP().toString().c_str());
    ESP_LOGI(TAG, "  Remote Port: %d", tcpClient.remotePort());
    setState(CONNECTED);

    // Start receive task with priority 1 (same as HTTP/WS tasks to avoid starvation)
    if (receiveTask == nullptr) {
        xTaskCreate(tcpTaskFunction, "TCP_RTCM_Task", 4096, this, 1, &receiveTask);
        ESP_LOGI(TAG, "✓ TCP receive task started (priority: 1)");
    }

    return true;
}

void TCPRTCMClient::disconnect() {
    ESP_LOGI(TAG, "Disconnecting TCP client (state: %d, task: %p)", (int)currentState, receiveTask);

    // Change state first to signal task to exit
    State oldState = currentState;
    setState(DISCONNECTED);

    // Close TCP connection to unblock any reads
    if (tcpClient.connected()) {
        tcpClient.stop();
        ESP_LOGI(TAG, "TCP connection closed");
    }

    // Only try to delete task if we were actually connected and task was created
    if (receiveTask != nullptr && oldState == CONNECTED) {
        ESP_LOGI(TAG, "Waiting for receive task to exit...");

        // Give task time to exit gracefully (max 1 second)
        for (int i = 0; i < 100; i++) {
            // Check if task has already deleted itself
            if (receiveTask == nullptr) {
                ESP_LOGI(TAG, "Receive task exited gracefully");
                break;
            }
            vTaskDelay(pdMS_TO_TICKS(10));
        }

        // If task still exists, force delete it
        if (receiveTask != nullptr) {
            TaskHandle_t taskToDelete = receiveTask;
            receiveTask = nullptr; // Clear first to prevent double-delete

            ESP_LOGW(TAG, "Force deleting receive task");
            vTaskDelete(taskToDelete);
        }
    } else if (receiveTask != nullptr) {
        // Task handle exists but we weren't connected - invalid state
        ESP_LOGW(TAG, "Clearing stale task handle (was never started)");
        receiveTask = nullptr;
    }

    ESP_LOGI(TAG, "Disconnect complete");
}

void TCPRTCMClient::tcpTaskFunction(void* parameter) {
    TCPRTCMClient* client = static_cast<TCPRTCMClient*>(parameter);
    client->runReceiveTask();

    // Clear the task handle before deleting self to prevent double-delete
    client->receiveTask = nullptr;
    vTaskDelete(nullptr);
}

void TCPRTCMClient::runReceiveTask() {
    uint8_t tempBuffer[512];
    uint32_t lastReceiveTime = millis();
    uint32_t lastLogTime = millis();
    uint32_t lastStatusLogTime = millis();
    uint32_t totalBytesReceived = 0;
    bool hasReceivedData = false;

    ESP_LOGI(TAG, "TCP receive task started");
    ESP_LOGI(TAG, "Waiting for data from %s:%d...", host, port);

    while (currentState == CONNECTED) {
        uint32_t now = millis();

        // Check WiFi connection
        if (WiFi.status() != WL_CONNECTED) {
            ESP_LOGE(TAG, "WiFi disconnected during RTCM session");
            setState(ERROR);
            break;
        }

        // Check connection status
        if (!tcpClient.connected()) {
            ESP_LOGE(TAG, "TCP connection lost to %s:%d", host, port);
            setState(ERROR);
            break;
        }

        // Log periodic status (every 10 seconds)
        if (now - lastStatusLogTime > 10000) {
            size_t available = tcpClient.available();
            uint32_t waitTime = (now - lastReceiveTime) / 1000;
            if (!hasReceivedData) {
                ESP_LOGI(TAG, "Still waiting for first data... (%lu seconds elapsed, %d bytes available)",
                         waitTime, available);
            } else {
                ESP_LOGI(TAG, "Connection active: last data %lu seconds ago, %d bytes available",
                         waitTime, available);
            }
            lastStatusLogTime = now;
        }

        // Check for incoming data
        size_t available = tcpClient.available();
        if (available > 0) {
            if (available > sizeof(tempBuffer)) {
                available = sizeof(tempBuffer);
            }

            size_t read = tcpClient.read(tempBuffer, available);
            if (read > 0) {
                if (!hasReceivedData) {
                    ESP_LOGI(TAG, "✓ First data received! (%d bytes)", read);
                    hasReceivedData = true;
                }

                processRTCMData(tempBuffer, read);
                totalBytesReceived += read;
                lastReceiveTime = now;

                // Log statistics every 30 seconds (only after receiving data)
                if (hasReceivedData && now - lastLogTime > 30000) {
                    ESP_LOGI(TAG, "RTCM stats: %lu bytes received, data rate: %.2f KB/s",
                             totalBytesReceived, (float)totalBytesReceived / 30.0f / 1024.0f);
                    totalBytesReceived = 0;
                    lastLogTime = now;
                }
            }
        } else {
            // No data available - yield immediately to give HTTP/WS tasks CPU time
            vTaskDelay(pdMS_TO_TICKS(1));
        }

        // Check for timeout
        uint32_t timeSinceLastData = now - lastReceiveTime;
        uint32_t timeoutPeriod = hasReceivedData ? dataTimeout : initialDataTimeout;

        if (timeSinceLastData > timeoutPeriod) {
            if (!hasReceivedData) {
                ESP_LOGE(TAG, "No data received after %lu seconds - server may not be sending data",
                         timeSinceLastData / 1000);
                ESP_LOGE(TAG, "  Connection is established but idle");
                ESP_LOGE(TAG, "  Check if RTCM server requires authentication or configuration");
            } else {
                ESP_LOGW(TAG, "No data received for %lu seconds, disconnecting", timeSinceLastData / 1000);
            }
            setState(ERROR);
            break;
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }

    ESP_LOGI(TAG, "TCP receive task ending, total bytes received: %lu", totalBytesReceived);

    // Cleanup
    if (tcpClient.connected()) {
        tcpClient.stop();
    }
}