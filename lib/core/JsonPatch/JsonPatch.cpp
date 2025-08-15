#include "JsonPatch.h"

String JsonPatch::lastError = "";
DynamicJsonDocument JsonPatch::backupDoc(BACKUP_BUFFER_SIZE);

JsonPatchResult JsonPatch::apply(JsonDocument& document, const JsonArray& operations) {
    if (operations.size() == 0) {
        return JsonPatchResult::SUCCESS;
    }
    
    if (operations.size() > MAX_OPERATIONS) {
        setLastError("Too many operations in patch");
        return JsonPatchResult::TOO_MANY_OPERATIONS;
    }
    
    // Create backup before applying operations
    if (!createBackup(document)) {
        setLastError("Failed to create backup before applying patch");
        return JsonPatchResult::MEMORY_ERROR;
    }
    
    // Convert JsonArray to PatchOperation array
    PatchOperation ops[MAX_OPERATIONS];
    uint8_t opCount = 0;
    
    for (JsonVariant opVariant : operations) {
        if (!opVariant.is<JsonObject>()) {
            setLastError("Invalid operation format");
            restoreFromBackup(document);
            return JsonPatchResult::INVALID_OPERATION;
        }
        
        JsonObject opObj = opVariant.as<JsonObject>();
        
        if (!opObj.containsKey("op") || !opObj.containsKey("path")) {
            setLastError("Missing required fields in operation");
            restoreFromBackup(document);
            return JsonPatchResult::INVALID_OPERATION;
        }
        
        String opStr = opObj["op"];
        String path = opObj["path"];
        JsonPatchOperation operation = stringToOperation(opStr);
        
        if (operation == JsonPatchOperation::UNKNOWN) {
            setLastError("Unknown operation: " + opStr);
            restoreFromBackup(document);
            return JsonPatchResult::INVALID_OPERATION;
        }
        
        ops[opCount].op = operation;
        ops[opCount].path = path;
        
        if (operation == JsonPatchOperation::ADD || operation == JsonPatchOperation::REPLACE) {
            if (!opObj.containsKey("value")) {
                setLastError("Missing value for operation: " + opStr);
                restoreFromBackup(document);
                return JsonPatchResult::INVALID_OPERATION;
            }
            ops[opCount].value = opObj["value"];
        }
        
        opCount++;
    }
    
    return apply(document, ops, opCount);
}

JsonPatchResult JsonPatch::apply(JsonDocument& document, const PatchOperation* operations, uint8_t operationCount) {
    if (operations == nullptr || operationCount == 0) {
        return JsonPatchResult::SUCCESS;
    }
    
    if (operationCount > MAX_OPERATIONS) {
        setLastError("Too many operations");
        return JsonPatchResult::TOO_MANY_OPERATIONS;
    }
    
    // Validate all operations first
    if (!validateOperations(operations, operationCount)) {
        return JsonPatchResult::INVALID_OPERATION;
    }
    
    // Apply operations sequentially
    for (uint8_t i = 0; i < operationCount; i++) {
        JsonPatchResult result = applySingle(document, operations[i]);
        if (result != JsonPatchResult::SUCCESS) {
            // Restore from backup on failure
            if (!restoreFromBackup(document)) {
                setLastError("Rollback failed after operation failure");
                return JsonPatchResult::ROLLBACK_FAILED;
            }
            return result;
        }
    }
    
    return JsonPatchResult::SUCCESS;
}

JsonPatchResult JsonPatch::applySingle(JsonDocument& document, const PatchOperation& operation) {
    clearLastError();
    
    if (!validateOperation(operation)) {
        return JsonPatchResult::INVALID_OPERATION;
    }
    
    switch (operation.op) {
        case JsonPatchOperation::ADD:
            return applyAddOperation(document, operation.path, operation.value);
            
        case JsonPatchOperation::REMOVE:
            return applyRemoveOperation(document, operation.path);
            
        case JsonPatchOperation::REPLACE:
            return applyReplaceOperation(document, operation.path, operation.value);
            
        default:
            setLastError("Unknown operation type");
            return JsonPatchResult::INVALID_OPERATION;
    }
}

