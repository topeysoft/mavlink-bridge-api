import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMAVLinkClient } from '../composables/useMAVLinkClient'
import type { StatusPayload } from '@mavlinkbridge/api-client'

// Define HealthCheckResponse locally since it's not exported from the client yet
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded'
  uptime: number
  freeHeap: number
  device: {
    hostname: string
    name: string
    chipModel: string
    chipRevision: number
    flashSize: number
    sdkVersion: string
    coreCount: number
  }
  network: {
    macAddress: string
    apMacAddress: string
    wifi: {
      status: 'disconnected' | 'connecting' | 'connected' | 'ap_mode' | 'error'
      ssid?: string
      ip?: string
      gateway?: string
      subnet?: string
      rssi?: number
      bssid?: string
      channel?: number
    }
    ap: {
      enabled: boolean
      ip?: string
      ssid?: string
      clients?: number
    }
  }
  system?: {
    systemHealthy: boolean
    cpuUsage: number
    temperature: number
    lowMemoryWarning: boolean
    minFreeHeap: number
    largestFreeBlock: number
    taskCount: number
    componentCount: number
    components: Array<{
      name: string
      healthy: boolean
      status: string
      lastUpdate: number
      message?: string
    }>
  }
}

import { createAsyncState, setAsyncLoading, setAsyncData, setAsyncError, createStoreError } from './types'

export const useDeviceStore = defineStore('device', () => {
  // State
  const health = ref(createAsyncState<HealthCheckResponse>())
  const status = ref(createAsyncState<StatusPayload>())
  const isWebSocketConnected = ref(false)
  const reconnectAttempts = ref(0)

  // Getters (computed)
  const deviceInfo = computed(() => health.value.data?.device)
  const networkInfo = computed(() => health.value.data?.network)
  const systemMetrics = computed(() => health.value.data?.system)
  const isHealthy = computed(() => health.value.data?.status === 'healthy')
  const uptime = computed(() => status.value.data?.uptime || 0)
  const freeHeap = computed(() => status.value.data?.freeHeap || 0)
  
  const deviceStatus = computed((): 'healthy' | 'degraded' | 'unknown' => {
    if (!health.value.data) return 'unknown'
    return health.value.data.status
  })
  
  const connectionQuality = computed((): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' => {
    if (!isWebSocketConnected.value) return 'poor'
    if (reconnectAttempts.value === 0) return 'excellent'
    if (reconnectAttempts.value < 3) return 'good'
    if (reconnectAttempts.value < 5) return 'fair'
    return 'poor'
  })

  // Actions
  async function fetchHealth() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    setAsyncLoading(health.value)
    
    try {
      const response = await client.value.getHealth()
      setAsyncData(health.value, response)
    } catch (error) {
      const storeError = createStoreError(
        'HEALTH_FETCH_ERROR',
        error instanceof Error ? error.message : 'Unknown error occurred',
        error
      )
      setAsyncError(health.value, storeError)
      throw error
    }
  }

  async function fetchSystemHealth() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      const response = await client.value.health.getSystemHealth()
      if (health.value.data) {
        // Update the health data with system health info
        health.value.data = { ...health.value.data, ...response }
        health.value.lastUpdated = Date.now()
      }
    } catch (error) {
      const storeError = createStoreError(
        'SYSTEM_HEALTH_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch system health',
        error
      )
      setAsyncError(health.value, storeError)
      throw error
    }
  }

  function handleStatusUpdate(payload: StatusPayload) {
    setAsyncData(status.value, payload)
  }

  function handleHealthUpdate(payload: HealthCheckResponse) {
    setAsyncData(health.value, payload)
  }

  function setupWebSocketHandlers() {
    const { client } = useMAVLinkClient()
    if (!client.value) return

    // Status updates
    client.value.onStatus((payload) => {
      handleStatusUpdate(payload)
    })

    // Health updates
    client.value.onHealthUpdate((payload) => {
      if (payload.health) {
        handleHealthUpdate(payload.health)
      }
    })

    // System log events
    client.value.onLog((payload) => {
      // Emit log event for components to handle
      window.dispatchEvent(new CustomEvent('system-log', { 
        detail: payload 
      }))
    })

    // Low memory warnings
    client.value.onLowMemoryWarning((freeHeap) => {
      if (health.value.data) {
        health.value.data.freeHeap = freeHeap
        health.value.lastUpdated = Date.now()
      }
    })

    // WebSocket connection state tracking
    // Note: WebSocket state management is handled by the client internally
    // We'll track connection state through other means
    isWebSocketConnected.value = client.value.isConnected()
  }

  function clearErrors() {
    health.value.error = null
    status.value.error = null
  }

  async function refreshData() {
    try {
      await Promise.all([
        fetchHealth(),
        fetchSystemHealth()
      ])
    } catch (error) {
      console.error('Failed to refresh device data:', error)
      throw error
    }
  }

  return {
    // State
    health,
    status,
    isWebSocketConnected,
    reconnectAttempts,
    
    // Getters
    deviceInfo,
    networkInfo,
    systemMetrics,
    isHealthy,
    uptime,
    freeHeap,
    deviceStatus,
    connectionQuality,
    
    // Actions
    fetchHealth,
    fetchSystemHealth,
    handleStatusUpdate,
    handleHealthUpdate,
    setupWebSocketHandlers,
    clearErrors,
    refreshData
  }
})