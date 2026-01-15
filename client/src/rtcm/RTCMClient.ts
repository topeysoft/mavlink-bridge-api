import { HttpClient } from '../core/HttpClient';
import { WebSocketClient } from '../core/WebSocketClient';
import { EventType } from '../core/EventTypes';
import {
  RTCMConfig,
  RTCMStatus,
  RTCMResponse,
  RTCMDataEvent,
  RTCMStateChangeEvent,
  RTCMState,
  NTRIPSource,
  TCPSource,
  UDPSource
} from './RTCMTypes';

export class RTCMClient {
  private dataCallbacks: Array<(data: RTCMDataEvent) => void> = [];
  private stateChangeCallbacks: Array<(state: RTCMState) => void> = [];
  private statusChangeCallbacks: Array<(status: RTCMStatus) => void> = [];

  constructor(
    private httpClient: HttpClient,
    private wsClient: WebSocketClient,
  ) {
    this.setupEventListeners();
  }

  /**
   * Start RTCM client with the given configuration
   */
  async start (config: Partial<RTCMConfig>): Promise<RTCMResponse> {
    const response = await this.httpClient.post<RTCMResponse>('/api/rtcm/start', { config });
    return response;
  }

  /**
   * Stop the RTCM client
   */
  async stop (): Promise<RTCMResponse> {
    const response = await this.httpClient.post<RTCMResponse>('/api/rtcm/stop');
    return response;
  }

  /**
   * Get current RTCM client status
   */
  async getStatus (): Promise<RTCMStatus> {
    const response = await this.httpClient.get<RTCMStatus>('/api/rtcm/status');
    return response;
  }

  /**
   * Get current RTCM configuration
   */
  async getConfig (): Promise<RTCMConfig> {
    const response = await this.httpClient.get<RTCMConfig>('/api/rtcm/config');
    return response;
  }

  /**
   * Register callback for RTCM data events
   */
  onDataReceived (callback: (data: RTCMDataEvent) => void): () => void {
    this.dataCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.dataCallbacks.indexOf(callback);
      if (index > -1) {
        this.dataCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for state change events
   */
  onStateChange (callback: (state: RTCMState) => void): () => void {
    this.stateChangeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for status change events (full status updates)
   */
  onStatusChange (callback: (status: RTCMStatus) => void): () => void {
    this.statusChangeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.statusChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start NTRIP client with common configuration
   */
  async startNTRIP (config: {
    host: string;
    port: number;
    mountpoint: string;
    username?: string;
    password?: string;
    sendPosition?: boolean;
    position?: {
      latitude: number;
      longitude: number;
      altitude?: number;
    };
  }): Promise<RTCMResponse> {
    const rtcmConfig: Partial<RTCMConfig> = {
      enabled: true,
      source: {
        type: 'ntrip',
        ...config,
        position: config.position || undefined
      } as NTRIPSource,
      outputFormat: 'raw'
    };

    return this.start(rtcmConfig);
  }

  /**
   * Start TCP RTCM client
   */
  async startTCP (host: string, port: number): Promise<RTCMResponse> {
    const rtcmConfig: Partial<RTCMConfig> = {
      enabled: true,
      source: {
        type: 'tcp',
        host,
        port
      },
      outputFormat: 'raw'
    };

    return this.start(rtcmConfig);
  }

  /**
   * Start UDP RTCM client
   */
  async startUDP (port: number, remoteHost?: string, remotePort?: number): Promise<RTCMResponse> {
    const rtcmConfig: Partial<RTCMConfig> = {
      enabled: true,
      source: {
        type: 'udp',
        port,
        ...(remoteHost && { remoteHost }),
        ...(remotePort && { remotePort })
      } as UDPSource,
      outputFormat: 'raw'
    };

    return this.start(rtcmConfig);
  }

  private setupEventListeners () {
    // Listen for RTCM data events
    this.wsClient.on(EventType.RTCM_DATA, ((data: RTCMDataEvent) => {
      this.dataCallbacks.forEach(callback => callback(data));
    }) as any);

    // Listen for state change events
    this.wsClient.on(EventType.RTCM_STATE_CHANGE, ((data: RTCMStateChangeEvent) => {
      const state = this.mapStateNumberToEnum(data.state);
      this.stateChangeCallbacks.forEach(callback => callback(state));
    }) as any);

    // Listen for full status change events
    this.wsClient.on(EventType.RTCM_STATUS_CHANGED, ((status: RTCMStatus) => {
      this.statusChangeCallbacks.forEach(callback => callback(status));
    }) as any);
  }

  private mapStateNumberToEnum (stateNum: number): RTCMState {
    switch (stateNum) {
      case 0: return RTCMState.DISCONNECTED;
      case 1: return RTCMState.CONNECTING;
      case 2: return RTCMState.CONNECTED;
      case 3: return RTCMState.ERROR;
      default: return RTCMState.DISCONNECTED;
    }
  }
}