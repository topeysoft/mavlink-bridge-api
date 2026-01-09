/**
 * @mavlinkbridge/api-client
 * 
 * TypeScript client library for MAVLinkBridge ESP32 API
 */

// Main client export
export { MAVLinkBridgeClient } from './MAVLinkBridgeClient';
export type { MAVLinkBridgeClientOptions } from './MAVLinkBridgeClient';

// Discovery exports
export { discoverMAVLinkBridgeDevices, startContinuousDiscovery } from './discovery/index';
export type { 
  MAVLinkBridgeDevice, 
  DiscoveryOptions, 
  DiscoveryResult
} from './discovery/types';

// Core exports
export { HttpClient, HttpError } from './core/HttpClient';
export type { TokenProvider, RequestOptions } from './core/HttpClient';
export { WebSocketClient } from './core/WebSocketClient';

// Auth exports
export { AuthClient } from './auth/AuthClient';
export {
  Role,
  Permission,
  type LoginRequest,
  type LoginResponse,
  type TokenData,
  type APIKeyCreateRequest,
  type APIKeyCreateResponse,
  type APIKeyListItem,
  type CurrentUser,
  type SetupStatus,
  type CompleteSetupRequest,
  type CompleteSetupResponse,
  type AuthState,
} from './auth/AuthTypes';
export {
  EventType,
  WebSocketMessage,
  StatusPayload,
  ConfigChangedPayload,
  RTCMDataPayload,
  ErrorPayload,
  LogPayload,
  WiFiConnectingPayload,
  WiFiConnectedPayload,
  WiFiDisconnectedPayload,
  WiFiSignalUpdatePayload,
  WiFiAPModeStartedPayload,
  WiFiScanCompletedPayload,
  ScaledImuPayload,
  RawImuPayload,
  HighResImuPayload,
  AttitudePayload,
  VfrHudPayload,
  EventHandler,
  EventHandlers
} from './core/EventTypes';

// Configuration exports
export { ConfigClient } from './config/ConfigClient';
export {
  DeviceConfig,
  WiFiConfig,
  ConnectionConfig,
  RTCMSourceConfig,
  RTCMConfig,
  Configuration,
  WiFiCredentials,
  HealthResponse,
  ConfigValidationResult,
  ConfigPatchOperation,
  ConfigValidator,
  isDeviceMode,
  isConnectionType,
  isRTCMSourceType,
  isHealthStatus
} from './config/ConfigTypes';

// WiFi exports
export { WiFiClient } from './wifi/WiFiClient';
export {
  WiFiCredentials as WiFiConnectionCredentials,
  WiFiState,
  WiFiStatus,
  WiFiNetwork,
  WiFiScanResult,
  SignalQuality,
  WiFiErrorCode,
  WiFiError,
  WiFiResponse,
  WiFiConnectResponse,
  WiFiDisconnectResponse,
  WiFiConnectOptions,
  WiFiScanOptions
} from './wifi/WiFiTypes';

// RTCM exports
export { RTCMClient } from './rtcm/RTCMClient';
export {
  NTRIPSource,
  TCPSource,
  UDPSource,
  RTCMState,
  RTCMStatistics,
  RTCMStatus,
  RTCMDataEvent,
  RTCMStateChangeEvent,
  RTCMResponse
} from './rtcm/RTCMTypes';

// mDNS exports
export { MDNSClient } from './mdns/MDNSClient';
export {
  MDNSService,
  RTCMServerInfo,
  MDNSStatus,
  MDNSDiscoveryRequest,
  MDNSDiscoveryResponse,
  MDNSConfig
} from './mdns/MDNSTypes';

// Health monitoring exports
export { HealthClient } from './health/HealthClient';
export {
  TaskInfo,
  ComponentHealth,
  MemoryStats,
  TaskStats,
  SystemHealth,
  ErrorInfo,
  SystemMetrics,
  HealthThresholds,
  HealthEventPayload,
  MemoryEventPayload,
  TaskEventPayload,
  ErrorEventPayload,
  DeviceInfo,
  WiFiInfo,
  AccessPointInfo,
  NetworkInfo,
  ConfigHealth,
  StorageHealth,
  RTCMHealth,
  EnhancedSystemHealth,
  HealthCheckResponse
} from './health/HealthTypes';

// Communication exports
export { CommunicationClient } from './communication/CommunicationClient';
export * from './communication/CommunicationTypes';

// MAVLink exports
export { MAVLinkCommandClient } from './mavlink/MAVLinkCommandClient';
export { MAVLinkMissionClient } from './mavlink/MAVLinkMissionClient';
export { MAVLinkDecoder } from './mavlink/MAVLinkDecoder';
export type { DecodedMAVLinkMessage } from './mavlink/MAVLinkDecoder';
export * from './mavlink/MAVLinkTypes';
export * from './mavlink/MAVLinkMissionTypes';

