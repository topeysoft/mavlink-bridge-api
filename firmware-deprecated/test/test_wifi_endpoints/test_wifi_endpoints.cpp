#include <unity.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "../../lib/WiFiEndpoints/WiFiEndpoints.h"
#include "../../lib/WiFiManager/WiFiManager.h"
#include "../../lib/HttpServer/HttpServer.h"
#include "../../lib/EventManager/EventManager.h"
#include "../../lib/ConfigManager/ConfigManager.h"

// Test fixtures
HttpServer* testServer = nullptr;
WiFiManager* testWifiManager = nullptr;
EventManager* testEventManager = nullptr;
ConfigManager* testConfigManager = nullptr;

void setUp(void) {
    // Initialize test dependencies
    testEventManager = EventManager::getInstance();
    testEventManager->begin();
    
    testConfigManager = ConfigManager::getInstance();
    testConfigManager->begin();
    
    testWifiManager = WiFiManager::getInstance();
    testWifiManager->begin();
    
    testServer = HttpServer::getInstance();
    WiFiEndpoints::registerRoutes(testServer);
}

void tearDown(void) {
    // Cleanup after each test
    if (testWifiManager) {
        testWifiManager->disconnect();
    }
}

// Helper function to create mock HTTP request
HttpRequest createMockRequest(const String& method, const String& path, const String& body = "") {
    HttpRequest req;
    req.path = path;
    req.body = body;
    req.request = nullptr; // Mock request - would need proper implementation for testing
    return req;
}

// Test WiFi status endpoint
void test_wifi_status_endpoint() {
    HttpRequest req = createMockRequest("GET", "/api/wifi/status");
    HttpResponse res;
    
    // The status endpoint should always work
    WiFiEndpoints::handleStatus(req, res);
    
    TEST_ASSERT_EQUAL(200, res.statusCode);
    TEST_ASSERT_TRUE(res.body.length() > 0);
    
    // Parse response to verify JSON structure
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    
    TEST_ASSERT_TRUE(doc["success"].as<bool>());
    TEST_ASSERT_TRUE(doc.containsKey("data"));
    TEST_ASSERT_TRUE(doc["data"].containsKey("state"));
    TEST_ASSERT_TRUE(doc["data"].containsKey("connected"));
}

// Test WiFi scan endpoint
void test_wifi_scan_endpoint() {
    HttpRequest req = createMockRequest("GET", "/api/wifi/scan");
    HttpResponse res;
    
    WiFiEndpoints::handleScan(req, res);
    
    TEST_ASSERT_EQUAL(200, res.statusCode);
    
    // Parse response
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    
    TEST_ASSERT_TRUE(doc["success"].as<bool>());
    TEST_ASSERT_TRUE(doc["data"].containsKey("networks"));
    TEST_ASSERT_TRUE(doc["data"].containsKey("count"));
    TEST_ASSERT_TRUE(doc["data"]["networks"].is<JsonArray>());
}

// Test WiFi connect endpoint with valid credentials
void test_wifi_connect_valid_credentials() {
    String requestBody = R"({"ssid": "TestNetwork", "password": "testpassword"})";
    HttpRequest req = createMockRequest("POST", "/api/wifi/connect", requestBody);
    HttpResponse res;
    
    WiFiEndpoints::handleConnect(req, res);
    
    // Should initiate connection successfully
    TEST_ASSERT_EQUAL(200, res.statusCode);
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    
    TEST_ASSERT_TRUE(doc["success"].as<bool>());
    TEST_ASSERT_TRUE(doc["data"].containsKey("ssid"));
    TEST_ASSERT_EQUAL_STRING("TestNetwork", doc["data"]["ssid"]);
}

// Test WiFi connect endpoint with invalid JSON
void test_wifi_connect_invalid_json() {
    String requestBody = R"({"ssid": "TestNetwork", "password":})"; // Invalid JSON
    HttpRequest req = createMockRequest("POST", "/api/wifi/connect", requestBody);
    HttpResponse res;
    
    WiFiEndpoints::handleConnect(req, res);
    
    TEST_ASSERT_EQUAL(400, res.statusCode);
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    
    TEST_ASSERT_FALSE(doc["success"].as<bool>());
    TEST_ASSERT_TRUE(doc["error"].containsKey("code"));
    TEST_ASSERT_EQUAL_STRING("INVALID_JSON", doc["error"]["code"]);
}

// Test WiFi connect endpoint with missing SSID
void test_wifi_connect_missing_ssid() {
    String requestBody = R"({"password": "testpassword"})";
    HttpRequest req = createMockRequest("POST", "/api/wifi/connect", requestBody);
    HttpResponse res;
    
    WiFiEndpoints::handleConnect(req, res);
    
    TEST_ASSERT_EQUAL(400, res.statusCode);
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    
    TEST_ASSERT_FALSE(doc["success"].as<bool>());
    TEST_ASSERT_TRUE(doc["error"].containsKey("code"));
    TEST_ASSERT_EQUAL_STRING("VALIDATION_ERROR", doc["error"]["code"]);
}

