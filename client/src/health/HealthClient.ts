import { HttpClient } from '../core/HttpClient';
import { WebSocketClient } from '../core/WebSocketClient';
import { EventType } from '../core/EventTypes';
import {
  SystemHealth,
  MemoryStats,
  TaskStats,
  ErrorInfo,
  SystemMetrics,
  HealthThresholds,
  HealthEventPayload,
  MemoryEventPayload,
  TaskEventPayload,
  ErrorEventPayload,
  HealthCheckResponse,
  DeviceInfo,
  NetworkInfo,
  WiFiInfo,
  AccessPointInfo,
  ConfigHealth,
  StorageHealth,
  EnhancedSystemHealth
} from './HealthTypes';

/**
 * Client for health monitoring and system metrics
 */
export class HealthClient {
  private httpClient: HttpClient;
  private wsClient: WebSocketClient;
  private metricsCache: SystemMetrics | null = null;
  private cacheExpiry = 0;
  private cacheTimeout = 5000; // 5 seconds

  constructor(httpClient: HttpClient, wsClient: WebSocketClient) {
    this.httpClient = httpClient;
    this.wsClient = wsClient;
  }

  /**
   * Get enhanced health check with comprehensive system information
   */
  async getHealthCheck (): Promise<HealthCheckResponse> {
    return this.httpClient.get<HealthCheckResponse>('/api/health');
  }

  /**
   * Get comprehensive system health information
   */
  async getSystemHealth (): Promise<SystemHealth> {
    return this.httpClient.get<SystemHealth>('/api/health/system');
  }

  /**
   * Get memory statistics and usage information
   */
  async getMemoryStats (): Promise<MemoryStats> {
    return this.httpClient.get<MemoryStats>('/api/health/memory');
  }

  /**
   * Get task statistics and monitoring information
   */
  async getTaskStats (): Promise<TaskStats[]> {
    return this.httpClient.get<TaskStats[]>('/api/health/tasks');
  }

  /**
   * Get recent error information
   */
  async getErrors (count: number = 10): Promise<ErrorInfo[]> {
    return this.httpClient.get<ErrorInfo[]>(`/api/health/errors?count=${count}`);
  }

  /**
   * Get errors by component
   */
  async getErrorsByComponent (component: string): Promise<ErrorInfo[]> {
    return this.httpClient.get<ErrorInfo[]>(`/api/health/errors/component/${component}`);
  }

  /**
   * Get errors by level
   */
  async getErrorsByLevel (level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'): Promise<ErrorInfo[]> {
    return this.httpClient.get<ErrorInfo[]>(`/api/health/errors/level/${level}`);
  }

  /**
   * Get comprehensive system metrics (cached)
   */
  async getSystemMetrics (useCache: boolean = true): Promise<SystemMetrics> {
    const now = Date.now();

    if (useCache && this.metricsCache && now < this.cacheExpiry) {
      return this.metricsCache;
    }

    const [health, memory, tasks, errors] = await Promise.all([
      this.getSystemHealth(),
      this.getMemoryStats(),
      this.getTaskStats(),
      this.getErrors(20)
    ]);

    this.metricsCache = {
      health,
      memory,
      tasks,
      errors,
      lastUpdate: now
    };

    this.cacheExpiry = now + this.cacheTimeout;
    return this.metricsCache;
  }

  /**
   * Set health monitoring thresholds
   */
  async setThresholds (thresholds: HealthThresholds): Promise<void> {
    await this.httpClient.post<void>('/api/health/thresholds', thresholds);
  }

  /**
   * Get current health monitoring thresholds
   */
  async getThresholds (): Promise<HealthThresholds> {
    return this.httpClient.get<HealthThresholds>('/api/health/thresholds');
  }

  /**
   * Trigger manual health check
   */
  async triggerHealthCheck (): Promise<void> {
    await this.httpClient.post<void>('/api/health/check');
    this.invalidateCache();
  }

  /**
   * Clear error log
   */
  async clearErrors (): Promise<void> {
    await this.httpClient.delete<void>('/api/health/errors');
  }

