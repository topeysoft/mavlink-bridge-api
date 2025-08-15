/**
 * WiFi connection credentials
 */
export interface WiFiCredentials {
  ssid: string;
  password: string;
  save?: boolean;
  priority?: number;
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
 * Saved WiFi network
 */
export interface SavedWiFiNetwork {
  ssid: string;
  priority: number;
}

/**
 * Saved networks response
 */
export interface SavedNetworksResult {
  networks: SavedWiFiNetwork[];
  count: number;
  maxNetworks: number;
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
  SAVE_FAILED = 'SAVE_FAILED',
  MISSING_SSID = 'MISSING_SSID',
  NETWORK_NOT_FOUND = 'NETWORK_NOT_FOUND',
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
 * Add network response
 */
export interface AddNetworkResponse {
  ssid: string;
  priority: number;
  message: string;
}

/**
 * Remove network response
 */
export interface RemoveNetworkResponse {
  ssid: string;
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