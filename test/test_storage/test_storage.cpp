#include <unity.h>
#include <Storage.h>
#include <LittleFS.h>

Storage* storage;
const char* testData = "{\"test\":\"data\",\"version\":1}";

void setUp(void) {
    storage = Storage::getInstance();
    UNITY_TEST_ASSERT(storage->begin() == StorageResult::SUCCESS, __LINE__, "Storage initialization failed");
}

void tearDown(void) {
    if (storage) {
        storage->end();
    }
}

void test_storage_instance_singleton(void) {
    Storage* instance1 = Storage::getInstance();
    Storage* instance2 = Storage::getInstance();
    TEST_ASSERT_EQUAL_PTR(instance1, instance2);
}

void test_storage_write_read_config(void) {
    size_t dataSize = strlen(testData);
    uint32_t version = 1;
    
    // Write configuration
    StorageResult writeResult = storage->writeConfig(
        reinterpret_cast<const uint8_t*>(testData), 
        dataSize, 
        version
    );
    TEST_ASSERT_EQUAL(StorageResult::SUCCESS, writeResult);
    
    // Read configuration back
    uint8_t readBuffer[512];
    size_t readSize = 0;
    uint32_t readVersion = 0;
    
    StorageResult readResult = storage->readConfig(readBuffer, readSize, readVersion);
    TEST_ASSERT_EQUAL(StorageResult::SUCCESS, readResult);
    TEST_ASSERT_EQUAL(dataSize, readSize);
    TEST_ASSERT_EQUAL(version, readVersion);
    
    // Compare data
    readBuffer[readSize] = '\0';
    TEST_ASSERT_EQUAL_STRING(testData, reinterpret_cast<char*>(readBuffer));
}

void test_storage_has_valid_config(void) {
    TEST_ASSERT_FALSE(storage->hasValidConfig());
    
    // Write a config
    size_t dataSize = strlen(testData);
    storage->writeConfig(reinterpret_cast<const uint8_t*>(testData), dataSize, 1);
    
    TEST_ASSERT_TRUE(storage->hasValidConfig());
}

void test_storage_backup_restore(void) {
    size_t dataSize = strlen(testData);
    
    // Write initial configuration
    storage->writeConfig(reinterpret_cast<const uint8_t*>(testData), dataSize, 1);
    
    // Create backup
    StorageResult backupResult = storage->backupConfig();
    TEST_ASSERT_EQUAL(StorageResult::SUCCESS, backupResult);
    
    // Write new configuration
    const char* newData = "{\"test\":\"modified\",\"version\":2}";
    storage->writeConfig(reinterpret_cast<const uint8_t*>(newData), strlen(newData), 2);
    
    // Verify new configuration is active
    uint8_t readBuffer[512];
    size_t readSize = 0;
    uint32_t readVersion = 0;
    storage->readConfig(readBuffer, readSize, readVersion);
    readBuffer[readSize] = '\0';
    TEST_ASSERT_EQUAL_STRING(newData, reinterpret_cast<char*>(readBuffer));
    
    // Restore from backup
    StorageResult restoreResult = storage->restoreFromBackup(0);
    TEST_ASSERT_EQUAL(StorageResult::SUCCESS, restoreResult);
    
    // Verify original configuration is restored
    storage->readConfig(readBuffer, readSize, readVersion);
    readBuffer[readSize] = '\0';
    TEST_ASSERT_EQUAL_STRING(testData, reinterpret_cast<char*>(readBuffer));
}

void test_storage_invalid_size(void) {
    // Test writing data that's too large
    uint8_t largeData[5000];
    memset(largeData, 'A', sizeof(largeData));
    
    StorageResult result = storage->writeConfig(largeData, sizeof(largeData), 1);
    TEST_ASSERT_EQUAL(StorageResult::INVALID_SIZE, result);
}

void test_storage_space_info(void) {
    size_t totalSpace = storage->getTotalSpace();
    size_t usedSpace = storage->getUsedSpace();
    size_t freeSpace = storage->getFreeSpace();
    
    TEST_ASSERT_GREATER_THAN(0, totalSpace);
    TEST_ASSERT_GREATER_OR_EQUAL(0, usedSpace);
    TEST_ASSERT_GREATER_OR_EQUAL(0, freeSpace);
    TEST_ASSERT_EQUAL(totalSpace, usedSpace + freeSpace);
}

void test_storage_multiple_backups(void) {
    const char* data1 = "{\"version\":1}";
    const char* data2 = "{\"version\":2}";
    const char* data3 = "{\"version\":3}";
    
    // Write and backup multiple times
    storage->writeConfig(reinterpret_cast<const uint8_t*>(data1), strlen(data1), 1);
    storage->backupConfig();
    
    storage->writeConfig(reinterpret_cast<const uint8_t*>(data2), strlen(data2), 2);
    storage->backupConfig();
    
    storage->writeConfig(reinterpret_cast<const uint8_t*>(data3), strlen(data3), 3);
    
    // Should have at least one backup
    uint8_t backupCount = storage->getAvailableBackupCount();
    TEST_ASSERT_GREATER_THAN(0, backupCount);
    
    // Restore from most recent backup
    TEST_ASSERT_EQUAL(StorageResult::SUCCESS, storage->restoreFromBackup(0));
    
    uint8_t readBuffer[256];
    size_t readSize = 0;
    uint32_t readVersion = 0;
    storage->readConfig(readBuffer, readSize, readVersion);
    readBuffer[readSize] = '\0';
    TEST_ASSERT_EQUAL_STRING(data2, reinterpret_cast<char*>(readBuffer));
}

void test_storage_timestamp(void) {
    uint64_t timestamp1 = storage->getConfigTimestamp();
    TEST_ASSERT_EQUAL(0, timestamp1); // No config initially
    
    storage->writeConfig(reinterpret_cast<const uint8_t*>(testData), strlen(testData), 1);
    
    uint64_t timestamp2 = storage->getConfigTimestamp();
    TEST_ASSERT_GREATER_THAN(0, timestamp2);
}

void setup() {
    UNITY_BEGIN();
    RUN_TEST(test_storage_instance_singleton);
    RUN_TEST(test_storage_write_read_config);
    RUN_TEST(test_storage_has_valid_config);
    RUN_TEST(test_storage_backup_restore);
    RUN_TEST(test_storage_invalid_size);
    RUN_TEST(test_storage_space_info);
    RUN_TEST(test_storage_multiple_backups);
    RUN_TEST(test_storage_timestamp);
    UNITY_END();
}

void loop() {
    // Empty loop for Arduino framework
}