#include "TCPRTCMTransport.h"
#include <esp_log.h>

static const char* TAG = "TCPRTCMTransport";

TCPRTCMTransport::TCPRTCMTransport()
    : server(nullptr)
    , port(0)
    , lastCleanupTime(0) {
    periodStartTime = millis();
}

TCPRTCMTransport::~TCPRTCMTransport() {
    end();
}

bool TCPRTCMTransport::begin(const JsonObjectConst& config) {
    // Parse configuration
    // Expected: { "port": 5015 }

    if (!config.containsKey("port")) {
        ESP_LOGE(TAG, "Missing required 'port' configuration");
        setState(ERROR);
        return false;
    }

    port = config["port"] | 5015;

    // Create and start server
    server = new WiFiServer(port);
    server->begin();

    ESP_LOGI(TAG, "TCP server started on port %d", port);

    setState(CONNECTED);
    lastCleanupTime = millis();
    return true;
}

void TCPRTCMTransport::end() {
    if (server) {
        // Disconnect all clients
        for (auto& client : clients) {
            if (client.connected()) {
                client.stop();
            }
        }
        clients.clear();

        server->end();
        delete server;
        server = nullptr;
    }

    setState(DISCONNECTED);
    ESP_LOGI(TAG, "TCP transport stopped");
}

size_t TCPRTCMTransport::send(const uint8_t* data, size_t length) {
    if (!isReady()) {
        recordError();
        return 0;
    }

    // Accept new clients periodically
    acceptNewClients();

    // Cleanup disconnected clients periodically
    if (millis() - lastCleanupTime > CLEANUP_INTERVAL) {
        cleanupDisconnectedClients();
        lastCleanupTime = millis();
    }

    size_t totalSent = 0;

    // Send to all connected clients
    for (auto& client : clients) {
        if (client.connected()) {
            size_t sent = client.write(data, length);
            if (sent == length) {
                totalSent += sent;
                ESP_LOGV(TAG, "Sent %d bytes to client %s",
                         sent, client.remoteIP().toString().c_str());
            } else {
                ESP_LOGW(TAG, "Partial send to client %s: %d/%d bytes",
                         client.remoteIP().toString().c_str(), sent, length);
                recordError();
            }
        }
    }

    if (totalSent > 0) {
        updateStatistics(totalSent);
    }

    return totalSent;
}

bool TCPRTCMTransport::isReady() const {
    return currentState == CONNECTED && server != nullptr;
}

TCPRTCMTransport::State TCPRTCMTransport::getState() const {
    return currentState;
}

void TCPRTCMTransport::acceptNewClients() {
    if (!server || clients.size() >= MAX_CLIENTS) {
        return;
    }

    WiFiClient newClient = server->available();
    if (newClient && newClient.connected()) {
        clients.push_back(newClient);
        ESP_LOGI(TAG, "New client connected: %s (total: %d)",
                 newClient.remoteIP().toString().c_str(), clients.size());
    }
}

void TCPRTCMTransport::cleanupDisconnectedClients() {
    size_t before = clients.size();

    clients.erase(
        std::remove_if(clients.begin(), clients.end(),
            [](WiFiClient& client) {
                if (!client.connected()) {
                    client.stop();
                    return true;
                }
                return false;
            }),
        clients.end()
    );

    size_t removed = before - clients.size();
    if (removed > 0) {
        ESP_LOGI(TAG, "Cleaned up %d disconnected clients (remaining: %d)",
                 removed, clients.size());
    }
}
