#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <functional>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

enum class EventType {
    CONFIG_CHANGED,
    WIFI_CONNECTING,
    WIFI_CONNECTED,
    WIFI_DISCONNECTED,
    WIFI_SIGNAL_UPDATE,
    WIFI_AP_MODE_STARTED,
    WIFI_AP_MODE_STOPPED,
    WIFI_SCAN_COMPLETED,
    RTCM_DATA_RECEIVED,
    RTCM_CLIENT_STARTED,
    RTCM_CLIENT_STOPPED,
    USB_CONNECTED,
    USB_DISCONNECTED,
    UART_CONNECTED,
    UART_DISCONNECTED,
    INTERFACE_SWITCHED,
    MAVLINK_MESSAGE,
    COMMUNICATION_STATS,
    SYSTEM_ERROR,
    HEALTH_UPDATE,
    MEMORY_LOW
};

struct Event {
    EventType type;
    DynamicJsonDocument payload;
    unsigned long timestamp;
    
    Event(EventType t = EventType::SYSTEM_ERROR, size_t payloadSize = 256) 
        : type(t), payload(payloadSize), timestamp(millis()) {}
};

using EventHandler = std::function<void(const Event&)>;

struct EventSubscription {
    EventType eventType;
    EventHandler handler;
    bool isActive;
    
    EventSubscription() : eventType(EventType::SYSTEM_ERROR), handler(nullptr), isActive(false) {}
    EventSubscription(EventType type, EventHandler h) : eventType(type), handler(h), isActive(true) {}
};

class EventManager {
private:
    static EventManager* instance;
    
    static const uint8_t MAX_SUBSCRIPTIONS = 32;
    static const uint8_t MAX_QUEUED_EVENTS = 10;
    static const size_t EVENT_TASK_STACK_SIZE = 2048;
    static const UBaseType_t EVENT_TASK_PRIORITY = 1;
    
    EventSubscription subscriptions[MAX_SUBSCRIPTIONS];
    uint8_t subscriptionCount;
    
    QueueHandle_t eventQueue;
    TaskHandle_t eventTaskHandle;
    SemaphoreHandle_t subscriptionMutex;
    
    bool isRunning;
    
    static void eventTaskWrapper(void* parameter);
    void eventTask();
    void processEvent(const Event& event);
    void notifySubscribers(const Event& event);
    
public:
    EventManager();
    ~EventManager();
    
    static EventManager* getInstance();
    void begin();
    void stop();
    
    bool subscribe(EventType eventType, EventHandler handler);
    bool unsubscribe(EventType eventType);
    
    void publish(EventType eventType);
    void publish(EventType eventType, const JsonObjectConst& payload);
    void publishAsync(EventType eventType);
    void publishAsync(EventType eventType, const JsonObjectConst& payload);
    
    uint8_t getSubscriptionCount() const { return subscriptionCount; }
    bool isEventQueued() const;
    uint8_t getQueuedEventCount() const;
    
    String eventTypeToString(EventType type) const;
    EventType stringToEventType(const String& typeStr) const;
};