// Telemetry exports
export { TelemetryClient } from './telemetry/TelemetryClient';
export * from './telemetry/TelemetryTypes';

// Task management exports
export { TaskClient } from './tasks/TaskClient';
export {
  TaskType,
  TaskPriority,
  TaskStatus,
  TaskMetadata,
  TaskParameters,
  TaskWaypoint,
  TaskCreateRequest,
  TaskUpdateRequest,
  TaskListResponse,
  TaskExecutionRequest,
  TaskExecutionResponse,
  TaskExecutionStatus,
  TaskImportRequest,
  TaskImportResponse,
  TaskExportRequest,
  TaskExportResponse,
  TaskFromTemplateRequest,
  TaskTemplate,
  TaskTemplateListResponse
} from './tasks/TaskTypes';

// Resource management exports
export { ResourceManager } from './resources/ResourceManager';
export { ZoneManager } from './resources/ZoneManager';
export { MissionManager } from './resources/MissionManager';
export { MissionExecutor } from './resources/MissionExecutor';
export type {
  WaypointGenerationOptions,
  MissionExecutionOptions,
  MissionExecutionResult
} from './resources/MissionExecutor';
export {
  ResourceType,
  ResourceMetadata,
  SyncStatus,
  ResourceListResponse,
  ResourceChangeEvent,
  Zone,
  Mission,
  ResourceData,
  ResourceStorageConfig
} from './resources/ResourceTypes';


// Version info
export const VERSION = '1.0.0';

// Default configuration
export const DEFAULT_CONFIG = {
  HTTP_TIMEOUT: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000,
  AUTO_CONNECT_WEBSOCKET: true
} as const;

/**
 * Create a new MAVLinkBridge client instance with default options
 * 
 * @param deviceUrl The base URL of the ESP32 device
 * @param options Optional configuration
 * @returns New MAVLinkBridge client instance
 * 
 * @example
 * ```typescript
 * import { createClient } from '@mavlinkbridge/api-client';
 * 
 * const client = createClient('http://192.168.4.1');
 * await client.connect();
 * 
 * // Get device configuration
 * const config = await client.getConfiguration();
 * console.log('Device name:', config.device.name);
 * 
 * // Send MAVLink commands to flight controller
 * await client.mavlink.arm();
 * await client.mavlink.setMode(4); // Guided mode
 * 
 * // Create and execute a mowing task
 * const mowingTask = client.tasks.createMowingTask('Front Yard Mowing', {
 *   centerLat: 40.7128,
 *   centerLng: -74.0060,
 *   width: 50,
 *   height: 30,
 *   spacing: 2,
 *   altitude: 5
 * });
 * const task = await client.tasks.createTask(mowingTask);
 * await client.tasks.executeTask(task.metadata.id);
 * 
 * // Listen for status updates
 * client.onStatus((status) => {
 *   console.log('Device status:', status.status);
 *   console.log('Free heap:', status.freeHeap);
 * });
 * ```
 */
import { MAVLinkBridgeClient } from './MAVLinkBridgeClient';
import type { MAVLinkBridgeClientOptions } from './MAVLinkBridgeClient';

export function createClient (
  deviceUrl: string,
  options?: MAVLinkBridgeClientOptions
): MAVLinkBridgeClient {
  return new MAVLinkBridgeClient(deviceUrl, options || {});
}

/**
 * Discover MAVLinkBridge devices on the local network
 * 
 * This function uses mDNS and network scanning to find MAVLinkBridge devices.
 * It will automatically detect local network interfaces and scan appropriate subnets.
 * 
 * @param timeout Discovery timeout in milliseconds (default: 5000ms)
 * @returns Promise that resolves to array of discovered device URLs
 * 
 * @example
 * ```typescript
 * import { discoverDevices } from '@mavlinkbridge/api-client';
 * 
 * // Simple discovery with default timeout
 * const deviceUrls = await discoverDevices();
 * console.log('Found devices:', deviceUrls);
 * 
 * // Discovery with custom timeout
 * const deviceUrls = await discoverDevices(10000); // 10 seconds
 * 
 * // Use discovered devices
 * for (const url of deviceUrls) {
 *   const client = createClient(url);
 *   await client.connect();
 *   const health = await client.getHealth();
 *   console.log(`Device at ${url}: ${health.device.name}`);
 * }
 * ```
 */
export async function discoverDevices (timeout: number = 5000): Promise<string[]> {
  const { discoverMAVLinkBridgeDevices } = await import('./discovery/node');
  
  const result = await discoverMAVLinkBridgeDevices({
    timeout,
    concurrent: 20
  });
  
  // Convert discovered devices to URLs
  return result.devices.map(device => {
    const protocol = 'http'; // MAVLinkBridge uses HTTP
    const port = 80; // Default HTTP port
    return `${protocol}://${device.ip}:${port}`;
  });
}