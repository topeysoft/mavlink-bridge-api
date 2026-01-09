export interface MAVLinkBridgeDevice {
  /** Unique device identifier (MAC address) */
  id: string;
  /** Device name from configuration */
  name: string;
  /** Device hostname */
  hostname: string;
  /** Device IP address */
  ip: string;
  /** HTTP port the device is accessible on */
  port: number;
  /** Device health status */
  status: 'healthy' | 'degraded';
  /** Whether device has been provisioned */
  isProvisioned: boolean;
  /** Device capabilities */
  capabilities: {
    chipModel: string;
    chipRevision: number;
    flashSize: number;
    sdkVersion: string;
    coreCount: number;
  };
  /** Network information */
  network: {
    macAddress: string;
    apMacAddress: string;
    wifi: {
      status: string;
      ssid?: string;
      rssi?: number;
    };
    ap: {
      enabled: boolean;
      clients?: number;
    };
  };
  /** Last discovery timestamp */
  lastSeen: number;
}

export interface DiscoveryOptions {
  /** Subnets to scan in CIDR notation (e.g., '192.168.1.0/24') */
  subnets?: string[];
  /** HTTP ports to check */
  ports?: number[];
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum concurrent requests */
  concurrent?: number;
  /** Known hostnames to try first */
  knownHostnames?: string[];
  /** AP mode IPs to check for unprovisioned devices */
  apModeIPs?: string[];
}

export interface DiscoveryResult {
  /** Discovered devices */
  devices: MAVLinkBridgeDevice[];
  /** Discovery duration in milliseconds */
  duration: number;
  /** Number of hosts scanned */
  hostsScanned: number;
  /** Number of successful responses */
  successfulResponses: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  uptime: number;
  freeHeap: number;
  device: {
    hostname: string;
    name: string;
    chipModel: string;
    chipRevision: number;
    flashSize: number;
    sdkVersion: string;
    coreCount: number;
  };
  network: {
    macAddress: string;
    apMacAddress: string;
    wifi: {
      status: string;
      ssid?: string;
      ip?: string;
      gateway?: string;
      subnet?: string;
      rssi?: number;
      bssid?: string;
      channel?: number;
    };
    ap: {
      enabled: boolean;
      ip?: string;
      ssid?: string;
      clients?: number;
    };
  };
  config: {
    version: number;
    isDirty: boolean;
  };
  storage: {
    freeBytes: number;
    totalBytes: number;
    usedBytes: number;
    healthy: boolean;
  };
  system?: {
    systemHealthy: boolean;
    cpuUsage: number;
    temperature: number;
    lowMemoryWarning: boolean;
    taskCount: number;
    componentCount: number;
  };
  issues?: string[];
}