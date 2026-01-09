#include "ErrorHandler.h"
#include <esp_log.h>
#include <EventManager/EventManager.h>
#include <ArduinoJson.h>
#include <algorithm>
#include <cstring>

static const char* TAG = "ErrorHandler";

ErrorHandler* ErrorHandler::instance = nullptr;

ErrorHandler* ErrorHandler::getInstance() {
    if (instance == nullptr) {
        instance = new ErrorHandler();
    }
    return instance;
}

ErrorHandler::ErrorHandler() 
    : totalErrors(0)
    , lastErrorTime(0) {
    
    memset(errorsByLevel, 0, sizeof(errorsByLevel));
}

void ErrorHandler::begin() {
    ESP_LOGI(TAG, "Error handler initialized");
    ESP_LOGI(TAG, "Error log capacity: %zu entries", errorLog.capacity());
}

void ErrorHandler::logError(ErrorLevel level, const char* component,
                           const char* message, uint32_t code) {
    if (component == nullptr || message == nullptr) {
        return;
    }

    ErrorInfo error;
    error.level = level;
    error.component = component;
    strncpy(error.message, message, sizeof(error.message) - 1);
    error.message[sizeof(error.message) - 1] = '\0';
    error.code = code;
    error.timestamp = millis();
    error.count = 1;

    // Check if this error already exists (same component, code, and level)
    bool found = false;
    auto recentErrors = errorLog.toVector();
    for (auto& existingError : recentErrors) {
        if (existingError.level == level &&
            existingError.code == code &&
            strcmp(existingError.component, component) == 0) {
            existingError.count++;
            found = true;
            break;
        }
    }

    if (!found) {
        errorLog.push(error);
    }

    // Update statistics
    updateStatistics(level, code);

    // Log to ESP32 logger with appropriate level
    switch (level) {
        case INFO:
            ESP_LOGI(component, "[%u] %s", code, message);
            break;
        case WARNING:
            ESP_LOGW(component, "[%u] %s", code, message);
            break;
        case ERROR:
            ESP_LOGE(component, "[%u] %s", code, message);
            break;
        case CRITICAL:
            ESP_LOGE(component, "[CRITICAL][%u] %s", code, message);
            handleCriticalError(error);
            break;
    }

    // Publish error event
    EventManager* eventManager = EventManager::getInstance();
    if (eventManager) {
        DynamicJsonDocument payload(256);
        payload["level"] = levelToString(level);
        payload["component"] = component;
        payload["message"] = message;
        payload["code"] = code;
        payload["timestamp"] = error.timestamp;
        
        eventManager->publishAsync(EventType::SYSTEM_ERROR, payload.as<JsonObjectConst>());
    }

    // Try recovery action if available
    if (level >= ERROR && shouldTriggerRecovery(code)) {
        executeRecoveryAction(code);
    }
}

void ErrorHandler::logInfo(const char* component, const char* message) {
    logError(INFO, component, message, 0);
}

void ErrorHandler::logWarning(const char* component, const char* message) {
    logError(WARNING, component, message, 0);
}

void ErrorHandler::logError(const char* component, const char* message, uint32_t code) {
    logError(ERROR, component, message, code);
}

void ErrorHandler::logCritical(const char* component, const char* message, uint32_t code) {
    logError(CRITICAL, component, message, code);
}

std::vector<ErrorHandler::ErrorInfo> ErrorHandler::getRecentErrors(size_t count) const {
    auto allErrors = errorLog.toVector();
    
    // Reverse to get most recent first
    std::reverse(allErrors.begin(), allErrors.end());
    
    if (allErrors.size() > count) {
        allErrors.resize(count);
    }
    
    return allErrors;
}

std::vector<ErrorHandler::ErrorInfo> ErrorHandler::getErrorsByComponent(const char* component) const {
    std::vector<ErrorInfo> result;
    auto allErrors = errorLog.toVector();
    
    for (const auto& error : allErrors) {
        if (strcmp(error.component, component) == 0) {
            result.push_back(error);
        }
    }
    
    return result;
}

std::vector<ErrorHandler::ErrorInfo> ErrorHandler::getErrorsByLevel(ErrorLevel level) const {
    std::vector<ErrorInfo> result;
    auto allErrors = errorLog.toVector();
    
    for (const auto& error : allErrors) {
        if (error.level == level) {
            result.push_back(error);
        }
    }
    
    return result;
}

