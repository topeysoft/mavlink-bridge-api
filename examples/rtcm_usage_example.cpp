/**
 * RTCM Client Usage Example
 * 
 * This example demonstrates how to use the RTCM client components
 * for receiving RTK correction data from various sources.
 */

#include <Arduino.h>
#include "lib/RTCMClient/RTCMClient.h"
#include "lib/NTRIPClient/NTRIPClient.h"
#include "lib/RTCMReceivers/TCPRTCMClient.h"
#include "lib/RTCMReceivers/UDPRTCMClient.h"
#include "lib/RTCMParser/RTCMParser.h"
#include "lib/MAVLinkConverter/MAVLinkConverter.h"
#include "lib/WiFiManager/WiFiManager.h"

// Global instances
std::unique_ptr<RTCMClient> rtcmClient;
MAVLinkConverter mavlinkConverter;

// Statistics
uint32_t messagesReceived = 0;
uint32_t lastStatsTime = 0;

void setupWiFi() {
    WiFiManager wifiManager;
    
    // Try to connect to saved network first
    if (!wifiManager.connectToSavedNetwork()) {
        Serial.println("Starting AP mode for WiFi configuration");
        wifiManager.startAPMode("ESP32-RTCM-Setup");
        
        // Wait for configuration via captive portal
        while (!WiFi.isConnected()) {
            wifiManager.handleClient();
            delay(100);
        }
    }
    
    Serial.print("Connected to WiFi: ");
    Serial.println(WiFi.SSID());
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
}

void onRTCMData(const uint8_t* data, size_t length) {
    messagesReceived++;
    
    // Parse RTCM message
    RTCMParser::RTCMMessage msg;
    if (RTCMParser::parseMessage(data, length, msg)) {
        Serial.printf("RTCM Message: Type %d (%s), Station %d, Length %d\n",
                     msg.messageType,
                     RTCMParser::getMessageTypeName(msg.messageType),
                     msg.stationId,
                     length);
        
        // Example: Forward to flight controller as MAVLink
        // This would typically be done via Serial1 or USB
        auto mavlinkMessages = mavlinkConverter.convertRTCMToMAVLink(data, length);
        for (const auto& mavMsg : mavlinkMessages) {
            // mavlinkConverter.injectToFC(mavMsg, &Serial1);
            Serial.printf("  -> Converted to %d MAVLink messages\n", mavlinkMessages.size());
        }
    }
}

void onStateChange(RTCMClient::State state) {
    const char* stateNames[] = {"DISCONNECTED", "CONNECTING", "CONNECTED", "ERROR"};
    Serial.printf("RTCM State: %s\n", stateNames[state]);
}

void startNTRIPClient() {
    Serial.println("Starting NTRIP client...");
    
    NTRIPClient::Config config;
    strncpy(config.host, "rtk2go.com", sizeof(config.host));
    config.port = 2101;
    strncpy(config.mountpoint, "DEMO", sizeof(config.mountpoint));
    strncpy(config.username, "demo", sizeof(config.username));
    strncpy(config.password, "demo", sizeof(config.password));
    
    // Example coordinates (adjust for your location)
    config.sendPosition = true;
    config.latitude = 37.7749;   // San Francisco
    config.longitude = -122.4194;
    config.altitude = 16.0;
    
    rtcmClient = std::make_unique<NTRIPClient>(config);
    rtcmClient->setDataCallback(onRTCMData);
    rtcmClient->setStateCallback(onStateChange);
    
    if (rtcmClient->connect()) {
        Serial.println("NTRIP client connected successfully");
    } else {
        Serial.println("Failed to connect NTRIP client");
    }
}

void startTCPClient() {
    Serial.println("Starting TCP RTCM client...");
    
    rtcmClient = std::make_unique<TCPRTCMClient>("192.168.1.100", 2101);
    rtcmClient->setDataCallback(onRTCMData);
    rtcmClient->setStateCallback(onStateChange);
    
    if (rtcmClient->connect()) {
        Serial.println("TCP client connected successfully");
    } else {
        Serial.println("Failed to connect TCP client");
    }
}

void startUDPClient() {
    Serial.println("Starting UDP RTCM client...");
    
    auto udpClient = std::make_unique<UDPRTCMClient>(2101);
    
    // Optionally filter to specific remote endpoint
    // IPAddress remoteIP(192, 168, 1, 100);
    // udpClient->setRemoteEndpoint(remoteIP, 2101);
    
    rtcmClient = std::move(udpClient);
    rtcmClient->setDataCallback(onRTCMData);
    rtcmClient->setStateCallback(onStateChange);
    
    if (rtcmClient->connect()) {
        Serial.println("UDP client listening successfully");
    } else {
        Serial.println("Failed to start UDP client");
    }
}

void printStatistics() {
    if (!rtcmClient) return;
    
    RTCMClient::Statistics stats = rtcmClient->getStatistics();
    
    Serial.println("\n=== RTCM Statistics ===");
    Serial.printf("Client Type: %s\n", rtcmClient->getTypeName());
    Serial.printf("State: %d\n", rtcmClient->getState());
    Serial.printf("Messages: %d\n", stats.messagesReceived);
    Serial.printf("Bytes: %d\n", stats.bytesReceived);
    Serial.printf("CRC Errors: %d\n", stats.crcErrors);
    Serial.printf("Data Rate: %.2f KB/s\n", stats.dataRate);
    Serial.printf("Last Message: %d ms ago\n", 
                 stats.lastMessageTime > 0 ? millis() - stats.lastMessageTime : 0);
    
    Serial.println("Message Types:");
    for (const auto& pair : stats.messageTypeCounts) {
        Serial.printf("  %d (%s): %d\n", 
                     pair.first,
                     RTCMParser::getMessageTypeName(pair.first),
                     pair.second);
    }
    Serial.println("=====================\n");
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("ESP32 RTCM Client Example");
    Serial.println("==========================");
    
    // Setup WiFi connection
    setupWiFi();
    
    // Start RTCM client
    // Choose one of the following:
    
    // 1. NTRIP client (most common for RTK base stations)
    startNTRIPClient();
    
    // 2. TCP client (for custom RTK servers)
    // startTCPClient();
    
    // 3. UDP client (for local base stations)
    // startUDPClient();
    
    lastStatsTime = millis();
}

void loop() {
    // Print statistics every 30 seconds
    if (millis() - lastStatsTime > 30000) {
        printStatistics();
        lastStatsTime = millis();
    }
    
    // Check for serial commands
    if (Serial.available()) {
        String command = Serial.readStringUntil('\n');
        command.trim();
        
        if (command == "stats") {
            printStatistics();
        }
        else if (command == "stop") {
            if (rtcmClient) {
                rtcmClient->disconnect();
                rtcmClient.reset();
                Serial.println("RTCM client stopped");
            }
        }
        else if (command == "restart") {
            if (rtcmClient) {
                rtcmClient->disconnect();
                rtcmClient.reset();
            }
            startNTRIPClient();
        }
        else if (command == "help") {
            Serial.println("Commands:");
            Serial.println("  stats   - Show statistics");
            Serial.println("  stop    - Stop RTCM client");
            Serial.println("  restart - Restart RTCM client");
            Serial.println("  help    - Show this help");
        }
        else {
            Serial.println("Unknown command. Type 'help' for available commands.");
        }
    }
    
    delay(100);
}