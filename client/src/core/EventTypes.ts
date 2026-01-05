/**
 * Event types for WebSocket communication with the ESP32 device
 */
export enum EventType {
  STATUS = 'status',
  CONFIG_CHANGED = 'config_changed',
  RTCM_DATA = 'rtcm_data',
  ERROR = 'error',
  LOG = 'log',
  // RTCM events
  RTCM_DATA_RECEIVED = 'rtcm_data_received',
  RTCM_STATE_CHANGE = 'rtcm_state_change',
  // WiFi events
  WIFI_CONNECTING = 'wifi_connecting',
  WIFI_CONNECTED = 'wifi_connected',
  WIFI_DISCONNECTED = 'wifi_disconnected',
  WIFI_SIGNAL_UPDATE = 'wifi_signal_update',
  WIFI_AP_MODE_STARTED = 'wifi_ap_mode_started',
  WIFI_AP_MODE_STOPPED = 'wifi_ap_mode_stopped',
  WIFI_SCAN_COMPLETED = 'wifi_scan_completed',
  // Communication events
  USB_CONNECTED = 'usb_connected',
  USB_DISCONNECTED = 'usb_disconnected',
  UART_CONNECTED = 'uart_connected',
  UART_DISCONNECTED = 'uart_disconnected',
  INTERFACE_SWITCHED = 'interface_switched',
  MAVLINK_MESSAGE = 'mavlink_message',
  COMMUNICATION_STATS = 'communication_stats',
  // Health events
  HEALTH_UPDATE = 'health_update',
  MEMORY_EVENT = 'memory_event',
  TASK_EVENT = 'task_event',
  // Mission events
  MISSION_CURRENT = 'mission_current',
  MISSION_ITEM_REACHED = 'mission_item_reached',
  MISSION_ACK = 'mission_ack',
  MISSION_COUNT = 'mission_count',
  MISSION_PROGRESS = 'mission_progress',
  // Task events
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_DELETED = 'task_deleted',
  TASK_EXECUTION_STARTED = 'task_execution_started',
  TASK_EXECUTION_PROGRESS = 'task_execution_progress',
  TASK_EXECUTION_PAUSED = 'task_execution_paused',
  TASK_EXECUTION_RESUMED = 'task_execution_resumed',
  TASK_EXECUTION_COMPLETED = 'task_execution_completed',
  TASK_EXECUTION_FAILED = 'task_execution_failed',
  TASK_EXECUTION_CANCELLED = 'task_execution_cancelled',
  // Telemetry events - IMU and sensors
  SCALED_IMU = 'scaled_imu',
  RAW_IMU = 'raw_imu',
  HIGHRES_IMU = 'highres_imu',
  ATTITUDE = 'attitude',
  VFR_HUD = 'vfr_hud'
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