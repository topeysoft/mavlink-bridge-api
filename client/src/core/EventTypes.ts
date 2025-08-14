/**
 * Event types for WebSocket communication with the ESP32 device
 */
export enum EventType {
  STATUS = 'status',
  CONFIG_CHANGED = 'config_changed',
  RTCM_DATA = 'rtcm_data',
  ERROR = 'error',
  LOG = 'log'
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
}