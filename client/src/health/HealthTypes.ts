/**
 * System health monitoring types for MAVLinkBridge client
 */

export interface TaskInfo {
  name: string;
  stackHighWaterMark: number;
  runtime: number;
  priority: number;
  state: 'Running' | 'Ready' | 'Blocked' | 'Suspended' | 'Deleted' | 'Unknown';
}

export interface ComponentHealth {
  name: string;
  healthy: boolean;
  status: string;
  lastUpdate: number;
  message?: string;
}

export interface MemoryStats {
  totalHeap: number;
  freeHeap: number;
  minFreeHeap: number;
  largestFreeBlock: number;
  allocations: number;
  frees: number;
  fragmentation: number;
  poolAllocations: number;
  poolFrees: number;
  poolHits: number;
  poolMisses: number;
  maxAllocHeap?: number;
  psramSize?: number;
  freePsram?: number;
  flashSize?: number;
  usedFlash?: number;
}

export interface TaskStats {
  name: string;
  stackHighWaterMark: number;
  runtime: number;
  priority: number;
  state: string;
  watchdogFeeds: number;
  watchdogViolations: number;
  healthy: boolean;
  cpuUsage?: number;
}

export interface SystemHealth {
  uptime: number;
  freeHeap: number;
  minFreeHeap: number;
  largestFreeBlock: number;
  cpuUsage: number;
  temperature: number;
  lowMemoryWarning: boolean;
  systemHealthy: boolean;
  tasks: TaskInfo[];
  components: ComponentHealth[];
  overall?: {
    status: string;
  };
  memory?: {
    status: string;
  };
  errors?: ErrorInfo[];
}

export interface ErrorInfo {
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  component: string;
  message: string;
  code: number;
  timestamp: number;
  count: number;
}

export interface SystemMetrics {
  health: SystemHealth;
  memory: MemoryStats;
  tasks: TaskStats[];
  errors: ErrorInfo[];
  lastUpdate: number;
}

export interface HealthThresholds {
  memoryThreshold: number;
  cpuThreshold: number;
  temperatureThreshold?: number;
}

export interface HealthEventPayload {
  uptime: number;
  freeHeap: number;
  minFreeHeap: number;
  cpuUsage: number;
  temperature: number;
  systemHealthy: boolean;
  taskCount: number;
  componentCount: number;
  unhealthyComponents: Array<{
    name: string;
    status: string;
  }>;
}

export interface MemoryEventPayload {
  freeHeap: number;
  fragmentation: number;
  largestFreeBlock: number;
  warning: boolean;
  critical: boolean;
}

export interface TaskEventPayload {
  name: string;
  state: string;
  healthy: boolean;
  stackUsage: number;
  watchdogViolations: number;
}

export interface ErrorEventPayload {
  level: string;
  component: string;
  message: string;
  code: number;
  timestamp: number;
}

// Enhanced health check response types
export interface DeviceInfo {
  hostname: string;
  name: string;
  chipModel: string;
  chipRevision: number;
  flashSize: number;
  sdkVersion: string;
  coreCount: number;
}

export interface WiFiInfo {
  status: 'disconnected' | 'connecting' | 'connected' | 'ap_mode' | 'error';
  ssid?: string;
  ip?: string;
  gateway?: string;
  subnet?: string;
  rssi?: number;
  bssid?: string;
  channel?: number;
}

export interface AccessPointInfo {
  enabled: boolean;
  ip?: string;
  ssid?: string;
  clients?: number;
}

export interface NetworkInfo {
  macAddress: string;
  apMacAddress: string;
  wifi: WiFiInfo;
  ap: AccessPointInfo;
}

export interface ConfigHealth {
  version: number;
  isDirty: boolean;
}

export interface StorageHealth {
  freeBytes: number;
  totalBytes: number;
  usedBytes: number;
  healthy: boolean;
}

export interface RTCMHealth {
  connected: boolean;
  state: 'connected' | 'connecting' | 'error' | 'disconnected' | 'not_running';
  type?: string;
  messagesReceived?: number;
  bytesReceived?: number;
  dataRate?: number;
  crcErrors?: number;
}

export interface EnhancedSystemHealth {
  systemHealthy: boolean;
  cpuUsage: number;
  temperature: number;
  lowMemoryWarning: boolean;
  minFreeHeap: number;
  largestFreeBlock: number;
  taskCount: number;
  componentCount: number;
  components: ComponentHealth[];
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded';
  uptime: number;
  freeHeap: number;
  device: DeviceInfo;
  network: NetworkInfo;
  system?: EnhancedSystemHealth;
  config: ConfigHealth;
  storage: StorageHealth;
  rtcm?: RTCMHealth;
  issues?: Array<'system_unhealthy' | 'low_storage' | 'low_memory'>;
}