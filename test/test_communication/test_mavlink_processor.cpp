#include <unity.h>
#include "../../lib/MAVLinkProcessor/MAVLinkProcessor.h"

void setUp(void) {
    // Set up test
}

void tearDown(void) {
    // Clean up after test
}

void test_mavlink_processor_initialization() {
    MAVLinkProcessor* processor = MAVLinkProcessor::getInstance();
    TEST_ASSERT_NOT_NULL(processor);
}

void test_mavlink_data_validation() {
    // Test valid MAVLink v1 frame
    uint8_t validV1Data[] = {0xFE, 0x04, 0x00, 0x01, 0x02, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x00, 0x00};
    TEST_ASSERT_TRUE(MAVLinkProcessor::isMAVLinkData(validV1Data, sizeof(validV1Data)));
    
    // Test valid MAVLink v2 frame
    uint8_t validV2Data[] = {0xFD, 0x04, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x00, 0x00};
    TEST_ASSERT_TRUE(MAVLinkProcessor::isMAVLinkData(validV2Data, sizeof(validV2Data)));
    
    // Test invalid data
    uint8_t invalidData[] = {0x00, 0x01, 0x02, 0x03, 0x04};
    TEST_ASSERT_FALSE(MAVLinkProcessor::isMAVLinkData(invalidData, sizeof(invalidData)));
    
    // Test empty data
    TEST_ASSERT_FALSE(MAVLinkProcessor::isMAVLinkData(nullptr, 0));
}

void test_mavlink_checksum_calculation() {
    uint8_t testData[] = {0x04, 0x00, 0x01, 0x02, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04};
    uint16_t checksum = MAVLinkProcessor::calculateChecksum(testData, sizeof(testData));
    
    // Should calculate a valid checksum (non-zero for this data)
    TEST_ASSERT_NOT_EQUAL(0, checksum);
    
    // Same data should produce same checksum
    uint16_t checksum2 = MAVLinkProcessor::calculateChecksum(testData, sizeof(testData));
    TEST_ASSERT_EQUAL(checksum, checksum2);
}

void test_mavlink_message_filter() {
    MAVLinkProcessor* processor = MAVLinkProcessor::getInstance();
    
    // Test default filter state
    MAVLinkProcessor::Filter filter = processor->getMessageFilter();
    TEST_ASSERT_FALSE(filter.enableFilter);
    TEST_ASSERT_EQUAL(0, filter.allowedMessageIds.size());
    
    // Test setting filter
    filter.enableFilter = true;
    filter.allowedMessageIds.push_back(1);
    filter.allowedMessageIds.push_back(2);
    filter.allowedSystemIds.push_back(1);
    
    processor->setMessageFilter(filter);
    
    MAVLinkProcessor::Filter retrievedFilter = processor->getMessageFilter();
    TEST_ASSERT_TRUE(retrievedFilter.enableFilter);
    TEST_ASSERT_EQUAL(2, retrievedFilter.allowedMessageIds.size());
    TEST_ASSERT_EQUAL(1, retrievedFilter.allowedSystemIds.size());
    
    // Test clearing filter
    processor->clearMessageFilter();
    MAVLinkProcessor::Filter clearedFilter = processor->getMessageFilter();
    TEST_ASSERT_FALSE(clearedFilter.enableFilter);
    TEST_ASSERT_EQUAL(0, clearedFilter.allowedMessageIds.size());
}

void test_mavlink_statistics() {
    MAVLinkProcessor* processor = MAVLinkProcessor::getInstance();
    
    // Reset statistics
    processor->resetStatistics();
    
    // Get initial statistics
    MAVLinkProcessor::MessageStats stats = processor->getStatistics();
    TEST_ASSERT_EQUAL(0, stats.totalMessages);
    TEST_ASSERT_EQUAL(0, stats.crcErrors);
    TEST_ASSERT_EQUAL(0, stats.parseErrors);
    TEST_ASSERT_EQUAL(0, stats.sequenceErrors);
    TEST_ASSERT_EQUAL(0, stats.messageTypes.size());
}

void test_mavlink_process_empty_data() {
    MAVLinkProcessor* processor = MAVLinkProcessor::getInstance();
    
    // Test processing null data
    std::vector<MAVLinkMessage> messages = processor->processData(nullptr, 0);
    TEST_ASSERT_EQUAL(0, messages.size());
    
    // Test processing empty data
    uint8_t emptyData[1] = {0};
    messages = processor->processData(emptyData, 0);
    TEST_ASSERT_EQUAL(0, messages.size());
}

void test_mavlink_message_serialization() {
    MAVLinkMessage message;
    message.magic = 0xFE;
    message.length = 4;
    message.seq = 1;
    message.sysid = 2;
    message.compid = 3;
    message.msgid = 0x0001;
    message.payload[0] = 0x01;
    message.payload[1] = 0x02;
    message.payload[2] = 0x03;
    message.payload[3] = 0x04;
    message.checksum = 0x1234;
    message.valid = true;
    
    uint8_t buffer[64];
    size_t serializedSize = MAVLinkProcessor::serializeMessage(message, buffer, sizeof(buffer));
    
    // Should serialize to a reasonable size
    TEST_ASSERT_GREATER_THAN(8, serializedSize);
    TEST_ASSERT_LESS_THAN(sizeof(buffer), serializedSize);
    
    // First byte should be the magic number
    TEST_ASSERT_EQUAL(0xFE, buffer[0]);
    
    // Second byte should be the length
    TEST_ASSERT_EQUAL(4, buffer[1]);
}

void run_mavlink_processor_tests() {
    RUN_TEST(test_mavlink_processor_initialization);
    RUN_TEST(test_mavlink_data_validation);
    RUN_TEST(test_mavlink_checksum_calculation);
    RUN_TEST(test_mavlink_message_filter);
    RUN_TEST(test_mavlink_statistics);
    RUN_TEST(test_mavlink_process_empty_data);
    RUN_TEST(test_mavlink_message_serialization);
}

#ifdef UNIT_TEST_STANDALONE
int main(int argc, char **argv) {
    UNITY_BEGIN();
    run_mavlink_processor_tests();
    return UNITY_END();
}
#endif