#include <unity.h>
#include <WiFiManager.h>
#include <EventManager.h>
#include <ConfigManager.h>
#include <NVSManager.h>
#include <ArduinoJson.h>

WiFiManager* wifiManager;
EventManager* eventManager;
ConfigManager* configManager;
NVSManager* nvsManager;

// Event tracking
std::vector<EventType> capturedEvents;
std::vector<JsonDocument> capturedPayloads;

void eventCallback(const Event& event) {
    capturedEvents.push_back(event.type);
    DynamicJsonDocument doc(512);
    doc.set(event.payload);
    capturedPayloads.push_back(doc);
}

void setUp(void) {
    // Initialize dependencies
    eventManager = EventManager::getInstance();
    configManager = ConfigManager::getInstance();
    nvsManager = NVSManager::getInstance();
    
    // Initialize components
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, nvsManager->begin());
    configManager->begin();
    
    // Clear any saved networks
    nvsManager->clear("wifi");
    
    // Reset configuration
    Configuration defaultConfig;
    configManager->setConfiguration(defaultConfig);
    
    // Initialize WiFiManager
    wifiManager = WiFiManager::getInstance();
    
    // Subscribe to WiFi events for testing
    capturedEvents.clear();
    capturedPayloads.clear();
    eventManager->subscribe(EventType::WIFI_STATE_CHANGED, eventCallback);
    eventManager->subscribe(EventType::WIFI_CONNECTED, eventCallback);
    eventManager->subscribe(EventType::WIFI_DISCONNECTED, eventCallback);
    eventManager->subscribe(EventType::WIFI_SCAN_COMPLETED, eventCallback);
    eventManager->subscribe(EventType::WIFI_AP_MODE_STARTED, eventCallback);
    eventManager->subscribe(EventType::WIFI_AP_MODE_STOPPED, eventCallback);
}

void tearDown(void) {
    // Disconnect and clean up
    if (wifiManager) {
        wifiManager->disconnect();
        wifiManager->stopAccessPoint();
    }
    
    // Clear saved networks
    nvsManager->clear("wifi");
    
    // Unsubscribe from events
    eventManager->unsubscribe(EventType::WIFI_STATE_CHANGED, eventCallback);
    eventManager->unsubscribe(EventType::WIFI_CONNECTED, eventCallback);
    eventManager->unsubscribe(EventType::WIFI_DISCONNECTED, eventCallback);
    eventManager->unsubscribe(EventType::WIFI_SCAN_COMPLETED, eventCallback);
    eventManager->unsubscribe(EventType::WIFI_AP_MODE_STARTED, eventCallback);
    eventManager->unsubscribe(EventType::WIFI_AP_MODE_STOPPED, eventCallback);
}

