#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

enum class JsonPatchOperation {
    ADD,
    REMOVE,
    REPLACE,
    UNKNOWN
};

enum class JsonPatchResult {
    SUCCESS,
    INVALID_OPERATION,
    INVALID_PATH,
    PATH_NOT_FOUND,
    INVALID_VALUE,
    MEMORY_ERROR,
    TOO_MANY_OPERATIONS,
    ROLLBACK_FAILED
};

struct PatchOperation {
    JsonPatchOperation op;
    String path;
    JsonVariant value;
    
    PatchOperation() : op(JsonPatchOperation::UNKNOWN) {}
    PatchOperation(JsonPatchOperation operation, const String& jsonPath) 
        : op(operation), path(jsonPath) {}
    PatchOperation(JsonPatchOperation operation, const String& jsonPath, JsonVariant val) 
        : op(operation), path(jsonPath), value(val) {}
};

class JsonPatch {
private:
    static const uint8_t MAX_OPERATIONS = 10;
    static const uint8_t MAX_PATH_DEPTH = 8;
    static const size_t BACKUP_BUFFER_SIZE = 2048;
    
    struct PathComponent {
        String key;
        int index;  // -1 if not an array index
        
        PathComponent() : index(-1) {}
        PathComponent(const String& k) : key(k), index(-1) {}
        PathComponent(int i) : index(i) {}
    };
    
    static String lastError;
    static DynamicJsonDocument backupDoc;
    
    static JsonPatchOperation stringToOperation(const String& opStr);
    static bool parsePath(const String& path, PathComponent* components, uint8_t& componentCount);
    static JsonVariant navigateToParent(JsonDocument& doc, const PathComponent* components, uint8_t componentCount);
    static JsonVariant navigateToTarget(JsonDocument& doc, const PathComponent* components, uint8_t componentCount);
    static bool isValidPath(const String& path);
    static bool isValidValue(const JsonVariant& value);
    static JsonPatchResult applyAddOperation(JsonDocument& doc, const String& path, const JsonVariant& value);
    static JsonPatchResult applyRemoveOperation(JsonDocument& doc, const String& path);
    static JsonPatchResult applyReplaceOperation(JsonDocument& doc, const String& path, const JsonVariant& value);
    static void setLastError(const String& error);
    static bool createBackup(const JsonDocument& doc);
    static bool restoreFromBackup(JsonDocument& doc);
    
public:
    static JsonPatchResult apply(JsonDocument& document, const JsonArray& operations);
    static JsonPatchResult apply(JsonDocument& document, const PatchOperation* operations, uint8_t operationCount);
    static JsonPatchResult applySingle(JsonDocument& document, const PatchOperation& operation);
    
    static bool validateOperations(const JsonArray& operations);
    static bool validateOperations(const PatchOperation* operations, uint8_t operationCount);
    static bool validateOperation(const PatchOperation& operation);
    
    static PatchOperation createAddOperation(const String& path, const JsonVariant& value);
    static PatchOperation createRemoveOperation(const String& path);
    static PatchOperation createReplaceOperation(const String& path, const JsonVariant& value);
    
    static String getLastError() { return lastError; }
    static void clearLastError() { lastError = ""; }
    
    static String resultToString(JsonPatchResult result);
    static String operationToString(JsonPatchOperation op);
};