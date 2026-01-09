#include <unity.h>
#include <JsonPatch.h>
#include <ArduinoJson.h>

DynamicJsonDocument testDoc(1024);
const char* testJson = R"({
  "device": {
    "name": "ESP32-MAVLinkBridge",
    "mode": "usb_otg"
  },
  "connection": {
    "type": "wifi",
    "wifi": {
      "ssid": "TestNetwork",
      "autoConnect": true
    }
  },
  "rtcm": {
    "enabled": false,
    "source": {
      "type": "ntrip",
      "host": "rtcm.example.com",
      "port": 2101
    }
  }
})";

void setUp(void) {
    testDoc.clear();
    deserializeJson(testDoc, testJson);
    JsonPatch::clearLastError();
}

void tearDown(void) {
    // Nothing to clean up
}

void test_patch_replace_simple(void) {
    PatchOperation op = JsonPatch::createReplaceOperation("/device/name", "NewName");
    
    JsonPatchResult result = JsonPatch::applySingle(testDoc, op);
    TEST_ASSERT_EQUAL(JsonPatchResult::SUCCESS, result);
    
    String newName = testDoc["device"]["name"];
    TEST_ASSERT_EQUAL_STRING("NewName", newName.c_str());
}

void test_patch_replace_nested(void) {
    PatchOperation op = JsonPatch::createReplaceOperation("/connection/wifi/ssid", "NewNetwork");
    
    JsonPatchResult result = JsonPatch::applySingle(testDoc, op);
    TEST_ASSERT_EQUAL(JsonPatchResult::SUCCESS, result);
    
    String newSsid = testDoc["connection"]["wifi"]["ssid"];
    TEST_ASSERT_EQUAL_STRING("NewNetwork", newSsid.c_str());
}

void test_patch_replace_boolean(void) {
    PatchOperation op = JsonPatch::createReplaceOperation("/rtcm/enabled", true);
    
    JsonPatchResult result = JsonPatch::applySingle(testDoc, op);
    TEST_ASSERT_EQUAL(JsonPatchResult::SUCCESS, result);
    
    bool enabled = testDoc["rtcm"]["enabled"];
    TEST_ASSERT_TRUE(enabled);
}

void test_patch_replace_number(void) {
    PatchOperation op = JsonPatch::createReplaceOperation("/rtcm/source/port", 9999);
    
    JsonPatchResult result = JsonPatch::applySingle(testDoc, op);
    TEST_ASSERT_EQUAL(JsonPatchResult::SUCCESS, result);
    
    int port = testDoc["rtcm"]["source"]["port"];
    TEST_ASSERT_EQUAL(9999, port);
}

void test_patch_add_property(void) {
    PatchOperation op = JsonPatch::createAddOperation("/device/serial", "123456");
    
    JsonPatchResult result = JsonPatch::applySingle(testDoc, op);
    TEST_ASSERT_EQUAL(JsonPatchResult::SUCCESS, result);
    
    String serial = testDoc["device"]["serial"];
    TEST_ASSERT_EQUAL_STRING("123456", serial.c_str());
}

void test_patch_remove_property(void) {
    PatchOperation op = JsonPatch::createRemoveOperation("/connection/wifi/autoConnect");
    
    JsonPatchResult result = JsonPatch::applySingle(testDoc, op);
    TEST_ASSERT_EQUAL(JsonPatchResult::SUCCESS, result);
    
    TEST_ASSERT_FALSE(testDoc["connection"]["wifi"].containsKey("autoConnect"));
}

void test_patch_invalid_path(void) {
    PatchOperation op = JsonPatch::createReplaceOperation("/nonexistent/path", "value");
    
    JsonPatchResult result = JsonPatch::applySingle(testDoc, op);
    TEST_ASSERT_EQUAL(JsonPatchResult::PATH_NOT_FOUND, result);
}

void test_patch_invalid_operation(void) {
    PatchOperation op;
    op.op = JsonPatchOperation::UNKNOWN;
    op.path = "/device/name";
    
    JsonPatchResult result = JsonPatch::applySingle(testDoc, op);
    TEST_ASSERT_EQUAL(JsonPatchResult::INVALID_OPERATION, result);
}

