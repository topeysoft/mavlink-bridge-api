#include "ESPNowRTCMTransport.h"
#include <esp_log.h>
#include <esp_wifi.h>

static const char* TAG = "ESPNowRTCMTransport";

// Static instance for callbacks
ESPNowRTCMTransport* ESPNowRTCMTransport::instance = nullptr;

// Broadcast MAC address
static const uint8_t BROADCAST_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

ESPNowRTCMTransport::ESPNowRTCMTransport()
    : isESPNowInitialized(false) {
    periodStartTime = millis();
    instance = this;
}

ESPNowRTCMTransport::~ESPNowRTCMTransport() {
    end();
    if (instance == this) {
        instance = nullptr;
    }
}

bool ESPNowRTCMTransport::begin(const JsonObjectConst& config) {
    // Parse configuration
    // Expected: { "peers": ["AA:BB:CC:DD:EE:FF", ...], "channel": 1, "broadcast": false }

    // Initialize ESP-NOW
    if (!initESPNow()) {
        ESP_LOGE(TAG, "Failed to initialize ESP-NOW");
        setState(ERROR);
        return false;
    }

    uint8_t channel = config["channel"] | 0;
    bool useBroadcast = config["broadcast"] | false;

    // Add broadcast peer if enabled
    if (useBroadcast) {
        if (!addPeer(BROADCAST_MAC, channel)) {
            ESP_LOGW(TAG, "Failed to add broadcast peer");
        }
    }

    // Parse and add peers
    if (config.containsKey("peers")) {
        JsonArrayConst peersArray = config["peers"];
        for (JsonVariantConst peerVar : peersArray) {
            const char* macStr = peerVar.as<const char*>();
            if (macStr) {
                if (!addPeer(macStr, channel)) {
                    ESP_LOGW(TAG, "Failed to add peer: %s", macStr);
                }
            }
        }
    }

    if (peers.empty()) {
        ESP_LOGW(TAG, "No peers configured, ESP-NOW transport will not send data");
    }

    ESP_LOGI(TAG, "ESP-NOW transport initialized with %d peers", peers.size());

    setState(CONNECTED);
    return true;
}

void ESPNowRTCMTransport::end() {
    clearPeers();
    deinitESPNow();
    setState(DISCONNECTED);
    ESP_LOGI(TAG, "ESP-NOW transport stopped");
}

size_t ESPNowRTCMTransport::send(const uint8_t* data, size_t length) {
    if (!isReady()) {
        recordError();
        return 0;
    }

    if (length == 0 || length > MAX_ESPNOW_PAYLOAD) {
        ESP_LOGW(TAG, "Invalid data length: %d (max: %d)", length, MAX_ESPNOW_PAYLOAD);
        recordError();
        return 0;
    }

    size_t totalSent = 0;

    // Send to all peers
    for (const auto& peer : peers) {
        esp_err_t result = esp_now_send(peer.mac, data, length);

        if (result == ESP_OK) {
            totalSent += length;
            ESP_LOGV(TAG, "Queued %d bytes to peer %02X:%02X:%02X:%02X:%02X:%02X",
                     length, peer.mac[0], peer.mac[1], peer.mac[2],
                     peer.mac[3], peer.mac[4], peer.mac[5]);
        } else {
            ESP_LOGW(TAG, "Failed to send to peer: %s", esp_err_to_name(result));
            recordError();
        }
    }

    if (totalSent > 0) {
        updateStatistics(totalSent);
    }

    return totalSent;
}

bool ESPNowRTCMTransport::isReady() const {
    return currentState == CONNECTED && isESPNowInitialized && !peers.empty();
}

ESPNowRTCMTransport::State ESPNowRTCMTransport::getState() const {
    return currentState;
}

