/**
 * Event types for WebSocket communication with the device API
 *
 * Note: Uses dot notation for better readability and consistency with web standards.
 * Example: 'wifi.connected', 'health.update', 'zone.created'
 */
export enum EventType {
  STATUS = 'status',
  HEARTBEAT = 'heartbeat',
  CONFIG_CHANGED = 'config.changed',
  RTCM_DATA = 'rtcm.data',
  ERROR = 'error',
  LOG = 'log',
  // RTCM events
  RTCM_DATA_RECEIVED = 'rtcm.data.received',
  RTCM_STATE_CHANGE = 'rtcm.state.change',
  RTCM_STATUS_CHANGED = 'rtcm.status.changed',
  // WiFi events
  WIFI_CONNECTING = 'wifi.connecting',
  WIFI_CONNECTED = 'wifi.connected',
  WIFI_DISCONNECTED = 'wifi.disconnected',
  WIFI_SIGNAL_UPDATE = 'wifi.signal.update',
  WIFI_AP_MODE_STARTED = 'wifi.ap.mode.started',
  WIFI_AP_MODE_STOPPED = 'wifi.ap.mode.stopped',
  WIFI_SCAN_COMPLETED = 'wifi.scan.completed',
  // Communication events
  USB_CONNECTED = 'usb.connected',
  USB_DISCONNECTED = 'usb.disconnected',
  UART_CONNECTED = 'uart.connected',
  UART_DISCONNECTED = 'uart.disconnected',
  INTERFACE_SWITCHED = 'interface.switched',
  MAVLINK_MESSAGE = 'mavlink.message',
  COMMUNICATION_STATS = 'communication.stats',
  // Health events
  HEALTH_UPDATE = 'health.update',
  MEMORY_EVENT = 'memory.event',
  TASK_EVENT = 'task.event',
  // Mission events
  MISSION_CURRENT = 'mission.current',
  MISSION_ITEM_REACHED = 'mission.item.reached',
  MISSION_ACK = 'mission.ack',
  MISSION_COUNT = 'mission.count',
  MISSION_PROGRESS = 'mission.progress',
  // Task events
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_DELETED = 'task.deleted',
  TASK_EXECUTION_STARTED = 'task.execution.started',
  TASK_EXECUTION_PROGRESS = 'task.execution.progress',
  TASK_EXECUTION_PAUSED = 'task.execution.paused',
  TASK_EXECUTION_RESUMED = 'task.execution.resumed',
  TASK_EXECUTION_COMPLETED = 'task.execution.completed',
  TASK_EXECUTION_FAILED = 'task.execution.failed',
  TASK_EXECUTION_CANCELLED = 'task.execution.cancelled',
  // Resource sync events
  ZONE_CREATED = 'zone.created',
  ZONE_UPDATED = 'zone.updated',
  ZONE_DELETED = 'zone.deleted',
  MISSION_CREATED = 'mission.created',
  MISSION_UPDATED = 'mission.updated',
  MISSION_DELETED = 'mission.deleted',
  // Telemetry events - IMU and sensors
  SCALED_IMU = 'scaled.imu',
  RAW_IMU = 'raw.imu',
  HIGHRES_IMU = 'highres.imu',
  ATTITUDE = 'attitude',
  VFR_HUD = 'vfr.hud'
}

/**
 * Base interface for all WebSocket messages
 */
export interface WebSocketMessage {
  type: EventType;
  payload: Record<string, unknown>;
}

/**
 * Status event payload
 */
export interface StatusPayload {
  status: 'healthy' | 'degraded';
  uptime: number;
  freeHeap: number;
  wifiConnected?: boolean;
  rtcmActive?: boolean;
}

/**
 * Configuration changed event payload
 */
export interface ConfigChangedPayload {
  section: 'device' | 'connection' | 'rtcm';
  changes: Record<string, unknown>;
}

/**
 * RTCM data event payload
 */
export interface RTCMDataPayload {
  messageType: number;
  length: number;
  timestamp: number;
  data?: string; // Base64 encoded
}

/**
 * Error event payload
 */
export interface ErrorPayload {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}

/**
 * Log event payload
 */
export interface LogPayload {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  component?: string;
}

/**
 * WiFi connecting event payload
 */
export interface WiFiConnectingPayload {
  ssid: string;
}

/**
 * WiFi connected event payload
 */
export interface WiFiConnectedPayload {
  ssid: string;
  ip: string;
  rssi: number;
}

/**
 * WiFi disconnected event payload
 */
export interface WiFiDisconnectedPayload {
  reason: 'user_request' | 'connection_lost' | 'auth_failed';
  ssid?: string;
}

/**
 * WiFi signal update event payload
 */
export interface WiFiSignalUpdatePayload {
  rssi: number;
  quality: number; // percentage
}

/**
 * WiFi AP mode started event payload
 */
export interface WiFiAPModeStartedPayload {
  ssid: string;
  ip: string;
}

/**
 * WiFi scan completed event payload
 */
export interface WiFiScanCompletedPayload {
  networks: Array<{
    ssid: string;
    rssi: number;
    secure: boolean;
    channel: number;
  }>;
}

/**
 * USB connected event payload
 */
export interface USBConnectedPayload {
  interface: string;
  speed: string;
  vid: number;
  pid: number;
  vendor: string;
  product: string;
  is_flight_controller: boolean;
  is_identified: boolean;
}

/**
 * USB disconnected event payload
 */
export interface USBDisconnectedPayload {
  interface: string;
  vid: number;
  pid: number;
  vendor: string;
  product: string;
  is_flight_controller: boolean;
  is_identified: boolean;
}

/**
 * UART connected event payload
 */