  /**
   * Clear errors older than specified age
   */
  async clearOldErrors (ageMs: number): Promise<void> {
    await this.httpClient.delete<void>(`/api/health/errors?older_than=${ageMs}`);
  }

  /**
   * Get error statistics summary
   */
  async getErrorSummary (): Promise<{
    total: number;
    byLevel: Record<string, number>;
    recent: number;
    timeSinceLastError: number;
  }> {
    return this.httpClient.get('/api/health/errors/summary');
  }

  /**
   * Test memory allocation (for testing purposes)
   */
  async testMemoryAllocation (size: number): Promise<{
    success: boolean;
    allocated: number;
    freeHeapBefore: number;
    freeHeapAfter: number;
  }> {
    return this.httpClient.post('/api/health/memory/test', { size });
  }

  /**
   * Trigger emergency memory cleanup
   */
  async emergencyMemoryCleanup (): Promise<{
    freedBytes: number;
    beforeFree: number;
    afterFree: number;
  }> {
    return this.httpClient.post('/api/health/memory/cleanup');
  }

  /**
   * Defragment heap memory
   */
  async defragmentMemory (): Promise<{
    beforeFree: number;
    afterFree: number;
    beforeLargest: number;
    afterLargest: number;
    fragmentation: number;
  }> {
    return this.httpClient.post('/api/health/memory/defragment');
  }

  /**
   * Get system uptime in milliseconds
   */
  async getUptime (): Promise<number> {
    const health = await this.getSystemHealth();
    return health.uptime;
  }

  /**
   * Check if system is healthy
   */
  async isSystemHealthy (): Promise<boolean> {
    const health = await this.getSystemHealth();
    return health.systemHealthy;
  }

  /**
   * Get CPU usage percentage
   */
  async getCPUUsage (): Promise<number> {
    const health = await this.getSystemHealth();
    return health.cpuUsage;
  }

  /**
   * Get system temperature (if available)
   */
  async getTemperature (): Promise<number> {
    const health = await this.getSystemHealth();
    return health.temperature;
  }

  /**
   * Check if memory is low
   */
  async isLowMemory (): Promise<boolean> {
    const health = await this.getSystemHealth();
    return health.lowMemoryWarning;
  }

  /**
   * Get memory usage percentage
   */
  async getMemoryUsage (): Promise<number> {
    const memory = await this.getMemoryStats();
    return ((memory.totalHeap - memory.freeHeap) / memory.totalHeap) * 100;
  }

  /**
   * Get fragmentation percentage
   */
  async getFragmentation (): Promise<number> {
    const memory = await this.getMemoryStats();
    return memory.fragmentation;
  }

  // Enhanced health check convenience methods

  /**
   * Get device information
   */
  async getDeviceInfo (): Promise<DeviceInfo> {
    const health = await this.getHealthCheck();
    return health.device;
  }

  /**
   * Get network information
   */
  async getNetworkInfo (): Promise<NetworkInfo> {
    const health = await this.getHealthCheck();
    return health.network;
  }

  /**
   * Get WiFi connection information
   */
  async getWiFiInfo (): Promise<WiFiInfo> {
    const health = await this.getHealthCheck();
    return health.network.wifi;
  }

  /**
   * Get access point information
   */
  async getAccessPointInfo (): Promise<AccessPointInfo> {
    const health = await this.getHealthCheck();
    return health.network.ap;
  }

  /**
   * Get device hostname
   */
  async getHostname (): Promise<string> {
    const health = await this.getHealthCheck();
    return health.device.hostname;
  }

  /**
   * Get device MAC address
   */
  async getMacAddress (): Promise<string> {
    const health = await this.getHealthCheck();
    return health.network.macAddress;
  }

  /**
   * Get current IP address (if connected to WiFi)
   */
  async getIpAddress (): Promise<string | null> {
    const health = await this.getHealthCheck();
    return health.network.wifi.ip || null;
  }

  /**
   * Get WiFi signal strength (RSSI)
   */
  async getSignalStrength (): Promise<number | null> {
    const health = await this.getHealthCheck();
    return health.network.wifi.rssi || null;
  }

  /**
   * Check if device is connected to WiFi
   */
  async isWiFiConnected (): Promise<boolean> {
    const health = await this.getHealthCheck();
    return health.network.wifi.status === 'connected';
  }

