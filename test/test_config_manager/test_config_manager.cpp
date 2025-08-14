#include <unity.h>
#include "../../lib/ConfigManager/ConfigManager.h"

ConfigManager* manager = nullptr;
bool changeHandlerCalled = false;
Configuration oldConfig;
Configuration newConfig;

void setUp(void) {
    manager = ConfigManager::getInstance();
    changeHandlerCalled = false;
}

void tearDown(void) {
    changeHandlerCalled = false;
    if (manager) {
        manager->resetToDefaults();
    }
}

void testChangeHandler(const Configuration& old, const Configuration& config) {
    changeHandlerCalled = true;
    oldConfig = old;
    newConfig = config;
}

void test_singleton_instance() {
    ConfigManager* instance1 = ConfigManager::getInstance();
    ConfigManager* instance2 = ConfigManager::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

void test_manager_initialization() {
    manager->begin();
    TEST_ASSERT_TRUE(true); // Manager initializes without error
    
    const Configuration& config = manager->getConfiguration();
    TEST_ASSERT_EQUAL_STRING("ESP32-MAVLinkBridge", config.device.name.c_str());
    TEST_ASSERT_EQUAL_STRING("usb_otg", config.device.mode.c_str());
}

void test_default_configuration() {
    manager->begin();
    const Configuration& config = manager->getConfiguration();
    
    // Test device defaults
    TEST_ASSERT_EQUAL_STRING("ESP32-MAVLinkBridge", config.device.name.c_str());
    TEST_ASSERT_EQUAL_STRING("usb_otg", config.device.mode.c_str());
    
    // Test connection defaults
    TEST_ASSERT_EQUAL_STRING("wifi", config.connection.type.c_str());
    TEST_ASSERT_EQUAL_STRING("", config.connection.wifi.ssid.c_str());
    TEST_ASSERT_TRUE(config.connection.wifi.autoConnect);
    
    // Test RTCM defaults
    TEST_ASSERT_FALSE(config.rtcm.enabled);
    TEST_ASSERT_EQUAL_STRING("ntrip", config.rtcm.source.type.c_str());
    TEST_ASSERT_EQUAL(2101, config.rtcm.source.port);
}

void test_device_config_update() {
    manager->begin();
    
    DeviceConfig newDevice;
    newDevice.name = "CustomDevice";
    newDevice.mode = "uart";
    
    bool result = manager->updateDeviceConfig(newDevice);
    TEST_ASSERT_TRUE(result);
    
    const DeviceConfig& device = manager->getDeviceConfig();
    TEST_ASSERT_EQUAL_STRING("CustomDevice", device.name.c_str());
    TEST_ASSERT_EQUAL_STRING("uart", device.mode.c_str());
}

void test_connection_config_update() {
    manager->begin();
    
    ConnectionConfig newConnection;
    newConnection.type = "wifi";
    newConnection.wifi.ssid = "TestNetwork";
    newConnection.wifi.autoConnect = false;
    
    bool result = manager->updateConnectionConfig(newConnection);
    TEST_ASSERT_TRUE(result);
    
    const ConnectionConfig& connection = manager->getConnectionConfig();
    TEST_ASSERT_EQUAL_STRING("wifi", connection.type.c_str());
    TEST_ASSERT_EQUAL_STRING("TestNetwork", connection.wifi.ssid.c_str());
    TEST_ASSERT_FALSE(connection.wifi.autoConnect);
}

void test_rtcm_config_update() {
    manager->begin();
    
    RTCMConfig newRTCM;
    newRTCM.enabled = true;
    newRTCM.source.type = "ntrip";
    newRTCM.source.host = "caster.example.com";
    newRTCM.source.port = 2101;
    newRTCM.source.mountpoint = "MOUNT1";
    newRTCM.source.username = "user";
    newRTCM.source.password = "pass";
    
    bool result = manager->updateRTCMConfig(newRTCM);
    TEST_ASSERT_TRUE(result);
    
    const RTCMConfig& rtcm = manager->getRTCMConfig();
    TEST_ASSERT_TRUE(rtcm.enabled);
    TEST_ASSERT_EQUAL_STRING("ntrip", rtcm.source.type.c_str());
    TEST_ASSERT_EQUAL_STRING("caster.example.com", rtcm.source.host.c_str());
    TEST_ASSERT_EQUAL(2101, rtcm.source.port);
    TEST_ASSERT_EQUAL_STRING("MOUNT1", rtcm.source.mountpoint.c_str());
}

void test_configuration_validation() {
    Configuration config;
    
    // Valid configuration
    config.device.name = "ValidDevice";
    config.device.mode = "usb_otg";
    config.connection.type = "wifi";
    config.rtcm.source.type = "ntrip";
    config.rtcm.source.port = 2101;
    
    ConfigValidationResult result = manager->validateConfiguration(config);
    TEST_ASSERT_EQUAL(ConfigValidationResult::VALID, result);
}

void test_invalid_device_name() {
    Configuration config;
    config.device.name = ""; // Invalid: empty name
    config.device.mode = "usb_otg";
    
    ConfigValidationResult result = manager->validateConfiguration(config);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_DEVICE_NAME, result);
}

void test_invalid_device_mode() {
    Configuration config;
    config.device.name = "ValidDevice";
    config.device.mode = "invalid_mode"; // Invalid mode
    
    ConfigValidationResult result = manager->validateConfiguration(config);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_DEVICE_MODE, result);
}

