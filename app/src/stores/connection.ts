import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api/client';
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  currentDevice: MAVLinkBridgeDevice | null;
  connectionUrl: string | null;
  lastConnected: Date | null;
  errorMessage: string | null;
  signalStrength: number;
  latency: number;
}

export const useConnectionStore = defineStore('connection', () => {
  // State
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const currentDevice = ref<MAVLinkBridgeDevice | null>(null);
  const connectionUrl = ref<string | null>(null);
  const lastConnected = ref<Date | null>(null);
  const errorMessage = ref<string | null>(null);
  const signalStrength = ref(0);
  const latency = ref(0);
  const autoReconnect = ref(true);
  const reconnectAttempts = ref(0);
  
  // Getters
  const connectionStatus = computed(() => {
    if (isConnecting.value) return 'connecting';
    if (isConnected.value) return 'connected';
    if (errorMessage.value) return 'error';
    return 'disconnected';
  });
  
  const connectionQuality = computed(() => {
    if (!isConnected.value) return 'none';
    if (signalStrength.value > -50) return 'excellent';
    if (signalStrength.value > -60) return 'good';
    if (signalStrength.value > -70) return 'fair';
    return 'poor';
  });
  
  const connectionStatusColor = computed(() => {
    switch (connectionStatus.value) {
      case 'connected': return 'positive';
      case 'connecting': return 'warning';
      case 'error': return 'negative';
      default: return 'grey';
    }
  });
  
  const connectionStatusText = computed(() => {
    switch (connectionStatus.value) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Error';
      default: return 'Disconnected';
    }
  });
  
  // Actions
  async function connect(url: string, device?: MAVLinkBridgeDevice) {
    try {
      isConnecting.value = true;
      errorMessage.value = null;
      
      await apiClient.connect(url);
      
      isConnected.value = true;
      connectionUrl.value = url;
      currentDevice.value = device || null;
      lastConnected.value = new Date();
      reconnectAttempts.value = 0;
      
      // Start monitoring connection health
      startHealthMonitoring();
    } catch (error) {
      errorMessage.value = (error as Error).message;
      throw error;
    } finally {
      isConnecting.value = false;
    }
  }
  
  async function disconnect() {
    apiClient.disconnect();
    
    isConnected.value = false;
    isConnecting.value = false;
    currentDevice.value = null;
    connectionUrl.value = null;
    signalStrength.value = 0;
    latency.value = 0;
    
    stopHealthMonitoring();
  }
  
  async function reconnect() {
    if (!connectionUrl.value || !autoReconnect.value) return;
    
    reconnectAttempts.value++;
    
    try {
      await connect(connectionUrl.value, currentDevice.value);
    } catch (error) {
      if (reconnectAttempts.value < 5) {
        setTimeout(() => reconnect(), 2000 * reconnectAttempts.value);
      } else {
        errorMessage.value = 'Maximum reconnection attempts reached';
        autoReconnect.value = false;
      }
    }
  }
  
  let healthInterval: NodeJS.Timeout | null = null;
  
  function startHealthMonitoring() {
    stopHealthMonitoring();
    
    healthInterval = setInterval(async () => {
      if (!isConnected.value) return;
      
      try {
        const startTime = Date.now();
        const health = await apiClient.getClient().getHealth();
        latency.value = Date.now() - startTime;
        
        if (health.network?.wifi?.rssi) {
          signalStrength.value = health.network.wifi.rssi;
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 5000);
  }
  
  function stopHealthMonitoring() {
    if (healthInterval) {
      clearInterval(healthInterval);
      healthInterval = null;
    }
  }
  
  return {
    // State
    isConnected,
    isConnecting,
    currentDevice,
    connectionUrl,
    lastConnected,
    errorMessage,
    signalStrength,
    latency,
    autoReconnect,
    reconnectAttempts,
    
    // Getters
    connectionStatus,
    connectionQuality,
    connectionStatusColor,
    connectionStatusText,
    
    // Actions
    connect,
    disconnect,
    reconnect
  };
});