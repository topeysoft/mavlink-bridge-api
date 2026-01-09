#pragma once

#include <Arduino.h>
#include <functional>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <freertos/queue.h>
#include "../USBOTGManager/USBOTGManager.h"
#include "../UARTManager/UARTManager.h"
#include "../../mavlink/MAVLinkProcessor/MAVLinkProcessor.h"

template<typename T, size_t Size>
class CircularBuffer {
private:
    T buffer[Size];
    size_t head;
    size_t tail;
    size_t count;
    
public:
    CircularBuffer() : head(0), tail(0), count(0) {}
    
    bool push(const T& item) {
        if (count >= Size) {
            return false;
        }
        
        buffer[head] = item;
        head = (head + 1) % Size;
        count++;
        return true;
    }
    
    bool pop(T& item) {
        if (count == 0) {
            return false;
        }
        
        item = buffer[tail];
        tail = (tail + 1) % Size;
        count--;
        return true;
    }
    
    bool empty() const { return count == 0; }
    bool full() const { return count >= Size; }
    size_t size() const { return count; }
    size_t capacity() const { return Size; }
};

class DataRouter {
public:
    enum Interface {
        NONE,
        USB_OTG,
        UART
    };
    
    enum RoutingMode {
        AUTO,           
        USB_PRIORITY,   
        UART_ONLY,      
        USB_ONLY        
    };
    
    struct RouteStats {
        Interface activeInterface;
        uint32_t upstreamBytes;
        uint32_t downstreamBytes;
        uint32_t upstreamPackets;
        uint32_t downstreamPackets;
        float upstreamRate;
        float downstreamRate;
        uint32_t lastUpdateMs;
        uint32_t interfaceSwitches;
        uint32_t lastSwitchMs;
    };
    
private:
    static DataRouter* instance;
    Interface activeInterface;
    Interface preferredInterface;
    RoutingMode mode;
    RouteStats stats;
    
    MAVLinkProcessor* mavlinkProcessor;
    USBOTGManager* usbManager;
    UARTManager* uartManager;
    
    CircularBuffer<uint8_t, 8192> upstreamBuffer;   
    CircularBuffer<uint8_t, 8192> downstreamBuffer; 
    
    TaskHandle_t routerTask;
    SemaphoreHandle_t routerMutex;
    QueueHandle_t upstreamQueue;
    QueueHandle_t downstreamQueue;
    
    bool mavlinkProcessingEnabled;
    bool initialized;
    
    std::function<void(Interface, Interface)> interfaceSwitchCallback;
    std::function<void(const RouteStats&)> statsCallback;
    
    uint32_t interfaceHealthCheck[3]; 
    uint32_t lastHealthCheck;
    
public:
    static DataRouter* getInstance();
    bool begin(RoutingMode mode = AUTO);
    void end();
    
    void setRoutingMode(RoutingMode mode);
    RoutingMode getRoutingMode() const;
    Interface getActiveInterface() const;
    Interface getPreferredInterface() const;
    bool switchInterface(Interface iface);
    
    void routeUpstream(const uint8_t* data, size_t length);
    void routeDownstream(const uint8_t* data, size_t length);
    
    void enableMAVLinkProcessing(bool enable);
    bool isMAVLinkProcessingEnabled() const;
    void setMAVLinkFilter(const MAVLinkProcessor::Filter& filter);
    
    RouteStats getStatistics() const;
    void resetStatistics();
    
    void onInterfaceSwitch(std::function<void(Interface, Interface)> callback);
    void onStatistics(std::function<void(const RouteStats&)> callback);
    
    static const char* interfaceToString(Interface iface);
    static const char* routingModeToString(RoutingMode mode);
    
private:
    DataRouter();
    ~DataRouter();
    
    static void routerTaskFunction(void* parameter);
    void processRouting();
    void detectActiveInterface();
    void handleInterfaceSwitch(Interface newInterface);
    bool validateInterface(Interface iface);
    void updateInterfaceHealth();
    void updateStatistics();
    
    void handleUSBData(uint8_t* data, size_t length);
    void handleUARTData(uint8_t* data, size_t length);
    void handleMAVLinkMessage(const MAVLinkMessage& message);
    
    bool sendToInterface(Interface iface, const uint8_t* data, size_t length);
    size_t readFromInterface(Interface iface, uint8_t* buffer, size_t maxLength);
    bool isInterfaceConnected(Interface iface);
    
    struct DataPacket {
        uint8_t data[256];
        size_t length;
        Interface source;
        uint32_t timestamp;
    };
};