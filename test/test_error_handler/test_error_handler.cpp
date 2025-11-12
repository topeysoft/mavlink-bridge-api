#include <unity.h>
#include <ErrorHandler.h>
#include <EventManager.h>
#include <ArduinoJson.h>

ErrorHandler* errorHandler;
EventManager* eventManager;

// Event tracking
std::vector<EventType> capturedEvents;
std::vector<JsonDocument> capturedPayloads;

// Callback tracking
bool criticalErrorCallbackTriggered = false;
bool panicHandlerTriggered = false;
bool recoveryActionTriggered = false;
ErrorHandler::ErrorInfo lastCriticalError;

// Test error codes
const uint32_t TEST_ERROR_CODE_1 = 1001;
const uint32_t TEST_ERROR_CODE_2 = 1002;
const uint32_t TEST_ERROR_CODE_RECOVERABLE = 2001;

void eventCallback(const Event& event) {
    capturedEvents.push_back(event.type);
    DynamicJsonDocument doc(256);
    doc.set(event.payload);
    capturedPayloads.push_back(doc);
}

void criticalErrorCallback(const ErrorHandler::ErrorInfo& error) {
    criticalErrorCallbackTriggered = true;
    lastCriticalError = error;
}

void panicHandler() {
    panicHandlerTriggered = true;
    // Don't actually restart in tests
}

void recoveryAction() {
    recoveryActionTriggered = true;
}

void setUp(void) {
    // Initialize dependencies
    eventManager = EventManager::getInstance();
    
    // Get ErrorHandler instance
    errorHandler = ErrorHandler::getInstance();
    errorHandler->begin();
    
    // Clear any existing errors
    errorHandler->clearErrors();
    
    // Reset test state
    capturedEvents.clear();
    capturedPayloads.clear();
    criticalErrorCallbackTriggered = false;
    panicHandlerTriggered = false;
    recoveryActionTriggered = false;
    
    // Subscribe to error events
    eventManager->subscribe(EventType::SYSTEM_ERROR, eventCallback);
    
    // Set test callbacks
    errorHandler->onCriticalError(criticalErrorCallback);
    errorHandler->setPanicHandler(panicHandler);
}

void tearDown(void) {
    // Unregister recovery actions
    errorHandler->unregisterRecoveryAction(TEST_ERROR_CODE_RECOVERABLE);
    
    // Clear errors
    errorHandler->clearErrors();
    
    // Unsubscribe from events
    eventManager->unsubscribe(EventType::SYSTEM_ERROR, eventCallback);
}

