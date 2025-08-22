import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMAVLinkClient } from '../composables/useMAVLinkClient'
import type { 
  WiFiStatus, 
  WiFiNetwork, 
  SavedWiFiNetwork,
  WiFiCredentials,
  WiFiConnectedPayload,
  WiFiSignalUpdatePayload
} from '@mavlinkbridge/api-client'
import { WiFiState } from '@mavlinkbridge/api-client'
import { createAsyncState, setAsyncLoading, setAsyncData, setAsyncError, createStoreError } from './types'

export const useWiFiStore = defineStore('wifi', () => {
  // State
  const status = ref(createAsyncState<WiFiStatus>())
  const networks = ref(createAsyncState<WiFiNetwork[]>())
  const savedNetworks = ref(createAsyncState<SavedWiFiNetwork[]>())
  const isScanning = ref(false)
  const connectionProgress = ref<string | null>(null)
  const lastScanTime = ref<number | null>(null)

  // Getters (computed)
  const isConnected = computed(() => status.value.data?.state === WiFiState.CONNECTED)
  const currentSSID = computed(() => status.value.data?.ssid)
  const signalStrength = computed(() => status.value.data?.rssi || 0)
  
  const signalQuality = computed(() => {
    const rssi = signalStrength.value
    if (rssi >= -50) return 'excellent'
    if (rssi >= -60) return 'good'
    if (rssi >= -70) return 'fair'
    return 'poor'
  })
  
  const connectionState = computed(() => {
    if (!status.value.data) return 'unknown'
    return status.value.data.state
  })
  
  const availableNetworks = computed(() => {
    return networks.value.data?.filter(network => network.ssid && network.ssid.length > 0) || []
  })
  
  const strongNetworks = computed(() => {
    return networks.value.data?.filter(network => (network.rssi || -100) > -70) || []
  })

  // Actions
  async function fetchStatus() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    setAsyncLoading(status.value)
    
    try {
      const response = await client.value.wifi.getStatus()
      setAsyncData(status.value, response)
    } catch (error) {
      const storeError = createStoreError(
        'WIFI_STATUS_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch WiFi status',
        error
      )
      setAsyncError(status.value, storeError)
      throw error
    }
  }

  async function scanNetworks() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    isScanning.value = true
    setAsyncLoading(networks.value)
    
    try {
      const response = await client.value.wifi.scan()
      setAsyncData(networks.value, response)
      lastScanTime.value = Date.now()
    } catch (error) {
      const storeError = createStoreError(
        'WIFI_SCAN_ERROR',
        error instanceof Error ? error.message : 'Failed to scan WiFi networks',
        error
      )
      setAsyncError(networks.value, storeError)
      throw error
    } finally {
      isScanning.value = false
    }
  }

  async function connect(credentials: WiFiCredentials) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    connectionProgress.value = 'Connecting...'
    
    try {
      await client.value.wifi.connect(credentials)
      connectionProgress.value = 'Connected successfully'
    } catch (error) {
      connectionProgress.value = null
      const storeError = createStoreError(
        'WIFI_CONNECT_ERROR',
        error instanceof Error ? error.message : 'Failed to connect to WiFi',
        error
      )
      setAsyncError(status.value, storeError)
      throw error
    }
  }

  async function disconnect() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      await client.value.wifi.disconnect()
      connectionProgress.value = 'Disconnected'
    } catch (error) {
      const storeError = createStoreError(
        'WIFI_DISCONNECT_ERROR',
        error instanceof Error ? error.message : 'Failed to disconnect from WiFi',
        error
      )
      setAsyncError(status.value, storeError)
      throw error
    }
  }

  function handleWiFiConnected(payload: WiFiConnectedPayload) {
    connectionProgress.value = 'Connected!'
    if (status.value.data) {
      status.value.data.state = WiFiState.CONNECTED
      status.value.data.ssid = payload.ssid
      status.value.data.ip = payload.ip
      status.value.lastUpdated = Date.now()
    }
    
    // Clear connection progress after a delay
    setTimeout(() => {
      connectionProgress.value = null
    }, 3000)
  }

  function handleWiFiDisconnected() {
    connectionProgress.value = null
    if (status.value.data) {
      status.value.data.state = WiFiState.DISCONNECTED
      status.value.data.ssid = ''
      status.value.data.ip = ''
      status.value.data.rssi = 0
      status.value.lastUpdated = Date.now()
    }
  }

  function handleSignalUpdate(payload: WiFiSignalUpdatePayload) {
    if (status.value.data && status.value.data.state === WiFiState.CONNECTED) {
      status.value.data.rssi = payload.rssi
      status.value.lastUpdated = Date.now()
    }
  }

  function setupWebSocketHandlers() {
    const { client } = useMAVLinkClient()
    if (!client.value) return

    // WiFi connection events
    client.value.onWiFiConnected((payload) => {
      handleWiFiConnected(payload)
    })

    client.value.onWiFiDisconnected(() => {
      handleWiFiDisconnected()
    })

    client.value.onWiFiSignalUpdate((payload) => {
      handleSignalUpdate(payload)
    })

    // WiFi state and status changes (if available)
    if (typeof client.value.onWiFiStateChange === 'function') {
      client.value.onWiFiStateChange((state) => {
        if (status.value.data) {
          status.value.data.state = state
          status.value.lastUpdated = Date.now()
        }
      })
    }

    if (typeof client.value.onWiFiStatusChange === 'function') {
      client.value.onWiFiStatusChange((statusUpdate) => {
        setAsyncData(status.value, statusUpdate)
      })
    }
  }

  function clearErrors() {
    status.value.error = null
    networks.value.error = null
    savedNetworks.value.error = null
  }

  function clearConnectionProgress() {
    connectionProgress.value = null
  }

  async function refreshData() {
    try {
      await Promise.all([
        fetchStatus()
      ])
    } catch (error) {
      console.error('Failed to refresh WiFi data:', error)
      throw error
    }
  }

  async function quickScan() {
    // Only scan if we haven't scanned recently (within last 30 seconds)
    const thirtySecondsAgo = Date.now() - 30000
    if (lastScanTime.value && lastScanTime.value > thirtySecondsAgo) {
      return // Skip scan, too recent
    }
    
    await scanNetworks()
  }

  async function addNetwork(credentials: WiFiCredentials) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    // Add network to saved networks (this would be a new API endpoint)
    // For now, just connect to the network
    await connect(credentials)
  }

  return {
    // State
    status,
    networks,
    savedNetworks,
    isScanning,
    connectionProgress,
    lastScanTime,
    
    // Getters
    isConnected,
    currentSSID,
    signalStrength,
    signalQuality,
    connectionState,
    availableNetworks,
    strongNetworks,
    
    // Actions
    fetchStatus,
    scanNetworks,
    connect,
    disconnect,
    handleWiFiConnected,
    handleWiFiDisconnected,
    handleSignalUpdate,
    setupWebSocketHandlers,
    clearErrors,
    clearConnectionProgress,
    refreshData,
    quickScan,
    addNetwork
  }
})