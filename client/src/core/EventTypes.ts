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
  WIFI_SCAN_COMPLETED = 'wifi_scan_completed'
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
}