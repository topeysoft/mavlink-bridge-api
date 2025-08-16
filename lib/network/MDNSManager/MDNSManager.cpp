#include "MDNSManager.h"
#include <WiFi.h>

namespace NetworkLib
{

    MDNSManager *MDNSManager::instance = nullptr;

    MDNSManager::MDNSManager()
        : eventManager(nullptr), configManager(nullptr), isInitialized(false),
          isEnabled(false), hostname("yardrover"), discoveryTaskHandle(nullptr),
          servicesMutex(nullptr), lastDiscoveryTime(0)
    {

        eventManager = EventManager::getInstance();
        configManager = ConfigManager::getInstance();

        servicesMutex = xSemaphoreCreateMutex();
    }

    MDNSManager::~MDNSManager()
    {
        end();
        if (servicesMutex != nullptr)
        {
            vSemaphoreDelete(servicesMutex);
        }
    }

    MDNSManager *MDNSManager::getInstance()
    {
        if (instance == nullptr)
        {
            instance = new MDNSManager();
        }
        return instance;
    }

    bool MDNSManager::begin()
    {
        if (isInitialized)
        {
            return true;
        }

        if (WiFi.status() != WL_CONNECTED)
        {
            Serial.println("MDNSManager: WiFi not connected, cannot start mDNS");
            return false;
        }

        // Get configuration
        const Configuration &config = configManager->getConfiguration();
        if (config.device.name.length() > 0)
        {
            hostname = config.device.name;
            hostname.toLowerCase();
            hostname.replace(" ", "-");
        }

        // Initialize mDNS
        if (!MDNS.begin(hostname.c_str()))
        {
            Serial.println("MDNSManager: Failed to start mDNS");
            return false;
        }

        Serial.printf("MDNSManager: Started with hostname: %s.local\n", hostname.c_str());

        isInitialized = true;
        isEnabled = true;

        // Setup default services
        setupDefaultServices();

        // Start discovery task
        xTaskCreate(
            discoveryTaskFunction,
            "MDNSDiscovery",
            4096,
            this,
            1,
            &discoveryTaskHandle);

        return true;
    }

    void MDNSManager::end()
    {
        if (!isInitialized)
        {
            return;
        }

        stopDiscovery();
        removeAllServices();

        if (discoveryTaskHandle != nullptr)
        {
            vTaskDelete(discoveryTaskHandle);
            discoveryTaskHandle = nullptr;
        }

        MDNS.end();
        isInitialized = false;
        isEnabled = false;

        Serial.println("MDNSManager: Stopped");
    }

    bool MDNSManager::addService(const String &serviceName, const String &serviceType, uint16_t port)
    {
        return addService(serviceName, serviceType, port, "");
    }

    bool MDNSManager::addService(const String &serviceName, const String &serviceType, uint16_t port, const String &txtRecords)
    {
        if (!isInitialized || !isEnabled)
        {
            return false;
        }

        if (xSemaphoreTake(servicesMutex, pdMS_TO_TICKS(1000)) == pdTRUE)
        {
            // Check if service already exists
            for (const auto &service : advertisedServices)
            {
                if (service.serviceType == serviceType && service.port == port)
                {
                    xSemaphoreGive(servicesMutex);
                    return true; // Already advertised
                }
            }

            // Add to mDNS
            if (!MDNS.addService(serviceType.c_str(), "tcp", port))
            {
                xSemaphoreGive(servicesMutex);
                Serial.printf("MDNSManager: Failed to add service %s on port %u\n", serviceType.c_str(), port);
                return false;
            }

            // Add TXT records if provided
            if (txtRecords.length() > 0)
            {
                // Parse and add TXT records
                int start = 0;
                int end = txtRecords.indexOf(';');
                while (end != -1 || start < txtRecords.length())
                {
                    if (end == -1)
                        end = txtRecords.length();

                    String record = txtRecords.substring(start, end);
                    int equalPos = record.indexOf('=');
                    if (equalPos != -1)
                    {
                        String key = record.substring(0, equalPos);
                        String value = record.substring(equalPos + 1);
                        MDNS.addServiceTxt(serviceType.c_str(), "tcp", key.c_str(), value.c_str());
                    }

                    start = end + 1;
                    end = txtRecords.indexOf(';', start);
                }
            }

            // Store service info
            MDNSService service(serviceName, serviceType, port);
            service.hostname = hostname;
            service.txtRecords = txtRecords;
            advertisedServices.push_back(service);

            xSemaphoreGive(servicesMutex);

            Serial.printf("MDNSManager: Added service %s (%s) on port %u\n",
                          serviceName.c_str(), serviceType.c_str(), port);
            return true;
        }

        return false;
    }

