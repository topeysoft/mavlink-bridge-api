#pragma once

#include "MDNSManager.h"
#include "../../rtcm/RTCMCommon.h"
#include <functional>

namespace NetworkLib
{

    struct RTCMServerInfo
    {
        String hostname;
        String friendlyName;
        IPAddress ip;
        uint16_t port;
        String protocol; // "tcp" or "udp"
        String mountpoint;
        bool requiresAuth;
        unsigned long lastSeen;

        RTCMServerInfo() : port(0), requiresAuth(false), lastSeen(0) {}
    };

    using RTCMServerFoundCallback = std::function<void(const RTCMServerInfo &)>;
    using RTCMServerLostCallback = std::function<void(const RTCMServerInfo &)>;

    class MDNSRTCMDiscovery
    {
    private:
        MDNSManager *mdnsManager;

        std::vector<RTCMServerInfo> discoveredServers;
        RTCMServerFoundCallback foundCallback;
        RTCMServerLostCallback lostCallback;

        SemaphoreHandle_t serversMutex;
        TaskHandle_t discoveryTaskHandle;

        bool isRunning;
        unsigned long lastDiscoveryTime;
        static const unsigned long DISCOVERY_INTERVAL = 15000; // 15 seconds
        static const unsigned long SERVER_TIMEOUT = 60000;     // 1 minute

    public:
        MDNSRTCMDiscovery(MDNSManager *manager);
        ~MDNSRTCMDiscovery();

        bool startDiscovery();
        void stopDiscovery();

        std::vector<RTCMServerInfo> getDiscoveredServers() const;
        RTCMServerInfo *findServer(const String &hostname);
        RTCMServerInfo *findServerByIP(const IPAddress &ip, uint16_t port);

        void setServerFoundCallback(RTCMServerFoundCallback callback) { foundCallback = callback; }
        void setServerLostCallback(RTCMServerLostCallback callback) { lostCallback = callback; }

        bool isDiscoveryRunning() const { return isRunning; }

        // Static helper methods
        static String createConnectionString(const RTCMServerInfo &server);
        static bool parseConnectionString(const String &connectionString, RTCMServerInfo &server);

    private:
        static void discoveryTaskFunction(void *parameter);
        void runDiscoveryTask();

        void processDiscoveredService(const DiscoveredService &service);
        void cleanupExpiredServers();

        RTCMServerInfo createServerInfo(const DiscoveredService &service);
        String parseTxtRecord(const String &txtRecords, const String &key);
    };

} // namespace NetworkLib