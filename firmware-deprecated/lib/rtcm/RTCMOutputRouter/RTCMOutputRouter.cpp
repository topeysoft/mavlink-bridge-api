#include "RTCMOutputRouter.h"
#include "../RTCMFormatters/RawRTCMFormatter.h"
#include "../RTCMFormatters/MAVLinkRTCMFormatter.h"
#include "../RTCMTransports/SerialRTCMTransport.h"
#include "../RTCMTransports/UDPRTCMTransport.h"
#include "../RTCMTransports/TCPRTCMTransport.h"
#include "../RTCMTransports/ESPNowRTCMTransport.h"
#include <esp_log.h>

static const char* TAG = "RTCMOutputRouter";

RTCMOutputRouter::RTCMOutputRouter() {
    routerMutex = xSemaphoreCreateMutex();
    memset(&stats, 0, sizeof(stats));
}

RTCMOutputRouter::~RTCMOutputRouter() {
    clearTargets();
    if (routerMutex) {
        vSemaphoreDelete(routerMutex);
    }
}

bool RTCMOutputRouter::begin(const JsonArrayConst& config) {
    clearTargets();

    ESP_LOGI(TAG, "Initializing output router with %d targets", config.size());

    for (JsonVariantConst targetVar : config) {
        JsonObjectConst targetConfig = targetVar.as<JsonObjectConst>();
        if (!targetConfig) {
            ESP_LOGW(TAG, "Invalid target configuration");
            continue;
        }

        if (!addTarget(targetConfig)) {
            ESP_LOGW(TAG, "Failed to add target");
        }
    }

    ESP_LOGI(TAG, "Output router initialized with %d active targets", targets.size());
    return true;
}

bool RTCMOutputRouter::addTarget(const JsonObjectConst& config) {
    // Expected format:
    // {
    //   "name": "Flight Controller",
    //   "protocol": "mavlink",
    //   "transport": "serial",
    //   "enabled": true,
    //   "params": { ... }
    // }

    const char* protocol = config["protocol"] | "raw";
    const char* transport = config["transport"];
    const char* name = config["name"] | "";
    bool enabled = config["enabled"] | true;

    if (!transport) {
        ESP_LOGE(TAG, "Missing required 'transport' field");
        return false;
    }

    JsonObjectConst params = config["params"];

    // Create formatter
    auto formatter = createFormatter(protocol, params);
    if (!formatter) {
        ESP_LOGE(TAG, "Failed to create formatter: %s", protocol);
        return false;
    }

    // Create transport
    auto transportObj = createTransport(transport, params);
    if (!transportObj) {
        ESP_LOGE(TAG, "Failed to create transport: %s", transport);
        return false;
    }

    // Initialize transport
    if (!transportObj->begin(params)) {
        ESP_LOGE(TAG, "Failed to initialize transport: %s", transport);
        return false;
    }

    // Add to targets
    OutputTarget target;
    target.formatter = std::move(formatter);
    target.transport = std::move(transportObj);
    target.enabled = enabled;
    target.name = name;

    xSemaphoreTake(routerMutex, portMAX_DELAY);
    targets.push_back(std::move(target));
    stats.totalTargets = targets.size();
    xSemaphoreGive(routerMutex);

    ESP_LOGI(TAG, "Added target '%s': %s via %s", name, protocol, transport);
    return true;
}

void RTCMOutputRouter::clearTargets() {
    xSemaphoreTake(routerMutex, portMAX_DELAY);

    // End all transports
    for (auto& target : targets) {
        if (target.transport) {
            target.transport->end();
        }
    }

    targets.clear();
    stats.totalTargets = 0;
    stats.activeTargets = 0;

    xSemaphoreGive(routerMutex);

    ESP_LOGI(TAG, "Cleared all targets");
}

