#include <unity.h>
#include <Arduino.h>
#include "lib/RTCMParser/RTCMParser.h"

void setUp(void) {
    // Setup before each test
}

void tearDown(void) {
    // Cleanup after each test
}

void test_find_message_start() {
    uint8_t data[] = {0x00, 0x01, 0xD3, 0x02, 0x03};
    size_t result = RTCMParser::findMessageStart(data, sizeof(data));
    TEST_ASSERT_EQUAL(2, result);
    
    // Test no preamble found
    uint8_t data2[] = {0x00, 0x01, 0x02, 0x03};
    result = RTCMParser::findMessageStart(data2, sizeof(data2));
    TEST_ASSERT_EQUAL((size_t)-1, result);
}

void test_get_message_length() {
    // Valid RTCM header: D3 00 0C (12 bytes payload + 6 total = 18)
    uint8_t data[] = {0xD3, 0x00, 0x0C};
    size_t result = RTCMParser::getMessageLength(data, sizeof(data));
    TEST_ASSERT_EQUAL(18, result);
    
    // Invalid preamble
    uint8_t data2[] = {0xD2, 0x00, 0x0C};
    result = RTCMParser::getMessageLength(data2, sizeof(data2));
    TEST_ASSERT_EQUAL(0, result);
    
    // Insufficient data
    uint8_t data3[] = {0xD3, 0x00};
    result = RTCMParser::getMessageLength(data3, sizeof(data3));
    TEST_ASSERT_EQUAL(0, result);
}

void test_message_type_helpers() {
    // Test position messages
    TEST_ASSERT_TRUE(RTCMParser::isPositionMessage(1005));
    TEST_ASSERT_TRUE(RTCMParser::isPositionMessage(1006));
    TEST_ASSERT_FALSE(RTCMParser::isPositionMessage(1074));
    
    // Test MSM messages
    TEST_ASSERT_TRUE(RTCMParser::isMSMMessage(1074));
    TEST_ASSERT_TRUE(RTCMParser::isMSMMessage(1077));
    TEST_ASSERT_TRUE(RTCMParser::isMSMMessage(1084));
    TEST_ASSERT_FALSE(RTCMParser::isMSMMessage(1005));
    
    // Test observation messages
    TEST_ASSERT_TRUE(RTCMParser::isObservationMessage(1001));
    TEST_ASSERT_TRUE(RTCMParser::isObservationMessage(1074));
    TEST_ASSERT_FALSE(RTCMParser::isObservationMessage(1005));
}

void test_message_type_names() {
    TEST_ASSERT_EQUAL_STRING("GPS L1-Only RTK", RTCMParser::getMessageTypeName(1001));
    TEST_ASSERT_EQUAL_STRING("Station ARP", RTCMParser::getMessageTypeName(1005));
    TEST_ASSERT_EQUAL_STRING("GPS MSM4", RTCMParser::getMessageTypeName(1074));
    TEST_ASSERT_EQUAL_STRING("Unknown", RTCMParser::getMessageTypeName(9999));
}

void test_parse_simple_message() {
    // Create a simple valid RTCM message
    // Preamble (D3) + Length (00 0C = 12 bytes) + Message Type 1005 + payload + CRC
    uint8_t testMessage[] = {
        0xD3, 0x00, 0x0C,  // Header: preamble + length (12 bytes)
        0x3E, 0xD0,        // Message type 1005 (12 bits) + station ID start
        0x00, 0x01,        // Station ID (12 bits)
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // Payload (9 bytes)
        0x12, 0x34, 0x56   // CRC24 (dummy values)
    };
    
    RTCMParser::RTCMMessage message;
    bool result = RTCMParser::parseMessage(testMessage, sizeof(testMessage), message);
    
    TEST_ASSERT_TRUE(result);
    TEST_ASSERT_EQUAL(1005, message.messageType);
    TEST_ASSERT_EQUAL(12, message.payloadLength);
    TEST_ASSERT_EQUAL(18, message.totalLength);
}

void test_incomplete_message() {
    // Create an incomplete message (header only)
    uint8_t incompleteMessage[] = {0xD3, 0x00, 0x0C};
    
    RTCMParser::RTCMMessage message;
    bool result = RTCMParser::parseMessage(incompleteMessage, sizeof(incompleteMessage), message);
    
    TEST_ASSERT_FALSE(result);
}

void test_is_complete_message() {
    // Complete message
    uint8_t completeMessage[] = {
        0xD3, 0x00, 0x03,  // Header: 3 bytes payload
        0x00, 0x00, 0x00,  // Payload
        0x00, 0x00, 0x00   // CRC
    };
    
    TEST_ASSERT_TRUE(RTCMParser::isCompleteMessage(completeMessage, sizeof(completeMessage)));
    
    // Incomplete message
    uint8_t incompleteMessage[] = {0xD3, 0x00, 0x03, 0x00};
    TEST_ASSERT_FALSE(RTCMParser::isCompleteMessage(incompleteMessage, sizeof(incompleteMessage)));
    
    // Too short
    uint8_t shortMessage[] = {0xD3, 0x00};
    TEST_ASSERT_FALSE(RTCMParser::isCompleteMessage(shortMessage, sizeof(shortMessage)));
}

void setup() {
    UNITY_BEGIN();
    
    RUN_TEST(test_find_message_start);
    RUN_TEST(test_get_message_length);
    RUN_TEST(test_message_type_helpers);
    RUN_TEST(test_message_type_names);
    RUN_TEST(test_parse_simple_message);
    RUN_TEST(test_incomplete_message);
    RUN_TEST(test_is_complete_message);
    
    UNITY_END();
}

void loop() {
    // Empty loop
}