#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include "Arduino.h"
#include <vector>

// IPAddress mock class
class IPAddress {
private:
    uint32_t _address;
public:
    IPAddress() : _address(0) {}
    IPAddress(uint8_t a, uint8_t b, uint8_t c, uint8_t d) {
        _address = ((uint32_t)a << 24) | ((uint32_t)b << 16) | ((uint32_t)c << 8) | (uint32_t)d;
    }
    IPAddress(uint32_t addr) : _address(addr) {}
    
    operator uint32_t() const { return _address; }
    bool operator==(const IPAddress& addr) const { return _address == addr._address; }
    bool operator!=(const IPAddress& addr) const { return !(*this == addr); }
    
    uint8_t operator[](int index) const {
        return (_address >> ((3-index) * 8)) & 0xFF;
    }
    
    String toString() const {
        return String((*this)[0]) + "." + String((*this)[1]) + "." + String((*this)[2]) + "." + String((*this)[3]);
    }
};

// Event types
typedef int arduino_event_id_t;
#define ARDUINO_EVENT_WIFI_STA_CONNECTED 0
#define ARDUINO_EVENT_WIFI_STA_DISCONNECTED 1

// WiFi status constants
typedef enum {
    WL_IDLE_STATUS = 0,
    WL_NO_SSID_AVAIL = 1,
    WL_SCAN_COMPLETED = 2,
    WL_CONNECTED = 3,
    WL_CONNECT_FAILED = 4,
    WL_CONNECTION_LOST = 5,
    WL_DISCONNECTED = 6
} wl_status_t;

// WiFi mode constants
typedef enum {
    WIFI_OFF = 0,
    WIFI_STA = 1,
    WIFI_AP = 2,
    WIFI_AP_STA = 3
} wifi_mode_t;

// Mock WiFi network info
struct WiFiNetwork {
    String ssid;
    int32_t rssi;
    uint32_t channel;
    String bssid;
    
    WiFiNetwork(const String& s = "", int32_t r = -50, uint32_t c = 1, const String& b = "00:00:00:00:00:00")
        : ssid(s), rssi(r), channel(c), bssid(b) {}
};

// WiFi class mock
class WiFiClass {
private:
    wl_status_t connection_status;
    wifi_mode_t wifi_mode;
    String connected_ssid;
    String local_ip;
    std::vector<WiFiNetwork> scan_results;
    bool scan_complete;

public:
    WiFiClass() : connection_status(WL_DISCONNECTED), wifi_mode(WIFI_OFF), local_ip("192.168.1.100"), scan_complete(false) {}

    // Connection methods
    wl_status_t begin(const char* ssid, const char* password = nullptr) {
        connected_ssid = ssid ? ssid : "";
        connection_status = WL_CONNECTED;
        wifi_mode = WIFI_STA;
        return connection_status;
    }
    
    void disconnect(bool wifioff = false) {
        connection_status = WL_DISCONNECTED;
        connected_ssid = "";
        if (wifioff) wifi_mode = WIFI_OFF;
    }
    
    wl_status_t status() { return connection_status; }
    
    // Network info
    String SSID() { return connected_ssid; }
    String localIP() { return local_ip; }
    String macAddress() { return "AA:BB:CC:DD:EE:FF"; }
    
    // AP mode
    bool softAP(const char* ssid, const char* password = nullptr, int channel = 1, int ssid_hidden = 0, int max_connection = 4) {
        (void)ssid; (void)password; (void)channel; (void)ssid_hidden; (void)max_connection;
        wifi_mode = WIFI_AP;
        return true;
    }
    
    bool softAPdisconnect(bool wifioff = false) {
        if (wifioff) wifi_mode = WIFI_OFF;
        else wifi_mode = WIFI_STA;
        return true;
    }
    
    String softAPIP() { return "192.168.4.1"; }
    
    // Scanning
    int16_t scanNetworks(bool async = false, bool show_hidden = false) {
        (void)async; (void)show_hidden;
        // Mock scan results
        scan_results.clear();
        scan_results.push_back(WiFiNetwork("TestNetwork1", -45, 6, "11:22:33:44:55:66"));
        scan_results.push_back(WiFiNetwork("TestNetwork2", -60, 11, "AA:BB:CC:DD:EE:FF"));
        scan_complete = true;
        return scan_results.size();
    }
    
    String SSID(uint8_t i) {
        return (i < scan_results.size()) ? scan_results[i].ssid : "";
    }
    
    int32_t RSSI(uint8_t i) {
        return (i < scan_results.size()) ? scan_results[i].rssi : 0;
    }
    
    uint32_t channel(uint8_t i) {
        return (i < scan_results.size()) ? scan_results[i].channel : 0;
    }
    
    String BSSIDstr(uint8_t i) {
        return (i < scan_results.size()) ? scan_results[i].bssid : "";
    }
    
    void scanDelete() {
        scan_results.clear();
        scan_complete = false;
    }
    
    // Mode
    bool mode(wifi_mode_t m) {
        wifi_mode = m;
        return true;
    }
    
    wifi_mode_t getMode() { return wifi_mode; }
};

extern WiFiClass WiFi;

#endif // ARDUINO_ARCH_NATIVE