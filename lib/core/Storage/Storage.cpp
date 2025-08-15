#include "Storage.h"
#include <esp_crc.h>

const char* StorageConfig::CONFIG_FILE = "/config.json";
const char* StorageConfig::BACKUP_PREFIX = "/config_backup_";
const char* StorageConfig::TEMP_SUFFIX = ".tmp";

Storage* Storage::instance = nullptr;

Storage::Storage() : isInitialized(false), storageMutex(nullptr) {
    memset(readBuffer, 0, BUFFER_SIZE);
    memset(writeBuffer, 0, BUFFER_SIZE);
}

Storage::~Storage() {
    end();
}

Storage* Storage::getInstance() {
    if (instance == nullptr) {
        instance = new Storage();
    }
    return instance;
}

StorageResult Storage::begin() {
    if (isInitialized) {
        return StorageResult::SUCCESS;
    }
    
    storageMutex = xSemaphoreCreateMutex();
    if (storageMutex == nullptr) {
        setLastError("Failed to create storage mutex");
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    if (!FFat.begin(true)) {
        setLastError("Failed to initialize FFat");
        vSemaphoreDelete(storageMutex);
        storageMutex = nullptr;
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    // Validate filesystem integrity
    StorageResult result = validateFilesystem();
    if (result != StorageResult::SUCCESS) {
        setLastError("Filesystem validation failed");
        FFat.end();
        vSemaphoreDelete(storageMutex);
        storageMutex = nullptr;
        return result;
    }
    
    isInitialized = true;
    return StorageResult::SUCCESS;
}

void Storage::end() {
    if (!isInitialized) {
        return;
    }
    
    FFat.end();
    
    if (storageMutex != nullptr) {
        vSemaphoreDelete(storageMutex);
        storageMutex = nullptr;
    }
    
    isInitialized = false;
}

StorageResult Storage::writeConfig(const uint8_t* data, size_t dataSize, uint32_t version) {
    if (!isInitialized || data == nullptr || dataSize == 0 || dataSize > StorageConfig::MAX_FILE_SIZE) {
        setLastError("Invalid parameters for writeConfig");
        return StorageResult::INVALID_SIZE;
    }
    
    if (xSemaphoreTake(storageMutex, portMAX_DELAY) != pdTRUE) {
        setLastError("Failed to acquire storage mutex");
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    StorageResult result = StorageResult::SUCCESS;
    
    // Create backup before writing if config exists
    if (hasValidConfig()) {
        result = createBackup(StorageConfig::CONFIG_FILE);
        if (result != StorageResult::SUCCESS) {
            xSemaphoreGive(storageMutex);
            return result;
        }
    }
    
    // Write atomically
    result = writeFileAtomic(StorageConfig::CONFIG_FILE, data, dataSize);
    
    xSemaphoreGive(storageMutex);
    return result;
}

StorageResult Storage::readConfig(uint8_t* buffer, size_t& dataSize, uint32_t& version) {
    if (!isInitialized || buffer == nullptr) {
        setLastError("Invalid parameters for readConfig");
        return StorageResult::READ_FAILED;
    }
    
    if (xSemaphoreTake(storageMutex, portMAX_DELAY) != pdTRUE) {
        setLastError("Failed to acquire storage mutex");
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    StorageResult result = readFileWithValidation(StorageConfig::CONFIG_FILE, readBuffer, dataSize);
    
    if (result == StorageResult::SUCCESS && dataSize >= sizeof(FileHeader)) {
        FileHeader* header = reinterpret_cast<FileHeader*>(readBuffer);
        version = header->version;
        dataSize = header->dataSize;
        
        if (dataSize > 0 && dataSize <= StorageConfig::MAX_FILE_SIZE) {
            memcpy(buffer, readBuffer + sizeof(FileHeader), dataSize);
        } else {
            result = StorageResult::CORRUPTION_DETECTED;
        }
    }
    
    xSemaphoreGive(storageMutex);
    return result;
}

StorageResult Storage::backupConfig() {
    if (!isInitialized) {
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    if (xSemaphoreTake(storageMutex, portMAX_DELAY) != pdTRUE) {
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    StorageResult result = createBackup(StorageConfig::CONFIG_FILE);
    
    xSemaphoreGive(storageMutex);
    return result;
}

StorageResult Storage::restoreFromBackup(uint8_t backupIndex) {
    if (!isInitialized || backupIndex >= StorageConfig::MAX_BACKUPS) {
        return StorageResult::BACKUP_FAILED;
    }
    
    if (xSemaphoreTake(storageMutex, portMAX_DELAY) != pdTRUE) {
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    String backupPath = getBackupPath(StorageConfig::CONFIG_FILE, backupIndex);
    
    if (!fileExists(backupPath)) {
        xSemaphoreGive(storageMutex);
        return StorageResult::FILE_NOT_FOUND;
    }
    
    size_t dataSize = 0;
    StorageResult result = readFileWithValidation(backupPath, readBuffer, dataSize);
    
    if (result == StorageResult::SUCCESS) {
        // Copy backup to main config file
        File configFile = FFat.open(StorageConfig::CONFIG_FILE, "w");
        if (!configFile) {
            result = StorageResult::WRITE_FAILED;
        } else {
            size_t written = configFile.write(readBuffer, dataSize);
            configFile.close();
            
            if (written != dataSize) {
                result = StorageResult::WRITE_FAILED;
            }
        }
    }
    
    xSemaphoreGive(storageMutex);
    return result;
}

StorageResult Storage::writeFile(const String& filePath, const uint8_t* data, size_t dataSize) {
    if (!isInitialized || data == nullptr || dataSize == 0 || dataSize > StorageConfig::MAX_FILE_SIZE) {
        return StorageResult::INVALID_SIZE;
    }
    
    if (xSemaphoreTake(storageMutex, portMAX_DELAY) != pdTRUE) {
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    StorageResult result = writeFileAtomic(filePath, data, dataSize);
    
    xSemaphoreGive(storageMutex);
    return result;
}

StorageResult Storage::readFile(const String& filePath, uint8_t* buffer, size_t& dataSize) {
    if (!isInitialized || buffer == nullptr) {
        return StorageResult::READ_FAILED;
    }
    
    if (xSemaphoreTake(storageMutex, portMAX_DELAY) != pdTRUE) {
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    StorageResult result = readFileWithValidation(filePath, buffer, dataSize);
    
    xSemaphoreGive(storageMutex);
    return result;
}

StorageResult Storage::deleteFile(const String& filePath) {
    if (!isInitialized) {
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    if (xSemaphoreTake(storageMutex, portMAX_DELAY) != pdTRUE) {
        return StorageResult::FILESYSTEM_ERROR;
    }
    
    StorageResult result = StorageResult::SUCCESS;
    
    if (!FFat.remove(filePath)) {
        result = StorageResult::FILE_NOT_FOUND;
    }
    
    xSemaphoreGive(storageMutex);
    return result;
}

bool Storage::hasValidConfig() {
    return fileExists(StorageConfig::CONFIG_FILE) && 
           validateFileIntegrity(StorageConfig::CONFIG_FILE);
}

StorageResult Storage::validateFilesystem() {
    // Check if FFat is properly mounted
    File root = FFat.open("/");
    if (!root) {
        return StorageResult::FILESYSTEM_ERROR;
    }
    root.close();
    
    // Validate main config file if it exists
    if (fileExists(StorageConfig::CONFIG_FILE)) {
        if (!validateFileIntegrity(StorageConfig::CONFIG_FILE)) {
            return StorageResult::CORRUPTION_DETECTED;
        }
    }
    
    return StorageResult::SUCCESS;
}

StorageResult Storage::defragment() {
    // FFat handles wear leveling automatically
    // This is a placeholder for future optimization
    return StorageResult::SUCCESS;
}

size_t Storage::getTotalSpace() {
    return FFat.totalBytes();
}

size_t Storage::getUsedSpace() {
    return FFat.usedBytes();
}

size_t Storage::getFreeSpace() {
    return getTotalSpace() - getUsedSpace();
}

bool Storage::isHealthy() {
    if (!isInitialized) {
        return false;
    }
    
    // Check if filesystem is available
    if (!FFat.exists("/")) {
        return false;
    }
    
    // Check if we have enough free space (at least 10KB)
    if (getFreeSpace() < 10240) {
        return false;
    }
    
    // Basic filesystem validation
    return validateFilesystem() == StorageResult::SUCCESS;
}

uint8_t Storage::getAvailableBackupCount() {
    uint8_t count = 0;
    for (uint8_t i = 0; i < StorageConfig::MAX_BACKUPS; i++) {
        String backupPath = getBackupPath(StorageConfig::CONFIG_FILE, i);
        if (fileExists(backupPath)) {
            count++;
        }
    }
    return count;
}

uint64_t Storage::getConfigTimestamp() {
    if (!hasValidConfig()) {
        return 0;
    }
    
    File file = FFat.open(StorageConfig::CONFIG_FILE, "r");
    if (!file) {
        return 0;
    }
    
    FileHeader header;
    size_t bytesRead = file.read(reinterpret_cast<uint8_t*>(&header), sizeof(FileHeader));
    file.close();
    
    if (bytesRead == sizeof(FileHeader) && header.magic == StorageConfig::CHECKSUM_MAGIC) {
        return header.timestamp;
    }
    
    return 0;
}

uint32_t Storage::calculateChecksum(const uint8_t* data, size_t length) {
    return esp_crc32_le(0, data, length);
}

bool Storage::validateFileIntegrity(const String& filePath) {
    File file = FFat.open(filePath, "r");
    if (!file) {
        return false;
    }
    
    FileHeader header;
    size_t bytesRead = file.read(reinterpret_cast<uint8_t*>(&header), sizeof(FileHeader));
    
    if (bytesRead != sizeof(FileHeader) || header.magic != StorageConfig::CHECKSUM_MAGIC) {
        file.close();
        return false;
    }
    
    if (header.dataSize > StorageConfig::MAX_FILE_SIZE) {
        file.close();
        return false;
    }
    
    // Read data and verify checksum
    size_t remainingBytes = min(header.dataSize, (uint32_t)(BUFFER_SIZE - sizeof(FileHeader)));
    bytesRead = file.read(readBuffer, remainingBytes);
    file.close();
    
    if (bytesRead != remainingBytes) {
        return false;
    }
    
    uint32_t calculatedChecksum = calculateChecksum(readBuffer, remainingBytes);
    return calculatedChecksum == header.checksum;
}

StorageResult Storage::createBackup(const String& filePath) {
    if (!fileExists(filePath)) {
        return StorageResult::FILE_NOT_FOUND;
    }
    
    // Rotate existing backups
    StorageResult result = rotateBackups(filePath);
    if (result != StorageResult::SUCCESS) {
        return result;
    }
    
    // Copy main file to backup_0
    String backupPath = getBackupPath(filePath, 0);
    
    File sourceFile = FFat.open(filePath, "r");
    if (!sourceFile) {
        return StorageResult::READ_FAILED;
    }
    
    File backupFile = FFat.open(backupPath, "w");
    if (!backupFile) {
        sourceFile.close();
        return StorageResult::WRITE_FAILED;
    }
    
    size_t totalBytes = 0;
    uint8_t buffer[256];
    while (sourceFile.available()) {
        size_t bytesToRead = min((size_t)sourceFile.available(), sizeof(buffer));
        size_t bytesRead = sourceFile.read(buffer, bytesToRead);
        size_t bytesWritten = backupFile.write(buffer, bytesRead);
        
        if (bytesWritten != bytesRead) {
            sourceFile.close();
            backupFile.close();
            FFat.remove(backupPath);
            return StorageResult::WRITE_FAILED;
        }
        
        totalBytes += bytesRead;
        if (totalBytes > StorageConfig::MAX_FILE_SIZE) {
            sourceFile.close();
            backupFile.close();
            FFat.remove(backupPath);
            return StorageResult::INVALID_SIZE;
        }
    }
    
    sourceFile.close();
    backupFile.close();
    
    return StorageResult::SUCCESS;
}

StorageResult Storage::rotateBackups(const String& basePath) {
    // Move backup_1 to backup_2, backup_0 to backup_1
    for (int8_t i = StorageConfig::MAX_BACKUPS - 1; i > 0; i--) {
        String currentPath = getBackupPath(basePath, i - 1);
        String nextPath = getBackupPath(basePath, i);
        
        if (fileExists(currentPath)) {
            // Remove old backup if it exists
            if (fileExists(nextPath)) {
                FFat.remove(nextPath);
            }
            
            // Rename current to next
            if (!FFat.rename(currentPath, nextPath)) {
                return StorageResult::BACKUP_FAILED;
            }
        }
    }
    
    return StorageResult::SUCCESS;
}

String Storage::getBackupPath(const String& basePath, uint8_t backupIndex) {
    String filename = basePath;
    int lastSlash = filename.lastIndexOf('/');
    if (lastSlash >= 0) {
        filename = filename.substring(lastSlash + 1);
    }
    
    // Remove extension if present
    int lastDot = filename.lastIndexOf('.');
    if (lastDot > 0) {
        filename = filename.substring(0, lastDot);
    }
    
    return String(StorageConfig::BACKUP_PREFIX) + String(backupIndex) + "_" + filename + ".bak";
}

String Storage::getTempPath(const String& filePath) {
    return filePath + StorageConfig::TEMP_SUFFIX;
}

bool Storage::fileExists(const String& filePath) {
    File file = FFat.open(filePath, "r");
    bool exists = (bool)file;
    if (exists) {
        file.close();
    }
    return exists;
}

size_t Storage::getFileSize(const String& filePath) {
    File file = FFat.open(filePath, "r");
    if (!file) {
        return 0;
    }
    
    size_t size = file.size();
    file.close();
    return size;
}

StorageResult Storage::writeFileAtomic(const String& filePath, const uint8_t* data, size_t dataSize) {
    String tempPath = getTempPath(filePath);
    
    // Prepare file header
    FileHeader header;
    header.version = 1;
    header.dataSize = dataSize;
    header.checksum = calculateChecksum(data, dataSize);
    header.timestamp = esp_timer_get_time();
    
    // Write to temporary file first
    File tempFile = FFat.open(tempPath, "w");
    if (!tempFile) {
        return StorageResult::WRITE_FAILED;
    }
    
    // Write header
    if (tempFile.write(reinterpret_cast<const uint8_t*>(&header), sizeof(FileHeader)) != sizeof(FileHeader)) {
        tempFile.close();
        FFat.remove(tempPath);
        return StorageResult::WRITE_FAILED;
    }
    
    // Write data
    if (tempFile.write(data, dataSize) != dataSize) {
        tempFile.close();
        FFat.remove(tempPath);
        return StorageResult::WRITE_FAILED;
    }
    
    tempFile.close();
    
    // Atomically rename temp file to final name
    if (!FFat.rename(tempPath, filePath)) {
        FFat.remove(tempPath);
        return StorageResult::WRITE_FAILED;
    }
    
    return StorageResult::SUCCESS;
}

StorageResult Storage::readFileWithValidation(const String& filePath, uint8_t* buffer, size_t& dataSize) {
    if (!fileExists(filePath)) {
        return StorageResult::FILE_NOT_FOUND;
    }
    
    if (!validateFileIntegrity(filePath)) {
        return StorageResult::CORRUPTION_DETECTED;
    }
    
    File file = FFat.open(filePath, "r");
    if (!file) {
        return StorageResult::READ_FAILED;
    }
    
    size_t fileSize = file.size();
    if (fileSize > BUFFER_SIZE) {
        file.close();
        return StorageResult::INVALID_SIZE;
    }
    
    size_t bytesRead = file.read(buffer, fileSize);
    file.close();
    
    if (bytesRead != fileSize) {
        return StorageResult::READ_FAILED;
    }
    
    dataSize = bytesRead;
    return StorageResult::SUCCESS;
}