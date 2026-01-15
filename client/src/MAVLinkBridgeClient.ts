import { HttpClient } from './core/HttpClient';
import { WebSocketClient } from './core/WebSocketClient';
import { AuthClient } from './auth/AuthClient';
import { ConfigClient } from './config/ConfigClient';
import { WiFiClient } from './wifi/WiFiClient';
import { RTCMClient } from './rtcm/RTCMClient';
import { MDNSClient } from './mdns/MDNSClient';
import { HealthClient } from './health/HealthClient';
import { CommunicationClient } from './communication/CommunicationClient';
import { MAVLinkCommandClient } from './mavlink/MAVLinkCommandClient';
import { MAVLinkMissionClient } from './mavlink/MAVLinkMissionClient';
import { MAVLinkParameterClient } from './mavlink/parameters/MAVLinkParameterClient';
import { TelemetryClient } from './telemetry/TelemetryClient';
import { TaskClient } from './tasks/TaskClient';
import { ZoneManager } from './resources/ZoneManager';
import { MissionManager } from './resources/MissionManager';
import { PeripheralClient } from './peripherals/PeripheralClient';
import { ZoneRecordingClient } from './zones/ZoneRecordingClient';
import { EventType, EventHandler, StatusPayload, ConfigChangedPayload, RTCMDataPayload, ErrorPayload, LogPayload, WiFiConnectedPayload, WiFiDisconnectedPayload, WiFiSignalUpdatePayload } from './core/EventTypes';
import { Configuration, HealthResponse, WiFiCredentials } from './config/ConfigTypes';
import { WiFiState, WiFiStatus, WiFiNetwork, SignalQuality } from './wifi/WiFiTypes';
import { SystemHealth, SystemMetrics, HealthThresholds, HealthCheckResponse } from './health/HealthTypes';

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
  public readonly authClient: AuthClient;
  private readonly configClient: ConfigClient;
  private readonly wifiClient: WiFiClient;
  private readonly rtcmClient: RTCMClient;
  private readonly mdnsClient: MDNSClient;
  private readonly healthClient: HealthClient;
  private readonly commClient: CommunicationClient;
  private readonly mavlinkClient: MAVLinkCommandClient;
  private readonly missionClient: MAVLinkMissionClient;
  private readonly parameterClient: MAVLinkParameterClient;
  private readonly telemetryClient: TelemetryClient;
  private readonly taskClient: TaskClient;
  private readonly zoneManager: ZoneManager;
  private readonly missionManager: MissionManager;
  private readonly peripheralClient: PeripheralClient;
  private readonly zoneRecordingClient: ZoneRecordingClient;
  private readonly options: Required<MAVLinkBridgeClientOptions>;

  /**
   * Create a new MAVLinkBridge client instance
   * @param deviceUrl The base URL of the ESP32 device (e.g., 'http://192.168.4.1')
   * @param options Client configuration options
   */
  constructor(deviceUrl: string, options: MAVLinkBridgeClientOptions = {}) {
    this.options = {
      httpTimeout: options.httpTimeout ?? 15000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 1000,
      autoConnectWebSocket: options.autoConnectWebSocket ?? true
    };

    // Initialize HTTP client
    this.httpClient = new HttpClient(deviceUrl, this.options.httpTimeout);

    // Initialize auth client
    this.authClient = new AuthClient(deviceUrl, this.options.httpTimeout);

    // Set up token provider for automatic token injection
    // Note: Using sync version here for compatibility with TokenProvider type
    // Actual token refresh happens automatically in AuthClient.getAuthToken()
    this.httpClient.setTokenProvider(() => this.authClient.getAuthTokenSync());

    // Initialize WebSocket client
    const wsUrl = deviceUrl.replace(/^http/, 'ws') + '/ws';
    this.wsClient = new WebSocketClient(wsUrl);
    this.wsClient.setMaxReconnectAttempts(this.options.maxReconnectAttempts);
    this.wsClient.setReconnectDelay(this.options.reconnectDelay);

    // Set up token provider for WebSocket authentication
    this.wsClient.setTokenProvider(() => this.authClient.getAuthTokenSync());

    // Initialize configuration client
    this.configClient = new ConfigClient(this.httpClient);

    // Initialize WiFi client
    this.wifiClient = new WiFiClient(this.httpClient, this.wsClient);

    // Initialize RTCM client
    this.rtcmClient = new RTCMClient(this.httpClient, this.wsClient);

    // Initialize mDNS client
    this.mdnsClient = new MDNSClient(this.httpClient);

    // Initialize health client
    this.healthClient = new HealthClient(this.httpClient, this.wsClient);

    // Initialize communication client
    this.commClient = new CommunicationClient(this.httpClient, this.wsClient);

    // Initialize MAVLink command client
    this.mavlinkClient = new MAVLinkCommandClient(this.httpClient);

    // Initialize MAVLink mission client
    this.missionClient = new MAVLinkMissionClient(this.httpClient, this.wsClient);

    // Initialize MAVLink parameter client
    this.parameterClient = new MAVLinkParameterClient(this.httpClient);

    // Initialize telemetry client
    this.telemetryClient = new TelemetryClient(this.wsClient);

    // Initialize task client
    this.taskClient = new TaskClient(this.httpClient, this.wsClient);

    // Initialize resource managers
    this.zoneManager = new ZoneManager(this.httpClient);
    this.missionManager = new MissionManager(this.httpClient);

    // Initialize peripheral client
    this.peripheralClient = new PeripheralClient(this.httpClient);

    // Initialize zone recording client
    this.zoneRecordingClient = new ZoneRecordingClient(this.httpClient);
  }

  /**
   * Initialize the client and establish connections
   */
  async connect (): Promise<void> {
    // Only connect WebSocket if we have a token (authenticated)
    // Otherwise, it will be connected after login via connectWebSocket()
    const hasToken = this.authClient.getAuthTokenSync() !== null;

    if (this.options.autoConnectWebSocket && hasToken) {
      await this.wsClient.connect();

      // Subscribe to MAVLink messages after WebSocket is connected
      // The backend requires explicit subscription to receive messages
      this.subscribeToMAVLinkMessages();
    }

    // Only initialize and sync resource managers if authenticated
    // Resource endpoints require authentication
    if (hasToken) {
      // Initialize resource managers
      await this.zoneManager.initialize();
      await this.missionManager.initialize();

      // Connect resource managers to WebSocket for real-time sync
      this.zoneManager.connectWebSocket(this.wsClient);
      this.missionManager.connectWebSocket(this.wsClient);

      // Initial sync with server
      await Promise.all([
        this.zoneManager.sync().catch(console.error),
        this.missionManager.sync().catch(console.error)
      ]);
    }
  }

  /**
   * Subscribe to MAVLink messages and other critical topics
   * Must be called after WebSocket connection is established
   */
  private subscribeToMAVLinkMessages(): void {
    try {
      // Send raw JSON to bypass the WebSocketMessage type mismatch
      // Backend expects: { type: "subscribe", data: { topics: [...] } }
      // Client interface expects: { type: EventType, payload: {...} }
      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        data: {
          topics: [
            'mavlink.message',
            'health.update',
            'wifi.*',
            'rtcm.*'  // Subscribe to all RTCM events (status, data, state)
          ]
        }
      });

      // Send raw string directly
      if (this.wsClient.isConnected() && (this.wsClient as any).ws) {
        (this.wsClient as any).ws.send(subscribeMessage);
        // Subscribed to WebSocket topics (silent)
      } else {
        console.warn('[MAVLinkBridgeClient] WebSocket not connected, cannot subscribe');
      }
    } catch (error) {
      console.error('[MAVLinkBridgeClient] Failed to subscribe to topics:', error);
    }
  }

  /**
   * Disconnect from the device
   */
  async disconnect (): Promise<void> {
    // Close resource managers
    await this.zoneManager.close();
    await this.missionManager.close();

    // Disconnect WebSocket
    this.wsClient.disconnect();
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected (): boolean {
    return this.wsClient.isConnected();
  }

  // Configuration Management

  /**
   * Get the current device configuration
   */
  async getConfiguration (): Promise<Configuration> {
    return this.configClient.getConfiguration();
  }

  /**
   * Set the complete device configuration
   */
  async setConfiguration (config: Configuration): Promise<void> {
    return this.configClient.setConfiguration(config);
  }

  /**
   * Update a specific configuration value
   */
  async updateConfigValue (path: string, value: unknown): Promise<void> {
    return this.configClient.updateConfigValue(path, value);
  }

  /**
   * Update device name
   */
  async updateDeviceName (name: string): Promise<void> {
    return this.configClient.updateDeviceName(name);
  }

  /**
   * Update device mode
   */
  async updateDeviceMode (mode: 'usb_otg' | 'uart'): Promise<void> {
    return this.configClient.updateDeviceMode(mode);
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfiguration (): Promise<void> {
    return this.configClient.resetToDefaults();
  }

  // Health and Status

  /**
   * Get device health status
   */
  async getHealth (): Promise<HealthCheckResponse> {
    return this.healthClient.getHealthCheck();
  }

  // WiFi Management

  /**
   * Get WiFi client for advanced WiFi operations
   */
  get wifi (): WiFiClient {
    return this.wifiClient;
  }

  /**
   * Get RTCM client for advanced RTCM operations
   */
  get rtcm (): RTCMClient {
    return this.rtcmClient;
  }

  /**
   * Get mDNS client for service discovery
   */
  get mdns (): MDNSClient {
    return this.mdnsClient;
  }

  /**
   * Get health client for system monitoring
   */
  get health (): HealthClient {
    return this.healthClient;
  }

  /**
   * Get communication client for USB/UART operations
   */
  get communication (): CommunicationClient {
    return this.commClient;
  }

  /**
   * Get MAVLink command client for flight controller commands
   */
  get mavlink (): MAVLinkCommandClient {
    return this.mavlinkClient;
  }

  /**
   * Get MAVLink mission client for mission management
   */
  get mission (): MAVLinkMissionClient {
    return this.missionClient;
  }

  /**
   * Get MAVLink parameter client for parameter management
   */
  get parameters (): MAVLinkParameterClient {
    return this.parameterClient;
  }

  /**
   * Get telemetry client for IMU, compass, and sensor data
   */
  get telemetry (): TelemetryClient {
    return this.telemetryClient;
  }

  /**
   * Get task client for task management
   */
  get tasks (): TaskClient {
    return this.taskClient;
  }

  /**
   * Get zone manager for zone resource management
   */
  get zones (): ZoneManager {
    return this.zoneManager;
  }

  /**
   * Get mission manager for mission resource management
   */
  get missions (): MissionManager {
    return this.missionManager;
  }

  /**
   * Get peripheral client for peripheral management
   */
  get peripherals (): PeripheralClient {
    return this.peripheralClient;
  }

  /**
   * Get zone recording client for GPS-based zone recording
   */
  get recording (): ZoneRecordingClient {
    return this.zoneRecordingClient;
  }

  /**
   * Get WebSocket client for direct event subscription
   * Use this for subscribing to events not covered by the convenience methods
   */
  get ws (): WebSocketClient {
    return this.wsClient;
  }

  /**
   * Connect to a WiFi network
   */
  async connectToWiFi (credentials: WiFiCredentials): Promise<void> {
    await this.wifiClient.connect(credentials);
  }

  /**
   * Disconnect from WiFi
   */
  async disconnectFromWiFi (): Promise<void> {
    await this.wifiClient.disconnect();
  }

  /**
   * Get current WiFi status
   */
  async getWiFiStatus (): Promise<WiFiStatus> {
    return this.wifiClient.getStatus();
  }

  /**
   * Scan for WiFi networks
   */
  async scanWiFiNetworks (force: boolean = false): Promise<WiFiNetwork[]> {
    return this.wifiClient.scan({ force });
  }


  /**
   * Update WiFi settings
   */
  async updateWiFiSettings (ssid: string, autoConnect: boolean = true): Promise<void> {
    await this.configClient.updateWiFiSSID(ssid);
    await this.configClient.updateWiFiAutoConnect(autoConnect);
  }

  // RTCM Management

  /**
   * Start RTCM client
   */
  async startRTCM (): Promise<void> {
    // First enable RTCM in config
    await this.configClient.updateRTCMEnabled(true);

    // Then start the client
    const config = await this.getConfiguration();
    await this.httpClient.post<void>('/api/rtcm/start', config.rtcm);
  }

  /**
   * Stop RTCM client
   */
  async stopRTCM (): Promise<void> {
    await this.httpClient.post<void>('/api/rtcm/stop');

    // Also disable in config
    await this.configClient.updateRTCMEnabled(false);
  }

  /**
   * Configure RTCM source
   */
  async configureRTCMSource (
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

  // Health Monitoring

  /**
   * Get comprehensive system health information
   */
  async getSystemHealth (): Promise<SystemHealth> {
    return this.healthClient.getSystemHealth();
  }

  /**
   * Get system metrics with caching
   */
  async getSystemMetrics (useCache: boolean = true): Promise<SystemMetrics> {
    return this.healthClient.getSystemMetrics(useCache);
  }

  /**
   * Check if system is healthy
   */
  async isSystemHealthy (): Promise<boolean> {
    return this.healthClient.isSystemHealthy();
  }

  /**
   * Get memory usage percentage
   */
  async getMemoryUsage (): Promise<number> {
    return this.healthClient.getMemoryUsage();
  }

  /**
   * Get CPU usage percentage
   */
  async getCPUUsage (): Promise<number> {
    return this.healthClient.getCPUUsage();
  }

  /**
   * Set health monitoring thresholds
   */
  async setHealthThresholds (thresholds: HealthThresholds): Promise<void> {
    return this.healthClient.setThresholds(thresholds);
  }

  /**
   * Trigger emergency memory cleanup
   */
  async emergencyCleanup (): Promise<void> {
    await this.healthClient.emergencyMemoryCleanup();
  }

  /**
   * Listen for system health updates
   */
  onHealthUpdate (handler: (health: any) => void): () => void {
    return this.healthClient.onHealthUpdate(handler);
  }

  /**
   * Listen for low memory warnings
   */
  onLowMemoryWarning (handler: (freeHeap: number) => void): () => void {
    return this.healthClient.onLowMemoryWarning(handler);
  }

  /**
   * Listen for critical errors
   */
  onCriticalError (handler: (error: any) => void): () => void {
    return this.healthClient.onCriticalError(handler);
  }

  // Event Handling

  /**
   * Listen for status updates
   */
  onStatus (handler: (payload: StatusPayload) => void): () => void {
    this.wsClient.on(EventType.STATUS, handler as any);
    return () => this.wsClient.off(EventType.STATUS, handler as any);
  }

  /**
   * Listen for configuration changes
   */
  onConfigChanged (handler: (payload: ConfigChangedPayload) => void): () => void {
    this.wsClient.on(EventType.CONFIG_CHANGED, handler as any);
    return () => this.wsClient.off(EventType.CONFIG_CHANGED, handler as any);
  }

  /**
   * Listen for RTCM data
   */
  onRTCMData (handler: (payload: RTCMDataPayload) => void): () => void {
    this.wsClient.on(EventType.RTCM_DATA, handler as any);
    return () => this.wsClient.off(EventType.RTCM_DATA, handler as any);
  }

  /**
   * Listen for errors
   */
  onError (handler: (payload: ErrorPayload) => void): () => void {
    this.wsClient.on(EventType.ERROR, handler as any);
    return () => this.wsClient.off(EventType.ERROR, handler as any);
  }

  /**
   * Listen for log messages
   */
  onLog (handler: (payload: LogPayload) => void): () => void {
    this.wsClient.on(EventType.LOG, handler as any);
    return () => this.wsClient.off(EventType.LOG, handler as any);
  }

  /**
   * Listen for WiFi connection events
   */
  onWiFiConnected (handler: (payload: WiFiConnectedPayload) => void): () => void {
    this.wsClient.on(EventType.WIFI_CONNECTED, handler as any);
    return () => this.wsClient.off(EventType.WIFI_CONNECTED, handler as any);
  }

  /**
   * Listen for WiFi disconnection events
   */
  onWiFiDisconnected (handler: (payload: WiFiDisconnectedPayload) => void): () => void {
    this.wsClient.on(EventType.WIFI_DISCONNECTED, handler as any);
    return () => this.wsClient.off(EventType.WIFI_DISCONNECTED, handler as any);
  }

  /**
   * Listen for WiFi signal updates
   */
  onWiFiSignalUpdate (handler: (payload: WiFiSignalUpdatePayload) => void): () => void {
    this.wsClient.on(EventType.WIFI_SIGNAL_UPDATE, handler as any);
    return () => this.wsClient.off(EventType.WIFI_SIGNAL_UPDATE, handler as any);
  }

  /**
   * Listen for WiFi state changes (convenience method)
   */
  onWiFiStateChange (handler: (state: WiFiState) => void): () => void {
    return this.wifiClient.onStateChange(handler);
  }

  /**
   * Listen for WiFi connection status changes (convenience method)
   */
  onWiFiStatusChange (handler: (status: WiFiStatus) => void): () => void {
    return this.wifiClient.onConnectionChange(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener (event: EventType, handler: any): void {
    this.wsClient.off(event, handler);
  }

  /**
   * Remove all event listeners for a specific event type
   */
  removeAllListeners (event?: EventType): void {
    this.wsClient.removeAllListeners(event);
  }

  // Utility Methods

  /**
   * Get the device base URL
   */
  getDeviceUrl (): string {
    return this.httpClient.getBaseUrl();
  }

  // MAVLink Commands

  /**
   * Get WebSocket connection state
   */
  getConnectionState (): 'connecting' | 'open' | 'closing' | 'closed' {
    return this.wsClient.getConnectionState();
  }

  /**
   * Manually connect WebSocket if not auto-connecting
   * This should be called after authentication to establish real-time connection
   */
  async connectWebSocket (): Promise<void> {
    await this.wsClient.connect();

    // Subscribe to MAVLink messages after WebSocket is connected
    this.subscribeToMAVLinkMessages();

    // Initialize resource managers if not already initialized
    // This happens when connecting for the first time after authentication
    await this.initializeResourceManagers();
  }

  /**
   * Initialize resource managers after authentication
   * Called automatically by connect() if authenticated, or by connectWebSocket() after login
   */
  async initializeResourceManagers (): Promise<void> {
    // Check if already initialized by checking if database is initialized
    // The 'db' property is protected, so we access it via type assertion
    const zonesInitialized = (this.zoneManager as any).db !== null;
    const missionsInitialized = (this.missionManager as any).db !== null;

    if (!zonesInitialized || !missionsInitialized) {
      // Initialize resource managers
      await this.zoneManager.initialize();
      await this.missionManager.initialize();

      // Connect resource managers to WebSocket for real-time sync
      this.zoneManager.connectWebSocket(this.wsClient);
      this.missionManager.connectWebSocket(this.wsClient);

      // Initial sync with server
      await Promise.all([
        this.zoneManager.sync().catch(console.error),
        this.missionManager.sync().catch(console.error)
      ]);
    }
  }

  /**
   * Ping the device to check connectivity
   */
  async ping (): Promise<boolean> {
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
  getOptions (): Required<MAVLinkBridgeClientOptions> {
    return { ...this.options };
  }

  /**
   * Abort all active HTTP requests
   */
  abortAllRequests (): void {
    this.httpClient.abortAllRequests();
  }

  /**
   * Get count of active HTTP requests
   */
  getActiveRequestCount (): number {
    return this.httpClient.getActiveRequestCount();
  }
}