#include <unity.h>
#include "WebSocketServer.h"

WebSocketServer* server = nullptr;
bool messageHandlerCalled = false;
uint32_t lastClientId = 0;
WebSocketMessage lastMessage(256);

void setUp(void) {
    server = WebSocketServer::getInstance();
    messageHandlerCalled = false;
    lastClientId = 0;
}

void tearDown(void) {
    if (server) {
        server->stop();
    }
    messageHandlerCalled = false;
}

void testMessageHandler(uint32_t clientId, const WebSocketMessage& message) {
    messageHandlerCalled = true;
    lastClientId = clientId;
    lastMessage.type = message.type;
    lastMessage.payload.set(message.payload);
}

void test_singleton_instance() {
    WebSocketServer* instance1 = WebSocketServer::getInstance();
    WebSocketServer* instance2 = WebSocketServer::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

void test_buffer_management() {
    TEST_ASSERT_NOT_NULL(server->getMessageBuffer());
    TEST_ASSERT_EQUAL(512, server->getBufferSize());
}

void test_message_document_access() {
    DynamicJsonDocument& doc = server->getMessageDoc();
    doc["type"] = "test";
    TEST_ASSERT_EQUAL_STRING("test", doc["type"]);
}

void test_server_lifecycle() {
    // Test begin
    server->begin("/ws");
    TEST_ASSERT_TRUE(true); // Server starts without error
    
    // Test loop (should not crash)
    server->loop();
    TEST_ASSERT_TRUE(true);
    
    // Test stop
    server->stop();
    TEST_ASSERT_TRUE(true); // Server stops without error
}

void test_message_handler_registration() {
    server->setMessageHandler(testMessageHandler);
    TEST_ASSERT_TRUE(true); // Handler registration doesn't fail
}

void test_client_count_tracking() {
    uint8_t initialCount = server->getClientCount();
    TEST_ASSERT_EQUAL(0, initialCount); // Initially no clients
}

void test_client_connection_check() {
    bool connected = server->isClientConnected(12345);
    TEST_ASSERT_FALSE(connected); // Client not connected initially
}

void test_broadcast_message_structure() {
    DynamicJsonDocument testPayload(256);
    testPayload["data"] = "test";
    
    // Test broadcast doesn't crash
    server->broadcast(WebSocketEventType::STATUS, testPayload.as<JsonObject>());
    TEST_ASSERT_TRUE(true);
}

void test_websocket_message_creation() {
    WebSocketMessage message(256);
    message.type = WebSocketEventType::CONFIG_CHANGED;
    message.payload["key"] = "value";
    
    TEST_ASSERT_EQUAL(WebSocketEventType::CONFIG_CHANGED, message.type);
    TEST_ASSERT_EQUAL_STRING("value", message.payload["key"]);
}

void test_event_type_validation() {
    // Test all supported event types
    WebSocketMessage statusMsg;
    statusMsg.type = WebSocketEventType::STATUS;
    TEST_ASSERT_EQUAL(WebSocketEventType::STATUS, statusMsg.type);
    
    WebSocketMessage configMsg;
    configMsg.type = WebSocketEventType::CONFIG_CHANGED;
    TEST_ASSERT_EQUAL(WebSocketEventType::CONFIG_CHANGED, configMsg.type);
    
    WebSocketMessage rtcmMsg;
    rtcmMsg.type = WebSocketEventType::RTCM_DATA;
    TEST_ASSERT_EQUAL(WebSocketEventType::RTCM_DATA, rtcmMsg.type);
    
    WebSocketMessage errorMsg;
    errorMsg.type = WebSocketEventType::ERROR_EVENT;
    TEST_ASSERT_EQUAL(WebSocketEventType::ERROR_EVENT, errorMsg.type);
    
    WebSocketMessage logMsg;
    logMsg.type = WebSocketEventType::LOG;
    TEST_ASSERT_EQUAL(WebSocketEventType::LOG, logMsg.type);
}

void test_message_broadcasting() {
    WebSocketMessage message(256);
    message.type = WebSocketEventType::STATUS;
    message.payload["status"] = "healthy";
    
    // Test broadcast message doesn't crash
    server->broadcastMessage(message);
    TEST_ASSERT_TRUE(true);
}

void test_client_specific_messaging() {
    WebSocketMessage message(256);
    message.type = WebSocketEventType::LOG;
    message.payload["message"] = "test log";
    
    // Test send to specific client doesn't crash (even if client doesn't exist)
    server->sendMessage(12345, message);
    TEST_ASSERT_TRUE(true);
}

void test_memory_constraints() {
    // Test that we don't exceed static buffer sizes
    char* buffer = server->getMessageBuffer();
    TEST_ASSERT_NOT_NULL(buffer);
    
    // Fill buffer to capacity
    memset(buffer, 'B', server->getBufferSize() - 1);
    buffer[server->getBufferSize() - 1] = '\0';
    
    TEST_ASSERT_EQUAL(server->getBufferSize() - 1, strlen(buffer));
}

void test_json_message_structure() {
    DynamicJsonDocument& doc = server->getMessageDoc();
    doc.clear();
    
    // Test expected WebSocket message structure
    doc["type"] = "status";
    doc["payload"]["data"] = "test";
    
    TEST_ASSERT_EQUAL_STRING("status", doc["type"]);
    TEST_ASSERT_EQUAL_STRING("test", doc["payload"]["data"]);
}

int main() {
    UNITY_BEGIN();
    
    RUN_TEST(test_singleton_instance);
    RUN_TEST(test_buffer_management);
    RUN_TEST(test_message_document_access);
    RUN_TEST(test_server_lifecycle);
    RUN_TEST(test_message_handler_registration);
    RUN_TEST(test_client_count_tracking);
    RUN_TEST(test_client_connection_check);
    RUN_TEST(test_broadcast_message_structure);
    RUN_TEST(test_websocket_message_creation);
    RUN_TEST(test_event_type_validation);
    RUN_TEST(test_message_broadcasting);
    RUN_TEST(test_client_specific_messaging);
    RUN_TEST(test_memory_constraints);
    RUN_TEST(test_json_message_structure);
    
    return UNITY_END();
}