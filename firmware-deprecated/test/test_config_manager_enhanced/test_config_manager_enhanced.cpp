#include <unity.h>
#include <ConfigManager.h>
#include <Storage.h>

ConfigManager* configManager;
Configuration testConfig;

void setUp(void) {
    configManager = ConfigManager::getInstance();
    configManager->begin();
    
    // Set up test configuration
    testConfig.version = 1;
    testConfig.device.name = "TestDevice";
    testConfig.device.mode = "uart";
    testConfig.connection.type = "wifi";
    testConfig.connection.wifi.ssid = "TestNetwork";
    testConfig.connection.wifi.autoConnect = true;
    testConfig.rtcm.enabled = true;
    testConfig.rtcm.source.type = "ntrip";
    testConfig.rtcm.source.host = "test.example.com";
    testConfig.rtcm.source.port = 2101;
}

void tearDown(void) {
    configManager->resetToDefaults();
}

void test_config_versioning(void) {
    Configuration initialConfig = configManager->getConfiguration();
    uint32_t initialVersion = initialConfig.version;
    
    TEST_ASSERT_TRUE(configManager->setConfiguration(testConfig));
    
    Configuration updatedConfig = configManager->getConfiguration();
    TEST_ASSERT_EQUAL(initialVersion + 1, updatedConfig.version);
}

void test_config_optimistic_locking_success(void) {
    TEST_ASSERT_TRUE(configManager->setConfiguration(testConfig));
    
    Configuration currentConfig = configManager->getConfiguration();
    uint32_t currentVersion = currentConfig.version;
    
    Configuration modifiedConfig = currentConfig;
    modifiedConfig.device.name = "ModifiedDevice";
    
    TEST_ASSERT_TRUE(configManager->setConfiguration(modifiedConfig, currentVersion));
    
    Configuration finalConfig = configManager->getConfiguration();
    TEST_ASSERT_EQUAL_STRING("ModifiedDevice", finalConfig.device.name.c_str());
}

void test_config_optimistic_locking_conflict(void) {
    TEST_ASSERT_TRUE(configManager->setConfiguration(testConfig));
    
    Configuration currentConfig = configManager->getConfiguration();
    uint32_t oldVersion = currentConfig.version - 1; // Use old version
    
    Configuration modifiedConfig = currentConfig;
    modifiedConfig.device.name = "ConflictDevice";
    
    TEST_ASSERT_FALSE(configManager->setConfiguration(modifiedConfig, oldVersion));
}

void test_config_persistence(void) {
    TEST_ASSERT_TRUE(configManager->setConfiguration(testConfig));
    TEST_ASSERT_TRUE(configManager->saveConfiguration());
    
    // Create new manager instance to simulate restart
    ConfigManager* newManager = new ConfigManager();
    newManager->begin();
    
    Configuration loadedConfig = newManager->getConfiguration();
    
    TEST_ASSERT_EQUAL_STRING(testConfig.device.name.c_str(), loadedConfig.device.name.c_str());
    TEST_ASSERT_EQUAL_STRING(testConfig.device.mode.c_str(), loadedConfig.device.mode.c_str());
    TEST_ASSERT_EQUAL_STRING(testConfig.connection.wifi.ssid.c_str(), loadedConfig.connection.wifi.ssid.c_str());
    TEST_ASSERT_EQUAL(testConfig.rtcm.enabled, loadedConfig.rtcm.enabled);
    TEST_ASSERT_EQUAL_STRING(testConfig.rtcm.source.host.c_str(), loadedConfig.rtcm.source.host.c_str());
    TEST_ASSERT_EQUAL(testConfig.rtcm.source.port, loadedConfig.rtcm.source.port);
}

void test_config_backup_restore(void) {
    // Set initial configuration
    TEST_ASSERT_TRUE(configManager->setConfiguration(testConfig));
    TEST_ASSERT_TRUE(configManager->backupConfiguration());
    
    // Modify configuration
    Configuration modifiedConfig = testConfig;
    modifiedConfig.device.name = "ModifiedName";
    modifiedConfig.version = testConfig.version + 1;
    TEST_ASSERT_TRUE(configManager->setConfiguration(modifiedConfig));
    
    // Verify modified configuration is active
    Configuration currentConfig = configManager->getConfiguration();
    TEST_ASSERT_EQUAL_STRING("ModifiedName", currentConfig.device.name.c_str());
    
    // Restore from backup
    TEST_ASSERT_TRUE(configManager->restoreConfiguration(0));
    
    // Verify original configuration is restored
    Configuration restoredConfig = configManager->getConfiguration();
    TEST_ASSERT_EQUAL_STRING(testConfig.device.name.c_str(), restoredConfig.device.name.c_str());
}

void test_config_validation_device_name(void) {
    Configuration invalidConfig = testConfig;
    invalidConfig.device.name = ""; // Invalid: empty name
    
    ConfigValidationResult result = configManager->validateConfiguration(invalidConfig);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_DEVICE_NAME, result);
    
    invalidConfig.device.name = String('A', 33); // Invalid: too long
    result = configManager->validateConfiguration(invalidConfig);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_DEVICE_NAME, result);
}

void test_config_validation_device_mode(void) {
    Configuration invalidConfig = testConfig;
    invalidConfig.device.mode = "invalid_mode";
    
    ConfigValidationResult result = configManager->validateConfiguration(invalidConfig);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_DEVICE_MODE, result);
}

