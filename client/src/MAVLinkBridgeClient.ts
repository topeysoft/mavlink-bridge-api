import { HttpClient } from './core/HttpClient';
import { WebSocketClient } from './core/WebSocketClient';
import { ConfigClient } from './config/ConfigClient';
import { EventType, EventHandler, StatusPayload, ConfigChangedPayload, RTCMDataPayload, ErrorPayload, LogPayload } from './core/EventTypes';
import { Configuration, HealthResponse, WiFiCredentials } from './config/ConfigTypes';

/**
 * Configuration options for the MAVLinkBridge client
 */
export interface MAVLinkBridgeClientOptions {
  /** HTTP request timeout in milliseconds (default: 5000) */
  httpTimeout?: number;
  /** WebSocket reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** WebSocket reconnection delay in milliseconds (default: 1000) */
  reconnectDelay?: number;
  /** Whether to auto-connect WebSocket (default: true) */
  autoConnectWebSocket?: boolean;
}

/**
 * Main client for interacting with MAVLinkBridge ESP32 device
 */
export class MAVLinkBridgeClient {
  private readonly httpClient: HttpClient;
  private readonly wsClient: WebSocketClient;
  private readonly configClient: ConfigClient;
  private readonly options: Required<MAVLinkBridgeClientOptions>;

  /**
   * Create a new MAVLinkBridge client instance
   * @param deviceUrl The base URL of the ESP32 device (e.g., 'http://192.168.4.1')
   * @param options Client configuration options
   */
  constructor(deviceUrl: string, options: MAVLinkBridgeClientOptions = {}) {
    this.options = {
      httpTimeout: options.httpTimeout ?? 5000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 1000,
      autoConnectWebSocket: options.autoConnectWebSocket ?? true
    };

    // Initialize HTTP client
    this.httpClient = new HttpClient(deviceUrl, this.options.httpTimeout);

    // Initialize WebSocket client
    const wsUrl = deviceUrl.replace(/^http/, 'ws') + '/ws';
    this.wsClient = new WebSocketClient(wsUrl);
    this.wsClient.setMaxReconnectAttempts(this.options.maxReconnectAttempts);
    this.wsClient.setReconnectDelay(this.options.reconnectDelay);

    // Initialize configuration client
    this.configClient = new ConfigClient(this.httpClient);
  }

  /**
   * Initialize the client and establish connections
   */
  async connect(): Promise<void> {
    if (this.options.autoConnectWebSocket) {
      await this.wsClient.connect();
    }
  }

  /**
   * Disconnect from the device
   */
  disconnect(): void {
    this.wsClient.disconnect();
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  // Configuration Management

  /**
   * Get the current device configuration
   */
  async getConfiguration(): Promise<Configuration> {
    return this.configClient.getConfiguration();
  }

  /**
   * Set the complete device configuration
   */
  async setConfiguration(config: Configuration): Promise<void> {
    return this.configClient.setConfiguration(config);
  }

  /**
   * Update a specific configuration value
   */
  async updateConfigValue(path: string, value: unknown): Promise<void> {
    return this.configClient.updateConfigValue(path, value);
  }

  /**
   * Update device name
   */
  async updateDeviceName(name: string): Promise<void> {
    return this.configClient.updateDeviceName(name);
  }

  /**
   * Update device mode
   */
  async updateDeviceMode(mode: 'usb_otg' | 'uart'): Promise<void> {
    return this.configClient.updateDeviceMode(mode);
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfiguration(): Promise<void> {
    return this.configClient.resetToDefaults();
  }

  // Health and Status

  /**
   * Get device health status
   */
  async getHealth(): Promise<HealthResponse> {
    return this.configClient.getHealth();
  }

  // WiFi Management

  /**
   * Connect to a WiFi network
   */
  async connectToWiFi(credentials: WiFiCredentials): Promise<void> {
    await this.httpClient.post<void>('/api/wifi/connect', credentials);
  }

  /**
   * Disconnect from WiFi
   */
  async disconnectFromWiFi(): Promise<void> {
    await this.httpClient.post<void>('/api/wifi/disconnect');
  }

  /**
   * Update WiFi settings
   */
  async updateWiFiSettings(ssid: string, autoConnect: boolean = true): Promise<void> {
    await this.configClient.updateWiFiSSID(ssid);
    await this.configClient.updateWiFiAutoConnect(autoConnect);
  }

  // RTCM Management

  /**
   * Start RTCM client
   */
  async startRTCM(): Promise<void> {
    // First enable RTCM in config
    await this.configClient.updateRTCMEnabled(true);
    
    // Then start the client
    const config = await this.getConfiguration();
    await this.httpClient.post<void>('/api/rtcm/start', config.rtcm);
  }

  /**
   * Stop RTCM client
   */
  async stopRTCM(): Promise<void> {
    await this.httpClient.post<void>('/api/rtcm/stop');
    
    // Also disable in config
    await this.configClient.updateRTCMEnabled(false);
  }

  /**
   * Configure RTCM source
   */
  async configureRTCMSource(
    type: 'ntrip' | 'tcp' | 'udp',
    host: string,
    port: number,
    options?: {
      mountpoint?: string;
      username?: string;
      password?: string;
    }
  ): Promise<void> {
    await this.configClient.updateRTCMSource(type, host, port, options);
  }

  // Event Handling

  /**
   * Listen for status updates
   */
  onStatus(handler: EventHandler<StatusPayload>): void {
    this.wsClient.on(EventType.STATUS, handler);
  }

  /**
   * Listen for configuration changes
   */
  onConfigChanged(handler: EventHandler<ConfigChangedPayload>): void {
    this.wsClient.on(EventType.CONFIG_CHANGED, handler);
  }

  /**
   * Listen for RTCM data
   */
  onRTCMData(handler: EventHandler<RTCMDataPayload>): void {
    this.wsClient.on(EventType.RTCM_DATA, handler);
  }

  /**
   * Listen for errors
   */
  onError(handler: EventHandler<ErrorPayload>): void {
    this.wsClient.on(EventType.ERROR, handler);
  }

  /**
   * Listen for log messages
   */
  onLog(handler: EventHandler<LogPayload>): void {
    this.wsClient.on(EventType.LOG, handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener<T extends EventType>(event: T, handler: EventHandler): void {
    this.wsClient.off(event, handler);
  }

  /**
   * Remove all event listeners for a specific event type
   */
  removeAllListeners(event?: EventType): void {
    this.wsClient.removeAllListeners(event);
  }

  // Utility Methods

  /**
   * Get the device base URL
   */
  getDeviceUrl(): string {
    return this.httpClient.getBaseUrl();
  }

  /**
   * Get WebSocket connection state
   */
  getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
    return this.wsClient.getConnectionState();
  }

  /**
   * Manually connect WebSocket if not auto-connecting
   */
  async connectWebSocket(): Promise<void> {
    await this.wsClient.connect();
  }

  /**
   * Ping the device to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      await this.getHealth();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get client configuration options
   */
  getOptions(): Required<MAVLinkBridgeClientOptions> {
    return { ...this.options };
  }
}