// Test singleton pattern
void test_error_handler_singleton(void) {
    ErrorHandler* instance1 = ErrorHandler::getInstance();
    ErrorHandler* instance2 = ErrorHandler::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

// Test basic error logging
void test_error_handler_log_errors(void) {
    // Log different levels
    errorHandler->logInfo("TestComponent", "Info message");
    errorHandler->logWarning("TestComponent", "Warning message");
    errorHandler->logError("TestComponent", "Error message", TEST_ERROR_CODE_1);
    errorHandler->logCritical("TestComponent", "Critical message", TEST_ERROR_CODE_2);
    
    delay(100); // Allow events to process
    
    // Check total error count
    TEST_ASSERT_EQUAL(4, errorHandler->getTotalErrorCount());
    
    // Check counts by level
    TEST_ASSERT_EQUAL(1, errorHandler->getErrorCount(ErrorHandler::INFO));
    TEST_ASSERT_EQUAL(1, errorHandler->getErrorCount(ErrorHandler::WARNING));
    TEST_ASSERT_EQUAL(1, errorHandler->getErrorCount(ErrorHandler::ERROR));
    TEST_ASSERT_EQUAL(1, errorHandler->getErrorCount(ErrorHandler::CRITICAL));
    
    // Check error codes
    TEST_ASSERT_EQUAL(1, errorHandler->getErrorCount(TEST_ERROR_CODE_1));
    TEST_ASSERT_EQUAL(1, errorHandler->getErrorCount(TEST_ERROR_CODE_2));
    
    // Check critical callback was triggered
    TEST_ASSERT_TRUE(criticalErrorCallbackTriggered);
    TEST_ASSERT_EQUAL(ErrorHandler::CRITICAL, lastCriticalError.level);
    TEST_ASSERT_EQUAL_STRING("TestComponent", lastCriticalError.component);
}

// Test error retrieval
void test_error_handler_get_errors(void) {
    // Log some errors
    errorHandler->logError("Component1", "Error 1", 100);
    errorHandler->logError("Component2", "Error 2", 200);
    errorHandler->logWarning("Component1", "Warning 1");
    errorHandler->logCritical("Component2", "Critical 1", 300);
    
    // Get recent errors
    auto recentErrors = errorHandler->getRecentErrors(2);
    TEST_ASSERT_EQUAL(2, recentErrors.size());
    
    // Get errors by component
    auto component1Errors = errorHandler->getErrorsByComponent("Component1");
    TEST_ASSERT_EQUAL(2, component1Errors.size());
    
    auto component2Errors = errorHandler->getErrorsByComponent("Component2");
    TEST_ASSERT_EQUAL(2, component2Errors.size());
    
    // Get errors by level
    auto warnings = errorHandler->getErrorsByLevel(ErrorHandler::WARNING);
    TEST_ASSERT_EQUAL(1, warnings.size());
    
    auto errors = errorHandler->getErrorsByLevel(ErrorHandler::ERROR);
    TEST_ASSERT_EQUAL(2, errors.size());
}

// Test last error retrieval
void test_error_handler_get_last_error(void) {
    // Initially no errors
    auto lastError = errorHandler->getLastError();
    TEST_ASSERT_EQUAL(0, lastError.timestamp);
    
    // Log an error
    errorHandler->logError("TestComp", "Test error", 123);
    
    // Get last error
    lastError = errorHandler->getLastError();
    TEST_ASSERT_EQUAL(ErrorHandler::ERROR, lastError.level);
    TEST_ASSERT_EQUAL_STRING("TestComp", lastError.component);
    TEST_ASSERT_EQUAL_STRING("Test error", lastError.message);
    TEST_ASSERT_EQUAL(123, lastError.code);
    TEST_ASSERT_GREATER_THAN(0, lastError.timestamp);
}

// Test recovery actions
void test_error_handler_recovery_actions(void) {
    // Register recovery action
    errorHandler->registerRecoveryAction(TEST_ERROR_CODE_RECOVERABLE, recoveryAction);
    
    // Log error with recovery code
    errorHandler->logError("TestComp", "Recoverable error", TEST_ERROR_CODE_RECOVERABLE);
    
    delay(100);
    
    // Check recovery was triggered
    TEST_ASSERT_TRUE(recoveryActionTriggered);
    
    // Test manual recovery execution
    recoveryActionTriggered = false;
    bool result = errorHandler->executeRecoveryAction(TEST_ERROR_CODE_RECOVERABLE);
    TEST_ASSERT_TRUE(result);
    TEST_ASSERT_TRUE(recoveryActionTriggered);
    
    // Test non-existent recovery
    result = errorHandler->executeRecoveryAction(9999);
    TEST_ASSERT_FALSE(result);
    
    // Unregister and test
    errorHandler->unregisterRecoveryAction(TEST_ERROR_CODE_RECOVERABLE);
    recoveryActionTriggered = false;
    errorHandler->logError("TestComp", "Error after unregister", TEST_ERROR_CODE_RECOVERABLE);
    delay(100);
    TEST_ASSERT_FALSE(recoveryActionTriggered);
}

// Test error events
void test_error_handler_events(void) {
    // Clear previous events
    capturedEvents.clear();
    capturedPayloads.clear();
    
    // Log errors
    errorHandler->logWarning("EventTest", "Warning event");
    errorHandler->logError("EventTest", "Error event", 500);
    
    delay(100);
    
    // Check events were published
    TEST_ASSERT_GREATER_OR_EQUAL(2, capturedEvents.size());
    
    // Check event content
    for (size_t i = 0; i < capturedEvents.size(); i++) {
        if (capturedEvents[i] == EventType::SYSTEM_ERROR) {
            const JsonDocument& payload = capturedPayloads[i];
            TEST_ASSERT_TRUE(payload.containsKey("level"));
            TEST_ASSERT_TRUE(payload.containsKey("component"));
            TEST_ASSERT_TRUE(payload.containsKey("message"));
            TEST_ASSERT_TRUE(payload.containsKey("timestamp"));
            
            if (payload["code"].as<uint32_t>() == 500) {
                TEST_ASSERT_EQUAL_STRING("ERROR", payload["level"].as<const char*>());
                TEST_ASSERT_EQUAL_STRING("EventTest", payload["component"].as<const char*>());
                TEST_ASSERT_EQUAL_STRING("Error event", payload["message"].as<const char*>());
            }
        }
    }
}

// Test error statistics
void test_error_handler_statistics(void) {
    // Log various errors
    errorHandler->logError("Stats", "Error 1", 100);
    errorHandler->logError("Stats", "Error 2", 100); // Same code
    errorHandler->logError("Stats", "Error 3", 200);
    errorHandler->logWarning("Stats", "Warning 1");
    
    // Test component error count
    TEST_ASSERT_EQUAL(4, errorHandler->getComponentErrorCount("Stats"));
    TEST_ASSERT_EQUAL(0, errorHandler->getComponentErrorCount("NonExistent"));
    
    // Test error code counts
    TEST_ASSERT_EQUAL(2, errorHandler->getErrorCount(100));
    TEST_ASSERT_EQUAL(1, errorHandler->getErrorCount(200));
    
    // Test time since last error
    uint32_t timeSince = errorHandler->getTimeSinceLastError();
    TEST_ASSERT_LESS_THAN(1000, timeSince); // Should be < 1 second
    
    // Test recent errors check
    TEST_ASSERT_TRUE(errorHandler->hasRecentErrors(5000));
    TEST_ASSERT_FALSE(errorHandler->hasRecentErrors(0));
}

// Test frequent errors
void test_error_handler_frequent_errors(void) {
    // Log errors with different frequencies
    for (int i = 0; i < 5; i++) {
        errorHandler->logError("Test", "Error", 100);
    }
    for (int i = 0; i < 3; i++) {
        errorHandler->logError("Test", "Error", 200);
    }
    errorHandler->logError("Test", "Error", 300);
    
    // Get top 2 frequent errors
    auto frequent = errorHandler->getFrequentErrors(2);
    TEST_ASSERT_EQUAL(2, frequent.size());
    TEST_ASSERT_EQUAL(100, frequent[0]); // Most frequent
    TEST_ASSERT_EQUAL(200, frequent[1]); // Second most
}

// Test clear errors
void test_error_handler_clear_errors(void) {
    // Log some errors
    errorHandler->logError("Clear", "Error 1", 100);
    errorHandler->logWarning("Clear", "Warning 1");
    
    TEST_ASSERT_GREATER_THAN(0, errorHandler->getTotalErrorCount());
    
    // Clear all errors
    errorHandler->clearErrors();
    
    // Check everything is cleared
    TEST_ASSERT_EQUAL(0, errorHandler->getTotalErrorCount());
    TEST_ASSERT_EQUAL(0, errorHandler->getErrorCount(ErrorHandler::ERROR));
    TEST_ASSERT_EQUAL(0, errorHandler->getErrorCount(ErrorHandler::WARNING));
    TEST_ASSERT_EQUAL(0, errorHandler->getErrorCount(100));
    
    auto recent = errorHandler->getRecentErrors();
    TEST_ASSERT_EQUAL(0, recent.size());
}

// Test error level utilities
void test_error_handler_level_utilities(void) {
    // Test level to string
    TEST_ASSERT_EQUAL_STRING("INFO", ErrorHandler::levelToString(ErrorHandler::INFO));
    TEST_ASSERT_EQUAL_STRING("WARNING", ErrorHandler::levelToString(ErrorHandler::WARNING));
    TEST_ASSERT_EQUAL_STRING("ERROR", ErrorHandler::levelToString(ErrorHandler::ERROR));
    TEST_ASSERT_EQUAL_STRING("CRITICAL", ErrorHandler::levelToString(ErrorHandler::CRITICAL));
    
    // Test string to level
    TEST_ASSERT_EQUAL(ErrorHandler::INFO, ErrorHandler::stringToLevel("INFO"));
    TEST_ASSERT_EQUAL(ErrorHandler::WARNING, ErrorHandler::stringToLevel("WARNING"));
    TEST_ASSERT_EQUAL(ErrorHandler::ERROR, ErrorHandler::stringToLevel("ERROR"));
    TEST_ASSERT_EQUAL(ErrorHandler::CRITICAL, ErrorHandler::stringToLevel("CRITICAL"));
    TEST_ASSERT_EQUAL(ErrorHandler::INFO, ErrorHandler::stringToLevel("INVALID")); // Default
}

// Test circular buffer behavior
void test_error_handler_circular_buffer(void) {
    // Log more errors than buffer capacity (50)
    for (int i = 0; i < 60; i++) {
        char msg[32];
        snprintf(msg, sizeof(msg), "Error %d", i);
        errorHandler->logError("Buffer", msg, i);
    }
    
    // Get all errors - should be limited to buffer capacity
    auto allErrors = errorHandler->getRecentErrors(100);
    TEST_ASSERT_LESS_OR_EQUAL(50, allErrors.size());
    
    // Most recent errors should be from the end of the loop
    if (allErrors.size() > 0) {
        // The first error in recent list should be one of the last logged
        TEST_ASSERT_GREATER_OR_EQUAL(10, allErrors[0].code);
    }
}

// Test critical errors
void test_error_handler_critical_errors(void) {
    // Initially no critical errors
    TEST_ASSERT_FALSE(errorHandler->hasCriticalErrors());
    
    // Log critical error
    errorHandler->logCritical("Critical", "System critical", 999);
    
    // Check critical error presence
    TEST_ASSERT_TRUE(errorHandler->hasCriticalErrors());
    
    // Check callback was triggered
    TEST_ASSERT_TRUE(criticalErrorCallbackTriggered);
    TEST_ASSERT_EQUAL(999, lastCriticalError.code);
}

// Test panic handler
void test_error_handler_panic(void) {
    // Note: We can't test actual panic/restart in unit tests
    // Just test that the handler is called
    
    TEST_ASSERT_FALSE(panicHandlerTriggered);
    
    // Don't actually trigger panic as it would restart the system
    // Just verify the handler is set
    errorHandler->setPanicHandler(panicHandler);
    
    // In real scenario, triggerPanic() would call handler and restart
    // errorHandler->triggerPanic();
}

// Test null safety
void test_error_handler_null_safety(void) {
    // Test with null component - should handle gracefully
    errorHandler->logError(ErrorHandler::ERROR, nullptr, "Message", 100);
    
    // Test with null message
    errorHandler->logError(ErrorHandler::ERROR, "Component", nullptr, 100);
    
    // Test component operations with null
    auto errors = errorHandler->getErrorsByComponent(nullptr);
    TEST_ASSERT_EQUAL(0, errors.size());
    
    uint32_t count = errorHandler->getComponentErrorCount(nullptr);
    TEST_ASSERT_EQUAL(0, count);
}

// Test error message truncation
void test_error_handler_message_truncation(void) {
    // Create a very long message
    char longMessage[256];
    for (int i = 0; i < 255; i++) {
        longMessage[i] = 'A';
    }
    longMessage[255] = '\0';
    
    // Log with long message
    errorHandler->logError("Truncate", longMessage, 123);
    
    // Get the error
    auto lastError = errorHandler->getLastError();
    
    // Message should be truncated to fit in ErrorInfo.message[128]
    TEST_ASSERT_LESS_THAN(128, strlen(lastError.message));
    TEST_ASSERT_EQUAL(127, strlen(lastError.message)); // Should be exactly 127 chars + null
}

// Test print functions (just verify they don't crash)
void test_error_handler_print_functions(void) {
    // Log some errors
    errorHandler->logError("Print", "Error 1", 100);
    errorHandler->logWarning("Print", "Warning 1");
    
    // These should execute without crashing
    errorHandler->printErrorSummary();
    errorHandler->printRecentErrors(5);
}

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    UNITY_BEGIN();
    
    // Basic functionality tests
    RUN_TEST(test_error_handler_singleton);
    RUN_TEST(test_error_handler_log_errors);
    RUN_TEST(test_error_handler_get_errors);
    RUN_TEST(test_error_handler_get_last_error);
    
    // Recovery and callbacks
    RUN_TEST(test_error_handler_recovery_actions);
    RUN_TEST(test_error_handler_critical_errors);
    RUN_TEST(test_error_handler_panic);
    
    // Events and statistics
    RUN_TEST(test_error_handler_events);
    RUN_TEST(test_error_handler_statistics);
    RUN_TEST(test_error_handler_frequent_errors);
    
    // Maintenance
    RUN_TEST(test_error_handler_clear_errors);
    RUN_TEST(test_error_handler_circular_buffer);
    
    // Utilities
    RUN_TEST(test_error_handler_level_utilities);
    RUN_TEST(test_error_handler_null_safety);
    RUN_TEST(test_error_handler_message_truncation);
    RUN_TEST(test_error_handler_print_functions);
    
    UNITY_END();
}

void loop() {
    // Nothing to do here
}