// Test WiFi disconnect endpoint
void test_wifi_disconnect() {
    HttpRequest req = createMockRequest("POST", "/api/wifi/disconnect");
    HttpResponse res;
    
    WiFiEndpoints::handleDisconnect(req, res);
    
    // Should succeed even if not connected
    TEST_ASSERT_TRUE(res.statusCode == 200 || res.statusCode == 409);
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
}

// Test saved networks endpoint
void test_saved_networks_endpoint() {
    HttpRequest req = createMockRequest("GET", "/api/wifi/networks");
    HttpResponse res;
    
    WiFiEndpoints::handleGetNetworks(req, res);
    
    TEST_ASSERT_EQUAL(200, res.statusCode);
    
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    
    TEST_ASSERT_TRUE(doc["success"].as<bool>());
    TEST_ASSERT_TRUE(doc["data"].containsKey("networks"));
    TEST_ASSERT_TRUE(doc["data"].containsKey("count"));
    TEST_ASSERT_TRUE(doc["data"].containsKey("maxNetworks"));
    TEST_ASSERT_EQUAL(5, doc["data"]["maxNetworks"].as<int>());
}

// Test add saved network endpoint
void test_add_saved_network() {
    String requestBody = R"({"ssid": "SavedNetwork", "password": "savedpassword", "priority": 1})";
    HttpRequest req = createMockRequest("POST", "/api/wifi/networks", requestBody);
    HttpResponse res;
    
    WiFiEndpoints::handleAddNetwork(req, res);
    
    TEST_ASSERT_EQUAL(200, res.statusCode);
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    
    TEST_ASSERT_TRUE(doc["success"].as<bool>());
    TEST_ASSERT_TRUE(doc["data"].containsKey("ssid"));
    TEST_ASSERT_EQUAL_STRING("SavedNetwork", doc["data"]["ssid"]);
}

// Test remove saved network endpoint
void test_remove_saved_network() {
    // This test requires proper AsyncWebServerRequest parameter handling
    // For now, just test that the function handles missing parameters correctly
    HttpRequest removeReq = createMockRequest("DELETE", "/api/wifi/networks");
    HttpResponse removeRes;
    
    WiFiEndpoints::handleRemoveNetwork(removeReq, removeRes);
    
    // Should return 400 for missing SSID parameter
    TEST_ASSERT_EQUAL(400, removeRes.statusCode);
}

// Test utility functions
void test_auth_mode_to_string() {
    TEST_ASSERT_EQUAL_STRING("open", WiFiEndpoints::authModeToString(WIFI_AUTH_OPEN).c_str());
    TEST_ASSERT_EQUAL_STRING("wpa2", WiFiEndpoints::authModeToString(WIFI_AUTH_WPA2_PSK).c_str());
    TEST_ASSERT_EQUAL_STRING("wpa3", WiFiEndpoints::authModeToString(WIFI_AUTH_WPA3_PSK).c_str());
}

void test_state_to_string() {
    TEST_ASSERT_EQUAL_STRING("disconnected", WiFiEndpoints::stateToString(WiFiManager::DISCONNECTED).c_str());
    TEST_ASSERT_EQUAL_STRING("connecting", WiFiEndpoints::stateToString(WiFiManager::CONNECTING).c_str());
    TEST_ASSERT_EQUAL_STRING("connected", WiFiEndpoints::stateToString(WiFiManager::CONNECTED).c_str());
    TEST_ASSERT_EQUAL_STRING("ap_mode", WiFiEndpoints::stateToString(WiFiManager::AP_MODE).c_str());
    TEST_ASSERT_EQUAL_STRING("error", WiFiEndpoints::stateToString(WiFiManager::ERROR).c_str());
}

// Test forced scan parameter
void test_wifi_scan_force_parameter() {
    // This test requires a proper AsyncWebServerRequest mock
    // For now, test the basic scan without force parameter
    HttpRequest req = createMockRequest("GET", "/api/wifi/scan");
    HttpResponse res;
    
    WiFiEndpoints::handleScan(req, res);
    
    TEST_ASSERT_EQUAL(200, res.statusCode);
    
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, res.body);
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    
    TEST_ASSERT_TRUE(doc["success"].as<bool>());
    // Note: cached status testing requires proper request parameter handling
}

void setup() {
    // Initialize Unity
    UNITY_BEGIN();
    
    // Initialize WiFi in test mode
    WiFi.mode(WIFI_AP_STA);
    
    // Run tests
    RUN_TEST(test_wifi_status_endpoint);
    RUN_TEST(test_wifi_scan_endpoint);
    RUN_TEST(test_wifi_connect_valid_credentials);
    RUN_TEST(test_wifi_connect_invalid_json);
    RUN_TEST(test_wifi_connect_missing_ssid);
    RUN_TEST(test_wifi_disconnect);
    RUN_TEST(test_saved_networks_endpoint);
    RUN_TEST(test_add_saved_network);
    RUN_TEST(test_remove_saved_network);
    RUN_TEST(test_auth_mode_to_string);
    RUN_TEST(test_state_to_string);
    RUN_TEST(test_wifi_scan_force_parameter);
    
    UNITY_END();
}

void loop() {
    // Unity test framework handles everything
}