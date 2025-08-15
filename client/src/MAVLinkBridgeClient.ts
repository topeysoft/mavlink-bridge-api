import { HttpClient } from './core/HttpClient';
import { WebSocketClient } from './core/WebSocketClient';
import { ConfigClient } from './config/ConfigClient';
import { WiFiClient } from './wifi/WiFiClient';
import { RTCMClient } from './rtcm/RTCMClient';
import { EventType, EventHandler, StatusPayload, ConfigChangedPayload, RTCMDataPayload, ErrorPayload, LogPayload, WiFiConnectedPayload, WiFiDisconnectedPayload, WiFiSignalUpdatePayload } from './core/EventTypes';
import { Configuration, HealthResponse, WiFiCredentials } from './config/ConfigTypes';
import { WiFiState, WiFiStatus, WiFiNetwork, SignalQuality } from './wifi/WiFiTypes';

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
  private readonly wifiClient: WiFiClient;
  private readonly rtcmClient: RTCMClient;
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

    // Initialize WiFi client
    this.wifiClient = new WiFiClient(this.httpClient, this.wsClient);

    // Initialize RTCM client
    this.rtcmClient = new RTCMClient(this.httpClient, this.wsClient);
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
   * Get WiFi client for advanced WiFi operations
   */
  get wifi(): WiFiClient {
    return this.wifiClient;
  }

  /**
   * Get RTCM client for advanced RTCM operations
   */
  get rtcm(): RTCMClient {
    return this.rtcmClient;
  }

  /**
   * Connect to a WiFi network
   */
  async connectToWiFi(credentials: WiFiCredentials): Promise<void> {
    await this.wifiClient.connect(credentials);
  }

  /**
   * Disconnect from WiFi
   */
  async disconnectFromWiFi(): Promise<void> {
    await this.wifiClient.disconnect();
  }

  /**
   * Get current WiFi status
   */
  async getWiFiStatus(): Promise<WiFiStatus> {
    return this.wifiClient.getStatus();
  }

  /**
   * Scan for WiFi networks
   */
  async scanWiFiNetworks(force: boolean = false): Promise<WiFiNetwork[]> {
    return this.wifiClient.scan({ force });
  }

  /**
   * Add a saved WiFi network
   */
  async addSavedWiFiNetwork(ssid: string, password: string, priority: number = 0): Promise<void> {
    await this.wifiClient.addSavedNetwork(ssid, password, priority);
  }

  /**
   * Remove a saved WiFi network
   */
  async removeSavedWiFiNetwork(ssid: string): Promise<void> {
    await this.wifiClient.removeSavedNetwork(ssid);
  }

  /**
   * Get saved WiFi networks
   */
  async getSavedWiFiNetworks(): Promise<any[]> {
    return this.wifiClient.getSavedNetworks();
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
  onStatus(handler: (payload: StatusPayload) => void): void {
    this.wsClient.on(EventType.STATUS, handler as any);
  }

  /**
   * Listen for configuration changes
   */
  onConfigChanged(handler: (payload: ConfigChangedPayload) => void): void {
    this.wsClient.on(EventType.CONFIG_CHANGED, handler as any);
  }

  /**
   * Listen for RTCM data
   */
  onRTCMData(handler: (payload: RTCMDataPayload) => void): void {
    this.wsClient.on(EventType.RTCM_DATA, handler as any);
  }

  /**
   * Listen for errors
   */
  onError(handler: (payload: ErrorPayload) => void): void {
    this.wsClient.on(EventType.ERROR, handler as any);
  }

  /**
   * Listen for log messages
   */
  onLog(handler: (payload: LogPayload) => void): void {
    this.wsClient.on(EventType.LOG, handler as any);
  }

  /**
   * Listen for WiFi connection events
   */
  onWiFiConnected(handler: (payload: WiFiConnectedPayload) => void): void {
    this.wsClient.on(EventType.WIFI_CONNECTED, handler as any);
  }

  /**
   * Listen for WiFi disconnection events
   */
  onWiFiDisconnected(handler: (payload: WiFiDisconnectedPayload) => void): void {
    this.wsClient.on(EventType.WIFI_DISCONNECTED, handler as any);
  }

  /**
   * Listen for WiFi signal updates
   */
  onWiFiSignalUpdate(handler: (payload: WiFiSignalUpdatePayload) => void): void {
    this.wsClient.on(EventType.WIFI_SIGNAL_UPDATE, handler as any);
  }

  /**
   * Listen for WiFi state changes (convenience method)
   */
  onWiFiStateChange(handler: (state: WiFiState) => void): () => void {
    return this.wifiClient.onStateChange(handler);
  }

  /**
   * Listen for WiFi connection status changes (convenience method)
   */
  onWiFiStatusChange(handler: (status: WiFiStatus) => void): () => void {
    return this.wifiClient.onConnectionChange(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener(event: EventType, handler: any): void {
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