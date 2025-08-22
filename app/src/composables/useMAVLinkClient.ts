import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMAVLinkStore } from '../stores/mavlink'
import type { MAVLinkBridgeClientOptions } from '@mavlinkbridge/api-client'

export function useMAVLinkClient() {
  const store = useMAVLinkStore()
  
  // Reactive refs from store
  const { 
    client, 
    isConnected, 
    isConnecting, 
    connectionError, 
    lastConnectedUrl 
  } = storeToRefs(store)

  // Computed getters
  const connectionStatus = computed(() => store.connectionStatus)
  const isReady = computed(() => store.isReady)

  // Connection methods
  const connect = async (deviceUrl: string, options?: Partial<MAVLinkBridgeClientOptions>) => {
    return await store.connect(deviceUrl, options)
  }

  const disconnect = () => {
    return store.disconnect()
  }

  const reconnect = async () => {
    return await store.reconnect()
  }

  const clearError = () => {
    store.clearError()
  }

  // Auto-connect helper
  const autoConnect = async (deviceUrl?: string) => {
    const urlToUse = deviceUrl || 
      lastConnectedUrl.value || 
      import.meta.env.VITE_DEFAULT_DEVICE_URL

    if (!urlToUse) {
      throw new Error('No device URL provided for auto-connection')
    }

    return await connect(urlToUse)
  }

  return {
    // State
    client: computed(() => client.value),
    isConnected: computed(() => isConnected.value),
    isConnecting: computed(() => isConnecting.value),
    connectionError: computed(() => connectionError.value),
    lastConnectedUrl: computed(() => lastConnectedUrl.value),
    
    // Getters
    connectionStatus,
    isReady,
    
    // Actions
    connect,
    disconnect,
    reconnect,
    clearError,
    autoConnect
  }
}