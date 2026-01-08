/**
 * mDNS service discovery types
 */

export interface MDNSService {
  hostname: string;
  name: string;
  type: string;
  ip: string;
  port: number;
  lastSeen: number;
  txtRecords?: string;
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
  success: boolean;
  message?: string;
  serviceType?: string;
  services: MDNSService[];
  error?: string;
}

export interface MDNSConfig {
  enabled: boolean;
  hostname: string;
}