void test_config_validation_wifi_ssid(void) {
    Configuration invalidConfig = testConfig;
    invalidConfig.connection.wifi.ssid = String('A', 33); // Too long
    
    ConfigValidationResult result = configManager->validateConfiguration(invalidConfig);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_WIFI_SSID, result);
}

void test_config_validation_rtcm_host(void) {
    Configuration invalidConfig = testConfig;
    invalidConfig.rtcm.enabled = true;
    invalidConfig.rtcm.source.host = ""; // Invalid: empty host when enabled
    
    ConfigValidationResult result = configManager->validateConfiguration(invalidConfig);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_RTCM_HOST, result);
}

void test_config_validation_rtcm_port(void) {
    Configuration invalidConfig = testConfig;
    invalidConfig.rtcm.source.port = 0; // Invalid port
    
    ConfigValidationResult result = configManager->validateConfiguration(invalidConfig);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_RTCM_PORT, result);
    
    invalidConfig.rtcm.source.port = 65536; // Invalid port
    result = configManager->validateConfiguration(invalidConfig);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_RTCM_PORT, result);
}

void test_config_json_serialization(void) {
    TEST_ASSERT_TRUE(configManager->setConfiguration(testConfig));
    
    String jsonStr = configManager->saveToJson();
    TEST_ASSERT_GREATER_THAN(0, jsonStr.length());
    
    // Parse JSON and verify structure
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, jsonStr);
    TEST_ASSERT_FALSE(error);
    
    TEST_ASSERT_TRUE(doc.containsKey("version"));
    TEST_ASSERT_TRUE(doc.containsKey("device"));
    TEST_ASSERT_TRUE(doc.containsKey("connection"));
    TEST_ASSERT_TRUE(doc.containsKey("rtcm"));
    
    TEST_ASSERT_EQUAL(testConfig.version, doc["version"].as<uint32_t>());
    TEST_ASSERT_EQUAL_STRING(testConfig.device.name.c_str(), doc["device"]["name"]);
}

void test_config_json_deserialization(void) {
    String testJson = R"({
        "version": 5,
        "device": {
            "name": "JsonTestDevice",
            "mode": "usb_otg"
        },
        "connection": {
            "type": "wifi",
            "wifi": {
                "ssid": "JsonTestNetwork",
                "autoConnect": false
            }
        },
        "rtcm": {
            "enabled": true,
            "source": {
                "type": "tcp",
                "host": "json.test.com",
                "port": 9999
            }
        }
    })";
    
    TEST_ASSERT_TRUE(configManager->loadFromJson(testJson));
    
    Configuration loadedConfig = configManager->getConfiguration();
    TEST_ASSERT_EQUAL(5, loadedConfig.version);
    TEST_ASSERT_EQUAL_STRING("JsonTestDevice", loadedConfig.device.name.c_str());
    TEST_ASSERT_EQUAL_STRING("usb_otg", loadedConfig.device.mode.c_str());
    TEST_ASSERT_EQUAL_STRING("JsonTestNetwork", loadedConfig.connection.wifi.ssid.c_str());
    TEST_ASSERT_FALSE(loadedConfig.connection.wifi.autoConnect);
    TEST_ASSERT_TRUE(loadedConfig.rtcm.enabled);
    TEST_ASSERT_EQUAL_STRING("tcp", loadedConfig.rtcm.source.type.c_str());
    TEST_ASSERT_EQUAL_STRING("json.test.com", loadedConfig.rtcm.source.host.c_str());
    TEST_ASSERT_EQUAL(9999, loadedConfig.rtcm.source.port);
}

void test_config_change_handler(void) {
    bool handlerCalled = false;
    Configuration oldConfig;
    Configuration newConfig;
    
    configManager->setChangeHandler([&](const Configuration& old, const Configuration& updated) {
        handlerCalled = true;
        oldConfig = old;
        newConfig = updated;
    });
    
    Configuration initialConfig = configManager->getConfiguration();
    TEST_ASSERT_TRUE(configManager->setConfiguration(testConfig));
    
    TEST_ASSERT_TRUE(handlerCalled);
    TEST_ASSERT_EQUAL_STRING(initialConfig.device.name.c_str(), oldConfig.device.name.c_str());
    TEST_ASSERT_EQUAL_STRING(testConfig.device.name.c_str(), newConfig.device.name.c_str());
}

void test_config_dirty_flag(void) {
    configManager->markClean();
    TEST_ASSERT_FALSE(configManager->isDirtyConfig());
    
    TEST_ASSERT_TRUE(configManager->setConfiguration(testConfig));
    TEST_ASSERT_FALSE(configManager->isDirtyConfig()); // Auto-saved, so should be clean
}

void setup() {
    UNITY_BEGIN();
    RUN_TEST(test_config_versioning);
    RUN_TEST(test_config_optimistic_locking_success);
    RUN_TEST(test_config_optimistic_locking_conflict);
    RUN_TEST(test_config_persistence);
    RUN_TEST(test_config_backup_restore);
    RUN_TEST(test_config_validation_device_name);
    RUN_TEST(test_config_validation_device_mode);
    RUN_TEST(test_config_validation_wifi_ssid);
    RUN_TEST(test_config_validation_rtcm_host);
    RUN_TEST(test_config_validation_rtcm_port);
    RUN_TEST(test_config_json_serialization);
    RUN_TEST(test_config_json_deserialization);
    RUN_TEST(test_config_change_handler);
    RUN_TEST(test_config_dirty_flag);
    UNITY_END();
}

void loop() {
    // Empty loop for Arduino framework
}