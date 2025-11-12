/**
 * WiFi connection credentials
 */
export interface WiFiCredentials {
  ssid: string;
  password: string;
}

/**
 * WiFi connection state
 */
export enum WiFiState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AP_MODE = 'ap_mode',
  ERROR = 'error',
}

/**
 * WiFi connection status
 */
export interface WiFiStatus {
  state: WiFiState;
  connected: boolean;
  ssid?: string;
  ip?: string;
  gateway?: string;
  subnet?: string;
  rssi?: number;
  quality?: number;
  bssid?: string;
  apMode?: boolean;
  apIP?: string;
  apSSID?: string;
  connectedClients?: number;
}

/**
 * WiFi network scan result
 */
export interface WiFiNetwork {
  ssid: string;
  rssi: number;
  secure: boolean;
  authMode: string;
  channel: number;
  quality: number;
}

/**
 * WiFi scan response
 */
export interface WiFiScanResult {
  networks: WiFiNetwork[];
  count: number;
  cached: boolean;
}


/**
 * WiFi signal quality information
 */
export interface SignalQuality {
  rssi: number;
  quality: number; // percentage 0-100
}

/**
 * WiFi error codes
 */
export enum WiFiErrorCode {
  INVALID_JSON = 'INVALID_JSON',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ALREADY_CONNECTED = 'ALREADY_CONNECTED',
  CONNECTION_IN_PROGRESS = 'CONNECTION_IN_PROGRESS',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  NOT_CONNECTED = 'NOT_CONNECTED',
}

/**
 * WiFi API error response
 */
export interface WiFiError {
  code: WiFiErrorCode;
  message: string;
}

/**
 * Standard WiFi API response
 */
export interface WiFiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: WiFiError;
}

/**
 * WiFi connection response
 */
export interface WiFiConnectResponse {
  ssid: string;
  state: string;
  message: string;
}

/**
 * WiFi disconnect response
 */
export interface WiFiDisconnectResponse {
  message: string;
}


/**
 * WiFi connection options
 */
export interface WiFiConnectOptions {
  timeout?: number; // milliseconds
  retries?: number;
}

/**
 * WiFi scan options
 */
export interface WiFiScanOptions {
  force?: boolean; // Force new scan vs use cached results
  timeout?: number; // milliseconds
}

