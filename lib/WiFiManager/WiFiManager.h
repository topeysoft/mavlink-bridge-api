#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <vector>
#include "../EventManager/EventManager.h"
#include "../ConfigManager/ConfigManager.h"

struct WiFiNetwork {
    String ssid;
    int8_t rssi;
    wifi_auth_mode_t authMode;
    uint8_t channel;
    
    WiFiNetwork() : ssid(""), rssi(0), authMode(WIFI_AUTH_OPEN), channel(0) {}
    WiFiNetwork(const String& s, int8_t r, wifi_auth_mode_t auth, uint8_t ch) 
        : ssid(s), rssi(r), authMode(auth), channel(ch) {}
};

class WiFiManager {
public:
    enum State {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,
        AP_MODE,
        ERROR
    };

    struct ConnectionInfo {
        String ssid;
        uint8_t bssid[6];
        int8_t rssi;
        IPAddress ip;
        IPAddress gateway;
        IPAddress subnet;
        
        ConnectionInfo() : ssid(""), rssi(0) {
            memset(bssid, 0, 6);
        }
    };

private:
    static WiFiManager* instance;
    State currentState;
    State previousState;
    ConnectionInfo connectionInfo;
    TaskHandle_t wifiTask;
    uint8_t reconnectAttempts;
    unsigned long lastReconnectTime;
    unsigned long lastSignalCheck;
    
    static const uint8_t MAX_RECONNECT_ATTEMPTS = 6;
    static const unsigned long SIGNAL_CHECK_INTERVAL = 30000; // 30 seconds
    static const unsigned long CONNECTION_TIMEOUT = 10000; // 10 seconds
    static const uint16_t RECONNECT_DELAYS[MAX_RECONNECT_ATTEMPTS]; // Exponential backoff delays
    
    EventManager* eventManager;
    ConfigManager* configManager;
    
    String connectingSsid;
    bool isScanning;
    std::vector<WiFiNetwork> lastScanResults;
    unsigned long lastScanTime;
    
public:
    WiFiManager();
    ~WiFiManager();
    
    static WiFiManager* getInstance();
    void begin();
    bool connect(const String& ssid, const String& password);
    void disconnect();
    State getState() const { return currentState; }
    State getPreviousState() const { return previousState; }
    ConnectionInfo getConnectionInfo() const { return connectionInfo; }
    void startAccessPoint();
    void startAccessPoint(const String& ssid, const String& password = "");
    void stopAccessPoint();
    std::vector<WiFiNetwork> scan(bool forceNew = false);
    std::vector<WiFiNetwork> getLastScanResults() const { return lastScanResults; }
    
    // Configuration integration
    bool addSavedNetwork(const String& ssid, const String& password, uint8_t priority = 0);
    bool removeSavedNetwork(const String& ssid);
    void tryAutoConnect();
    
private:
    static void wifiTaskFunction(void* parameter);
    void wifiTask();
    void handleStateTransition();
    void attemptReconnection();
    void updateConnectionInfo();
    void checkSignalStrength();
    void setState(State newState);
    void publishStateEvent();
    void publishConnectionEvent(const String& ssid, const String& reason = "");
    void publishSignalUpdate();
    unsigned long getReconnectDelay(uint8_t attempt);
    SavedNetwork* findBestSavedNetwork();
    bool connectToNetwork(const String& ssid, const String& password);
    
    // WiFi event handlers
    static void onWiFiEvent(WiFiEvent_t event);
    void handleWiFiEvent(WiFiEvent_t event);
};