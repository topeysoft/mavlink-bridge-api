#include <unity.h>
#include <NVSManager.h>
#include <Arduino.h>
#include <ArduinoJson.h>

NVSManager *nvsManager;

void setUp(void)
{
    nvsManager = NVSManager::getInstance();
    TEST_ASSERT_NOT_NULL(nvsManager);

    NVSResult result = nvsManager->begin();
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Clear all namespaces for clean test environment
    nvsManager->clear("system");
    nvsManager->clear("wifi");
    nvsManager->clear("device");
    nvsManager->clear("test");
}

void tearDown(void)
{
    if (nvsManager)
    {
        nvsManager->end();
    }
}

// Test singleton pattern
void test_nvs_manager_singleton(void)
{
    NVSManager *instance1 = NVSManager::getInstance();
    NVSManager *instance2 = NVSManager::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

// Test initialization
void test_nvs_manager_initialization(void)
{
    // Test double initialization
    NVSResult result = nvsManager->begin();
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
}

// Test string operations
void test_nvs_manager_string_operations(void)
{
    String testKey = "test_str";
    String testValue = "Hello NVS!";
    String readValue;

    // Test write
    NVSResult result = nvsManager->putString(testKey, testValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Test read
    result = nvsManager->getString(testKey, readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING(testValue.c_str(), readValue.c_str());

    // Test key exists
    TEST_ASSERT_TRUE(nvsManager->hasKey(testKey));

    // Test non-existent key
    String nonExistentValue;
    result = nvsManager->getString("non_existent", nonExistentValue);
    TEST_ASSERT_EQUAL(NVSResult::KEY_NOT_FOUND, result);
}

// Test integer operations
void test_nvs_manager_int_operations(void)
{
    String testKey = "test_int";
    int32_t testValue = -12345;
    int32_t readValue;

    // Test write
    NVSResult result = nvsManager->putInt(testKey, testValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Test read
    result = nvsManager->getInt(testKey, readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL(testValue, readValue);

    // Test non-existent key
    int32_t nonExistentValue;
    result = nvsManager->getInt("non_existent", nonExistentValue);
    TEST_ASSERT_EQUAL(NVSResult::KEY_NOT_FOUND, result);
}

// Test boolean operations
void test_nvs_manager_bool_operations(void)
{
    String testKey = "test_bool";
    bool testValue = true;
    bool readValue;

    // Test write true
    NVSResult result = nvsManager->putBool(testKey, testValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Test read true
    result = nvsManager->getBool(testKey, readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_TRUE(readValue);

    // Test write false
    testValue = false;
    result = nvsManager->putBool(testKey, testValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Test read false
    result = nvsManager->getBool(testKey, readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_FALSE(readValue);
}

// Test byte array operations
void test_nvs_manager_bytes_operations(void)
{
    String testKey = "test_bytes";
    uint8_t testData[] = {0x01, 0x02, 0x03, 0x04, 0x05};
    size_t testLength = sizeof(testData);
    uint8_t readBuffer[10];
    size_t readLength = sizeof(readBuffer);

    // Test write
    NVSResult result = nvsManager->putBytes(testKey, testData, testLength);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Test read
    result = nvsManager->getBytes(testKey, readBuffer, readLength);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL(testLength, readLength);
    TEST_ASSERT_EQUAL_UINT8_ARRAY(testData, readBuffer, testLength);
}

// Test key length validation
void test_nvs_manager_key_validation(void)
{
    String longKey = "this_key_is_way_too_long_for_nvs_storage";
    String testValue = "test";

    // Test string with long key
    NVSResult result = nvsManager->putString(longKey, testValue);
    TEST_ASSERT_EQUAL(NVSResult::INVALID_KEY, result);

    // Test int with long key
    result = nvsManager->putInt(longKey, 123);
    TEST_ASSERT_EQUAL(NVSResult::INVALID_KEY, result);

    // Test bool with long key
    result = nvsManager->putBool(longKey, true);
    TEST_ASSERT_EQUAL(NVSResult::INVALID_KEY, result);

    // Test bytes with long key
    uint8_t data[] = {0x01};
    result = nvsManager->putBytes(longKey, data, 1);
    TEST_ASSERT_EQUAL(NVSResult::INVALID_KEY, result);
}

// Test namespace operations
void test_nvs_manager_namespace_operations(void)
{
    String key = "test_key";
    String value1 = "namespace1_value";
    String value2 = "namespace2_value";
    String readValue;

    // Write to different namespaces
    NVSResult result = nvsManager->putString(key, value1, "namespace1");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->putString(key, value2, "namespace2");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Read from different namespaces
    result = nvsManager->getString(key, readValue, "namespace1");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING(value1.c_str(), readValue.c_str());

    result = nvsManager->getString(key, readValue, "namespace2");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING(value2.c_str(), readValue.c_str());
}

// Test remove operations
void test_nvs_manager_remove_operations(void)
{
    String testKey = "remove_test";
    String testValue = "to_be_removed";
    String readValue;

    // Write value
    NVSResult result = nvsManager->putString(testKey, testValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Verify it exists
    TEST_ASSERT_TRUE(nvsManager->hasKey(testKey));

    // Remove value
    result = nvsManager->remove(testKey);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Verify it's gone
    TEST_ASSERT_FALSE(nvsManager->hasKey(testKey));

    // Try to read removed value
    result = nvsManager->getString(testKey, readValue);
    TEST_ASSERT_EQUAL(NVSResult::KEY_NOT_FOUND, result);

    // Try to remove non-existent key
    result = nvsManager->remove("non_existent");
    TEST_ASSERT_EQUAL(NVSResult::KEY_NOT_FOUND, result);
}

// Test clear namespace
void test_nvs_manager_clear_namespace(void)
{
    String namespace_name = "test_clear";

    // Add multiple values to namespace
    nvsManager->putString("key1", "value1", namespace_name);
    nvsManager->putString("key2", "value2", namespace_name);
    nvsManager->putInt("key3", 123, namespace_name);

    // Verify they exist
    TEST_ASSERT_TRUE(nvsManager->hasKey("key1", namespace_name));
    TEST_ASSERT_TRUE(nvsManager->hasKey("key2", namespace_name));
    TEST_ASSERT_TRUE(nvsManager->hasKey("key3", namespace_name));

    // Clear namespace
    NVSResult result = nvsManager->clear(namespace_name);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Verify they're gone
    TEST_ASSERT_FALSE(nvsManager->hasKey("key1", namespace_name));
    TEST_ASSERT_FALSE(nvsManager->hasKey("key2", namespace_name));
    TEST_ASSERT_FALSE(nvsManager->hasKey("key3", namespace_name));
}

// Test WiFi credential management
void test_nvs_manager_wifi_credentials(void)
{
    WiFiCredential testCred("TestNetwork", "TestPassword123");
    WiFiCredential readCred;

    // Test save credential
    NVSResult result = nvsManager->saveWiFiCredential(testCred);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Test has credential
    TEST_ASSERT_TRUE(nvsManager->hasWiFiCredential());

    // Test get credential
    result = nvsManager->getWiFiCredential(readCred);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING(testCred.ssid.c_str(), readCred.ssid.c_str());
    TEST_ASSERT_EQUAL_STRING(testCred.password.c_str(), readCred.password.c_str());

    // Test remove credential
    result = nvsManager->removeWiFiCredential();
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Verify it's gone
    TEST_ASSERT_FALSE(nvsManager->hasWiFiCredential());

    // Try to get removed credential
    result = nvsManager->getWiFiCredential(readCred);
    TEST_ASSERT_EQUAL(NVSResult::KEY_NOT_FOUND, result);
}

// Test WiFi credential validation
void test_nvs_manager_wifi_credential_validation(void)
{
    WiFiCredential invalidCred("", "password");

    // Test save with empty SSID
    NVSResult result = nvsManager->saveWiFiCredential(invalidCred);
    TEST_ASSERT_EQUAL(NVSResult::INVALID_VALUE, result);
}

// Test device configuration
void test_nvs_manager_device_config(void)
{
    String deviceName = "YardRover-001";
    String deviceId = "12345678-abcd-efgh-ijkl-mnopqrstuvwx";
    String mdnsHostname = "yardrover-001";
    String readValue;

    // Test device name
    NVSResult result = nvsManager->setDeviceName(deviceName);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->getDeviceName(readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING(deviceName.c_str(), readValue.c_str());

    // Test device ID
    result = nvsManager->setDeviceId(deviceId);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->getDeviceId(readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING(deviceId.c_str(), readValue.c_str());

    // Test mDNS hostname
    result = nvsManager->setMDNSHostname(mdnsHostname);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->getMDNSHostname(readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING(mdnsHostname.c_str(), readValue.c_str());
}

// Test system configuration
void test_nvs_manager_system_config(void)
{
    uint32_t configVersion = 42;
    uint32_t readVersion;
    bool autoConnect = true;
    bool readAutoConnect;

    // Test config version
    NVSResult result = nvsManager->setConfigVersion(configVersion);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->getConfigVersion(readVersion);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL(configVersion, readVersion);

    // Test auto connect
    result = nvsManager->setAutoConnect(autoConnect);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->getAutoConnect(readAutoConnect);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL(autoConnect, readAutoConnect);
}

// Test JSON migration
void test_nvs_manager_json_migration(void)
{
    // Create test JSON data
    DynamicJsonDocument doc(1024);

    doc["version"] = 2;

    JsonObject device = doc.createNestedObject("device");
    device["name"] = "MigratedDevice";
    device["id"] = "migrated-id-123";

    JsonObject mdns = doc.createNestedObject("mdns");
    mdns["hostname"] = "migrated-host";

    JsonObject connection = doc.createNestedObject("connection");
    JsonObject wifi = connection.createNestedObject("wifi");
    wifi["autoConnect"] = true;
    wifi["ssid"] = "MigratedNetwork";
    wifi["password"] = "MigratedPass123";

    String jsonData;
    serializeJson(doc, jsonData);

    // Perform migration
    NVSResult result = nvsManager->migrateFromJSON(jsonData);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Verify migrated data
    String value;
    uint32_t version;
    bool autoConnect;
    WiFiCredential cred;

    // Check device name
    result = nvsManager->getDeviceName(value);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING("MigratedDevice", value.c_str());

    // Check device ID
    result = nvsManager->getDeviceId(value);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING("migrated-id-123", value.c_str());

    // Check mDNS hostname
    result = nvsManager->getMDNSHostname(value);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING("migrated-host", value.c_str());

    // Check config version
    result = nvsManager->getConfigVersion(version);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL(2, version);

    // Check auto connect
    result = nvsManager->getAutoConnect(autoConnect);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_TRUE(autoConnect);

    // Check WiFi credential
    result = nvsManager->getWiFiCredential(cred);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING("MigratedNetwork", cred.ssid.c_str());
    TEST_ASSERT_EQUAL_STRING("MigratedPass123", cred.password.c_str());
}

// Test JSON export
void test_nvs_manager_json_export(void)
{
    // Set up test data
    nvsManager->setDeviceName("ExportDevice");
    nvsManager->setDeviceId("export-id-456");
    nvsManager->setMDNSHostname("export-host");
    nvsManager->setConfigVersion(3);
    nvsManager->setAutoConnect(false);

    WiFiCredential cred("ExportNetwork", "ExportPass456");
    nvsManager->saveWiFiCredential(cred);

    // Export to JSON
    String jsonData;
    NVSResult result = nvsManager->exportToJSON(jsonData);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Parse exported JSON
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, jsonData);
    TEST_ASSERT_FALSE(error);

    // Verify exported data
    TEST_ASSERT_EQUAL(3, doc["version"].as<int>());
    TEST_ASSERT_EQUAL_STRING("ExportDevice", doc["device"]["name"].as<const char *>());
    TEST_ASSERT_EQUAL_STRING("export-id-456", doc["device"]["id"].as<const char *>());
    TEST_ASSERT_EQUAL_STRING("export-host", doc["mdns"]["hostname"].as<const char *>());
    TEST_ASSERT_FALSE(doc["connection"]["wifi"]["autoConnect"].as<bool>());
    TEST_ASSERT_EQUAL_STRING("ExportNetwork", doc["connection"]["wifi"]["ssid"].as<const char *>());
    TEST_ASSERT_EQUAL_STRING("ExportPass456", doc["connection"]["wifi"]["password"].as<const char *>());
}

// Test operations without initialization
void test_nvs_manager_operations_without_init(void)
{
    // End current instance and create new one without init
    nvsManager->end();

    String value;
    int32_t intValue;
    bool boolValue;
    uint8_t buffer[10];
    size_t length = sizeof(buffer);

    // Test all operations should fail
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->putString("key", "value"));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->getString("key", value));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->putInt("key", 123));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->getInt("key", intValue));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->putBool("key", true));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->getBool("key", boolValue));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->putBytes("key", buffer, 1));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->getBytes("key", buffer, length));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->remove("key"));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->clear());

    // WiFi operations
    WiFiCredential cred;
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->saveWiFiCredential(cred));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->getWiFiCredential(cred));
    TEST_ASSERT_EQUAL(NVSResult::NOT_INITIALIZED, nvsManager->removeWiFiCredential());
    TEST_ASSERT_FALSE(nvsManager->hasWiFiCredential());

    // Re-initialize for tearDown
    nvsManager->begin();
}