JsonPatchResult JsonPatch::applyAddOperation(JsonDocument& doc, const String& path, const JsonVariant& value) {
    PathComponent components[MAX_PATH_DEPTH];
    uint8_t componentCount = 0;
    
    if (!parsePath(path, components, componentCount)) {
        setLastError("Invalid path format: " + path);
        return JsonPatchResult::INVALID_PATH;
    }
    
    if (componentCount == 0) {
        setLastError("Cannot add to root path");
        return JsonPatchResult::INVALID_PATH;
    }
    
    // Navigate to parent
    JsonVariant parent = navigateToParent(doc, components, componentCount);
    if (parent.isNull()) {
        setLastError("Parent path not found: " + path);
        return JsonPatchResult::PATH_NOT_FOUND;
    }
    
    const PathComponent& lastComponent = components[componentCount - 1];
    
    if (parent.is<JsonObject>()) {
        JsonObject parentObj = parent.as<JsonObject>();
        parentObj[lastComponent.key] = value;
    } else if (parent.is<JsonArray>()) {
        JsonArray parentArray = parent.as<JsonArray>();
        if (lastComponent.index < 0 || lastComponent.index > (int)parentArray.size()) {
            setLastError("Invalid array index for add operation");
            return JsonPatchResult::INVALID_PATH;
        }
        
        // For arrays, add operation can append or insert
        if (lastComponent.index == (int)parentArray.size()) {
            parentArray.add(value);
        } else {
            setLastError("Array insertion at specific index not supported in add operation");
            return JsonPatchResult::INVALID_OPERATION;
        }
    } else {
        setLastError("Parent is not an object or array");
        return JsonPatchResult::INVALID_PATH;
    }
    
    return JsonPatchResult::SUCCESS;
}

JsonPatchResult JsonPatch::applyRemoveOperation(JsonDocument& doc, const String& path) {
    PathComponent components[MAX_PATH_DEPTH];
    uint8_t componentCount = 0;
    
    if (!parsePath(path, components, componentCount)) {
        setLastError("Invalid path format: " + path);
        return JsonPatchResult::INVALID_PATH;
    }
    
    if (componentCount == 0) {
        setLastError("Cannot remove root path");
        return JsonPatchResult::INVALID_PATH;
    }
    
    JsonVariant parent = navigateToParent(doc, components, componentCount);
    if (parent.isNull()) {
        setLastError("Parent path not found: " + path);
        return JsonPatchResult::PATH_NOT_FOUND;
    }
    
    const PathComponent& lastComponent = components[componentCount - 1];
    
    if (parent.is<JsonObject>()) {
        JsonObject parentObj = parent.as<JsonObject>();
        if (!parentObj.containsKey(lastComponent.key)) {
            setLastError("Key not found for remove operation: " + lastComponent.key);
            return JsonPatchResult::PATH_NOT_FOUND;
        }
        parentObj.remove(lastComponent.key);
    } else if (parent.is<JsonArray>()) {
        JsonArray parentArray = parent.as<JsonArray>();
        if (lastComponent.index < 0 || lastComponent.index >= (int)parentArray.size()) {
            setLastError("Array index out of bounds for remove operation");
            return JsonPatchResult::PATH_NOT_FOUND;
        }
        parentArray.remove(lastComponent.index);
    } else {
        setLastError("Parent is not an object or array");
        return JsonPatchResult::INVALID_PATH;
    }
    
    return JsonPatchResult::SUCCESS;
}

JsonPatchResult JsonPatch::applyReplaceOperation(JsonDocument& doc, const String& path, const JsonVariant& value) {
    PathComponent components[MAX_PATH_DEPTH];
    uint8_t componentCount = 0;
    
    if (!parsePath(path, components, componentCount)) {
        setLastError("Invalid path format: " + path);
        return JsonPatchResult::INVALID_PATH;
    }
    
    if (componentCount == 0) {
        // Replace entire document
        doc.clear();
        doc.set(value);
        return JsonPatchResult::SUCCESS;
    }
    
    JsonVariant parent = navigateToParent(doc, components, componentCount);
    if (parent.isNull()) {
        setLastError("Parent path not found: " + path);
        return JsonPatchResult::PATH_NOT_FOUND;
    }
    
    const PathComponent& lastComponent = components[componentCount - 1];
    
    if (parent.is<JsonObject>()) {
        JsonObject parentObj = parent.as<JsonObject>();
        if (!parentObj.containsKey(lastComponent.key)) {
            setLastError("Key not found for replace operation: " + lastComponent.key);
            return JsonPatchResult::PATH_NOT_FOUND;
        }
        parentObj[lastComponent.key] = value;
    } else if (parent.is<JsonArray>()) {
        JsonArray parentArray = parent.as<JsonArray>();
        if (lastComponent.index < 0 || lastComponent.index >= (int)parentArray.size()) {
            setLastError("Array index out of bounds for replace operation");
            return JsonPatchResult::PATH_NOT_FOUND;
        }
        parentArray[lastComponent.index] = value;
    } else {
        setLastError("Parent is not an object or array");
        return JsonPatchResult::INVALID_PATH;
    }
    
    return JsonPatchResult::SUCCESS;
}