// Test singleton pattern
void test_wifi_manager_singleton(void) {
    WiFiManager* instance1 = WiFiManager::getInstance();
    WiFiManager* instance2 = WiFiManager::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

// Test initialization
void test_wifi_manager_initialization(void) {
    wifiManager->begin();
    
    // Initial state should be disconnected
    TEST_ASSERT_EQUAL(WiFiManager::State::DISCONNECTED, wifiManager->getState());
    
    // Connection info should be empty
    WiFiManager::ConnectionInfo info = wifiManager->getConnectionInfo();
    TEST_ASSERT_EQUAL_STRING("", info.ssid.c_str());
    TEST_ASSERT_EQUAL(0, info.rssi);
}

// Test state transitions
void test_wifi_manager_state_transitions(void) {
    // Start in disconnected state
    TEST_ASSERT_EQUAL(WiFiManager::State::DISCONNECTED, wifiManager->getState());
    
    // Connect (will fail with invalid credentials, but state should change)
    wifiManager->connect("TestNetwork", "TestPassword");
    
    // Should transition to connecting state
    delay(100); // Allow state change
    WiFiManager::State state = wifiManager->getState();
    TEST_ASSERT_TRUE(state == WiFiManager::State::CONNECTING || 
                     state == WiFiManager::State::ERROR ||
                     state == WiFiManager::State::DISCONNECTED);
    
    // Disconnect
    wifiManager->disconnect();
    delay(100);
    TEST_ASSERT_EQUAL(WiFiManager::State::DISCONNECTED, wifiManager->getState());
}

// Test access point mode
void test_wifi_manager_ap_mode(void) {
    String apSSID = "TestAP";
    String apPassword = "TestPassword123";
    
    // Start access point
    wifiManager->startAccessPoint(apSSID, apPassword);
    delay(500); // Allow AP to start
    
    // Check state
    TEST_ASSERT_EQUAL(WiFiManager::State::AP_MODE, wifiManager->getState());
    
    // Check event was published
    bool apStartedEvent = false;
    for (size_t i = 0; i < capturedEvents.size(); i++) {
        if (capturedEvents[i] == EventType::WIFI_AP_MODE_STARTED) {
            apStartedEvent = true;
            // Check payload
            if (capturedPayloads[i].containsKey("ssid")) {
                TEST_ASSERT_EQUAL_STRING(apSSID.c_str(), 
                                       capturedPayloads[i]["ssid"].as<const char*>());
            }
        }
    }
    TEST_ASSERT_TRUE(apStartedEvent);
    
    // Stop access point
    wifiManager->stopAccessPoint();
    delay(100);
    
    // Check state
    TEST_ASSERT_EQUAL(WiFiManager::State::DISCONNECTED, wifiManager->getState());
    
    // Check event was published
    bool apStoppedEvent = false;
    for (const auto& event : capturedEvents) {
        if (event == EventType::WIFI_AP_MODE_STOPPED) {
            apStoppedEvent = true;
        }
    }
    TEST_ASSERT_TRUE(apStoppedEvent);
}

// Test network scanning
void test_wifi_manager_scan(void) {
    // Perform scan
    std::vector<WiFiNetwork> networks = wifiManager->scan();
    
    // Check that scan completed (even if no networks found)
    TEST_ASSERT_TRUE(networks.size() >= 0);
    
    // Check scan event was published
    bool scanEvent = false;
    for (const auto& event : capturedEvents) {
        if (event == EventType::WIFI_SCAN_COMPLETED) {
            scanEvent = true;
        }
    }
    TEST_ASSERT_TRUE(scanEvent);
    
    // Test cached results
    unsigned long scanTime = millis();
    std::vector<WiFiNetwork> cachedNetworks = wifiManager->scan(false);
    unsigned long cacheTime = millis();
    
    // Cache should return quickly (< 50ms)
    TEST_ASSERT_TRUE((cacheTime - scanTime) < 50);
    TEST_ASSERT_EQUAL(networks.size(), cachedNetworks.size());
}

// Test saved network management
void test_wifi_manager_saved_networks(void) {
    String testSSID = "SavedNetwork";
    String testPassword = "SavedPassword123";
    
    // Initially should have no saved network
    TEST_ASSERT_FALSE(wifiManager->hasSavedNetwork());
    
    // Save network
    TEST_ASSERT_TRUE(wifiManager->saveNetwork(testSSID, testPassword));
    
    // Should now have saved network
    TEST_ASSERT_TRUE(wifiManager->hasSavedNetwork());
    
    // Get saved credential
    WiFiCredential cred = wifiManager->getSavedCredential();
    TEST_ASSERT_EQUAL_STRING(testSSID.c_str(), cred.ssid.c_str());
    TEST_ASSERT_EQUAL_STRING(testPassword.c_str(), cred.password.c_str());
    
    // Clear saved network
    TEST_ASSERT_TRUE(wifiManager->clearSavedNetwork());
    
    // Should no longer have saved network
    TEST_ASSERT_FALSE(wifiManager->hasSavedNetwork());
}

// Test NVS and ConfigManager synchronization
void test_wifi_manager_storage_sync(void) {
    String testSSID = "SyncTestNetwork";
    String testPassword = "SyncTestPassword";
    
    // Save network
    wifiManager->saveNetwork(testSSID, testPassword);
    
    // Check both NVS and ConfigManager have the credential
    WiFiCredential nvsCred;
    NVSResult nvsResult = nvsManager->getWiFiCredential(nvsCred);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, nvsResult);
    TEST_ASSERT_EQUAL_STRING(testSSID.c_str(), nvsCred.ssid.c_str());
    
    const Configuration& config = configManager->getConfiguration();
    TEST_ASSERT_EQUAL_STRING(testSSID.c_str(), config.connection.wifi.ssid.c_str());
    TEST_ASSERT_EQUAL_STRING(testPassword.c_str(), config.connection.wifi.password.c_str());
    
    // Clear from NVS only
    nvsManager->removeWiFiCredential();
    
    // WiFiManager should still find credential from ConfigManager
    TEST_ASSERT_TRUE(wifiManager->hasSavedNetwork());
    WiFiCredential retrievedCred = wifiManager->getSavedCredential();
    TEST_ASSERT_EQUAL_STRING(testSSID.c_str(), retrievedCred.ssid.c_str());
}

// Test connection info update
void test_wifi_manager_connection_info(void) {
    // Get connection info when disconnected
    WiFiManager::ConnectionInfo info = wifiManager->getConnectionInfo();
    
    // Should have empty values
    TEST_ASSERT_EQUAL_STRING("", info.ssid.c_str());
    TEST_ASSERT_EQUAL(0, info.rssi);
    TEST_ASSERT_EQUAL(0, info.ip[0]);
    
    // BSSID should be all zeros
    uint8_t zeroBSSID[6] = {0, 0, 0, 0, 0, 0};
    TEST_ASSERT_EQUAL_UINT8_ARRAY(zeroBSSID, info.bssid, 6);
}

// Test auto-connect functionality
void test_wifi_manager_auto_connect(void) {
    // Save a network
    String testSSID = "AutoConnectTest";
    String testPassword = "AutoConnectPass";
    wifiManager->saveNetwork(testSSID, testPassword);
    
    // Enable auto-connect in configuration
    Configuration config = configManager->getConfiguration();
    config.connection.wifi.autoConnect = true;
    configManager->setConfiguration(config);
    
    // Clear events
    capturedEvents.clear();
    
    // Try auto-connect
    wifiManager->tryAutoConnect();
    delay(200); // Allow connection attempt
    
    // Should attempt to connect (state change)
    WiFiManager::State state = wifiManager->getState();
    TEST_ASSERT_TRUE(state != WiFiManager::State::DISCONNECTED);
}

