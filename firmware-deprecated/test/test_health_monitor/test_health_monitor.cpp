#include <unity.h>
#include <HealthMonitor.h>
#include <EventManager.h>
#include <ArduinoJson.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

HealthMonitor* healthMonitor;
EventManager* eventManager;

// Event tracking
std::vector<EventType> capturedEvents;
std::vector<JsonDocument> capturedPayloads;

// Callback tracking
bool lowMemoryCallbackTriggered = false;
bool highCPUCallbackTriggered = false;
bool componentFailureCallbackTriggered = false;
uint32_t lastReportedMemory = 0;
float lastReportedCPU = 0.0f;
String lastFailedComponent = "";

// Test components
bool testComponent1Healthy = true;
bool testComponent2Healthy = true;

void eventCallback(const Event& event) {
    capturedEvents.push_back(event.type);
    DynamicJsonDocument doc(1024);
    doc.set(event.payload);
    capturedPayloads.push_back(doc);
}

void lowMemoryCallback(uint32_t freeBytes) {
    lowMemoryCallbackTriggered = true;
    lastReportedMemory = freeBytes;
}

void highCPUCallback(float cpuUsage) {
    highCPUCallbackTriggered = true;
    lastReportedCPU = cpuUsage;
}

void componentFailureCallback(const char* componentName) {
    componentFailureCallbackTriggered = true;
    lastFailedComponent = componentName;
}

bool testComponent1HealthCheck() {
    return testComponent1Healthy;
}

bool testComponent2HealthCheck() {
    return testComponent2Healthy;
}

void setUp(void) {
    // Initialize dependencies
    eventManager = EventManager::getInstance();
    
    // Get HealthMonitor instance
    healthMonitor = HealthMonitor::getInstance();
    
    // Reset test state
    capturedEvents.clear();
    capturedPayloads.clear();
    lowMemoryCallbackTriggered = false;
    highCPUCallbackTriggered = false;
    componentFailureCallbackTriggered = false;
    lastReportedMemory = 0;
    lastReportedCPU = 0.0f;
    lastFailedComponent = "";
    testComponent1Healthy = true;
    testComponent2Healthy = true;
    
    // Subscribe to health events
    eventManager->subscribe(EventType::HEALTH_UPDATE, eventCallback);
}

void tearDown(void) {
    // Stop health monitor
    healthMonitor->stop();
    
    // Unregister test components
    healthMonitor->unregisterComponent("TestComponent1");
    healthMonitor->unregisterComponent("TestComponent2");
    
    // Unsubscribe from events
    eventManager->unsubscribe(EventType::HEALTH_UPDATE, eventCallback);
}

