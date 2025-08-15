#include <unity.h>
#include "../../lib/DataRouter/DataRouter.h"

void setUp(void) {
    // Set up test
}

void tearDown(void) {
    // Clean up after test
}

void test_data_router_initialization() {
    DataRouter* router = DataRouter::getInstance();
    TEST_ASSERT_NOT_NULL(router);
}

void test_data_router_interface_strings() {
    // Test interface to string conversion
    TEST_ASSERT_EQUAL_STRING("none", DataRouter::interfaceToString(DataRouter::NONE));
    TEST_ASSERT_EQUAL_STRING("usb_otg", DataRouter::interfaceToString(DataRouter::USB_OTG));
    TEST_ASSERT_EQUAL_STRING("uart", DataRouter::interfaceToString(DataRouter::UART));
}

void test_data_router_routing_mode_strings() {
    // Test routing mode to string conversion
    TEST_ASSERT_EQUAL_STRING("auto", DataRouter::routingModeToString(DataRouter::AUTO));
    TEST_ASSERT_EQUAL_STRING("usb_priority", DataRouter::routingModeToString(DataRouter::USB_PRIORITY));
    TEST_ASSERT_EQUAL_STRING("uart_only", DataRouter::routingModeToString(DataRouter::UART_ONLY));
    TEST_ASSERT_EQUAL_STRING("usb_only", DataRouter::routingModeToString(DataRouter::USB_ONLY));
}

void test_data_router_routing_mode() {
    DataRouter* router = DataRouter::getInstance();
    
    // Test setting routing mode
    router->setRoutingMode(DataRouter::USB_PRIORITY);
    TEST_ASSERT_EQUAL(DataRouter::USB_PRIORITY, router->getRoutingMode());
    
    router->setRoutingMode(DataRouter::UART_ONLY);
    TEST_ASSERT_EQUAL(DataRouter::UART_ONLY, router->getRoutingMode());
    
    router->setRoutingMode(DataRouter::AUTO);
    TEST_ASSERT_EQUAL(DataRouter::AUTO, router->getRoutingMode());
}

void test_data_router_statistics() {
    DataRouter* router = DataRouter::getInstance();
    
    // Reset statistics
    router->resetStatistics();
    
    // Get initial statistics
    DataRouter::RouteStats stats = router->getStatistics();
    TEST_ASSERT_EQUAL(0, stats.upstreamBytes);
    TEST_ASSERT_EQUAL(0, stats.downstreamBytes);
    TEST_ASSERT_EQUAL(0, stats.upstreamPackets);
    TEST_ASSERT_EQUAL(0, stats.downstreamPackets);
    TEST_ASSERT_EQUAL(0, stats.interfaceSwitches);
}

void test_data_router_mavlink_processing() {
    DataRouter* router = DataRouter::getInstance();
    
    // Test enabling/disabling MAVLink processing
    router->enableMAVLinkProcessing(true);
    TEST_ASSERT_TRUE(router->isMAVLinkProcessingEnabled());
    
    router->enableMAVLinkProcessing(false);
    TEST_ASSERT_FALSE(router->isMAVLinkProcessingEnabled());
}

void test_circular_buffer() {
    CircularBuffer<uint8_t, 8> buffer;
    
    // Test initial state
    TEST_ASSERT_TRUE(buffer.empty());
    TEST_ASSERT_FALSE(buffer.full());
    TEST_ASSERT_EQUAL(0, buffer.size());
    TEST_ASSERT_EQUAL(8, buffer.capacity());
    
    // Test pushing data
    TEST_ASSERT_TRUE(buffer.push(1));
    TEST_ASSERT_TRUE(buffer.push(2));
    TEST_ASSERT_TRUE(buffer.push(3));
    
    TEST_ASSERT_FALSE(buffer.empty());
    TEST_ASSERT_EQUAL(3, buffer.size());
    
    // Test popping data
    uint8_t value;
    TEST_ASSERT_TRUE(buffer.pop(value));
    TEST_ASSERT_EQUAL(1, value);
    
    TEST_ASSERT_TRUE(buffer.pop(value));
    TEST_ASSERT_EQUAL(2, value);
    
    TEST_ASSERT_EQUAL(1, buffer.size());
    
    // Fill the buffer to test capacity
    for (int i = 0; i < 7; i++) {
        TEST_ASSERT_TRUE(buffer.push(i + 10));
    }
    
    TEST_ASSERT_TRUE(buffer.full());
    TEST_ASSERT_FALSE(buffer.push(99)); // Should fail when full
}

void test_data_router_routing_operations() {
    DataRouter* router = DataRouter::getInstance();
    
    // Test upstream routing with null data
    router->routeUpstream(nullptr, 0);
    // Should not crash
    
    // Test downstream routing with null data
    router->routeDownstream(nullptr, 0);
    // Should not crash
    
    // Test routing with valid data
    uint8_t testData[] = {1, 2, 3, 4, 5};
    router->routeUpstream(testData, sizeof(testData));
    router->routeDownstream(testData, sizeof(testData));
    // Should not crash
}

void run_data_router_tests() {
    RUN_TEST(test_data_router_initialization);
    RUN_TEST(test_data_router_interface_strings);
    RUN_TEST(test_data_router_routing_mode_strings);
    RUN_TEST(test_data_router_routing_mode);
    RUN_TEST(test_data_router_statistics);
    RUN_TEST(test_data_router_mavlink_processing);
    RUN_TEST(test_circular_buffer);
    RUN_TEST(test_data_router_routing_operations);
}

#ifdef UNIT_TEST_STANDALONE
int main(int argc, char **argv) {
    UNITY_BEGIN();
    run_data_router_tests();
    return UNITY_END();
}
#endif