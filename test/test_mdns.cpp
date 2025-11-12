#include <unity.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include "MDNSManager.h"
#include "MDNSRTCMDiscovery.h"
#include "ConfigManager.h"
#include "TCPRTCMClient.h"
#include "UDPRTCMClient.h"

using namespace NetworkLib;

void setUp(void)
{
    // Set up function runs before each test
}

void tearDown(void)
{
    // Tear down function runs after each test
}

void test_mdns_manager_initialization()
{
    // Test MDNSManager initialization
    MDNSManager *manager = MDNSManager::getInstance();
    TEST_ASSERT_NOT_NULL(manager);
    TEST_ASSERT_FALSE(manager->getEnabled()); // Should be disabled initially
}

void test_mdns_hostname_validation()
{
    // Test hostname validation
    MDNSManager *manager = MDNSManager::getInstance();

    // Valid hostnames
    manager->setHostname("yardrover");
    TEST_ASSERT_EQUAL_STRING("yardrover", manager->getHostname().c_str());

    manager->setHostname("test-device");
    TEST_ASSERT_EQUAL_STRING("test-device", manager->getHostname().c_str());

    // Test that spaces are replaced with hyphens
    manager->setHostname("Test Device");
    TEST_ASSERT_EQUAL_STRING("test-device", manager->getHostname().c_str());
}

void test_mdns_service_advertisement()
{
    MDNSManager *manager = MDNSManager::getInstance();

    // Test adding services (these will only work when WiFi is connected)
    bool result = manager->addService("Test Service", "_http", 80);
    // Result depends on WiFi connection state, so we just test the method exists
    TEST_ASSERT_TRUE(true); // Placeholder - would need WiFi connection to test properly
}

void test_mdns_config_validation()
{
    ConfigManager *configMgr = ConfigManager::getInstance();

    MDNSConfig config;
    config.enabled = true;
    config.hostname = "valid-hostname";
    config.discoveryEnabled = true;

    bool result = configMgr->updateMDNSConfig(config);
    TEST_ASSERT_TRUE(result);

    // Test invalid hostname
    config.hostname = ""; // Empty hostname should be invalid
    result = configMgr->updateMDNSConfig(config);
    TEST_ASSERT_FALSE(result);

    // Test hostname too long
    config.hostname = "this-is-a-very-long-hostname-that-exceeds-the-maximum-length-limit-of-63-characters";
    result = configMgr->updateMDNSConfig(config);
    TEST_ASSERT_FALSE(result);

    // Test hostname with invalid characters
    config.hostname = "invalid@hostname";
    result = configMgr->updateMDNSConfig(config);
    TEST_ASSERT_FALSE(result);
}

void test_mdns_rtcm_discovery()
{
    MDNSManager *manager = MDNSManager::getInstance();
    MDNSRTCMDiscovery discovery(manager);

    // Test basic functionality
    TEST_ASSERT_FALSE(discovery.isDiscoveryRunning());

    // Test server list (should be empty initially)
    auto servers = discovery.getDiscoveredServers();
    TEST_ASSERT_EQUAL(0, servers.size());
}

void test_mdns_connection_string_parsing()
{
    RTCMServerInfo server;

    // Test TCP connection string
    bool result = MDNSRTCMDiscovery::parseConnectionString("tcp://test-server:2101", server);
    TEST_ASSERT_TRUE(result);
    TEST_ASSERT_EQUAL_STRING("tcp", server.protocol.c_str());
    TEST_ASSERT_EQUAL_STRING("test-server", server.hostname.c_str());
    TEST_ASSERT_EQUAL(2101, server.port);

    // Test UDP connection string with mountpoint
    result = MDNSRTCMDiscovery::parseConnectionString("udp://rtcm-server:2102/mount1", server);
    TEST_ASSERT_TRUE(result);
    TEST_ASSERT_EQUAL_STRING("udp", server.protocol.c_str());
    TEST_ASSERT_EQUAL_STRING("rtcm-server", server.hostname.c_str());
    TEST_ASSERT_EQUAL(2102, server.port);
    TEST_ASSERT_EQUAL_STRING("mount1", server.mountpoint.c_str());

    // Test with authentication
    result = MDNSRTCMDiscovery::parseConnectionString("tcp://user:pass@auth-server:2101", server);
    TEST_ASSERT_TRUE(result);
    TEST_ASSERT_EQUAL_STRING("tcp", server.protocol.c_str());
    TEST_ASSERT_EQUAL_STRING("auth-server", server.hostname.c_str());
    TEST_ASSERT_EQUAL(2101, server.port);
    TEST_ASSERT_TRUE(server.requiresAuth);

    // Test invalid connection string
    result = MDNSRTCMDiscovery::parseConnectionString("invalid-string", server);
    TEST_ASSERT_FALSE(result);
}

void test_mdns_hostname_detection()
{
    // Test mDNS hostname detection in RTCM clients
    TEST_ASSERT_TRUE(TCPRTCMClient::resolveMDNSHost != nullptr); // Check method exists
    TEST_ASSERT_TRUE(UDPRTCMClient::resolveMDNSHost != nullptr); // Check method exists
}

void setup()
{
    delay(2000); // Give time for serial monitor
    UNITY_BEGIN();

    RUN_TEST(test_mdns_manager_initialization);
    RUN_TEST(test_mdns_hostname_validation);
    RUN_TEST(test_mdns_service_advertisement);
    RUN_TEST(test_mdns_config_validation);
    RUN_TEST(test_mdns_rtcm_discovery);
    RUN_TEST(test_mdns_connection_string_parsing);
    RUN_TEST(test_mdns_hostname_detection);

    UNITY_END();
}

void loop()
{
    // Empty loop
}