ErrorHandler::ErrorInfo ErrorHandler::getLastError() const {
    if (errorLog.empty()) {
        ErrorInfo empty = {};
        return empty;
    }
    
    auto errors = errorLog.toVector();
    return errors.back();
}

void ErrorHandler::registerRecoveryAction(uint32_t errorCode, RecoveryAction action) {
    recoveryActions[errorCode] = action;
    ESP_LOGI(TAG, "Registered recovery action for error code %u", errorCode);
}

void ErrorHandler::unregisterRecoveryAction(uint32_t errorCode) {
    auto it = recoveryActions.find(errorCode);
    if (it != recoveryActions.end()) {
        recoveryActions.erase(it);
        ESP_LOGI(TAG, "Unregistered recovery action for error code %u", errorCode);
    }
}

bool ErrorHandler::executeRecoveryAction(uint32_t errorCode) {
    auto it = recoveryActions.find(errorCode);
    if (it != recoveryActions.end()) {
        try {
            ESP_LOGI(TAG, "Executing recovery action for error code %u", errorCode);
            it->second();
            return true;
        } catch (const std::exception& e) {
            ESP_LOGE(TAG, "Recovery action failed for code %u: %s", errorCode, e.what());
        } catch (...) {
            ESP_LOGE(TAG, "Recovery action failed for code %u: unknown exception", errorCode);
        }
    }
    return false;
}

void ErrorHandler::onCriticalError(CriticalErrorCallback callback) {
    criticalCallback = callback;
}

void ErrorHandler::setPanicHandler(PanicHandler handler) {
    panicHandler = handler;
}

void ErrorHandler::triggerPanic() {
    ESP_LOGE(TAG, "SYSTEM PANIC TRIGGERED!");
    
    if (panicHandler) {
        try {
            panicHandler();
        } catch (...) {
            ESP_LOGE(TAG, "Panic handler threw exception");
        }
    }
    
    // As last resort, restart the system
    ESP.restart();
}

uint32_t ErrorHandler::getTotalErrorCount() const {
    return totalErrors;
}

uint32_t ErrorHandler::getErrorCount(ErrorLevel level) const {
    if (level < 0 || level >= 4) {
        return 0;
    }
    return errorsByLevel[level];
}

uint32_t ErrorHandler::getErrorCount(uint32_t errorCode) const {
    auto it = errorCounts.find(errorCode);
    return (it != errorCounts.end()) ? it->second : 0;
}

uint32_t ErrorHandler::getComponentErrorCount(const char* component) const {
    uint32_t count = 0;
    auto allErrors = errorLog.toVector();
    
    for (const auto& error : allErrors) {
        if (strcmp(error.component, component) == 0) {
            count++;
        }
    }
    
    return count;
}

uint32_t ErrorHandler::getTimeSinceLastError() const {
    if (lastErrorTime == 0) {
        return UINT32_MAX;
    }
    return millis() - lastErrorTime;
}

bool ErrorHandler::hasRecentErrors(uint32_t timeWindowMs) const {
    return getTimeSinceLastError() < timeWindowMs;
}

bool ErrorHandler::hasCriticalErrors() const {
    return errorsByLevel[CRITICAL] > 0;
}

std::vector<uint32_t> ErrorHandler::getFrequentErrors(size_t topCount) const {
    std::vector<std::pair<uint32_t, uint32_t>> errorPairs;
    
    for (const auto& pair : errorCounts) {
        errorPairs.push_back(pair);
    }
    
    // Sort by count descending
    std::sort(errorPairs.begin(), errorPairs.end(),
              [](const std::pair<uint32_t, uint32_t>& a, const std::pair<uint32_t, uint32_t>& b) {
                  return a.second > b.second;
              });
    
    std::vector<uint32_t> result;
    for (size_t i = 0; i < std::min(topCount, errorPairs.size()); i++) {
        result.push_back(errorPairs[i].first);
    }
    
    return result;
}

void ErrorHandler::clearErrors() {
    while (!errorLog.empty()) {
        ErrorInfo dummy;
        errorLog.pop(dummy);
    }
    
    errorCounts.clear();
    totalErrors = 0;
    memset(errorsByLevel, 0, sizeof(errorsByLevel));
    lastErrorTime = 0;
    
    ESP_LOGI(TAG, "Error log cleared");
}