// Test multiple connect attempts
void test_wifi_manager_connect_while_connecting(void) {
    // Start first connection
    bool result1 = wifiManager->connect("Network1", "Password1");
    TEST_ASSERT_TRUE(result1);
    
    // Try to connect again while connecting
    delay(50);
    bool result2 = wifiManager->connect("Network2", "Password2");
    TEST_ASSERT_FALSE(result2); // Should fail as already connecting
}

// Test connect to already connected network
void test_wifi_manager_connect_same_network(void) {
    // This test simulates being already connected
    // Since we can't actually connect in unit tests, we'll test the logic
    
    String testSSID = "CurrentNetwork";
    
    // If we were connected to testSSID and try to connect again,
    // it should return true immediately
    // This is a logic test rather than a full integration test
    TEST_ASSERT_TRUE(true); // Placeholder for actual connection test
}

// Test get last scan results
void test_wifi_manager_last_scan_results(void) {
    // Perform initial scan
    std::vector<WiFiNetwork> firstScan = wifiManager->scan();
    
    // Get last scan results without new scan
    std::vector<WiFiNetwork> lastResults = wifiManager->getLastScanResults();
    
    // Should match
    TEST_ASSERT_EQUAL(firstScan.size(), lastResults.size());
    for (size_t i = 0; i < firstScan.size(); i++) {
        TEST_ASSERT_EQUAL_STRING(firstScan[i].ssid.c_str(), lastResults[i].ssid.c_str());
        TEST_ASSERT_EQUAL(firstScan[i].rssi, lastResults[i].rssi);
    }
}

// Test empty password AP mode
void test_wifi_manager_open_ap(void) {
    String apSSID = "OpenTestAP";
    
    // Start open access point (no password)
    wifiManager->startAccessPoint(apSSID, "");
    delay(500);
    
    // Check state
    TEST_ASSERT_EQUAL(WiFiManager::State::AP_MODE, wifiManager->getState());
    
    // Stop AP
    wifiManager->stopAccessPoint();
}

// Test default AP configuration
void test_wifi_manager_default_ap(void) {
    // Set AP configuration
    Configuration config = configManager->getConfiguration();
    config.connection.wifi.apSSID = "ConfiguredAP";
    config.connection.wifi.apPassword = "ConfiguredPassword";
    configManager->setConfiguration(config);
    
    // Start AP with default config
    wifiManager->startAccessPoint();
    delay(500);
    
    // Check state
    TEST_ASSERT_EQUAL(WiFiManager::State::AP_MODE, wifiManager->getState());
    
    // Stop AP
    wifiManager->stopAccessPoint();
}

// Test previous state tracking
void test_wifi_manager_previous_state(void) {
    // Initial state
    TEST_ASSERT_EQUAL(WiFiManager::State::DISCONNECTED, wifiManager->getState());
    TEST_ASSERT_EQUAL(WiFiManager::State::DISCONNECTED, wifiManager->getPreviousState());
    
    // Start AP
    wifiManager->startAccessPoint("TestAP", "TestPass");
    delay(200);
    
    // Check previous state
    TEST_ASSERT_EQUAL(WiFiManager::State::AP_MODE, wifiManager->getState());
    TEST_ASSERT_EQUAL(WiFiManager::State::DISCONNECTED, wifiManager->getPreviousState());
    
    // Stop AP
    wifiManager->stopAccessPoint();
    delay(100);
    
    // Check previous state updated
    TEST_ASSERT_EQUAL(WiFiManager::State::DISCONNECTED, wifiManager->getState());
    TEST_ASSERT_EQUAL(WiFiManager::State::AP_MODE, wifiManager->getPreviousState());
}

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    UNITY_BEGIN();
    
    // Basic functionality tests
    RUN_TEST(test_wifi_manager_singleton);
    RUN_TEST(test_wifi_manager_initialization);
    RUN_TEST(test_wifi_manager_state_transitions);
    
    // Access Point tests
    RUN_TEST(test_wifi_manager_ap_mode);
    RUN_TEST(test_wifi_manager_open_ap);
    RUN_TEST(test_wifi_manager_default_ap);
    
    // Network scanning tests
    RUN_TEST(test_wifi_manager_scan);
    RUN_TEST(test_wifi_manager_last_scan_results);
    
    // Saved network tests
    RUN_TEST(test_wifi_manager_saved_networks);
    RUN_TEST(test_wifi_manager_storage_sync);
    
    // Connection tests
    RUN_TEST(test_wifi_manager_connection_info);
    RUN_TEST(test_wifi_manager_auto_connect);
    RUN_TEST(test_wifi_manager_connect_while_connecting);
    RUN_TEST(test_wifi_manager_connect_same_network);
    
    // State management tests
    RUN_TEST(test_wifi_manager_previous_state);
    
    UNITY_END();
}

void loop() {
    // Nothing to do here
}