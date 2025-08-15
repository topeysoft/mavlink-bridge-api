#pragma once

#include <Arduino.h>
#include <HardwareSerial.h>
#include <functional>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

class UARTManager {
public:
    enum BaudRate {
        BAUD_57600 = 57600,
        BAUD_115200 = 115200,
        BAUD_230400 = 230400,
        BAUD_460800 = 460800,
        BAUD_921600 = 921600
    };
    
    struct Config {
        uint8_t rxPin;
        uint8_t txPin;
        BaudRate baudRate;
        bool autoBaud;
        bool flowControl;
        uint8_t rtsPin;
        uint8_t ctsPin;
        uint8_t uartNum;
    };
    
    struct Statistics {
        uint32_t bytesReceived;
        uint32_t bytesSent;
        uint32_t packetsReceived;
        uint32_t packetsSent;
        float dataRate;
        uint32_t lastUpdateMs;
        uint32_t crcErrors;
        uint32_t framingErrors;
    };
    
private:
    static UARTManager* instance;
    Config config;
    Statistics stats;
    uint8_t rxBuffer[4096];
    uint8_t txBuffer[4096];
    size_t rxBufferPos;
    size_t txBufferPos;
    TaskHandle_t uartTask;
    SemaphoreHandle_t txMutex;
    SemaphoreHandle_t rxMutex;
    bool connected;
    bool initialized;
    
    std::function<void()> connectCallback;
    std::function<void()> disconnectCallback;
    std::function<void(uint8_t*, size_t)> dataCallback;
    
    HardwareSerial* serial;
    
    static const BaudRate SUPPORTED_BAUDS[];
    static const size_t SUPPORTED_BAUDS_COUNT;
    
public:
    static UARTManager* getInstance();
    bool begin(const Config& cfg);
    void end();
    
    BaudRate detectBaudRate();
    bool setBaudRate(BaudRate baud);
    BaudRate getCurrentBaudRate() const;
    
    size_t write(const uint8_t* data, size_t length);
    size_t read(uint8_t* buffer, size_t length);
    size_t available();
    void flush();
    
    bool detectMAVLink();
    bool isConnected() const;
    Statistics getStatistics() const;
    void resetStatistics();
    
    void onConnect(std::function<void()> callback);
    void onDisconnect(std::function<void()> callback);
    void onData(std::function<void(uint8_t*, size_t)> callback);
    
private:
    UARTManager();
    ~UARTManager();
    
    static void uartTaskFunction(void* parameter);
    void processIncomingData();
    void updateStatistics();
    bool testBaudRate(BaudRate baud);
    bool validateMAVLinkFrame(const uint8_t* data, size_t length);
    void handleConnectionChange(bool connected);
};