    bool MDNSManager::removeService(const String &serviceType, uint16_t port)
    {
        if (!isInitialized)
        {
            return false;
        }

        if (xSemaphoreTake(servicesMutex, pdMS_TO_TICKS(1000)) == pdTRUE)
        {
            // Remove from advertised services list
            for (auto it = advertisedServices.begin(); it != advertisedServices.end(); ++it)
            {
                if (it->serviceType == serviceType && it->port == port)
                {
                    advertisedServices.erase(it);
                    break;
                }
            }

            xSemaphoreGive(servicesMutex);

            Serial.printf("MDNSManager: Removed service %s on port %u\n", serviceType.c_str(), port);
            return true;
        }

        return false;
    }

    void MDNSManager::removeAllServices()
    {
        if (xSemaphoreTake(servicesMutex, pdMS_TO_TICKS(1000)) == pdTRUE)
        {
            advertisedServices.clear();
            xSemaphoreGive(servicesMutex);
        }
    }

    bool MDNSManager::startDiscovery(const String &serviceType)
    {
        if (!isInitialized || !isEnabled)
        {
            return false;
        }

        Serial.printf("MDNSManager: Starting discovery for %s services\n", serviceType.c_str());
        return true;
    }

    void MDNSManager::stopDiscovery()
    {
        // Discovery runs continuously in background task
        Serial.println("MDNSManager: Discovery continues in background");
    }

    std::vector<DiscoveredService> MDNSManager::getDiscoveredServices(const String &serviceType)
    {
        std::vector<DiscoveredService> result;

        if (xSemaphoreTake(servicesMutex, pdMS_TO_TICKS(1000)) == pdTRUE)
        {
            for (const auto &service : discoveredServices)
            {
                if (serviceType.isEmpty() || service.serviceType == serviceType)
                {
                    result.push_back(service);
                }
            }
            xSemaphoreGive(servicesMutex);
        }

        return result;
    }

    bool MDNSManager::isServiceAdvertised(const String &serviceType, uint16_t port) const
    {
        for (const auto &service : advertisedServices)
        {
            if (service.serviceType == serviceType && service.port == port)
            {
                return true;
            }
        }
        return false;
    }

    std::vector<MDNSService> MDNSManager::getAdvertisedServices() const
    {
        return advertisedServices;
    }

    void MDNSManager::setHostname(const String &name)
    {
        hostname = name;
        hostname.toLowerCase();
        hostname.replace(" ", "-");

        if (isInitialized)
        {
            // Restart mDNS with new hostname
            end();
            begin();
        }
    }

    void MDNSManager::setEnabled(bool enabled)
    {
        if (enabled && !isEnabled)
        {
            isEnabled = true;
            if (!isInitialized)
            {
                begin();
            }
        }
        else if (!enabled && isEnabled)
        {
            isEnabled = false;
            if (isInitialized)
            {
                end();
            }
        }
    }

    void MDNSManager::update()
    {
        if (!isInitialized || !isEnabled)
        {
            return;
        }

        unsigned long now = millis();

        // Clean up expired services periodically
        if (now - lastDiscoveryTime > DISCOVERY_INTERVAL)
        {
            cleanupExpiredServices();
            lastDiscoveryTime = now;
        }
    }

    void MDNSManager::discoveryTaskFunction(void *parameter)
    {
        MDNSManager *manager = static_cast<MDNSManager *>(parameter);
        manager->runDiscoveryTask();
    }

