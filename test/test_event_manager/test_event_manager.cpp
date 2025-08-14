#include <unity.h>
#include "../../lib/EventManager/EventManager.h"

EventManager* manager = nullptr;
bool handlerCalled = false;
Event lastEvent;
int handlerCallCount = 0;

void setUp(void) {
    manager = EventManager::getInstance();
    handlerCalled = false;
    handlerCallCount = 0;
    lastEvent = Event();
}

void tearDown(void) {
    if (manager) {
        manager->stop();
    }
    handlerCalled = false;
    handlerCallCount = 0;
}

void testEventHandler(const Event& event) {
    handlerCalled = true;
    handlerCallCount++;
    lastEvent.type = event.type;
    lastEvent.payload.set(event.payload);
    lastEvent.timestamp = event.timestamp;
}

void test_singleton_instance() {
    EventManager* instance1 = EventManager::getInstance();
    EventManager* instance2 = EventManager::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

void test_manager_lifecycle() {
    // Test begin
    manager->begin();
    TEST_ASSERT_TRUE(true); // Manager starts without error
    
    // Small delay to allow task creation
    vTaskDelay(pdMS_TO_TICKS(10));
    
    // Test stop
    manager->stop();
    TEST_ASSERT_TRUE(true); // Manager stops without error
}

void test_event_subscription() {
    bool result = manager->subscribe(EventType::CONFIG_CHANGED, testEventHandler);
    TEST_ASSERT_TRUE(result);
    TEST_ASSERT_EQUAL(1, manager->getSubscriptionCount());
}

void test_event_unsubscription() {
    manager->subscribe(EventType::CONFIG_CHANGED, testEventHandler);
    TEST_ASSERT_EQUAL(1, manager->getSubscriptionCount());
    
    bool result = manager->unsubscribe(EventType::CONFIG_CHANGED);
    TEST_ASSERT_TRUE(result);
    TEST_ASSERT_EQUAL(0, manager->getSubscriptionCount());
}

void test_multiple_subscriptions() {
    manager->subscribe(EventType::CONFIG_CHANGED, testEventHandler);
    manager->subscribe(EventType::WIFI_CONNECTED, testEventHandler);
    manager->subscribe(EventType::RTCM_DATA_RECEIVED, testEventHandler);
    
    TEST_ASSERT_EQUAL(3, manager->getSubscriptionCount());
}

void test_synchronous_event_publishing() {
    manager->subscribe(EventType::CONFIG_CHANGED, testEventHandler);
    
    // Publish synchronously
    manager->publish(EventType::CONFIG_CHANGED);
    
    TEST_ASSERT_TRUE(handlerCalled);
    TEST_ASSERT_EQUAL(EventType::CONFIG_CHANGED, lastEvent.type);
}

void test_synchronous_event_with_payload() {
    manager->subscribe(EventType::WIFI_CONNECTED, testEventHandler);
    
    DynamicJsonDocument payload(256);
    payload["ssid"] = "TestNetwork";
    payload["ip"] = "192.168.1.100";
    
    manager->publish(EventType::WIFI_CONNECTED, payload.as<JsonObject>());
    
    TEST_ASSERT_TRUE(handlerCalled);
    TEST_ASSERT_EQUAL(EventType::WIFI_CONNECTED, lastEvent.type);
    TEST_ASSERT_EQUAL_STRING("TestNetwork", lastEvent.payload["ssid"]);
    TEST_ASSERT_EQUAL_STRING("192.168.1.100", lastEvent.payload["ip"]);
}

void test_asynchronous_event_publishing() {
    manager->begin();
    vTaskDelay(pdMS_TO_TICKS(10)); // Allow task to start
    
    manager->subscribe(EventType::SYSTEM_ERROR, testEventHandler);
    
    // Publish asynchronously
    manager->publishAsync(EventType::SYSTEM_ERROR);
    
    // Give time for async processing
    vTaskDelay(pdMS_TO_TICKS(50));
    
    TEST_ASSERT_TRUE(handlerCalled);
    TEST_ASSERT_EQUAL(EventType::SYSTEM_ERROR, lastEvent.type);
    
    manager->stop();
}

void test_event_queue_functionality() {
    manager->begin();
    vTaskDelay(pdMS_TO_TICKS(10));
    
    // Initially no events queued
    TEST_ASSERT_FALSE(manager->isEventQueued());
    TEST_ASSERT_EQUAL(0, manager->getQueuedEventCount());
    
    manager->stop();
}

void test_event_type_conversion() {
    // Test event type to string conversion
    String configChangedStr = manager->eventTypeToString(EventType::CONFIG_CHANGED);
    TEST_ASSERT_EQUAL_STRING("config_changed", configChangedStr.c_str());
    
    String wifiConnectedStr = manager->eventTypeToString(EventType::WIFI_CONNECTED);
    TEST_ASSERT_EQUAL_STRING("wifi_connected", wifiConnectedStr.c_str());
    
    // Test string to event type conversion
    EventType configType = manager->stringToEventType("config_changed");
    TEST_ASSERT_EQUAL(EventType::CONFIG_CHANGED, configType);
    
    EventType wifiType = manager->stringToEventType("wifi_connected");
    TEST_ASSERT_EQUAL(EventType::WIFI_CONNECTED, wifiType);
}

void test_event_creation() {
    Event event(EventType::HEALTH_UPDATE, 256);
    event.payload["cpu_usage"] = 45;
    event.payload["free_heap"] = 123456;
    
    TEST_ASSERT_EQUAL(EventType::HEALTH_UPDATE, event.type);
    TEST_ASSERT_EQUAL(45, event.payload["cpu_usage"]);
    TEST_ASSERT_EQUAL(123456, event.payload["free_heap"]);
    TEST_ASSERT_TRUE(event.timestamp > 0);
}

void test_multiple_handlers_same_event() {
    int handler1Called = 0;
    int handler2Called = 0;
    
    auto handler1 = [&handler1Called](const Event& e) { handler1Called++; };
    auto handler2 = [&handler2Called](const Event& e) { handler2Called++; };
    
    manager->subscribe(EventType::MEMORY_LOW, handler1);
    manager->subscribe(EventType::MEMORY_LOW, handler2);
    
    manager->publish(EventType::MEMORY_LOW);
    
    TEST_ASSERT_EQUAL(1, handler1Called);
    TEST_ASSERT_EQUAL(1, handler2Called);
}

void test_null_handler_rejection() {
    bool result = manager->subscribe(EventType::CONFIG_CHANGED, nullptr);
    TEST_ASSERT_FALSE(result);
    TEST_ASSERT_EQUAL(0, manager->getSubscriptionCount());
}

void test_all_event_types() {
    // Test all defined event types
    EventType types[] = {
        EventType::CONFIG_CHANGED,
        EventType::WIFI_CONNECTED,
        EventType::WIFI_DISCONNECTED,
        EventType::RTCM_DATA_RECEIVED,
        EventType::RTCM_CLIENT_STARTED,
        EventType::RTCM_CLIENT_STOPPED,
        EventType::USB_CONNECTED,
        EventType::USB_DISCONNECTED,
        EventType::SYSTEM_ERROR,
        EventType::HEALTH_UPDATE,
        EventType::MEMORY_LOW
    };
    
    for (int i = 0; i < sizeof(types) / sizeof(types[0]); i++) {
        String typeStr = manager->eventTypeToString(types[i]);
        EventType convertedType = manager->stringToEventType(typeStr);
        TEST_ASSERT_EQUAL(types[i], convertedType);
    }
}

void test_event_timestamp() {
    unsigned long beforeTime = millis();
    Event event(EventType::CONFIG_CHANGED);
    unsigned long afterTime = millis();
    
    TEST_ASSERT_TRUE(event.timestamp >= beforeTime);
    TEST_ASSERT_TRUE(event.timestamp <= afterTime);
}

int main() {
    UNITY_BEGIN();
    
    RUN_TEST(test_singleton_instance);
    RUN_TEST(test_manager_lifecycle);
    RUN_TEST(test_event_subscription);
    RUN_TEST(test_event_unsubscription);
    RUN_TEST(test_multiple_subscriptions);
    RUN_TEST(test_synchronous_event_publishing);
    RUN_TEST(test_synchronous_event_with_payload);
    RUN_TEST(test_asynchronous_event_publishing);
    RUN_TEST(test_event_queue_functionality);
    RUN_TEST(test_event_type_conversion);
    RUN_TEST(test_event_creation);
    RUN_TEST(test_multiple_handlers_same_event);
    RUN_TEST(test_null_handler_rejection);
    RUN_TEST(test_all_event_types);
    RUN_TEST(test_event_timestamp);
    
    return UNITY_END();
}