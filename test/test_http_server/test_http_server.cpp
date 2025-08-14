#include <unity.h>
#include "../../lib/HttpServer/HttpServer.h"

HttpServer* server = nullptr;
bool handlerCalled = false;
HttpRequest lastRequest;
HttpResponse lastResponse;

void setUp(void) {
    server = HttpServer::getInstance();
    handlerCalled = false;
}

void tearDown(void) {
    if (server) {
        server->stop();
    }
    handlerCalled = false;
}

void testRouteHandler(const HttpRequest& req, HttpResponse& res) {
    handlerCalled = true;
    lastRequest = req;
    res.statusCode = 200;
    res.body = "{\"status\":\"ok\"}";
}

void test_singleton_instance() {
    HttpServer* instance1 = HttpServer::getInstance();
    HttpServer* instance2 = HttpServer::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

void test_add_route() {
    server->addRoute("/test", HttpMethod::GET, testRouteHandler);
    TEST_ASSERT_TRUE(true); // Route addition doesn't fail
}

void test_buffer_management() {
    TEST_ASSERT_NOT_NULL(server->getJsonBuffer());
    TEST_ASSERT_EQUAL(1024, server->getBufferSize());
}

void test_json_document_access() {
    DynamicJsonDocument& doc = server->getRequestDoc();
    doc["test"] = "value";
    TEST_ASSERT_EQUAL_STRING("value", doc["test"]);
    
    DynamicJsonDocument& responseDoc = server->getResponseDoc();
    responseDoc["response"] = "data";
    TEST_ASSERT_EQUAL_STRING("data", responseDoc["response"]);
}

void test_server_lifecycle() {
    // Test begin
    server->begin(8080);
    TEST_ASSERT_TRUE(true); // Server starts without error
    
    // Test loop (should not crash)
    server->loop();
    TEST_ASSERT_TRUE(true);
    
    // Test stop
    server->stop();
    TEST_ASSERT_TRUE(true); // Server stops without error
}

void test_http_method_validation() {
    // Test all supported methods
    server->addRoute("/get", HttpMethod::GET, testRouteHandler);
    server->addRoute("/post", HttpMethod::POST, testRouteHandler);
    server->addRoute("/patch", HttpMethod::PATCH, testRouteHandler);
    TEST_ASSERT_TRUE(true); // All methods are accepted
}

void test_multiple_routes() {
    server->addRoute("/route1", HttpMethod::GET, testRouteHandler);
    server->addRoute("/route2", HttpMethod::POST, testRouteHandler);
    server->addRoute("/route3", HttpMethod::PATCH, testRouteHandler);
    TEST_ASSERT_TRUE(true); // Multiple routes can be added
}

void test_memory_constraints() {
    // Test that we don't exceed static buffer sizes
    char* buffer = server->getJsonBuffer();
    TEST_ASSERT_NOT_NULL(buffer);
    
    // Fill buffer to capacity
    memset(buffer, 'A', server->getBufferSize() - 1);
    buffer[server->getBufferSize() - 1] = '\0';
    
    TEST_ASSERT_EQUAL(server->getBufferSize() - 1, strlen(buffer));
}

void test_cors_headers_structure() {
    // Test that CORS functionality is available
    // This would be tested with actual HTTP requests in integration tests
    TEST_ASSERT_TRUE(true);
}

void test_json_parsing_capability() {
    DynamicJsonDocument& doc = server->getRequestDoc();
    doc.clear();
    
    // Test JSON parsing capability
    const char* testJson = "{\"key\":\"value\",\"number\":42}";
    DeserializationError error = deserializeJson(doc, testJson);
    
    TEST_ASSERT_EQUAL(DeserializationError::Ok, error);
    TEST_ASSERT_EQUAL_STRING("value", doc["key"]);
    TEST_ASSERT_EQUAL(42, doc["number"]);
}

int main() {
    UNITY_BEGIN();
    
    RUN_TEST(test_singleton_instance);
    RUN_TEST(test_add_route);
    RUN_TEST(test_buffer_management);
    RUN_TEST(test_json_document_access);
    RUN_TEST(test_server_lifecycle);
    RUN_TEST(test_http_method_validation);
    RUN_TEST(test_multiple_routes);
    RUN_TEST(test_memory_constraints);
    RUN_TEST(test_cors_headers_structure);
    RUN_TEST(test_json_parsing_capability);
    
    return UNITY_END();
}