import { useConnectionStore } from '@/stores/connection';
import { Notify } from 'quasar';
import { MAVLinkBridgeClient, discoverMAVLinkBridgeDevices } from '@mavlinkbridge/api-client';

class ApiClient {
  private client: MAVLinkBridgeClient | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async connect (url: string): Promise<void> {
    try {
      this.disconnect();

      this.client = new MAVLinkBridgeClient(url, {
        autoConnectWebSocket: true,
        reconnectDelay: 1000,
        maxReconnectAttempts: 5
      });

      await this.client.connect();

      // Set up event handlers
      this.setupEventHandlers();

      // Connection store will be updated via the connect method

      Notify.create({
        type: 'positive',
        message: 'Connected to YardRover'
      });
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      Notify.create({
        type: 'negative',
        message: `Connection failed: ${errorMessage}`
      });
      throw error;
    }
  }

  disconnect (): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  getClient (): MAVLinkBridgeClient {
    if (!this.client) {
      throw new Error('Not connected to device');
    }
    return this.client;
  }

  async discoverDevices (timeout = 5000): Promise<string[]> {
    const result = await discoverMAVLinkBridgeDevices({ timeout });
    return result.devices.map(device => `http://${device.ip}`);
  }

  isConnected (): boolean {
    return this.client !== null && this.client.isConnected();
  }

  private setupEventHandlers (): void {
    if (!this.client) return;

    this.client.onError((error) => {
      console.error('API Client Error:', error);

      Notify.create({
        type: 'negative',
        message: `Error: ${error.message || 'Unknown error'}`
      });
    });

    this.client.onStatus((status) => {
      // Handle status updates if needed
      console.log('Device status:', status);
    });
  }
}

export const apiClient = new ApiClient();