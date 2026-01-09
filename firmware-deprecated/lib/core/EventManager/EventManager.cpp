#include "EventManager.h"

EventManager* EventManager::instance = nullptr;

EventManager::EventManager() 
    : subscriptionCount(0), eventQueue(nullptr), eventTaskHandle(nullptr), subscriptionMutex(nullptr), isRunning(false) {
    for (uint8_t i = 0; i < MAX_SUBSCRIPTIONS; i++) {
        subscriptions[i] = EventSubscription();
    }
}

EventManager::~EventManager() {
    stop();
}

EventManager* EventManager::getInstance() {
    if (instance == nullptr) {
        instance = new EventManager();
    }
    return instance;
}

void EventManager::begin() {
    if (isRunning) {
        return;
    }
    
    subscriptionMutex = xSemaphoreCreateMutex();
    if (subscriptionMutex == nullptr) {
        return;
    }
    
    eventQueue = xQueueCreate(MAX_QUEUED_EVENTS, sizeof(Event));
    if (eventQueue == nullptr) {
        vSemaphoreDelete(subscriptionMutex);
        subscriptionMutex = nullptr;
        return;
    }
    
    BaseType_t result = xTaskCreate(
        eventTaskWrapper,
        "EventManager",
        EVENT_TASK_STACK_SIZE,
        this,
        EVENT_TASK_PRIORITY,
        &eventTaskHandle
    );
    
    if (result == pdPASS) {
        isRunning = true;
    } else {
        vQueueDelete(eventQueue);
        vSemaphoreDelete(subscriptionMutex);
        eventQueue = nullptr;
        subscriptionMutex = nullptr;
        eventTaskHandle = nullptr;
    }
}

void EventManager::stop() {
    if (!isRunning) {
        return;
    }
    
    isRunning = false;
    
    if (eventTaskHandle != nullptr) {
        vTaskDelete(eventTaskHandle);
        eventTaskHandle = nullptr;
    }
    
    if (eventQueue != nullptr) {
        vQueueDelete(eventQueue);
        eventQueue = nullptr;
    }
    
    if (subscriptionMutex != nullptr) {
        vSemaphoreDelete(subscriptionMutex);
        subscriptionMutex = nullptr;
    }
}

void EventManager::eventTaskWrapper(void* parameter) {
    EventManager* eventManager = static_cast<EventManager*>(parameter);
    eventManager->eventTask();
}

void EventManager::eventTask() {
    Event event;
    
    while (isRunning) {
        if (xQueueReceive(eventQueue, &event, portMAX_DELAY) == pdPASS) {
            processEvent(event);
        }
    }
    
    vTaskDelete(nullptr);
}

void EventManager::processEvent(const Event& event) {
    notifySubscribers(event);
}

void EventManager::notifySubscribers(const Event& event) {
    if (xSemaphoreTake(subscriptionMutex, portMAX_DELAY) == pdTRUE) {
        for (uint8_t i = 0; i < subscriptionCount; i++) {
            if (subscriptions[i].isActive && 
                subscriptions[i].eventType == event.type && 
                subscriptions[i].handler != nullptr) {
                
                try {
                    subscriptions[i].handler(event);
                } catch (...) {
                    // Handle exceptions silently to prevent task crashes
                }
            }
        }
        xSemaphoreGive(subscriptionMutex);
    }
}

