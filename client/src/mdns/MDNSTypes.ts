/**
 * mDNS service discovery types
 */

export interface MDNSService {
  hostname: string;
  service_name: string;
  service_type: string;
  ip_address: string;
  port: number;
  last_seen: number;
  txt_records?: Record<string, string>;
}

export interface RTCMServerInfo {
  hostname: string;
  friendlyName: string;
  ip: string;
  port: number;
  protocol: 'tcp' | 'udp';
  mountpoint: string | undefined;
  requiresAuth: boolean | undefined;
  lastSeen: number;
}

export interface MDNSStatus {
  enabled: boolean;
  hostname: string;
  advertisedServices: MDNSService[];
  discoveredServices: MDNSService[];
}

export interface MDNSDiscoveryRequest {
  serviceType?: string;
}

export interface MDNSDiscoveryResponse {
  service_type: string;
  services: MDNSService[];
  discovery_time: string;
}

export interface MDNSConfig {
  enabled: boolean;
  hostname: string;
}