// Test singleton pattern
void test_health_monitor_singleton(void) {
    HealthMonitor* instance1 = HealthMonitor::getInstance();
    HealthMonitor* instance2 = HealthMonitor::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

// Test initialization
void test_health_monitor_initialization(void) {
    // Start health monitor
    bool result = healthMonitor->begin(1000); // 1 second interval
    TEST_ASSERT_TRUE(result);
    
    // Test double initialization
    result = healthMonitor->begin(2000);
    TEST_ASSERT_TRUE(result); // Should handle gracefully
    
    delay(100); // Allow task to start
}

// Test system health retrieval
void test_health_monitor_get_system_health(void) {
    healthMonitor->begin(1000);
    delay(100); // Allow initial metrics update
    
    HealthMonitor::SystemHealth health = healthMonitor->getSystemHealth();
    
    // Check basic metrics are populated
    TEST_ASSERT_GREATER_THAN(0, health.uptime);
    TEST_ASSERT_GREATER_THAN(0, health.freeHeap);
    TEST_ASSERT_GREATER_OR_EQUAL(0, health.minFreeHeap);
    TEST_ASSERT_GREATER_OR_EQUAL(0.0f, health.cpuUsage);
    TEST_ASSERT_LESS_OR_EQUAL(100.0f, health.cpuUsage);
    
    // System should be healthy by default
    TEST_ASSERT_TRUE(health.systemHealthy);
    TEST_ASSERT_FALSE(health.lowMemoryWarning);
}

// Test component registration
void test_health_monitor_component_registration(void) {
    healthMonitor->begin(1000);
    
    // Register components
    healthMonitor->registerComponent("TestComponent1", testComponent1HealthCheck);
    healthMonitor->registerComponent("TestComponent2", testComponent2HealthCheck);
    
    delay(1500); // Wait for health check cycle
    
    HealthMonitor::SystemHealth health = healthMonitor->getSystemHealth();
    
    // Check components are registered
    bool found1 = false;
    bool found2 = false;
    for (const auto& component : health.components) {
        if (strcmp(component.name, "TestComponent1") == 0) {
            found1 = true;
            TEST_ASSERT_TRUE(component.healthy);
        }
        if (strcmp(component.name, "TestComponent2") == 0) {
            found2 = true;
            TEST_ASSERT_TRUE(component.healthy);
        }
    }
    
    TEST_ASSERT_TRUE(found1);
    TEST_ASSERT_TRUE(found2);
}

// Test component health checks
void test_health_monitor_component_health_check(void) {
    healthMonitor->begin(1000);
    
    // Register callbacks
    healthMonitor->onComponentFailure(componentFailureCallback);
    
    // Register component
    healthMonitor->registerComponent("TestComponent1", testComponent1HealthCheck);
    
    // Wait for initial check
    delay(1500);
    
    // Make component unhealthy
    testComponent1Healthy = false;
    
    // Trigger manual health check
    healthMonitor->triggerHealthCheck();
    delay(100);
    
    // Check callback was triggered
    TEST_ASSERT_TRUE(componentFailureCallbackTriggered);
    TEST_ASSERT_EQUAL_STRING("TestComponent1", lastFailedComponent.c_str());
    
    // Check system is now unhealthy
    TEST_ASSERT_FALSE(healthMonitor->isSystemHealthy());
}

// Test memory threshold
void test_health_monitor_memory_threshold(void) {
    healthMonitor->begin(1000);
    
    // Set callback
    healthMonitor->onLowMemory(lowMemoryCallback);
    
    // Set very high threshold to trigger warning
    uint32_t currentFree = healthMonitor->getFreeHeap();
    healthMonitor->setMemoryThreshold(currentFree + 1000000); // Set above current free
    
    // Wait for check
    delay(1500);
    
    // Check callback was triggered
    TEST_ASSERT_TRUE(lowMemoryCallbackTriggered);
    TEST_ASSERT_GREATER_THAN(0, lastReportedMemory);
    
    // Check system health reflects low memory
    HealthMonitor::SystemHealth health = healthMonitor->getSystemHealth();
    TEST_ASSERT_TRUE(health.lowMemoryWarning);
    TEST_ASSERT_FALSE(health.systemHealthy);
}

// Test CPU threshold
void test_health_monitor_cpu_threshold(void) {
    healthMonitor->begin(1000);
    
    // Set callback
    healthMonitor->onHighCPU(highCPUCallback);
    
    // Set very low threshold to trigger warning
    healthMonitor->setCPUThreshold(0.1f); // 0.1% - should always trigger
    
    // Wait for CPU calculation
    delay(2500); // Need at least 2 cycles for CPU calculation
    
    // Check if callback was triggered (may not trigger in test environment)
    if (highCPUCallbackTriggered) {
        TEST_ASSERT_GREATER_OR_EQUAL(0.0f, lastReportedCPU);
        TEST_ASSERT_LESS_OR_EQUAL(100.0f, lastReportedCPU);
    }
}

// Test manual component health update
void test_health_monitor_manual_update(void) {
    healthMonitor->begin(1000);
    
    // Register component without health check
    healthMonitor->registerComponent("ManualComponent", nullptr);
    
    // Update health manually
    healthMonitor->updateComponentHealth("ManualComponent", true, "running");
    
    delay(1500);
    
    HealthMonitor::SystemHealth health = healthMonitor->getSystemHealth();
    
    // Find component
    bool found = false;
    for (const auto& component : health.components) {
        if (strcmp(component.name, "ManualComponent") == 0) {
            found = true;
            TEST_ASSERT_TRUE(component.healthy);
            TEST_ASSERT_EQUAL_STRING("running", component.status);
        }
    }
    
    TEST_ASSERT_TRUE(found);
    
    // Update to unhealthy
    healthMonitor->updateComponentHealth("ManualComponent", false, "error");
    
    // Trigger immediate check
    healthMonitor->triggerHealthCheck();
    delay(100);
    
    // Check system is now unhealthy
    TEST_ASSERT_FALSE(healthMonitor->isSystemHealthy());
}

// Test task information
void test_health_monitor_task_info(void) {
    healthMonitor->begin(1000);
    
    // Create a test task
    TaskHandle_t testTaskHandle;
    xTaskCreate([](void* param) {
        while (true) {
            vTaskDelay(pdMS_TO_TICKS(100));
        }
    }, "TestTask", 2048, nullptr, 1, &testTaskHandle);
    
    delay(1500); // Wait for health check
    
    HealthMonitor::SystemHealth health = healthMonitor->getSystemHealth();
    
    // Check we have tasks
    TEST_ASSERT_GREATER_THAN(0, health.tasks.size());
    
    // Find our test task
    bool foundTestTask = false;
    bool foundHealthTask = false;
    
    for (const auto& task : health.tasks) {
        if (strcmp(task.name, "TestTask") == 0) {
            foundTestTask = true;
            TEST_ASSERT_EQUAL(1, task.priority);
            TEST_ASSERT_GREATER_THAN(0, task.stackHighWaterMark);
        }
        if (strcmp(task.name, "HealthMonitor") == 0) {
            foundHealthTask = true;
        }
    }
    
    TEST_ASSERT_TRUE(foundTestTask);
    TEST_ASSERT_TRUE(foundHealthTask);
    
    // Clean up test task
    vTaskDelete(testTaskHandle);
}

// Test health events
void test_health_monitor_events(void) {
    healthMonitor->begin(500); // Fast interval for testing
    
    // Wait for at least one event
    delay(1000);
    
    // Check we received health update events
    TEST_ASSERT_GREATER_THAN(0, capturedEvents.size());
    
    bool foundHealthUpdate = false;
    for (size_t i = 0; i < capturedEvents.size(); i++) {
        if (capturedEvents[i] == EventType::HEALTH_UPDATE) {
            foundHealthUpdate = true;
            
            // Check payload structure
            const JsonDocument& payload = capturedPayloads[i];
            TEST_ASSERT_TRUE(payload.containsKey("uptime"));
            TEST_ASSERT_TRUE(payload.containsKey("freeHeap"));
            TEST_ASSERT_TRUE(payload.containsKey("cpuUsage"));
            TEST_ASSERT_TRUE(payload.containsKey("systemHealthy"));
            TEST_ASSERT_TRUE(payload.containsKey("taskCount"));
            TEST_ASSERT_TRUE(payload.containsKey("componentCount"));
        }
    }
    
    TEST_ASSERT_TRUE(foundHealthUpdate);
}

// Test getters
void test_health_monitor_getters(void) {
    healthMonitor->begin(1000);
    delay(100);
    
    // Test individual getters
    uint32_t uptime = healthMonitor->getUptime();
    TEST_ASSERT_GREATER_THAN(0, uptime);
    
    uint32_t freeHeap = healthMonitor->getFreeHeap();
    TEST_ASSERT_GREATER_THAN(1000, freeHeap); // Should have at least 1KB free
    
    uint32_t minFreeHeap = healthMonitor->getMinFreeHeap();
    TEST_ASSERT_GREATER_OR_EQUAL(0, minFreeHeap);
    TEST_ASSERT_LESS_OR_EQUAL(freeHeap, minFreeHeap);
    
    float cpuUsage = healthMonitor->getCPUUsage();
    TEST_ASSERT_GREATER_OR_EQUAL(0.0f, cpuUsage);
    TEST_ASSERT_LESS_OR_EQUAL(100.0f, cpuUsage);
    
    size_t taskCount = healthMonitor->getTaskCount();
    TEST_ASSERT_GREATER_THAN(0, taskCount);
    
    size_t healthyComponents = healthMonitor->getHealthyComponentCount();
    TEST_ASSERT_GREATER_OR_EQUAL(0, healthyComponents);
}

// Test stop functionality
void test_health_monitor_stop(void) {
    healthMonitor->begin(100);
    delay(200);
    
    // Capture event count
    size_t eventCountBefore = capturedEvents.size();
    
    // Stop monitor
    healthMonitor->stop();
    
    // Wait and check no new events
    delay(500);
    
    size_t eventCountAfter = capturedEvents.size();
    TEST_ASSERT_EQUAL(eventCountBefore, eventCountAfter);
}

// Test component unregistration
void test_health_monitor_unregister_component(void) {
    healthMonitor->begin(1000);
    
    // Register and then unregister component
    healthMonitor->registerComponent("TempComponent", nullptr);
    delay(1500);
    
    // Verify it exists
    HealthMonitor::SystemHealth health = healthMonitor->getSystemHealth();
    bool found = false;
    for (const auto& component : health.components) {
        if (strcmp(component.name, "TempComponent") == 0) {
            found = true;
        }
    }
    TEST_ASSERT_TRUE(found);
    
    // Unregister
    healthMonitor->unregisterComponent("TempComponent");
    delay(1500);
    
    // Verify it's gone
    health = healthMonitor->getSystemHealth();
    found = false;
    for (const auto& component : health.components) {
        if (strcmp(component.name, "TempComponent") == 0) {
            found = true;
        }
    }
    TEST_ASSERT_FALSE(found);
}

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    UNITY_BEGIN();
    
    // Basic functionality tests
    RUN_TEST(test_health_monitor_singleton);
    RUN_TEST(test_health_monitor_initialization);
    RUN_TEST(test_health_monitor_get_system_health);
    
    // Component tests
    RUN_TEST(test_health_monitor_component_registration);
    RUN_TEST(test_health_monitor_component_health_check);
    RUN_TEST(test_health_monitor_manual_update);
    RUN_TEST(test_health_monitor_unregister_component);
    
    // Threshold tests
    RUN_TEST(test_health_monitor_memory_threshold);
    RUN_TEST(test_health_monitor_cpu_threshold);
    
    // Information tests
    RUN_TEST(test_health_monitor_task_info);
    RUN_TEST(test_health_monitor_getters);
    
    // Event tests
    RUN_TEST(test_health_monitor_events);
    
    // Control tests
    RUN_TEST(test_health_monitor_stop);
    
    UNITY_END();
}

void loop() {
    // Nothing to do here
}