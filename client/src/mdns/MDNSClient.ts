import { HttpClient } from '../core/HttpClient';
import {
  MDNSStatus,
  MDNSDiscoveryRequest,
  MDNSDiscoveryResponse,
  MDNSConfig,
  MDNSService,
  RTCMServerInfo
} from './MDNSTypes';

/**
 * Client for mDNS service discovery
 */
export class MDNSClient {
  constructor(private httpClient: HttpClient) {}

  /**
   * Get mDNS status including discovered and advertised services
   */
  async getStatus(): Promise<MDNSStatus> {
    return this.httpClient.get<MDNSStatus>('/api/mdns/status');
  }

  /**
   * Start mDNS discovery for a specific service type
   * @param serviceType The service type to discover (default: '_rtk-base._tcp')
   */
  async discover(serviceType: string = '_rtk-base._tcp'): Promise<MDNSDiscoveryResponse> {
    const request: MDNSDiscoveryRequest = { serviceType };
    return this.httpClient.post<MDNSDiscoveryResponse>('/api/mdns/discover', request);
  }

  /**
   * Discover RTCM base stations on the network
   * This is a convenience method that discovers both TCP and UDP RTK service types:
   * '_rtk-base._tcp', '_rtk._tcp', '_rtk-base._udp', and '_rtk._udp'
   */
  async discoverRTCMServers(): Promise<RTCMServerInfo[]> {
    // Search for both TCP and UDP RTK service types
    const serviceTypes = [
      '_rtk-base._tcp', '_rtk._tcp',     // TCP services
      '_rtk-base._udp', '_rtk._udp'      // UDP services
    ];
    const allServers: RTCMServerInfo[] = [];
    const seenKeys = new Set<string>(); // Use ip:port as unique key

    for (const serviceType of serviceTypes) {
      try {
        const response = await this.discover(serviceType);

        if (!response.services || response.services.length === 0) {
          continue;
        }

        // Determine protocol from service type if not in TXT records
        const isUdpService = serviceType.includes('._udp');

        // Convert MDNSService to RTCMServerInfo
        const servers = response.services.map(service => {
          // TXT records are already parsed as object from backend
          const txtRecords = service.txt_records || {};

          // Protocol priority: TXT record > service type > default tcp
          const protocol = txtRecords.protocol
            ? txtRecords.protocol as 'tcp' | 'udp'
            : isUdpService ? 'udp' : 'tcp';

          return {
            hostname: service.hostname,
            friendlyName: service.service_name || service.hostname,
            ip: service.ip_address,
            port: service.port,
            protocol: protocol,
            mountpoint: txtRecords.mountpoint,
            requiresAuth: txtRecords.requiresAuth === 'true',
            lastSeen: service.last_seen
          };
        });

        // Add servers, avoiding duplicates by IP:port combination
        for (const server of servers) {
          const key = `${server.ip}:${server.port}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allServers.push(server);
          }
        }
      } catch (error) {
        // Continue to next service type if one fails
        console.warn(`Failed to discover ${serviceType}:`, error);
      }
    }

    return allServers;
  }

  /**
   * Discover HTTP API services on the network
   * This discovers YardRover backends and similar HTTP services
   */
  async discoverHTTPServices(): Promise<MDNSService[]> {
    const response = await this.discover('_http._tcp');

    if (!response.services || response.services.length === 0) {
      return [];
    }

    // Filter for YardRover services (optional - could return all HTTP services)
    return response.services.filter(service => {
      const txtRecords = service.txt_records || {};
      // Only include services that advertise as YardRover or have the device tag
      return txtRecords.device === 'yardrover' || service.service_name.toLowerCase().includes('yardrover');
    });
  }

  /**
   * Get mDNS configuration
   */
  async getConfig(): Promise<MDNSConfig> {
    return this.httpClient.get<MDNSConfig>('/api/mdns/config');
  }

  /**
   * Update mDNS configuration
   */
  async updateConfig(config: Partial<MDNSConfig>): Promise<MDNSConfig> {
    return this.httpClient.patch<MDNSConfig>('/api/mdns/config', config);
  }
}