void RTCMOutputRouter::route(const uint8_t* rtcmData, size_t length) {
    if (!rtcmData || length == 0) {
        return;
    }

    xSemaphoreTake(routerMutex, portMAX_DELAY);

    stats.activeTargets = 0;

    // Route to each enabled target
    for (auto& target : targets) {
        if (!target.enabled || !target.transport->isReady()) {
            continue;
        }

        stats.activeTargets++;

        // Format data (may produce multiple fragments)
        target.formatter->format(rtcmData, length,
            [&](const RTCMDataFormatter::FormattedData& formatted) {
                // Send formatted data via transport
                size_t sent = target.transport->send(formatted.data.data(),
                                                     formatted.data.size());

                if (sent > 0) {
                    ESP_LOGD(TAG, "Sent %d bytes via %s (%s) - fragment %d/%d",
                             sent, target.transport->getTypeName(),
                             target.formatter->getTypeName(),
                             formatted.fragmentIndex + 1, formatted.totalFragments);
                } else {
                    ESP_LOGW(TAG, "Failed to send via %s", target.transport->getTypeName());
                    stats.routingErrors++;
                }
            });
    }

    // Update statistics
    stats.messagesRouted++;
    stats.bytesRouted += length;
    stats.lastRouteTime = millis();

    xSemaphoreGive(routerMutex);

    ESP_LOGV(TAG, "Routed %d bytes to %d active targets", length, stats.activeTargets);
}

bool RTCMOutputRouter::setTargetEnabled(size_t index, bool enabled) {
    xSemaphoreTake(routerMutex, portMAX_DELAY);

    if (index >= targets.size()) {
        xSemaphoreGive(routerMutex);
        return false;
    }

    targets[index].enabled = enabled;

    xSemaphoreGive(routerMutex);

    ESP_LOGI(TAG, "Target %d %s", index, enabled ? "enabled" : "disabled");
    return true;
}

void RTCMOutputRouter::resetStatistics() {
    xSemaphoreTake(routerMutex, portMAX_DELAY);
    memset(&stats, 0, sizeof(stats));
    stats.totalTargets = targets.size();
    xSemaphoreGive(routerMutex);
}

void RTCMOutputRouter::getTargetInfo(JsonDocument& doc) const {
    doc.clear();
    JsonArray targetsArray = doc.createNestedArray("targets");

    xSemaphoreTake(routerMutex, portMAX_DELAY);

    for (size_t i = 0; i < targets.size(); i++) {
        const auto& target = targets[i];

        JsonObject targetObj = targetsArray.createNestedObject();
        targetObj["index"] = i;
        targetObj["name"] = target.name;
        targetObj["enabled"] = target.enabled;
        targetObj["protocol"] = target.formatter->getTypeName();
        targetObj["transport"] = target.transport->getTypeName();
        targetObj["ready"] = target.transport->isReady();
        targetObj["state"] = (int)target.transport->getState();

        // Transport statistics
        RTCMTransport::Statistics transportStats = target.transport->getStatistics();
        JsonObject statsObj = targetObj.createNestedObject("statistics");
        statsObj["bytesSent"] = transportStats.bytesSent;
        statsObj["messagesSent"] = transportStats.messagesSent;
        statsObj["sendErrors"] = transportStats.sendErrors;
        statsObj["sendRate"] = transportStats.sendRate;
    }

    xSemaphoreGive(routerMutex);
}

std::unique_ptr<RTCMDataFormatter> RTCMOutputRouter::createFormatter(
    const char* type, const JsonObjectConst& params) {

    if (strcmp(type, "raw") == 0) {
        return std::make_unique<RawRTCMFormatter>();
    } else if (strcmp(type, "mavlink") == 0) {
        uint8_t systemId = params["systemId"] | 1;
        uint8_t componentId = params["componentId"] | 1;
        return std::make_unique<MAVLinkRTCMFormatter>(systemId, componentId);
    }

    ESP_LOGE(TAG, "Unknown formatter type: %s", type);
    return nullptr;
}

std::unique_ptr<RTCMTransport> RTCMOutputRouter::createTransport(
    const char* type, const JsonObjectConst& params) {

    if (strcmp(type, "serial") == 0) {
        return std::make_unique<SerialRTCMTransport>();
    } else if (strcmp(type, "udp") == 0) {
        return std::make_unique<UDPRTCMTransport>();
    } else if (strcmp(type, "tcp") == 0) {
        return std::make_unique<TCPRTCMTransport>();
    } else if (strcmp(type, "espnow") == 0) {
        return std::make_unique<ESPNowRTCMTransport>();
    }

    ESP_LOGE(TAG, "Unknown transport type: %s", type);
    return nullptr;
}