bool JsonPatch::validateOperations(const JsonArray& operations) {
    if (operations.size() > MAX_OPERATIONS) {
        setLastError("Too many operations");
        return false;
    }
    
    for (JsonVariant opVariant : operations) {
        if (!opVariant.is<JsonObject>()) {
            setLastError("Invalid operation format");
            return false;
        }
        
        JsonObject opObj = opVariant.as<JsonObject>();
        
        if (!opObj.containsKey("op") || !opObj.containsKey("path")) {
            setLastError("Missing required fields in operation");
            return false;
        }
        
        String opStr = opObj["op"];
        JsonPatchOperation operation = stringToOperation(opStr);
        
        if (operation == JsonPatchOperation::UNKNOWN) {
            setLastError("Unknown operation: " + opStr);
            return false;
        }
        
        if (!isValidPath(opObj["path"])) {
            setLastError("Invalid path format");
            return false;
        }
        
        if ((operation == JsonPatchOperation::ADD || operation == JsonPatchOperation::REPLACE) && 
            !opObj.containsKey("value")) {
            setLastError("Missing value for operation: " + opStr);
            return false;
        }
    }
    
    return true;
}

bool JsonPatch::validateOperations(const PatchOperation* operations, uint8_t operationCount) {
    if (operationCount > MAX_OPERATIONS) {
        setLastError("Too many operations");
        return false;
    }
    
    for (uint8_t i = 0; i < operationCount; i++) {
        if (!validateOperation(operations[i])) {
            return false;
        }
    }
    
    return true;
}

bool JsonPatch::validateOperation(const PatchOperation& operation) {
    if (operation.op == JsonPatchOperation::UNKNOWN) {
        setLastError("Unknown operation type");
        return false;
    }
    
    if (!isValidPath(operation.path)) {
        setLastError("Invalid path format: " + operation.path);
        return false;
    }
    
    if ((operation.op == JsonPatchOperation::ADD || operation.op == JsonPatchOperation::REPLACE) && 
        !isValidValue(operation.value)) {
        setLastError("Invalid value for operation");
        return false;
    }
    
    return true;
}

JsonPatchOperation JsonPatch::stringToOperation(const String& opStr) {
    if (opStr.equalsIgnoreCase("add")) {
        return JsonPatchOperation::ADD;
    } else if (opStr.equalsIgnoreCase("remove")) {
        return JsonPatchOperation::REMOVE;
    } else if (opStr.equalsIgnoreCase("replace")) {
        return JsonPatchOperation::REPLACE;
    }
    return JsonPatchOperation::UNKNOWN;
}

String JsonPatch::operationToString(JsonPatchOperation op) {
    switch (op) {
        case JsonPatchOperation::ADD: return "add";
        case JsonPatchOperation::REMOVE: return "remove";
        case JsonPatchOperation::REPLACE: return "replace";
        default: return "unknown";
    }
}

bool JsonPatch::parsePath(const String& path, PathComponent* components, uint8_t& componentCount) {
    componentCount = 0;
    
    if (path.length() == 0 || path == "/") {
        return true; // Root path
    }
    
    if (!path.startsWith("/")) {
        return false; // Path must start with /
    }
    
    String remainingPath = path.substring(1); // Remove leading /
    
    while (remainingPath.length() > 0 && componentCount < MAX_PATH_DEPTH) {
        int nextSlash = remainingPath.indexOf('/');
        String component;
        
        if (nextSlash == -1) {
            component = remainingPath;
            remainingPath = "";
        } else {
            component = remainingPath.substring(0, nextSlash);
            remainingPath = remainingPath.substring(nextSlash + 1);
        }
        
        // Check if component is array index
        if (component.length() > 0 && isDigit(component.charAt(0))) {
            bool allDigits = true;
            for (unsigned int i = 0; i < component.length(); i++) {
                if (!isDigit(component.charAt(i))) {
                    allDigits = false;
                    break;
                }
            }
            
            if (allDigits) {
                components[componentCount].index = component.toInt();
                componentCount++;
                continue;
            }
        }
        
        // Regular object key
        components[componentCount].key = component;
        components[componentCount].index = -1;
        componentCount++;
    }
    
    return componentCount < MAX_PATH_DEPTH;
}