export interface UARTConnectedPayload {
  interface: string;
  baudrate: number;
  mavlink_detected: boolean;
}

/**
 * UART disconnected event payload
 */
export interface UARTDisconnectedPayload {
  interface: string;
}

/**
 * Interface switched event payload
 */
export interface InterfaceSwitchedPayload {
  from: string;
  to: string;
  reason: string;
}

/**
 * MAVLink message event payload
 */
export interface MAVLinkMessagePayload {
  messageId: number;
  systemId: number;
  componentId: number;
  length: number;
  data: string; // Base64 encoded
}

/**
 * Communication statistics event payload
 */
export interface CommunicationStatsPayload {
  interface: string;
  upstreamRate: number;
  downstreamRate: number;
  packetsReceived: number;
  packetsSent: number;
  bytesReceived: number;
  bytesSent: number;
}

/**
 * Event handler function type
 */
export type EventHandler<T = Record<string, unknown>> = (payload: T) => void;

/**
 * Typed event handlers for specific event types
 */
export interface EventHandlers {
  [EventType.STATUS]?: EventHandler<StatusPayload>;
  [EventType.CONFIG_CHANGED]?: EventHandler<ConfigChangedPayload>;
  [EventType.RTCM_DATA]?: EventHandler<RTCMDataPayload>;
  [EventType.ERROR]?: EventHandler<ErrorPayload>;
  [EventType.LOG]?: EventHandler<LogPayload>;
  [EventType.WIFI_CONNECTING]?: EventHandler<WiFiConnectingPayload>;
  [EventType.WIFI_CONNECTED]?: EventHandler<WiFiConnectedPayload>;
  [EventType.WIFI_DISCONNECTED]?: EventHandler<WiFiDisconnectedPayload>;
  [EventType.WIFI_SIGNAL_UPDATE]?: EventHandler<WiFiSignalUpdatePayload>;
  [EventType.WIFI_AP_MODE_STARTED]?: EventHandler<WiFiAPModeStartedPayload>;
  [EventType.WIFI_AP_MODE_STOPPED]?: EventHandler;
  [EventType.WIFI_SCAN_COMPLETED]?: EventHandler<WiFiScanCompletedPayload>;
  [EventType.USB_CONNECTED]?: EventHandler<USBConnectedPayload>;
  [EventType.USB_DISCONNECTED]?: EventHandler<USBDisconnectedPayload>;
  [EventType.UART_CONNECTED]?: EventHandler<UARTConnectedPayload>;
  [EventType.UART_DISCONNECTED]?: EventHandler<UARTDisconnectedPayload>;
  [EventType.INTERFACE_SWITCHED]?: EventHandler<InterfaceSwitchedPayload>;
  [EventType.MAVLINK_MESSAGE]?: EventHandler<MAVLinkMessagePayload>;
  [EventType.COMMUNICATION_STATS]?: EventHandler<CommunicationStatsPayload>;
  [EventType.MISSION_CURRENT]?: EventHandler<MissionCurrentPayload>;
  [EventType.MISSION_ITEM_REACHED]?: EventHandler<MissionItemReachedPayload>;
  [EventType.MISSION_ACK]?: EventHandler<MissionAckPayload>;
  [EventType.MISSION_COUNT]?: EventHandler<MissionCountPayload>;
  [EventType.MISSION_PROGRESS]?: EventHandler<MissionProgressPayload>;
}

/**
 * Mission current event payload
 */
export interface MissionCurrentPayload {
  seq: number;
}

/**
 * Mission item reached event payload
 */
export interface MissionItemReachedPayload {
  seq: number;
}

/**
 * Mission acknowledgment event payload
 */
export interface MissionAckPayload {
  targetSystem: number;
  targetComponent: number;
  type: number;
  result: number;
}

/**
 * Mission count event payload
 */
export interface MissionCountPayload {
  targetSystem: number;
  targetComponent: number;
  count: number;
  missionType: number;
}

/**
 * Mission progress event payload
 */
export interface MissionProgressPayload {
  totalItems: number;
  currentItem: number;
  itemsReached: number;
  distanceToWaypoint?: number;
  estimatedTimeToWaypoint?: number;
}

/**
 * Scaled IMU event payload
 */
export interface ScaledImuPayload {
  timeBootMs: number;
  xacc: number;
  yacc: number;
  zacc: number;
  xgyro: number;
  ygyro: number;
  zgyro: number;
  xmag: number;
  ymag: number;
  zmag: number;
  temperature?: number;
}

/**
 * Raw IMU event payload
 */
export interface RawImuPayload {
  timeUsec: number;
  xacc: number;
  yacc: number;
  zacc: number;
  xgyro: number;
  ygyro: number;
  zgyro: number;
  xmag: number;
  ymag: number;
  zmag: number;
  id?: number;
  temperature?: number;
}

/**
 * High-resolution IMU event payload
 */
export interface HighResImuPayload {
  timeUsec: number;
  xacc: number;
  yacc: number;
  zacc: number;
  xgyro: number;
  ygyro: number;
  zgyro: number;
  xmag: number;
  ymag: number;
  zmag: number;
  absPressure: number;
  diffPressure: number;
  pressureAlt: number;
  temperature: number;
  fieldsUpdated: number;
  id?: number;
}

/**
 * Attitude event payload
 */
export interface AttitudePayload {
  timeBootMs: number;
  roll: number;
  pitch: number;
  yaw: number;
  rollspeed: number;
  pitchspeed: number;
  yawspeed: number;
}

/**
 * VFR HUD event payload
 */
export interface VfrHudPayload {
  airspeed: number;
  groundspeed: number;
  heading: number;
  throttle: number;
  alt: number;
  climb: number;
}