void test_patch_multiple_operations(void) {
    PatchOperation ops[] = {
        JsonPatch::createReplaceOperation("/device/name", "MultiTest"),
        JsonPatch::createReplaceOperation("/device/mode", "uart"),
        JsonPatch::createReplaceOperation("/rtcm/enabled", true)
    };
    
    JsonPatchResult result = JsonPatch::apply(testDoc, ops, 3);
    TEST_ASSERT_EQUAL(JsonPatchResult::SUCCESS, result);
    
    String name = testDoc["device"]["name"];
    String mode = testDoc["device"]["mode"];
    bool enabled = testDoc["rtcm"]["enabled"];
    
    TEST_ASSERT_EQUAL_STRING("MultiTest", name.c_str());
    TEST_ASSERT_EQUAL_STRING("uart", mode.c_str());
    TEST_ASSERT_TRUE(enabled);
}

void test_patch_json_array_format(void) {
    DynamicJsonDocument patchDoc(512);
    JsonArray patchArray = patchDoc.to<JsonArray>();
    
    JsonObject op1 = patchArray.createNestedObject();
    op1["op"] = "replace";
    op1["path"] = "/device/name";
    op1["value"] = "ArrayTest";
    
    JsonObject op2 = patchArray.createNestedObject();
    op2["op"] = "replace";
    op2["path"] = "/rtcm/enabled";
    op2["value"] = true;
    
    JsonPatchResult result = JsonPatch::apply(testDoc, patchArray);
    TEST_ASSERT_EQUAL(JsonPatchResult::SUCCESS, result);
    
    String name = testDoc["device"]["name"];
    bool enabled = testDoc["rtcm"]["enabled"];
    
    TEST_ASSERT_EQUAL_STRING("ArrayTest", name.c_str());
    TEST_ASSERT_TRUE(enabled);
}

void test_patch_rollback_on_failure(void) {
    String originalName = testDoc["device"]["name"];
    
    PatchOperation ops[] = {
        JsonPatch::createReplaceOperation("/device/name", "TempName"),
        JsonPatch::createReplaceOperation("/nonexistent/path", "value") // This should fail
    };
    
    JsonPatchResult result = JsonPatch::apply(testDoc, ops, 2);
    TEST_ASSERT_EQUAL(JsonPatchResult::PATH_NOT_FOUND, result);
    
    // Should have rolled back
    String currentName = testDoc["device"]["name"];
    TEST_ASSERT_EQUAL_STRING(originalName.c_str(), currentName.c_str());
}

void test_patch_validation(void) {
    PatchOperation validOp = JsonPatch::createReplaceOperation("/device/name", "ValidName");
    TEST_ASSERT_TRUE(JsonPatch::validateOperation(validOp));
    
    PatchOperation invalidOp;
    invalidOp.op = JsonPatchOperation::UNKNOWN;
    invalidOp.path = "/device/name";
    TEST_ASSERT_FALSE(JsonPatch::validateOperation(invalidOp));
    
    PatchOperation invalidPath = JsonPatch::createReplaceOperation("invalid-path", "value");
    TEST_ASSERT_FALSE(JsonPatch::validateOperation(invalidPath));
}

void test_patch_too_many_operations(void) {
    PatchOperation ops[15]; // More than MAX_OPERATIONS
    for (int i = 0; i < 15; i++) {
        ops[i] = JsonPatch::createReplaceOperation("/device/name", "Test");
    }
    
    JsonPatchResult result = JsonPatch::apply(testDoc, ops, 15);
    TEST_ASSERT_EQUAL(JsonPatchResult::TOO_MANY_OPERATIONS, result);
}

void test_patch_result_to_string(void) {
    TEST_ASSERT_EQUAL_STRING("Success", JsonPatch::resultToString(JsonPatchResult::SUCCESS).c_str());
    TEST_ASSERT_EQUAL_STRING("Invalid operation", JsonPatch::resultToString(JsonPatchResult::INVALID_OPERATION).c_str());
    TEST_ASSERT_EQUAL_STRING("Path not found", JsonPatch::resultToString(JsonPatchResult::PATH_NOT_FOUND).c_str());
}

void setup() {
    UNITY_BEGIN();
    RUN_TEST(test_patch_replace_simple);
    RUN_TEST(test_patch_replace_nested);
    RUN_TEST(test_patch_replace_boolean);
    RUN_TEST(test_patch_replace_number);
    RUN_TEST(test_patch_add_property);
    RUN_TEST(test_patch_remove_property);
    RUN_TEST(test_patch_invalid_path);
    RUN_TEST(test_patch_invalid_operation);
    RUN_TEST(test_patch_multiple_operations);
    RUN_TEST(test_patch_json_array_format);
    RUN_TEST(test_patch_rollback_on_failure);
    RUN_TEST(test_patch_validation);
    RUN_TEST(test_patch_too_many_operations);
    RUN_TEST(test_patch_result_to_string);
    UNITY_END();
}

void loop() {
    // Empty loop for Arduino framework
}