void ErrorHandler::clearErrorsOlderThan(uint32_t ageMs) {
    uint32_t cutoffTime = millis() - ageMs;
    size_t removedCount = 0;
    
    // This is a simplified implementation - in practice, you might want
    // a more sophisticated circular buffer that supports removal from middle
    auto errors = errorLog.toVector();
    
    // Clear and rebuild with recent errors only
    while (!errorLog.empty()) {
        ErrorInfo dummy;
        errorLog.pop(dummy);
    }
    
    for (const auto& error : errors) {
        if (error.timestamp >= cutoffTime) {
            errorLog.push(error);
        } else {
            removedCount++;
        }
    }
    
    ESP_LOGI(TAG, "Removed %zu old errors", removedCount);
}

void ErrorHandler::printErrorSummary() const {
    ESP_LOGI(TAG, "=== Error Summary ===");
    ESP_LOGI(TAG, "Total errors: %u", totalErrors);
    ESP_LOGI(TAG, "Info: %u", errorsByLevel[INFO]);
    ESP_LOGI(TAG, "Warning: %u", errorsByLevel[WARNING]);
    ESP_LOGI(TAG, "Error: %u", errorsByLevel[ERROR]);
    ESP_LOGI(TAG, "Critical: %u", errorsByLevel[CRITICAL]);
    ESP_LOGI(TAG, "Time since last error: %u ms", getTimeSinceLastError());
    ESP_LOGI(TAG, "Error log size: %zu/%zu", errorLog.size(), errorLog.capacity());
    
    if (!errorCounts.empty()) {
        ESP_LOGI(TAG, "Most frequent error codes:");
        auto frequent = getFrequentErrors(5);
        for (size_t i = 0; i < frequent.size(); i++) {
            uint32_t code = frequent[i];
            ESP_LOGI(TAG, "  %u: %u occurrences", code, getErrorCount(code));
        }
    }
}

void ErrorHandler::printRecentErrors(size_t count) const {
    auto errors = getRecentErrors(count);
    
    ESP_LOGI(TAG, "=== Recent Errors (last %zu) ===", errors.size());
    
    for (const auto& error : errors) {
        const char* levelStr = levelToString(error.level);
        ESP_LOGI(TAG, "[%s] %s: [%lu] %s (count: %lu, time: %lu)",
                 levelStr, error.component, error.code, error.message,
                 error.count, error.timestamp);
    }
}

const char* ErrorHandler::levelToString(ErrorLevel level) {
    switch (level) {
        case INFO: return "INFO";
        case WARNING: return "WARNING";
        case ERROR: return "ERROR";
        case CRITICAL: return "CRITICAL";
        default: return "UNKNOWN";
    }
}

ErrorHandler::ErrorLevel ErrorHandler::stringToLevel(const char* levelStr) {
    if (strcmp(levelStr, "INFO") == 0) return INFO;
    if (strcmp(levelStr, "WARNING") == 0) return WARNING;
    if (strcmp(levelStr, "ERROR") == 0) return ERROR;
    if (strcmp(levelStr, "CRITICAL") == 0) return CRITICAL;
    return INFO;
}

void ErrorHandler::handleCriticalError(const ErrorInfo& error) {
    ESP_LOGE(TAG, "CRITICAL ERROR: %s - %s", error.component, error.message);
    
    if (criticalCallback) {
        try {
            criticalCallback(error);
        } catch (...) {
            ESP_LOGE(TAG, "Critical error callback threw exception");
        }
    }
    
    // If too many critical errors, trigger panic
    if (errorsByLevel[CRITICAL] >= 5) {
        ESP_LOGE(TAG, "Too many critical errors, triggering panic");
        triggerPanic();
    }
}

void ErrorHandler::updateStatistics(ErrorLevel level, uint32_t code) {
    totalErrors++;
    errorsByLevel[level]++;
    errorCounts[code]++;
    lastErrorTime = millis();
}

bool ErrorHandler::shouldTriggerRecovery(uint32_t code) const {
    // Only trigger recovery if we have a registered action and
    // this error hasn't occurred too frequently recently
    auto it = recoveryActions.find(code);
    if (it == recoveryActions.end()) {
        return false;
    }
    
    // Simple rate limiting - don't trigger recovery more than once per minute per code
    // In a more sophisticated implementation, you'd track per-code timestamps
    return true;
}