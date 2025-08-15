#pragma once

#include <Arduino.h>
#include <vector>
#include <functional>
#include "../CoreCommon.h"

class IntegrationTest {
public:
    struct TestResult {
        const char* name;
        bool passed;
        uint32_t duration;
        const char* failureReason;
        uint32_t timestamp;
    };

    struct TestSuite {
        const char* name;
        std::vector<TestResult> results;
        uint32_t totalTests;
        uint32_t passedTests;
        uint32_t failedTests;
        uint32_t totalDuration;
    };

    // Test function type
    using TestFunction = std::function<TestResult()>;

private:
    static IntegrationTest* instance;
    std::vector<TestSuite> testSuites;
    bool isRunning;
    
    // Test configuration
    uint32_t stressTestDuration;
    size_t memoryTestSize;
    uint32_t timeoutMs;

public:
    static IntegrationTest* getInstance();
    
    void begin(uint32_t timeoutMs = 30000);
    
    // Main test runners
    void runAllTests();
    void runSystemTests();
    void runStressTests();
    void runMemoryTests();
    void runConnectivityTests();
    
    // Individual test categories
    TestSuite runHealthMonitorTests();
    TestSuite runTaskManagerTests();
    TestSuite runMemoryManagerTests();
    TestSuite runErrorHandlerTests();
    TestSuite runConfigurationTests();
    TestSuite runWiFiTests();
    TestSuite runRTCMTests();
    TestSuite runCommunicationTests();
    
    // Stress testing
    TestSuite runStabilityTests(uint32_t durationMs = 300000); // 5 minutes
    TestSuite runMemoryStressTests();
    TestSuite runConcurrencyTests();
    
    // Results and reporting
    void printTestResults() const;
    void printTestSummary() const;
    std::vector<TestSuite> getAllResults() const;
    TestSuite getLastResult() const;
    
    // Configuration
    void setStressTestDuration(uint32_t durationMs);
    void setMemoryTestSize(size_t sizeBytes);
    void setTimeout(uint32_t timeoutMs);

private:
    IntegrationTest();
    ~IntegrationTest() = default;
    
    // Helper methods
    TestResult runTest(const char* testName, TestFunction testFunc);
    TestSuite createTestSuite(const char* suiteName);
    void addTestResult(TestSuite& suite, const TestResult& result);
    void printTestResult(const TestResult& result) const;
    const char* formatDuration(uint32_t durationMs) const;
    
    // Individual test scenarios
    static TestResult testHealthMonitorBasic();
    static TestResult testHealthMonitorThresholds();
    static TestResult testHealthMonitorComponents();
    static TestResult testTaskManagerCreation();
    static TestResult testTaskManagerWatchdog();
    static TestResult testTaskManagerLifecycle();
    static TestResult testMemoryManagerStats();
    static TestResult testMemoryManagerPools();
    static TestResult testMemoryManagerCleanup();
    static TestResult testErrorHandlerLogging();
    static TestResult testErrorHandlerRecovery();
    static TestResult testErrorHandlerThresholds();
    static TestResult testWiFiConnection();
    static TestResult testWiFiReconnection();
    static TestResult testWiFiAPMode();
    static TestResult testRTCMDataFlow();
    static TestResult testRTCMReconnection();
    static TestResult testUSBUARTSwitching();
    static TestResult testConfigPersistence();
    static TestResult testConfigValidation();
    static TestResult testWebSocketReconnection();
    static TestResult testConcurrentRequests();
    static TestResult testMemoryUnderLoad();
    static TestResult testSystemRecovery();
    static TestResult testLongRunningStability();
    
    // Utility methods
    static bool waitForCondition(std::function<bool()> condition, uint32_t timeoutMs);
    static void simulateLoad(uint32_t durationMs);
    static bool checkSystemHealth();
    static void forceMemoryPressure();
    static void cleanup();
};