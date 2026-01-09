#include "UDPRTCMTransport.h"
#include <WiFi.h>
#include <esp_log.h>

static const char* TAG = "UDPRTCMTransport";

UDPRTCMTransport::UDPRTCMTransport()
    : localPort(0)
    , broadcastEnabled(false) {
    periodStartTime = millis();
}

UDPRTCMTransport::~UDPRTCMTransport() {
    end();
}

bool UDPRTCMTransport::begin(const JsonObjectConst& config) {
    // Parse configuration
    // Expected: { "port": 14550, "broadcast": true, "targets": ["192.168.1.100:14550", ...] }

    if (!config.containsKey("port")) {
        ESP_LOGE(TAG, "Missing required 'port' configuration");
        setState(ERROR);
        return false;
    }

    localPort = config["port"] | 14550;
    broadcastEnabled = config["broadcast"] | false;

    // Start UDP
    if (!udp.begin(localPort)) {
        ESP_LOGE(TAG, "Failed to start UDP on port %d", localPort);
        setState(ERROR);
        return false;
    }

    ESP_LOGI(TAG, "UDP started on port %d", localPort);

    // Parse targets
    if (config.containsKey("targets")) {
        JsonArrayConst targetsArray = config["targets"];
        for (JsonVariantConst targetVar : targetsArray) {
            const char* targetStr = targetVar.as<const char*>();
            if (!targetStr) continue;

            // Parse "IP:PORT" format
            String targetString(targetStr);
            int colonIdx = targetString.indexOf(':');

            if (colonIdx > 0) {
                String ipStr = targetString.substring(0, colonIdx);
                String portStr = targetString.substring(colonIdx + 1);

                IPAddress ip;
                if (ip.fromString(ipStr)) {
                    uint16_t port = portStr.toInt();
                    if (port > 0) {
                        addTarget(ip, port);
                    }
                }
            }
        }
    }

    ESP_LOGI(TAG, "Configured %d unicast targets, broadcast: %s",
             targets.size(), broadcastEnabled ? "enabled" : "disabled");

    setState(CONNECTED);
    return true;
}

void UDPRTCMTransport::end() {
    udp.stop();
    targets.clear();
    setState(DISCONNECTED);
    ESP_LOGI(TAG, "UDP transport stopped");
}

size_t UDPRTCMTransport::send(const uint8_t* data, size_t length) {
    if (!isReady()) {
        recordError();
        return 0;
    }

    size_t totalSent = 0;

    // Send to broadcast if enabled
    if (broadcastEnabled) {
        udp.beginPacket(IPAddress(255, 255, 255, 255), localPort);
        udp.write(data, length);
        if (udp.endPacket()) {
            totalSent += length;
            ESP_LOGD(TAG, "Broadcast %d bytes", length);
        } else {
            ESP_LOGW(TAG, "Broadcast send failed");
            recordError();
        }
    }

    // Send to all configured targets
    for (const auto& target : targets) {
        udp.beginPacket(target.address, target.port);
        udp.write(data, length);
        if (udp.endPacket()) {
            totalSent += length;
            ESP_LOGD(TAG, "Sent %d bytes to %s:%d",
                     length, target.address.toString().c_str(), target.port);
        } else {
            ESP_LOGW(TAG, "Failed to send to %s:%d",
                     target.address.toString().c_str(), target.port);
            recordError();
        }
    }

    if (totalSent > 0) {
        updateStatistics(totalSent);
    }

    return totalSent;
}

bool UDPRTCMTransport::isReady() const {
    return currentState == CONNECTED && WiFi.status() == WL_CONNECTED;
}

UDPRTCMTransport::State UDPRTCMTransport::getState() const {
    return currentState;
}

bool UDPRTCMTransport::addTarget(const IPAddress& address, uint16_t port) {
    Target target = { address, port };
    targets.push_back(target);
    ESP_LOGI(TAG, "Added UDP target: %s:%d", address.toString().c_str(), port);
    return true;
}

void UDPRTCMTransport::clearTargets() {
    targets.clear();
    ESP_LOGI(TAG, "Cleared all UDP targets");
}