bool ESPNowRTCMTransport::addPeer(const uint8_t* macAddress, uint8_t channel) {
    // Check if peer already exists
    for (const auto& peer : peers) {
        if (memcmp(peer.mac, macAddress, 6) == 0) {
            ESP_LOGD(TAG, "Peer already exists");
            return true;
        }
    }

    // Add to ESP-NOW
    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, macAddress, 6);
    peerInfo.channel = channel;
    peerInfo.ifidx = WIFI_IF_STA;
    peerInfo.encrypt = false;

    esp_err_t result = esp_now_add_peer(&peerInfo);
    if (result != ESP_OK) {
        ESP_LOGE(TAG, "Failed to add ESP-NOW peer: %s", esp_err_to_name(result));
        return false;
    }

    // Add to our list
    Peer peer;
    memcpy(peer.mac, macAddress, 6);
    peer.broadcast = (memcmp(macAddress, BROADCAST_MAC, 6) == 0);
    peer.channel = channel;
    peers.push_back(peer);

    ESP_LOGI(TAG, "Added peer: %02X:%02X:%02X:%02X:%02X:%02X (channel %d)",
             macAddress[0], macAddress[1], macAddress[2],
             macAddress[3], macAddress[4], macAddress[5], channel);

    return true;
}

bool ESPNowRTCMTransport::addPeer(const char* macString, uint8_t channel) {
    uint8_t mac[6];
    if (!parseMacAddress(macString, mac)) {
        ESP_LOGE(TAG, "Invalid MAC address format: %s", macString);
        return false;
    }

    return addPeer(mac, channel);
}

void ESPNowRTCMTransport::clearPeers() {
    for (const auto& peer : peers) {
        esp_now_del_peer(peer.mac);
    }
    peers.clear();
    ESP_LOGI(TAG, "Cleared all peers");
}

bool ESPNowRTCMTransport::initESPNow() {
    if (isESPNowInitialized) {
        return true;
    }

    // ESP-NOW requires WiFi to be initialized
    if (WiFi.status() == WL_NO_SHIELD) {
        WiFi.mode(WIFI_STA);
    }

    // Initialize ESP-NOW
    esp_err_t result = esp_now_init();
    if (result != ESP_OK) {
        ESP_LOGE(TAG, "ESP-NOW init failed: %s", esp_err_to_name(result));
        return false;
    }

    // Register send callback
    esp_now_register_send_cb(onDataSent);

    isESPNowInitialized = true;
    ESP_LOGI(TAG, "ESP-NOW initialized");
    return true;
}

void ESPNowRTCMTransport::deinitESPNow() {
    if (!isESPNowInitialized) {
        return;
    }

    esp_now_unregister_send_cb();
    esp_now_deinit();

    isESPNowInitialized = false;
    ESP_LOGI(TAG, "ESP-NOW deinitialized");
}

bool ESPNowRTCMTransport::parseMacAddress(const char* macStr, uint8_t* mac) {
    // Parse MAC address in format "AA:BB:CC:DD:EE:FF" or "AA-BB-CC-DD-EE-FF"
    int values[6];
    int count = sscanf(macStr, "%x:%x:%x:%x:%x:%x",
                       &values[0], &values[1], &values[2],
                       &values[3], &values[4], &values[5]);

    if (count != 6) {
        count = sscanf(macStr, "%x-%x-%x-%x-%x-%x",
                       &values[0], &values[1], &values[2],
                       &values[3], &values[4], &values[5]);
    }

    if (count != 6) {
        return false;
    }

    for (int i = 0; i < 6; i++) {
        mac[i] = (uint8_t)values[i];
    }

    return true;
}

void ESPNowRTCMTransport::onDataSent(const uint8_t* mac, esp_now_send_status_t status) {
    if (instance) {
        if (status != ESP_NOW_SEND_SUCCESS) {
            ESP_LOGD(TAG, "ESP-NOW send failed to %02X:%02X:%02X:%02X:%02X:%02X",
                     mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
            instance->recordError();
        }
    }
}
