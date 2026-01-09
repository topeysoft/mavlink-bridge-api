#pragma once

// Check if we're on ESP32-S3 with proper USB host support
#ifdef CONFIG_IDF_TARGET_ESP32S3

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include <esp_err.h>
#include <esp_log.h>

// ESP-IDF USB Host includes
extern "C" {
#include <usb/usb_host.h>
}

// Buffer size for USB communication
#ifndef USB_OTG_BUFFER_SIZE
#define USB_OTG_BUFFER_SIZE 1024
#endif

// USB Device information structure
struct USBDeviceInfo {
    uint16_t vid;
    uint16_t pid;
    String vendor;
    String product;
    String serial;
    uint8_t deviceAddress;
    uint8_t interfaceNumber;
    bool isConnected;
    bool isFlightController;
    
    USBDeviceInfo() : vid(0), pid(0), deviceAddress(0), interfaceNumber(0), isConnected(false), isFlightController(false) {}
};

// USB Host Event types
enum USBHostEvent {
    USB_HOST_DEVICE_CONNECTED,
    USB_HOST_DEVICE_DISCONNECTED,
    USB_HOST_DATA_RECEIVED,
    USB_HOST_ERROR
};

// USB Host Event message
struct USBHostEventMessage {
    USBHostEvent event;
    uint8_t device_address;
    size_t data_len;
    uint8_t data[USB_OTG_BUFFER_SIZE];
};

// USB Host implementation class
class USBHostImpl {
public:
    USBHostImpl();
    ~USBHostImpl();
    
    // Initialization
    bool begin();
    void end();
    bool isInitialized() const { return initialized; }
    
    // Device status
    bool isDeviceConnected() const { return deviceConnected; }
    USBDeviceInfo getDeviceInfo() const { return deviceInfo; }
    uint8_t getDeviceAddress() const { return deviceInfo.deviceAddress; }
    
    // Communication interface (similar to Serial)
    size_t available();
    size_t write(const uint8_t* data, size_t len);
    size_t read(uint8_t* buffer, size_t len);
    int read();
    void flush();
    
    // Configuration
    bool setBaudRate(uint32_t baud_rate);
    uint32_t getBaudRate() const { return baudRate; }
    
    // Event handling
    void handleEvents();
    
    // Statistics
    struct Statistics {
        uint32_t devicesConnected;
        uint32_t devicesDisconnected;
        uint32_t bytesReceived;
        uint32_t bytesSent;
        uint32_t messagesReceived;
        uint32_t messagesSent;
        uint32_t errors;
        uint32_t lastEventTime;
        uint32_t lastActivity;
    };
    
    Statistics getStatistics() const { return stats; }
    
private:
    // State
    bool initialized;
    bool deviceConnected;
    USBDeviceInfo deviceInfo;
    Statistics stats;
    uint32_t baudRate;
    
    // USB Host handles
    usb_host_client_handle_t clientHandle;
    usb_device_handle_t deviceHandle;
    
    // Task and synchronization
    TaskHandle_t usbHostTaskHandle;
    TaskHandle_t classDriverTaskHandle;
    QueueHandle_t eventQueue;
    SemaphoreHandle_t usbMutex;
    
    // Device management
    uint8_t pendingDevices[16];
    int pendingDeviceCount;
    bool enumerationFilterEnabled;
    
    // USB Transfer management
    usb_transfer_t* bulkInTransfer;
    usb_transfer_t* bulkOutTransfer;
    uint8_t bulkInEpAddr;
    uint8_t bulkOutEpAddr;
    bool transfersActive;
    
    // Transfer state tracking
    volatile bool bulkOutTransferInProgress;
    SemaphoreHandle_t transferCompleteSemaphore;
    uint32_t transferTimeoutMs;
    
    // Recovery mechanism
    uint32_t consecutiveTransferFailures;
    uint32_t lastTransferFailureTime;
    static const uint32_t MAX_CONSECUTIVE_FAILURES = 5;
    static const uint32_t RECOVERY_DELAY_MS = 1000;
    
    // Data buffers
    uint8_t rxBuffer[USB_OTG_BUFFER_SIZE];
    uint8_t txBuffer[USB_OTG_BUFFER_SIZE];
    size_t rxBufferHead;
    size_t rxBufferTail;
    size_t rxBufferCount;
    
    // Callbacks
    static void usbHostLibTask(void* arg);
    static void clientEventCallback(const usb_host_client_event_msg_t* eventMsg, void* arg);
    static void classDriverTask(void* arg);
    static bool enumerationFilterCallback(const usb_device_desc_t* device_desc, uint8_t* bConfigurationValue);
    
    // USB transfer callbacks
    static void bulkInTransferCallback(usb_transfer_t* transfer);
    static void bulkOutTransferCallback(usb_transfer_t* transfer);
    
    // Internal methods
    bool initializeUSBHost();
    void cleanupUSBHost();
    bool openDevice(uint8_t deviceAddress);
    void closeDevice();
    void updateDeviceInfo(usb_device_handle_t deviceHandle);
    bool isFlightControllerDevice(uint16_t vid, uint16_t pid);
    const char* getVendorName(uint16_t vid);
    const char* getProductName(uint16_t vid, uint16_t pid);
    
    // Class driver methods (based on ESP-IDF example)
    bool classDriverActionOpenDev(uint8_t dev_addr);
    bool classDriverActionGetInfo();
    bool classDriverActionGetDesc();
    bool classDriverActionGetConfigDesc();
    bool classDriverActionGetStrDesc();
    bool classDriverActionCloseDev();
    
    // CDC-ACM communication methods
    bool initializeCDCCommunication();
    void startCDCTransfers();
    bool findUSBEndpoints();
    bool setupUSBTransfers();
    void stopUSBTransfers();
    
    // Helper methods
    void logUSBEvent(const char* event, const char* details = nullptr);
    
    // Recovery methods
    void handleTransferFailure();
    bool shouldAttemptRecovery();
    void performRecovery();
    
    // Endpoint validation
    bool validateEndpoint(uint8_t endpointAddr);
    bool validateEndpoints();
};

#endif // CONFIG_IDF_TARGET_ESP32S3