// Test edge cases
void test_nvs_manager_edge_cases(void)
{
    String emptyValue = "";
    String readValue;

    // Test empty string storage
    NVSResult result = nvsManager->putString("empty_str", emptyValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->getString("empty_str", readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING("", readValue.c_str());

    // Test maximum key length (15 characters)
    String maxKey = "123456789012345"; // 15 characters
    result = nvsManager->putString(maxKey, "test");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Test large string value
    String largeValue(500, 'X'); // 500 character string
    result = nvsManager->putString("large_val", largeValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->getString("large_val", readValue);
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING(largeValue.c_str(), readValue.c_str());
}

// Test last error functionality
void test_nvs_manager_last_error(void)
{
    // Trigger an error
    String longKey = "this_key_is_way_too_long";
    nvsManager->putString(longKey, "test");

    // Check last error
    String lastError = nvsManager->getLastError();
    TEST_ASSERT_TRUE(lastError.length() > 0);
    TEST_ASSERT_TRUE(lastError.indexOf("Key too long") >= 0);
}

// Test concurrent namespace access
void test_nvs_manager_concurrent_namespace_access(void)
{
    // Write to multiple namespaces in sequence
    NVSResult result = nvsManager->putString("key1", "value1", "ns1");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->putString("key2", "value2", "ns2");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    result = nvsManager->putString("key3", "value3", "ns3");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);

    // Read back from all namespaces
    String value;
    result = nvsManager->getString("key1", value, "ns1");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING("value1", value.c_str());

    result = nvsManager->getString("key2", value, "ns2");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING("value2", value.c_str());

    result = nvsManager->getString("key3", value, "ns3");
    TEST_ASSERT_EQUAL(NVSResult::SUCCESS, result);
    TEST_ASSERT_EQUAL_STRING("value3", value.c_str());
}

void setup()
{
    Serial.begin(115200);
    delay(2000);

    UNITY_BEGIN();

    // Basic functionality tests
    RUN_TEST(test_nvs_manager_singleton);
    RUN_TEST(test_nvs_manager_initialization);
    RUN_TEST(test_nvs_manager_string_operations);
    RUN_TEST(test_nvs_manager_int_operations);
    RUN_TEST(test_nvs_manager_bool_operations);
    RUN_TEST(test_nvs_manager_bytes_operations);

    // Validation tests
    RUN_TEST(test_nvs_manager_key_validation);

    // Namespace tests
    RUN_TEST(test_nvs_manager_namespace_operations);
    RUN_TEST(test_nvs_manager_remove_operations);
    RUN_TEST(test_nvs_manager_clear_namespace);

    // WiFi credential tests
    RUN_TEST(test_nvs_manager_wifi_credentials);
    RUN_TEST(test_nvs_manager_wifi_credential_validation);

    // Configuration tests
    RUN_TEST(test_nvs_manager_device_config);
    RUN_TEST(test_nvs_manager_system_config);

    // Migration tests
    RUN_TEST(test_nvs_manager_json_migration);
    RUN_TEST(test_nvs_manager_json_export);

    // Error handling tests
    RUN_TEST(test_nvs_manager_operations_without_init);
    RUN_TEST(test_nvs_manager_edge_cases);
    RUN_TEST(test_nvs_manager_last_error);
    RUN_TEST(test_nvs_manager_concurrent_namespace_access);

    UNITY_END();
}

void loop()
{
    // Nothing to do here
}