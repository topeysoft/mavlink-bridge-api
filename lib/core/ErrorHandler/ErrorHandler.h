#pragma once

#include <Arduino.h>
#include <vector>
#include <map>
#include <functional>
#include "../CoreCommon.h"

namespace ErrorHandlerInternal {

template<typename T, size_t Capacity>
class CircularBuffer {
private:
    T buffer[Capacity];
    size_t head;
    size_t tail;
    bool full;

public:
    CircularBuffer() : head(0), tail(0), full(false) {}

    void push(const T& item) {
        buffer[head] = item;
        
        if (full) {
            tail = (tail + 1) % Capacity;
        }
        
        head = (head + 1) % Capacity;
        full = (head == tail);
    }

    bool pop(T& item) {
        if (empty()) {
            return false;
        }
        
        item = buffer[tail];
        full = false;
        tail = (tail + 1) % Capacity;
        return true;
    }

    T& front() {
        return buffer[tail];
    }

    const T& front() const {
        return buffer[tail];
    }

    bool empty() const {
        return (!full && (head == tail));
    }

    bool isFull() const {
        return full;
    }

    size_t size() const {
        if (full) {
            return Capacity;
        }
        
        if (head >= tail) {
            return head - tail;
        }
        
        return Capacity + head - tail;
    }

    size_t capacity() const {
        return Capacity;
    }

    std::vector<T> toVector() const {
        std::vector<T> result;
        if (empty()) {
            return result;
        }
        
        size_t current = tail;
        do {
            result.push_back(buffer[current]);
            current = (current + 1) % Capacity;
        } while (current != head);
        
        return result;
    }
};

} // namespace ErrorHandlerInternal

class ErrorHandler {
public:
    enum ErrorLevel {
        INFO = 0,
        WARNING = 1,
        ERROR = 2,
        CRITICAL = 3
    };

    struct ErrorInfo {
        ErrorLevel level;
        const char* component;
        char message[128];
        uint32_t code;
        uint32_t timestamp;
        uint32_t count;  // Occurrence count
    };

    // Callback types
    using RecoveryAction = std::function<void()>;
    using CriticalErrorCallback = std::function<void(const ErrorInfo&)>;
    using PanicHandler = std::function<void()>;

private:
    static ErrorHandler* instance;
    ErrorHandlerInternal::CircularBuffer<ErrorInfo, 50> errorLog;
    std::map<uint32_t, uint32_t> errorCounts;
    std::map<uint32_t, RecoveryAction> recoveryActions;
    
    CriticalErrorCallback criticalCallback;
    PanicHandler panicHandler;
    
    // Statistics
    uint32_t totalErrors;
    uint32_t errorsByLevel[4];  // Count for each level
    uint32_t lastErrorTime;

public:
    static ErrorHandler* getInstance();

    void begin();

    // Error logging
    void logError(ErrorLevel level, const char* component,
                  const char* message, uint32_t code = 0);
    
    void logInfo(const char* component, const char* message);
    void logWarning(const char* component, const char* message);
    void logError(const char* component, const char* message, uint32_t code = 0);
    void logCritical(const char* component, const char* message, uint32_t code = 0);

    // Error retrieval
    std::vector<ErrorInfo> getRecentErrors(size_t count = 10) const;
    std::vector<ErrorInfo> getErrorsByComponent(const char* component) const;
    std::vector<ErrorInfo> getErrorsByLevel(ErrorLevel level) const;
    ErrorInfo getLastError() const;

    // Recovery actions
    void registerRecoveryAction(uint32_t errorCode, RecoveryAction action);
    void unregisterRecoveryAction(uint32_t errorCode);
    bool executeRecoveryAction(uint32_t errorCode);

    // System-wide error handling
    void onCriticalError(CriticalErrorCallback callback);
    void setPanicHandler(PanicHandler handler);
    void triggerPanic();

    // Statistics and analysis
    uint32_t getTotalErrorCount() const;
    uint32_t getErrorCount(ErrorLevel level) const;
    uint32_t getErrorCount(uint32_t errorCode) const;
    uint32_t getComponentErrorCount(const char* component) const;
    uint32_t getTimeSinceLastError() const;
    
    // Error analysis
    bool hasRecentErrors(uint32_t timeWindowMs = 60000) const;
    bool hasCriticalErrors() const;
    std::vector<uint32_t> getFrequentErrors(size_t topCount = 5) const;
    
    // Maintenance
    void clearErrors();
    void clearErrorsOlderThan(uint32_t ageMs);
    void printErrorSummary() const;
    void printRecentErrors(size_t count = 10) const;

    // Error level utilities
    static const char* levelToString(ErrorLevel level);
    static ErrorLevel stringToLevel(const char* levelStr);

private:
    ErrorHandler();
    ~ErrorHandler() = default;

    void handleCriticalError(const ErrorInfo& error);
    void updateStatistics(ErrorLevel level, uint32_t code);
    bool shouldTriggerRecovery(uint32_t code) const;
};

// Convenience macros
#define LOG_INFO(component, message) \
    ErrorHandler::getInstance()->logInfo(component, message)

#define LOG_WARNING(component, message) \
    ErrorHandler::getInstance()->logWarning(component, message)

#define LOG_ERROR(component, message, code) \
    ErrorHandler::getInstance()->logError(component, message, code)

#define LOG_CRITICAL(component, message, code) \
    ErrorHandler::getInstance()->logCritical(component, message, code)

// Format macros
#define LOG_ERROR_FMT(component, code, fmt, ...) \
    do { \
        char msg[128]; \
        snprintf(msg, sizeof(msg), fmt, ##__VA_ARGS__); \
        ErrorHandler::getInstance()->logError(component, msg, code); \
    } while(0)

#define LOG_WARNING_FMT(component, fmt, ...) \
    do { \
        char msg[128]; \
        snprintf(msg, sizeof(msg), fmt, ##__VA_ARGS__); \
        ErrorHandler::getInstance()->logWarning(component, msg); \
    } while(0)
