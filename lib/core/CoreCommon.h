#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <functional>
#include <vector>
#include <map>

namespace Core {

enum class EventType {
    SYSTEM_BOOT,
    SYSTEM_SHUTDOWN,
    CONFIG_CHANGED,
    CONFIG_SAVED,
    CONFIG_LOADED,
    WIFI_CONNECTED,
    WIFI_DISCONNECTED,
    COMMUNICATION_CONNECTED,
    COMMUNICATION_DISCONNECTED,
    RTCM_DATA_RECEIVED,
    ERROR_OCCURRED,
    CUSTOM
};

enum class LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
};

enum class StorageType {
    SPIFFS,
    SD_CARD,
    EEPROM
};

struct Event {
    EventType type;
    String source;
    DynamicJsonDocument data;
    uint32_t timestamp;
    
    Event(size_t capacity = 256) : data(capacity), timestamp(millis()) {}
};

struct ConfigField {
    String key;
    JsonVariant value;
    bool required;
    String description;
};

struct ValidationError {
    String field;
    String message;
    String code;
};

using EventCallback = std::function<void(const Event&)>;
using ValidationCallback = std::function<bool(const String&, const JsonVariant&, ValidationError&)>;

static const size_t DEFAULT_JSON_CAPACITY = 2048;
static const size_t MAX_EVENT_QUEUE_SIZE = 32;
static const uint32_t EVENT_PROCESS_INTERVAL = 100; // ms
static const size_t MAX_CONFIG_FIELDS = 64;

// JSON Patch operations
enum class PatchOperation {
    ADD,
    REMOVE,
    REPLACE,
    MOVE,
    COPY,
    TEST
};

struct PatchOp {
    PatchOperation op;
    String path;
    JsonVariant value;
    String from; // for move and copy operations
};

const char* getEventTypeString(EventType type);
const char* getLogLevelString(LogLevel level);
const char* getStorageTypeString(StorageType type);
const char* getPatchOperationString(PatchOperation op);
EventType stringToEventType(const String& typeStr);
LogLevel stringToLogLevel(const String& levelStr);
PatchOperation stringToPatchOperation(const String& opStr);

bool isValidJsonPath(const String& path);
String sanitizeConfigKey(const String& key);

}