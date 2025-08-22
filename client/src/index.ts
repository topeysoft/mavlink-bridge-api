/**
 * @mavlinkbridge/api-client
 * 
 * TypeScript client library for MAVLinkBridge ESP32 API
 */

// Main client export
export { MAVLinkBridgeClient } from './MAVLinkBridgeClient';
export type { MAVLinkBridgeClientOptions } from './MAVLinkBridgeClient';

// Core exports
export { HttpClient, HttpError } from './core/HttpClient';
export { WebSocketClient } from './core/WebSocketClient';
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
  SavedWiFiNetwork,
  SavedNetworksResult,
  SignalQuality,
  WiFiErrorCode,
  WiFiError,
  WiFiResponse,
  WiFiConnectResponse,
  WiFiDisconnectResponse,
  AddNetworkResponse,
  RemoveNetworkResponse,
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
  ErrorEventPayload
} from './health/HealthTypes';

// Communication exports
export { CommunicationClient } from './communication/CommunicationClient';
export * from './communication/CommunicationTypes';

// MAVLink exports
export { MAVLinkCommandClient } from './mavlink/MAVLinkCommandClient';
export { MAVLinkMissionClient } from './mavlink/MAVLinkMissionClient';
export * from './mavlink/MAVLinkTypes';
export * from './mavlink/MAVLinkMissionTypes';

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
 * Note: This is a placeholder for future implementation.
 * The actual implementation would depend on the discovery mechanism
 * (mDNS, broadcast, etc.)
 * 
 * @param timeout Discovery timeout in milliseconds
 * @returns Promise that resolves to array of discovered device URLs
 */
export async function discoverDevices (timeout: number = 5000): Promise<string[]> {
  // Placeholder implementation
  // In a real implementation, this would:
  // 1. Use mDNS to discover _http._tcp services
  // 2. Or scan common IP ranges for MAVLinkBridge devices
  // 3. Or use broadcast discovery

  console.warn('Device discovery not yet implemented');
  return [];
}