  /**
   * Check if access point is enabled
   */
  async isAccessPointEnabled (): Promise<boolean> {
    const health = await this.getHealthCheck();
    return health.network.ap.enabled;
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo (): Promise<StorageHealth> {
    const health = await this.getHealthCheck();
    return health.storage;
  }

  /**
   * Get storage usage percentage
   */
  async getStorageUsage (): Promise<number> {
    const health = await this.getHealthCheck();
    return (health.storage.usedBytes / health.storage.totalBytes) * 100;
  }

  /**
   * Check if system status is degraded and get issues
   */
  async getSystemIssues (): Promise<string[]> {
    const health = await this.getHealthCheck();
    return health.issues || [];
  }

  // Event listeners

  /**
   * Listen for health update events
   */
  onHealthUpdate (handler: (payload: HealthEventPayload) => void): () => void {
    this.wsClient.on(EventType.HEALTH_UPDATE, handler as any);
    return () => this.wsClient.off(EventType.HEALTH_UPDATE, handler as any);
  }

  /**
   * Listen for memory events
   */
  onMemoryEvent (handler: (payload: MemoryEventPayload) => void): () => void {
    this.wsClient.on(EventType.MEMORY_EVENT, handler as any);
    return () => this.wsClient.off(EventType.MEMORY_EVENT, handler as any);
  }

  /**
   * Listen for task events
   */
  onTaskEvent (handler: (payload: TaskEventPayload) => void): () => void {
    this.wsClient.on(EventType.TASK_EVENT, handler as any);
    return () => this.wsClient.off(EventType.TASK_EVENT, handler as any);
  }

  /**
   * Listen for error events
   */
  onErrorEvent (handler: (payload: ErrorEventPayload) => void): () => void {
    this.wsClient.on(EventType.ERROR, handler as any);
    return () => this.wsClient.off(EventType.ERROR, handler as any);
  }

  /**
   * Listen for low memory warnings
   */
  onLowMemoryWarning (handler: (freeHeap: number) => void): () => void {
    const wrappedHandler = (payload: MemoryEventPayload) => {
      if (payload.warning) {
        handler(payload.freeHeap);
      }
    };

    this.wsClient.on(EventType.MEMORY_EVENT, wrappedHandler as any);
    return () => this.wsClient.off(EventType.MEMORY_EVENT, wrappedHandler as any);
  }

  /**
   * Listen for critical memory warnings
   */
  onCriticalMemoryWarning (handler: (freeHeap: number) => void): () => void {
    const wrappedHandler = (payload: MemoryEventPayload) => {
      if (payload.critical) {
        handler(payload.freeHeap);
      }
    };

    this.wsClient.on(EventType.MEMORY_EVENT, wrappedHandler as any);
    return () => this.wsClient.off(EventType.MEMORY_EVENT, wrappedHandler as any);
  }

  /**
   * Listen for task failures (watchdog violations)
   */
  onTaskFailure (handler: (taskName: string, violations: number) => void): () => void {
    const wrappedHandler = (payload: TaskEventPayload) => {
      if (!payload.healthy && payload.watchdogViolations > 0) {
        handler(payload.name, payload.watchdogViolations);
      }
    };

    this.wsClient.on(EventType.TASK_EVENT, wrappedHandler as any);
    return () => this.wsClient.off(EventType.TASK_EVENT, wrappedHandler as any);
  }

  /**
   * Listen for critical errors
   */
  onCriticalError (handler: (error: ErrorEventPayload) => void): () => void {
    const wrappedHandler = (payload: ErrorEventPayload) => {
      if (payload.level === 'CRITICAL') {
        handler(payload);
      }
    };

    this.wsClient.on(EventType.ERROR, wrappedHandler as any);
    return () => this.wsClient.off(EventType.ERROR, wrappedHandler as any);
  }

  /**
   * Invalidate metrics cache
   */
  private invalidateCache (): void {
    this.metricsCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Set cache timeout
   */
  setCacheTimeout (timeoutMs: number): void {
    this.cacheTimeout = timeoutMs;
  }
}