void test_invalid_connection_type() {
    Configuration config;
    config.device.name = "ValidDevice";
    config.device.mode = "usb_otg";
    config.connection.type = "invalid_connection"; // Invalid connection type
    
    ConfigValidationResult result = manager->validateConfiguration(config);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_CONNECTION_TYPE, result);
}

void test_json_serialization() {
    manager->begin();
    
    String json = manager->saveToJson();
    TEST_ASSERT_TRUE(json.length() > 0);
    
    // Parse JSON to verify structure
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, json);
    
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    TEST_ASSERT_TRUE(doc.containsKey("device"));
    TEST_ASSERT_TRUE(doc.containsKey("connection"));
    TEST_ASSERT_TRUE(doc.containsKey("rtcm"));
}

void test_json_deserialization() {
    String testJson = R"({
        "device": {
            "name": "TestDevice",
            "mode": "uart"
        },
        "connection": {
            "type": "wifi",
            "wifi": {
                "ssid": "TestSSID",
                "autoConnect": false
            }
        },
        "rtcm": {
            "enabled": true,
            "source": {
                "type": "ntrip",
                "host": "test.example.com",
                "port": 2102
            }
        }
    })";
    
    bool result = manager->loadFromJson(testJson);
    TEST_ASSERT_TRUE(result);
    
    const Configuration& config = manager->getConfiguration();
    TEST_ASSERT_EQUAL_STRING("TestDevice", config.device.name.c_str());
    TEST_ASSERT_EQUAL_STRING("uart", config.device.mode.c_str());
    TEST_ASSERT_EQUAL_STRING("TestSSID", config.connection.wifi.ssid.c_str());
    TEST_ASSERT_FALSE(config.connection.wifi.autoConnect);
    TEST_ASSERT_TRUE(config.rtcm.enabled);
    TEST_ASSERT_EQUAL_STRING("test.example.com", config.rtcm.source.host.c_str());
    TEST_ASSERT_EQUAL(2102, config.rtcm.source.port);
}

void test_dirty_flag_tracking() {
    manager->begin();
    TEST_ASSERT_FALSE(manager->isDirtyConfig()); // Initially clean
    
    DeviceConfig newDevice;
    newDevice.name = "ChangedDevice";
    newDevice.mode = "uart";
    
    manager->updateDeviceConfig(newDevice);
    TEST_ASSERT_TRUE(manager->isDirtyConfig()); // Now dirty
    
    manager->markClean();
    TEST_ASSERT_FALSE(manager->isDirtyConfig()); // Clean again
}

void test_change_handler() {
    manager->begin();
    manager->setChangeHandler(testChangeHandler);
    
    DeviceConfig newDevice;
    newDevice.name = "NewDevice";
    newDevice.mode = "uart";
    
    manager->updateDeviceConfig(newDevice);
    
    TEST_ASSERT_TRUE(changeHandlerCalled);
    TEST_ASSERT_EQUAL_STRING("ESP32-MAVLinkBridge", oldConfig.device.name.c_str());
    TEST_ASSERT_EQUAL_STRING("NewDevice", newConfig.device.name.c_str());
}

void test_reset_to_defaults() {
    manager->begin();
    
    // Change configuration
    DeviceConfig newDevice;
    newDevice.name = "CustomDevice";
    manager->updateDeviceConfig(newDevice);
    
    // Reset to defaults
    manager->resetToDefaults();
    
    const Configuration& config = manager->getConfiguration();
    TEST_ASSERT_EQUAL_STRING("ESP32-MAVLinkBridge", config.device.name.c_str());
}

void test_buffer_management() {
    TEST_ASSERT_NOT_NULL(manager->getConfigBuffer());
    TEST_ASSERT_EQUAL(2048, manager->getBufferSize());
    
    DynamicJsonDocument& doc = manager->getConfigDoc();
    doc["test"] = "value";
    TEST_ASSERT_EQUAL_STRING("value", doc["test"]);
}

void test_port_validation() {
    Configuration config;
    config.device.name = "ValidDevice";
    config.device.mode = "usb_otg";
    config.connection.type = "wifi";
    config.rtcm.source.type = "ntrip";
    config.rtcm.source.port = 0; // Invalid port
    
    ConfigValidationResult result = manager->validateConfiguration(config);
    TEST_ASSERT_EQUAL(ConfigValidationResult::INVALID_RTCM_PORT, result);
}

void test_invalid_json_handling() {
    String invalidJson = "{ invalid json }";
    bool result = manager->loadFromJson(invalidJson);
    TEST_ASSERT_FALSE(result);
}

int main() {
    UNITY_BEGIN();
    
    RUN_TEST(test_singleton_instance);
    RUN_TEST(test_manager_initialization);
    RUN_TEST(test_default_configuration);
    RUN_TEST(test_device_config_update);
    RUN_TEST(test_connection_config_update);
    RUN_TEST(test_rtcm_config_update);
    RUN_TEST(test_configuration_validation);
    RUN_TEST(test_invalid_device_name);
    RUN_TEST(test_invalid_device_mode);
    RUN_TEST(test_invalid_connection_type);
    RUN_TEST(test_json_serialization);
    RUN_TEST(test_json_deserialization);
    RUN_TEST(test_dirty_flag_tracking);
    RUN_TEST(test_change_handler);
    RUN_TEST(test_reset_to_defaults);
    RUN_TEST(test_buffer_management);
    RUN_TEST(test_port_validation);
    RUN_TEST(test_invalid_json_handling);
    
    return UNITY_END();
}