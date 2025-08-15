#pragma once

#include <Arduino.h>
#include <functional>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

class USBOTGManager {
public:
    enum State {
        NOT_INITIALIZED,
        INITIALIZED,
        CONNECTED,
        SUSPENDED,
        ERROR
    };
    
    struct Statistics {
        uint32_t bytesReceived;
        uint32_t bytesSent;
        uint32_t packetsReceived;
        uint32_t packetsSent;
        float dataRate;
        uint32_t lastUpdateMs;
    };
    
    struct DeviceInfo {
        uint16_t vid;
        uint16_t pid;
        String vendor;
        String product;
        bool isFlightController;
        bool isIdentified;
    };
    
private:
    static USBOTGManager* instance;
    State currentState;
    Statistics stats;
    DeviceInfo deviceInfo;
    uint8_t rxBuffer[4096];
    uint8_t txBuffer[4096];
    size_t rxBufferPos;
    size_t txBufferPos;
    TaskHandle_t usbTask;
    SemaphoreHandle_t txMutex;
    SemaphoreHandle_t rxMutex;
    
    std::function<void()> connectCallback;
    std::function<void()> disconnectCallback;
    std::function<void(uint8_t*, size_t)> dataCallback;
    
    bool initialized;
    
public:
    static USBOTGManager* getInstance();
    bool begin();
    void end();
    State getState() const;
    Statistics getStatistics() const;
    DeviceInfo getDeviceInfo() const;
    void resetStatistics();
    
    size_t write(const uint8_t* data, size_t length);
    size_t read(uint8_t* buffer, size_t length);
    size_t available();
    void flush();
    
    void onConnect(std::function<void()> callback);
    void onDisconnect(std::function<void()> callback);
    void onData(std::function<void(uint8_t*, size_t)> callback);
    
    bool isConnected() const;
    void handleUSBEvents();
    
private:
    USBOTGManager();
    ~USBOTGManager();
    
    static void usbTaskFunction(void* parameter);
    void processIncomingData();
    void updateStatistics();
    void identifyConnectedDevice(uint16_t vid, uint16_t pid);
    
    static void cdcRxCallback(uint8_t* buffer, uint32_t length);
    static void cdcTxCompleteCallback();
    static void deviceMountCallback();
    static void deviceUnmountCallback();
    static void deviceSuspendCallback(bool suspended);
};