bool EventManager::subscribe(EventType eventType, EventHandler handler) {
    if (handler == nullptr || subscriptionCount >= MAX_SUBSCRIPTIONS) {
        return false;
    }
    
    if (xSemaphoreTake(subscriptionMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        subscriptions[subscriptionCount] = EventSubscription(eventType, handler);
        subscriptionCount++;
        xSemaphoreGive(subscriptionMutex);
        return true;
    }
    
    return false;
}

bool EventManager::unsubscribe(EventType eventType) {
    if (xSemaphoreTake(subscriptionMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        for (uint8_t i = 0; i < subscriptionCount; i++) {
            if (subscriptions[i].eventType == eventType && subscriptions[i].isActive) {
                subscriptions[i].isActive = false;
                
                // Compact the array
                for (uint8_t j = i; j < subscriptionCount - 1; j++) {
                    subscriptions[j] = subscriptions[j + 1];
                }
                subscriptionCount--;
                
                xSemaphoreGive(subscriptionMutex);
                return true;
            }
        }
        xSemaphoreGive(subscriptionMutex);
    }
    
    return false;
}

void EventManager::publish(EventType eventType) {
    Event event(eventType);
    processEvent(event);
}

void EventManager::publish(EventType eventType, const JsonObjectConst& payload) {
    Event event(eventType);
    event.payload.set(payload);
    processEvent(event);
}

void EventManager::publishAsync(EventType eventType) {
    if (!isRunning || eventQueue == nullptr) {
        return;
    }
    
    Event event(eventType);
    xQueueSend(eventQueue, &event, 0);
}

void EventManager::publishAsync(EventType eventType, const JsonObjectConst& payload) {
    if (!isRunning || eventQueue == nullptr) {
        return;
    }
    
    Event event(eventType);
    event.payload.set(payload);
    xQueueSend(eventQueue, &event, 0);
}

bool EventManager::isEventQueued() const {
    if (eventQueue == nullptr) {
        return false;
    }
    
    return uxQueueMessagesWaiting(eventQueue) > 0;
}

uint8_t EventManager::getQueuedEventCount() const {
    if (eventQueue == nullptr) {
        return 0;
    }
    
    return uxQueueMessagesWaiting(eventQueue);
}

String EventManager::eventTypeToString(EventType type) const {
    switch (type) {
        case EventType::CONFIG_CHANGED: return "config_changed";
        case EventType::WIFI_CONNECTING: return "wifi_connecting";
        case EventType::WIFI_CONNECTED: return "wifi_connected";
        case EventType::WIFI_DISCONNECTED: return "wifi_disconnected";
        case EventType::WIFI_SIGNAL_UPDATE: return "wifi_signal_update";
        case EventType::WIFI_AP_MODE_STARTED: return "wifi_ap_mode_started";
        case EventType::WIFI_AP_MODE_STOPPED: return "wifi_ap_mode_stopped";
        case EventType::WIFI_SCAN_COMPLETED: return "wifi_scan_completed";
        case EventType::RTCM_DATA_RECEIVED: return "rtcm_data_received";
        case EventType::RTCM_CLIENT_STARTED: return "rtcm_client_started";
        case EventType::RTCM_CLIENT_STOPPED: return "rtcm_client_stopped";
        case EventType::USB_CONNECTED: return "usb_connected";
        case EventType::USB_DISCONNECTED: return "usb_disconnected";
        case EventType::SYSTEM_ERROR: return "system_error";
        case EventType::HEALTH_UPDATE: return "health_update";
        case EventType::MEMORY_LOW: return "memory_low";
        default: return "unknown";
    }
}

EventType EventManager::stringToEventType(const String& typeStr) const {
    if (typeStr == "config_changed") return EventType::CONFIG_CHANGED;
    if (typeStr == "wifi_connecting") return EventType::WIFI_CONNECTING;
    if (typeStr == "wifi_connected") return EventType::WIFI_CONNECTED;
    if (typeStr == "wifi_disconnected") return EventType::WIFI_DISCONNECTED;
    if (typeStr == "wifi_signal_update") return EventType::WIFI_SIGNAL_UPDATE;
    if (typeStr == "wifi_ap_mode_started") return EventType::WIFI_AP_MODE_STARTED;
    if (typeStr == "wifi_ap_mode_stopped") return EventType::WIFI_AP_MODE_STOPPED;
    if (typeStr == "wifi_scan_completed") return EventType::WIFI_SCAN_COMPLETED;
    if (typeStr == "rtcm_data_received") return EventType::RTCM_DATA_RECEIVED;
    if (typeStr == "rtcm_client_started") return EventType::RTCM_CLIENT_STARTED;
    if (typeStr == "rtcm_client_stopped") return EventType::RTCM_CLIENT_STOPPED;
    if (typeStr == "usb_connected") return EventType::USB_CONNECTED;
    if (typeStr == "usb_disconnected") return EventType::USB_DISCONNECTED;
    if (typeStr == "system_error") return EventType::SYSTEM_ERROR;
    if (typeStr == "health_update") return EventType::HEALTH_UPDATE;
    if (typeStr == "memory_low") return EventType::MEMORY_LOW;
    return EventType::SYSTEM_ERROR;
}