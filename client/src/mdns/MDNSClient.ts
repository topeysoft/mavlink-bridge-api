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
   * @param serviceType The service type to discover (default: 'rtk-base')
   */
  async discover(serviceType: string = 'rtk-base'): Promise<MDNSDiscoveryResponse> {
    const request: MDNSDiscoveryRequest = { serviceType };
    return this.httpClient.post<MDNSDiscoveryResponse>('/api/mdns/discover', request);
  }

  /**
   * Discover RTCM base stations on the network
   * This is a convenience method that discovers 'rtk-base' services
   */
  async discoverRTCMServers(): Promise<RTCMServerInfo[]> {
    const response = await this.discover('rtk-base');

    if (!response.success || !response.services) {
      return [];
    }

    // Convert MDNSService to RTCMServerInfo
    return response.services.map(service => {
      // Parse TXT records if available
      const txtRecords = this.parseTxtRecords(service.txtRecords || '');

      return {
        hostname: service.hostname,
        friendlyName: service.name || service.hostname,
        ip: service.ip,
        port: service.port,
        protocol: (txtRecords.protocol || 'tcp') as 'tcp' | 'udp',
        mountpoint: txtRecords.mountpoint,
        requiresAuth: txtRecords.requiresAuth === 'true',
        lastSeen: service.lastSeen
      };
    });
  }

  /**
   * Discover HTTP API services on the network
   * This discovers YardRover backends and similar HTTP services
   */
  async discoverHTTPServices(): Promise<MDNSService[]> {
    const response = await this.discover('_http._tcp');

    if (!response.success || !response.services) {
      return [];
    }

    // Filter for YardRover services (optional - could return all HTTP services)
    return response.services.filter(service => {
      const txtRecords = this.parseTxtRecords(service.txtRecords || '');
      // Only include services that advertise as YardRover or have the device tag
      return txtRecords.device === 'yardrover' || service.name.toLowerCase().includes('yardrover');
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

  /**
   * Parse TXT records string into key-value pairs
   * @private
   */
  private parseTxtRecords(txtRecords: string): Record<string, string> {
    const records: Record<string, string> = {};

    if (!txtRecords) {
      return records;
    }

    // Split by semicolon or newline
    const pairs = txtRecords.split(/[;\n]/);

    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (key && value) {
        records[key] = value;
      }
    }

    return records;
  }
}