JsonVariant JsonPatch::navigateToParent(JsonDocument& doc, const PathComponent* components, uint8_t componentCount) {
    if (componentCount <= 1) {
        return doc.as<JsonVariant>();
    }
    
    JsonVariant current = doc.as<JsonVariant>();
    
    for (uint8_t i = 0; i < componentCount - 1; i++) {
        const PathComponent& component = components[i];
        
        if (component.index >= 0) {
            // Array access
            if (!current.is<JsonArray>()) {
                return JsonVariant();
            }
            
            JsonArray currentArray = current.as<JsonArray>();
            if (component.index >= (int)currentArray.size()) {
                return JsonVariant();
            }
            
            current = currentArray[component.index];
        } else {
            // Object access
            if (!current.is<JsonObject>()) {
                return JsonVariant();
            }
            
            JsonObject currentObj = current.as<JsonObject>();
            if (!currentObj.containsKey(component.key)) {
                return JsonVariant();
            }
            
            current = currentObj[component.key];
        }
    }
    
    return current;
}

JsonVariant JsonPatch::navigateToTarget(JsonDocument& doc, const PathComponent* components, uint8_t componentCount) {
    if (componentCount == 0) {
        return doc.as<JsonVariant>();
    }
    
    JsonVariant parent = navigateToParent(doc, components, componentCount);
    if (parent.isNull()) {
        return JsonVariant();
    }
    
    const PathComponent& lastComponent = components[componentCount - 1];
    
    if (lastComponent.index >= 0) {
        if (!parent.is<JsonArray>()) {
            return JsonVariant();
        }
        
        JsonArray parentArray = parent.as<JsonArray>();
        if (lastComponent.index >= (int)parentArray.size()) {
            return JsonVariant();
        }
        
        return parentArray[lastComponent.index];
    } else {
        if (!parent.is<JsonObject>()) {
            return JsonVariant();
        }
        
        JsonObject parentObj = parent.as<JsonObject>();
        if (!parentObj.containsKey(lastComponent.key)) {
            return JsonVariant();
        }
        
        return parentObj[lastComponent.key];
    }
}

bool JsonPatch::isValidPath(const String& path) {
    if (path.length() == 0) {
        return false;
    }
    
    if (path == "/") {
        return true; // Root path is valid
    }
    
    return path.startsWith("/");
}

bool JsonPatch::isValidValue(const JsonVariant& value) {
    // All JsonVariant values are considered valid
    return !value.isNull();
}

bool JsonPatch::createBackup(const JsonDocument& doc) {
    backupDoc.clear();
    return backupDoc.set(doc);
}

bool JsonPatch::restoreFromBackup(JsonDocument& doc) {
    doc.clear();
    return doc.set(backupDoc);
}

void JsonPatch::setLastError(const String& error) {
    lastError = error;
}

PatchOperation JsonPatch::createAddOperation(const String& path, const JsonVariant& value) {
    return PatchOperation(JsonPatchOperation::ADD, path, value);
}

PatchOperation JsonPatch::createRemoveOperation(const String& path) {
    return PatchOperation(JsonPatchOperation::REMOVE, path);
}

PatchOperation JsonPatch::createReplaceOperation(const String& path, const JsonVariant& value) {
    return PatchOperation(JsonPatchOperation::REPLACE, path, value);
}

String JsonPatch::resultToString(JsonPatchResult result) {
    switch (result) {
        case JsonPatchResult::SUCCESS: return "Success";
        case JsonPatchResult::INVALID_OPERATION: return "Invalid operation";
        case JsonPatchResult::INVALID_PATH: return "Invalid path";
        case JsonPatchResult::PATH_NOT_FOUND: return "Path not found";
        case JsonPatchResult::INVALID_VALUE: return "Invalid value";
        case JsonPatchResult::MEMORY_ERROR: return "Memory error";
        case JsonPatchResult::TOO_MANY_OPERATIONS: return "Too many operations";
        case JsonPatchResult::ROLLBACK_FAILED: return "Rollback failed";
        default: return "Unknown error";
    }
}