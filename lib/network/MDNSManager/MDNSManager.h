#pragma once

#include "../NetworkCommon.h"
#include "EventManager/EventManager.h"
#include "ConfigManager/ConfigManager.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include <vector>
#include <functional>

namespace NetworkLib
{

    struct MDNSService
    {
        String serviceName;
        String serviceType;
        uint16_t port;
        String hostname;
        String txtRecords;

        MDNSService() : port(0) {}
        MDNSService(const String &name, const String &type, uint16_t p)
            : serviceName(name), serviceType(type), port(p) {}
    };

    struct DiscoveredService
    {
        String hostname;
        String serviceName;
        String serviceType;
        IPAddress ip;
        uint16_t port;
        String txtRecords;
        unsigned long lastSeen;

        DiscoveredService() : port(0), lastSeen(0) {}
    };

    class MDNSManager
    {
    private:
        static MDNSManager *instance;

        EventManager *eventManager;
        ConfigManager *configManager;

        bool isInitialized;
        bool isEnabled;
        String hostname;

        std::vector<MDNSService> advertisedServices;
        std::vector<DiscoveredService> discoveredServices;

        TaskHandle_t discoveryTaskHandle;
        SemaphoreHandle_t servicesMutex;

        unsigned long lastDiscoveryTime;
        static const unsigned long DISCOVERY_INTERVAL = 30000; // 30 seconds
        static const unsigned long SERVICE_TIMEOUT = 120000;   // 2 minutes

        MDNSManager();

    public:
        ~MDNSManager();

        static MDNSManager *getInstance();

        bool begin();
        void end();

        bool addService(const String &serviceName, const String &serviceType, uint16_t port);
        bool addService(const String &serviceName, const String &serviceType, uint16_t port, const String &txtRecords);
        bool removeService(const String &serviceType, uint16_t port);
        void removeAllServices();

        bool startDiscovery(const String &serviceType);
        void stopDiscovery();
        std::vector<DiscoveredService> getDiscoveredServices(const String &serviceType = "");

        bool isServiceAdvertised(const String &serviceType, uint16_t port) const;
        std::vector<MDNSService> getAdvertisedServices() const;

        void setHostname(const String &name);
        String getHostname() const { return hostname; }

        bool getEnabled() const { return isEnabled; }
        void setEnabled(bool enabled);

        void update();

    private:
        static void discoveryTaskFunction(void *parameter);
        void runDiscoveryTask();

        void cleanupExpiredServices();
        void publishDiscoveryEvent(const DiscoveredService &service, bool added);

        String createTxtRecord(const String &key, const String &value);
        String combineTxtRecords(const std::vector<String> &records);

        void onWiFiEvent(arduino_event_id_t event);
        void setupDefaultServices();

        friend class WiFiManager;
    };

} // namespace NetworkLib