import { HttpClient } from '../core/HttpClient';
import { WebSocketClient } from '../core/WebSocketClient';
import { EventType } from '../core/EventTypes';
import {
  WiFiCredentials,
  WiFiStatus,
  WiFiNetwork,
  WiFiScanResult,
  SavedWiFiNetwork,
  SavedNetworksResult,
  WiFiState,
  SignalQuality,
  WiFiResponse,
  WiFiConnectResponse,
  WiFiDisconnectResponse,
  AddNetworkResponse,
  RemoveNetworkResponse,
  WiFiConnectOptions,
  WiFiScanOptions,
} from './WiFiTypes';

/**
 * WiFi client for managing ESP32 WiFi connections
 */
export class WiFiClient {
  private stateChangeHandlers: Set<(state: WiFiState) => void> = new Set();
  private signalUpdateHandlers: Set<(quality: SignalQuality) => void> = new Set();
  private connectionHandlers: Set<(status: WiFiStatus) => void> = new Set();
  private scanCompleteHandlers: Set<(networks: WiFiNetwork[]) => void> = new Set();

  constructor(
    private httpClient: HttpClient,
    private wsClient: WebSocketClient,
  ) {
    this.setupEventListeners();
  }

  /**
   * Connect to a WiFi network
   */
  async connect(
    credentials: WiFiCredentials,
    options: WiFiConnectOptions = {}
  ): Promise<WiFiConnectResponse> {
    try {
      const response = await this.httpClient.post<WiFiResponse<WiFiConnectResponse>>(
        '/api/wifi/connect',
        credentials,
        options.timeout ? { timeout: options.timeout } : undefined
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Connection failed');
      }

      return response.data!;
    } catch (error) {
      throw new Error(`Failed to connect to WiFi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from WiFi
   */
  async disconnect(): Promise<WiFiDisconnectResponse> {
    try {
      const response = await this.httpClient.post<WiFiResponse<WiFiDisconnectResponse>>(
        '/api/wifi/disconnect'
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Disconnection failed');
      }

      return response.data!;
    } catch (error) {
      throw new Error(`Failed to disconnect WiFi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current WiFi status
   */
  async getStatus(): Promise<WiFiStatus> {
    try {
      const response = await this.httpClient.get<WiFiResponse<WiFiStatus>>('/api/wifi/status');

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get status');
      }

      return response.data!;
    } catch (error) {
      throw new Error(`Failed to get WiFi status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scan for available WiFi networks
   */
  async scan(options: WiFiScanOptions = {}): Promise<WiFiNetwork[]> {
    try {
      const url = options.force ? '/api/wifi/scan?force=true' : '/api/wifi/scan';
      const response = await this.httpClient.get<WiFiResponse<WiFiScanResult>>(
        url,
        options.timeout ? { timeout: options.timeout } : undefined
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Scan failed');
      }

      return response.data!.networks;
    } catch (error) {
      throw new Error(`Failed to scan WiFi networks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a saved WiFi network
   */
  async addSavedNetwork(
    ssid: string,
    password: string,
    priority: number = 0
  ): Promise<AddNetworkResponse> {
    try {
      const response = await this.httpClient.post<WiFiResponse<AddNetworkResponse>>(
        '/api/wifi/networks',
        { ssid, password, priority }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save network');
      }

      return response.data!;
    } catch (error) {
      throw new Error(`Failed to add saved network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove a saved WiFi network
   */
  async removeSavedNetwork(ssid: string): Promise<RemoveNetworkResponse> {
    try {
      const response = await this.httpClient.delete<WiFiResponse<RemoveNetworkResponse>>(
        `/api/wifi/networks?ssid=${encodeURIComponent(ssid)}`
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to remove network');
      }

      return response.data!;
    } catch (error) {
      throw new Error(`Failed to remove saved network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of saved WiFi networks
   */
  async getSavedNetworks(): Promise<SavedWiFiNetwork[]> {
    try {
      const response = await this.httpClient.get<WiFiResponse<SavedNetworksResult>>(
        '/api/wifi/networks'
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get saved networks');
      }

      return response.data!.networks;
    } catch (error) {
      throw new Error(`Failed to get saved networks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Register a callback for WiFi state changes
   */
  onStateChange(callback: (state: WiFiState) => void): () => void {
    this.stateChangeHandlers.add(callback);
    return () => this.stateChangeHandlers.delete(callback);
  }

  /**
   * Register a callback for WiFi signal quality updates
   */
  onSignalUpdate(callback: (quality: SignalQuality) => void): () => void {
    this.signalUpdateHandlers.add(callback);
    return () => this.signalUpdateHandlers.delete(callback);
  }

  /**
   * Register a callback for WiFi connection status changes
   */
  onConnectionChange(callback: (status: WiFiStatus) => void): () => void {
    this.connectionHandlers.add(callback);
    return () => this.connectionHandlers.delete(callback);
  }

  /**
   * Register a callback for WiFi scan completion
   */
  onScanComplete(callback: (networks: WiFiNetwork[]) => void): () => void {
    this.scanCompleteHandlers.add(callback);
    return () => this.scanCompleteHandlers.delete(callback);
  }

  /**
   * Set up WebSocket event listeners for WiFi events
   */
  private setupEventListeners(): void {
    // Connection state events
    this.wsClient.on(EventType.WIFI_CONNECTING, (data: any) => {
      this.notifyStateChange(WiFiState.CONNECTING);
    });

    this.wsClient.on(EventType.WIFI_CONNECTED, (data: any) => {
      this.notifyStateChange(WiFiState.CONNECTED);
      
      // Create status object from connection event
      const status: WiFiStatus = {
        state: WiFiState.CONNECTED,
        connected: true,
        ssid: data.ssid as string,
        ip: data.ip as string,
        rssi: data.rssi as number,
        quality: this.calculateQuality(data.rssi as number),
      };
      
      this.notifyConnectionChange(status);
    });

    this.wsClient.on(EventType.WIFI_DISCONNECTED, (data: any) => {
      this.notifyStateChange(WiFiState.DISCONNECTED);
      
      const status: WiFiStatus = {
        state: WiFiState.DISCONNECTED,
        connected: false,
      };
      
      this.notifyConnectionChange(status);
    });

    // Signal quality updates
    this.wsClient.on(EventType.WIFI_SIGNAL_UPDATE, (data: any) => {
      const quality: SignalQuality = {
        rssi: data.rssi as number,
        quality: data.quality as number,
      };
      
      this.notifySignalUpdate(quality);
    });

    // AP mode events
    this.wsClient.on(EventType.WIFI_AP_MODE_STARTED, (data: any) => {
      this.notifyStateChange(WiFiState.AP_MODE);
      
      const status: WiFiStatus = {
        state: WiFiState.AP_MODE,
        connected: false,
        apMode: true,
        apIP: data.ip as string,
        apSSID: data.ssid as string,
      };
      
      this.notifyConnectionChange(status);
    });

    this.wsClient.on(EventType.WIFI_AP_MODE_STOPPED, () => {
      this.notifyStateChange(WiFiState.DISCONNECTED);
      
      const status: WiFiStatus = {
        state: WiFiState.DISCONNECTED,
        connected: false,
        apMode: false,
      };
      
      this.notifyConnectionChange(status);
    });

    // Scan completion
    this.wsClient.on(EventType.WIFI_SCAN_COMPLETED, (data: any) => {
      const networks = (data.networks as any[]).map(network => ({
        ssid: network.ssid,
        rssi: network.rssi,
        secure: network.secure,
        authMode: network.authMode || 'unknown',
        channel: network.channel,
        quality: this.calculateQuality(network.rssi),
      }));
      
      this.notifyScanComplete(networks);
    });
  }

  /**
   * Calculate signal quality percentage from RSSI
   */
  private calculateQuality(rssi: number): number {
    if (rssi >= -50) return 100;
    if (rssi >= -60) return 80;
    if (rssi >= -70) return 60;
    if (rssi >= -80) return 40;
    return 20;
  }

  /**
   * Notify state change handlers
   */
  private notifyStateChange(state: WiFiState): void {
    this.stateChangeHandlers.forEach(handler => {
      try {
        handler(state);
      } catch (error) {
        console.error('Error in WiFi state change handler:', error);
      }
    });
  }

  /**
   * Notify signal update handlers
   */
  private notifySignalUpdate(quality: SignalQuality): void {
    this.signalUpdateHandlers.forEach(handler => {
      try {
        handler(quality);
      } catch (error) {
        console.error('Error in WiFi signal update handler:', error);
      }
    });
  }

  /**
   * Notify connection change handlers
   */
  private notifyConnectionChange(status: WiFiStatus): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('Error in WiFi connection change handler:', error);
      }
    });
  }

  /**
   * Notify scan complete handlers
   */
  private notifyScanComplete(networks: WiFiNetwork[]): void {
    this.scanCompleteHandlers.forEach(handler => {
      try {
        handler(networks);
      } catch (error) {
        console.error('Error in WiFi scan complete handler:', error);
      }
    });
  }
}