    void MDNSManager::runDiscoveryTask()
    {
        TickType_t xLastWakeTime = xTaskGetTickCount();
        const TickType_t xFrequency = pdMS_TO_TICKS(30000); // 30 seconds

        while (true)
        {
            if (isInitialized && isEnabled && WiFi.status() == WL_CONNECTED)
            {
                // Discover RTCM services
                int numServices = MDNS.queryService("rtcm", "tcp");

                if (xSemaphoreTake(servicesMutex, pdMS_TO_TICKS(1000)) == pdTRUE)
                {
                    unsigned long now = millis();

                    for (int i = 0; i < numServices; i++)
                    {
                        DiscoveredService service;
                        service.hostname = MDNS.hostname(i);
                        service.serviceName = MDNS.hostname(i);
                        service.serviceType = "rtcm";
                        service.ip = MDNS.address(i);
                        service.port = MDNS.port(i);
                        service.lastSeen = now;

                        // Check if this service already exists
                        bool found = false;
                        for (auto &existing : discoveredServices)
                        {
                            if (existing.hostname == service.hostname &&
                                existing.serviceType == service.serviceType &&
                                existing.port == service.port)
                            {
                                existing.lastSeen = now;
                                existing.ip = service.ip; // Update IP in case it changed
                                found = true;
                                break;
                            }
                        }

                        if (!found)
                        {
                            discoveredServices.push_back(service);
                            publishDiscoveryEvent(service, true);
                            Serial.printf("MDNSManager: Discovered RTCM service: %s (%s:%u)\n",
                                          service.hostname.c_str(), service.ip.toString().c_str(), service.port);
                        }
                    }

                    xSemaphoreGive(servicesMutex);
                }
            }

            vTaskDelayUntil(&xLastWakeTime, xFrequency);
        }
    }

    void MDNSManager::cleanupExpiredServices()
    {
        if (xSemaphoreTake(servicesMutex, pdMS_TO_TICKS(1000)) == pdTRUE)
        {
            unsigned long now = millis();

            for (auto it = discoveredServices.begin(); it != discoveredServices.end();)
            {
                if (now - it->lastSeen > SERVICE_TIMEOUT)
                {
                    Serial.printf("MDNSManager: Service expired: %s\n", it->hostname.c_str());
                    publishDiscoveryEvent(*it, false);
                    it = discoveredServices.erase(it);
                }
                else
                {
                    ++it;
                }
            }

            xSemaphoreGive(servicesMutex);
        }
    }

    void MDNSManager::publishDiscoveryEvent(const DiscoveredService &service, bool added)
    {
        if (eventManager)
        {
            DynamicJsonDocument doc(512);
            doc["event"] = added ? "service_discovered" : "service_lost";
            doc["hostname"] = service.hostname;
            doc["service_type"] = service.serviceType;
            doc["ip"] = service.ip.toString();
            doc["port"] = service.port;
            doc["timestamp"] = millis();

            eventManager->publishAsync(::EventType::MDNS_DISCOVERY, doc.as<JsonObjectConst>());
        }
    }

    String MDNSManager::createTxtRecord(const String &key, const String &value)
    {
        return key + "=" + value;
    }

    String MDNSManager::combineTxtRecords(const std::vector<String> &records)
    {
        String result;
        for (size_t i = 0; i < records.size(); i++)
        {
            if (i > 0)
                result += ";";
            result += records[i];
        }
        return result;
    }

    void MDNSManager::onWiFiEvent(arduino_event_id_t event)
    {
        switch (event)
        {
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            if (!isInitialized && isEnabled)
            {
                begin();
            }
            break;

        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            if (isInitialized)
            {
                end();
            }
            break;

        default:
            break;
        }
    }

    void MDNSManager::setupDefaultServices()
    {
        const Configuration &config = configManager->getConfiguration();

        // Create TXT records with device info
        std::vector<String> txtRecords;
        txtRecords.push_back(createTxtRecord("version", String(config.version)));
        txtRecords.push_back(createTxtRecord("mode", config.device.mode));
        txtRecords.push_back(createTxtRecord("type", "yardrover"));

        String txtData = combineTxtRecords(txtRecords);

        // Advertise HTTP API
        addService("YardRover API", "_http", 80, txtData);

        // Advertise WebSocket
        addService("YardRover WebSocket", "_ws", 80, txtData);

        Serial.println("MDNSManager: Default services configured");
    }

} // namespace NetworkLib