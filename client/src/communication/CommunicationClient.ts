import { HttpClient } from '../core/HttpClient';
import { WebSocketClient } from '../core/WebSocketClient';
import { EventType } from '../core/EventTypes';
import {
  Interface,
  RoutingMode,
  InterfaceChangeEvent,
  DataFlowStats,
  CommunicationStats,
  MAVLinkMessage,
  MAVLinkFilter,
  CommunicationConfig,
  CommunicationStatus,
  CommunicationError,
  CommunicationErrorType,
  InterfaceChangeCallback,
  DataFlowCallback,
  MAVLinkMessageCallback,
  CommunicationErrorCallback,
  StatisticsCallback
} from './CommunicationTypes';

/**
 * Client for managing communication system
 */
export class CommunicationClient {
  private httpClient: HttpClient;
  private wsClient: WebSocketClient;
  private callbacks = new Map<string, Function[]>();

  constructor(httpClient: HttpClient, wsClient: WebSocketClient) {
    this.httpClient = httpClient;
    this.wsClient = wsClient;
    this.setupEventListeners();
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupEventListeners (): void {
    // Interface events
    this.wsClient.on(EventType.USB_CONNECTED, (payload) => {
      this.triggerCallbacks('interfaceChange', {
        from: Interface.NONE,
        to: Interface.USB_OTG,
        reason: 'usb_connected',
        timestamp: Date.now()
      });
    });

    this.wsClient.on(EventType.USB_DISCONNECTED, (payload) => {
      this.triggerCallbacks('interfaceChange', {
        from: Interface.USB_OTG,
        to: Interface.NONE,
        reason: 'usb_disconnected',
        timestamp: Date.now()
      });
    });

    this.wsClient.on(EventType.UART_CONNECTED, (payload) => {
      this.triggerCallbacks('interfaceChange', {
        from: Interface.NONE,
        to: Interface.UART,
        reason: 'uart_connected',
        timestamp: Date.now()
      });
    });

    this.wsClient.on(EventType.UART_DISCONNECTED, (payload) => {
      this.triggerCallbacks('interfaceChange', {
        from: Interface.UART,
        to: Interface.NONE,
        reason: 'uart_disconnected',
        timestamp: Date.now()
      });
    });

    this.wsClient.on(EventType.INTERFACE_SWITCHED, (payload: any) => {
      const event: InterfaceChangeEvent = {
        from: payload.from as Interface,
        to: payload.to as Interface,
        reason: payload.reason as string,
        timestamp: Date.now()
      };
      this.triggerCallbacks('interfaceChange', event);
    });

    // MAVLink events
    this.wsClient.on(EventType.MAVLINK_MESSAGE, (payload: any) => {
      // Support both snake_case (Python backend) and camelCase field names
      const messageId = payload.message_id ?? payload.messageId;
      const messageName = payload.message_name ?? payload.messageName; // Backend provides human-readable name
      const systemId = payload.system_id ?? payload.systemId;
      const componentId = payload.component_id ?? payload.componentId;

      // Support both object payload (decoded) and base64 string payload (raw)
      // Backend can send either:
      // - payload.payload (object with decoded fields)
      // - payload.data (base64 encoded string)
      const messagePayload = payload.payload ?? payload.data;

      const message: MAVLinkMessage = {
        messageId: messageId as number,
        ...(messageName && { messageName: messageName as string }),
        systemId: systemId as number,
        componentId: componentId as number,
        sequence: 0, // This would need to be added to the payload
        length: payload.length ?? 0,
        payload: messagePayload,
        timestamp: Date.now(),
        valid: true
      };

      this.triggerCallbacks('mavlinkMessage', message);
    });

    // Statistics events
    this.wsClient.on(EventType.COMMUNICATION_STATS, (payload: any) => {
      const stats: DataFlowStats = {
        interface: payload.interface as Interface,
        upstreamRate: payload.upstreamRate as number,
        downstreamRate: payload.downstreamRate as number,
        packetsReceived: payload.packetsReceived as number,
        packetsSent: payload.packetsSent as number,
        bytesReceived: payload.bytesReceived as number,
        bytesSent: payload.bytesSent as number,
        interfaceSwitches: 0, // This would need to be added to the payload
        lastSwitchMs: 0 // This would need to be added to the payload
      };
      this.triggerCallbacks('dataFlow', stats);
    });

    // Error events
    this.wsClient.on(EventType.ERROR, (payload: any) => {
      if (payload.component === 'communication') {
        const error: CommunicationError = {
          type: CommunicationErrorType.INTERFACE_ERROR,
          message: payload.message as string,
          timestamp: payload.timestamp as number,
          details: payload as Record<string, unknown>
        };
        this.triggerCallbacks('error', error);
      }
    });
  }

  /**
   * Trigger callbacks for a specific event type
   */
  private triggerCallbacks (eventType: string, data: unknown): void {
    const callbacks = this.callbacks.get(eventType) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventType} callback:`, error);
      }
    });
  }

  /**
   * Add a callback for a specific event type
   */
  private addCallback (eventType: string, callback: Function): void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, []);
    }
    this.callbacks.get(eventType)!.push(callback);
  }

  /**
   * Remove a callback for a specific event type
   */
  private removeCallback (eventType: string, callback: Function): void {
    const callbacks = this.callbacks.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Event subscription methods

  /**
   * Subscribe to interface change events
   */
  onInterfaceChange (callback: InterfaceChangeCallback): () => void {
    this.addCallback('interfaceChange', callback);
    return () => this.removeCallback('interfaceChange', callback);
  }

  /**
   * Subscribe to data flow statistics
   */
  onDataFlow (callback: DataFlowCallback): () => void {
    this.addCallback('dataFlow', callback);
    return () => this.removeCallback('dataFlow', callback);
  }

  /**
   * Subscribe to MAVLink messages
   */
  onMAVLinkMessage (callback: MAVLinkMessageCallback): () => void {
    this.addCallback('mavlinkMessage', callback);
    return () => this.removeCallback('mavlinkMessage', callback);
  }

  /**
   * Subscribe to communication errors
   */
  onError (callback: CommunicationErrorCallback): () => void {
    this.addCallback('error', callback);
    return () => this.removeCallback('error', callback);
  }

  /**
   * Subscribe to statistics updates
   */
  onStatistics (callback: StatisticsCallback): () => void {
    this.addCallback('statistics', callback);
    return () => this.removeCallback('statistics', callback);
  }

  // API methods

  /**
   * Get current communication status
   */
  async getStatus (): Promise<CommunicationStatus> {
    return await this.httpClient.get<CommunicationStatus>('/api/communication/status');
  }

  /**
   * Get current communication statistics
   */
  async getStatistics (): Promise<CommunicationStats> {
    return await this.httpClient.get<CommunicationStats>('/api/communication/statistics');
  }

  /**
   * Get current active interface
   */
  async getActiveInterface (): Promise<Interface> {
    const status = await this.getStatus();
    return status.activeInterface;
  }

  /**
   * Get current routing mode
   */
  async getRoutingMode (): Promise<RoutingMode> {
    const status = await this.getStatus();
    return status.routingMode;
  }

  /**
   * Set routing mode
   */
  async setRoutingMode (mode: RoutingMode): Promise<void> {
    await this.httpClient.post('/api/communication/routing', { mode });
  }

  /**
   * Switch to a specific interface
   */
  async switchInterface (targetInterface: Interface): Promise<void> {
    await this.httpClient.post('/api/communication/interface', { interface: targetInterface });
  }

  /**
   * Get communication configuration
   */
  async getConfiguration (): Promise<CommunicationConfig> {
    const response: any = await this.httpClient.get('/api/communication/config');
    return response.data as CommunicationConfig;
  }

  /**
   * Update communication configuration
   */
  async updateConfiguration (config: Partial<CommunicationConfig>): Promise<void> {
    await this.httpClient.patch('/api/communication/config', config);
  }

  /**
   * Enable/disable MAVLink processing
   */
  async setMAVLinkProcessing (enabled: boolean): Promise<void> {
    await this.httpClient.post('/api/communication/mavlink/processing', { enabled });
  }

  /**
   * Set MAVLink message filter
   */
  async setMAVLinkFilter (filter: MAVLinkFilter): Promise<void> {
    await this.httpClient.post('/api/communication/mavlink/filter', filter);
  }

  /**
   * Get MAVLink message filter
   */
  async getMAVLinkFilter (): Promise<MAVLinkFilter> {
    const response: any = await this.httpClient.get('/api/communication/mavlink/filter');
    return response.data as MAVLinkFilter;
  }

  /**
   * Clear MAVLink message filter
   */
  async clearMAVLinkFilter (): Promise<void> {
    await this.httpClient.delete('/api/communication/mavlink/filter');
  }

  /**
   * Send data to the active interface
   */
  async sendData (data: string): Promise<void> {
    await this.httpClient.post('/api/communication/send', { data });
  }

  /**
   * Reset communication statistics
   */
  async resetStatistics (): Promise<void> {
    await this.httpClient.post('/api/communication/statistics/reset');
  }

  /**
   * Test interface connectivity
   */
  async testInterface (targetInterface: Interface): Promise<boolean> {
    const response: any = await this.httpClient.post('/api/communication/test', { interface: targetInterface });
    return response.data.success as boolean;
  }

  /**
   * Get available interfaces
   */
  async getAvailableInterfaces (): Promise<Interface[]> {
    const response: any = await this.httpClient.get('/api/communication/interfaces');
    return response.data.interfaces as Interface[];
  }

  /**
   * Force interface detection
   */
  async detectInterfaces (): Promise<Interface[]> {
    const response: any = await this.httpClient.post('/api/communication/detect');
    return response.data.interfaces as Interface[];
  }

  /**
   * Get interface health status
   */
  async getInterfaceHealth (): Promise<Record<Interface, boolean>> {
    const response: any = await this.httpClient.get('/api/communication/health');
    return response.data as Record<Interface, boolean>;
  }

  /**
   * Restart communication system
   */
  async restart (): Promise<void> {
    await this.httpClient.post('/api/communication/restart');
  }
}