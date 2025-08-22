import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMAVLinkClient } from '../composables/useMAVLinkClient'
import type { 
  RTCMConfig, 
  RTCMStatus, 
  RTCMStatistics
} from '@mavlinkbridge/api-client'
import { RTCMState } from '@mavlinkbridge/api-client'
import { createAsyncState, setAsyncLoading, setAsyncData, setAsyncError, createStoreError } from './types'

export interface RTCMProfile {
  id: string
  name: string
  description?: string
  config: RTCMConfig
  createdAt: number
  lastUsed?: number
}

export interface RTCMConnectionHistory {
  timestamp: number
  source: string
  success: boolean
  duration?: number
  error?: string
}

export const useRTCMStore = defineStore('rtcm', () => {
  // State
  const status = ref(createAsyncState<RTCMStatus>())
  const config = ref(createAsyncState<RTCMConfig>())
  const isStarting = ref(false)
  const isStopping = ref(false)
  const connectionHistory = ref<RTCMConnectionHistory[]>([])
  const profiles = ref<RTCMProfile[]>([])
  const activeProfileId = ref<string | null>(null)
  const streamingData = ref<Array<{timestamp: number, messageType: number, messageName: string, length: number, stationId?: number}>>([])
  const maxStreamingDataSize = 100

  // Real-time state from WebSocket
  const realtimeState = ref<RTCMState>(RTCMState.DISCONNECTED)
  const realtimeStatistics = ref<RTCMStatistics | null>(null)
  const lastDataReceived = ref<number | null>(null)

  // Getters
  const isConnected = computed(() => realtimeState.value === ('connected' as RTCMState))
  const isConnecting = computed(() => realtimeState.value === ('connecting' as RTCMState))
  const hasError = computed(() => realtimeState.value === ('error' as RTCMState))
  const isActive = computed(() => status.value.data?.running || false)

  const formattedStatistics = computed(() => {
    const stats = realtimeStatistics.value || status.value.data?.statistics
    if (!stats) return null

    return {
      messagesReceived: stats.messagesReceived || 0,
      bytesReceived: stats.bytesReceived || 0,
      messagesSent: stats.messagesSent || 0,
      bytesSent: stats.bytesSent || 0,
      crcErrors: stats.crcErrors || 0,
      dataRate: stats.dataRate || 0,
      errorRate: stats.errors || 0,
      uptime: stats.connectionTime || 0,
      messageTypes: stats.messageTypes || {},
      formattedDataRate: formatDataRate(stats.dataRate || 0),
      formattedUptime: formatUptime(stats.connectionTime || 0)
    }
  })

  const connectionQuality = computed(() => {
    const stats = formattedStatistics.value
    if (!stats) return 'unknown'

    const errorRate = stats.messagesReceived > 0 
      ? (stats.crcErrors / stats.messagesReceived) * 100 
      : 0

    if (errorRate > 5) return 'poor'
    if (errorRate > 1) return 'fair'
    if (stats.dataRate === 0) return 'no-data'
    return 'good'
  })

  const activeProfile = computed(() => 
    profiles.value.find(p => p.id === activeProfileId.value)
  )

  // Actions
  async function fetchStatus() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    setAsyncLoading(status.value)

    try {
      const response = await client.value.rtcm.getStatus()
      setAsyncData(status.value, response)
      
      // Update realtime state if available
      if (response.state) {
        realtimeState.value = response.state
      }
      if (response.statistics) {
        realtimeStatistics.value = response.statistics
      }
    } catch (error) {
      const storeError = createStoreError(
        'RTCM_STATUS_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch RTCM status',
        error
      )
      setAsyncError(status.value, storeError)
      throw error
    }
  }

  async function fetchConfig() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    setAsyncLoading(config.value)

    try {
      const response = await client.value.rtcm.getConfig()
      // Type assertion since the client returns the config RTCMConfig but we need rtcm RTCMConfig
      setAsyncData(config.value, response as RTCMConfig)
    } catch (error) {
      const storeError = createStoreError(
        'RTCM_CONFIG_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch RTCM config',
        error
      )
      setAsyncError(config.value, storeError)
      throw error
    }
  }

  async function startRTCM(rtcmConfig: RTCMConfig) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    isStarting.value = true

    try {
      const response = await client.value.rtcm.start(rtcmConfig as Parameters<typeof client.value.rtcm.start>[0])
      
      // Add to connection history
      connectionHistory.value.unshift({
        timestamp: Date.now(),
        source: getSourceDescription(rtcmConfig.source),
        success: response.success
      })

      // Limit history size
      if (connectionHistory.value.length > 50) {
        connectionHistory.value = connectionHistory.value.slice(0, 50)
      }

      await fetchStatus()
      return response
    } catch (error) {
      // Add failed connection to history
      connectionHistory.value.unshift({
        timestamp: Date.now(),
        source: getSourceDescription(rtcmConfig.source),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    } finally {
      isStarting.value = false
    }
  }

  async function stopRTCM() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    isStopping.value = true

    try {
      const response = await client.value.rtcm.stop()
      
      // Update connection history with duration
      const lastConnection = connectionHistory.value.find(c => c.success && !c.duration)
      if (lastConnection) {
        lastConnection.duration = Date.now() - lastConnection.timestamp
      }

      await fetchStatus()
      return response
    } finally {
      isStopping.value = false
    }
  }

  async function startNTRIP(config: {
    host: string
    port: number
    mountpoint: string
    username?: string
    password?: string
    sendPosition?: boolean
    position?: { latitude: number; longitude: number; altitude?: number }
  }) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    return client.value.rtcm.startNTRIP(config)
  }

  async function startTCP(host: string, port: number) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    return client.value.rtcm.startTCP(host, port)
  }

  async function startUDP(port: number, remoteHost?: string, remotePort?: number) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    return client.value.rtcm.startUDP(port, remoteHost, remotePort)
  }

  // Profile management
  function saveProfile(name: string, description: string, rtcmConfig: RTCMConfig) {
    const profile: RTCMProfile = {
      id: generateId(),
      name,
      description,
      config: rtcmConfig,
      createdAt: Date.now()
    }

    profiles.value.push(profile)
    saveProfilesToStorage()
    return profile
  }

  function updateProfile(id: string, updates: {name?: string, description?: string}) {
    const index = profiles.value.findIndex(p => p.id === id)
    if (index >= 0) {
      const currentProfile = profiles.value[index]
      if (currentProfile) {
        profiles.value[index] = { 
          ...currentProfile, 
          ...updates
        }
        saveProfilesToStorage()
      }
    }
  }

  function deleteProfile(id: string) {
    profiles.value = profiles.value.filter(p => p.id !== id)
    if (activeProfileId.value === id) {
      activeProfileId.value = null
    }
    saveProfilesToStorage()
  }

  async function applyProfile(profileId: string) {
    const profile = profiles.value.find(p => p.id === profileId)
    if (!profile) throw new Error('Profile not found')

    profile.lastUsed = Date.now()
    activeProfileId.value = profileId
    saveProfilesToStorage()

    return startRTCM(profile.config)
  }

  // WebSocket event handlers
  function handleRTCMData(data: {messageType: number, messageName: string, length: number, stationId?: number}) {
    lastDataReceived.value = Date.now()
    
    // Add to streaming data buffer
    streamingData.value.unshift({
      ...data,
      timestamp: Date.now()
    })

    // Limit buffer size
    if (streamingData.value.length > maxStreamingDataSize) {
      streamingData.value = streamingData.value.slice(0, maxStreamingDataSize)
    }
  }

  function handleStateChange(state: RTCMState) {
    realtimeState.value = state
  }

  function handleStatisticsUpdate(stats: RTCMStatistics) {
    realtimeStatistics.value = stats
  }

  function setupWebSocketHandlers() {
    const { client } = useMAVLinkClient()
    if (!client.value) return

    // Set up RTCM-specific event handlers
    const unsubscribeData = client.value.rtcm.onDataReceived(handleRTCMData)
    const unsubscribeState = client.value.rtcm.onStateChange(handleStateChange)

    // Return cleanup function
    return () => {
      unsubscribeData()
      unsubscribeState()
    }
  }

  // Utility functions
  function getSourceDescription(source: RTCMConfig['source']): string {
    if (!source) return 'Unknown'
    
    switch (source.type) {
      case 'ntrip':
        return `NTRIP ${source.host}:${source.port}${source.mountpoint ? '/' + source.mountpoint : ''}`
      case 'tcp':
        return `TCP ${source.host}:${source.port}`
      case 'udp': {
        const udpSource = source as { remoteHost?: string; remotePort?: number }
        return `UDP :${source.port}${udpSource.remoteHost ? ' <- ' + udpSource.remoteHost + ':' + udpSource.remotePort : ''}`
      }
      default:
        return 'Unknown'
    }
  }

  function formatDataRate(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`
  }

  function formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Storage
  function loadProfilesFromStorage() {
    const stored = localStorage.getItem('rtcm-profiles')
    if (stored) {
      try {
        profiles.value = JSON.parse(stored)
      } catch (e) {
        console.error('Failed to load RTCM profiles:', e)
      }
    }
  }

  function saveProfilesToStorage() {
    localStorage.setItem('rtcm-profiles', JSON.stringify(profiles.value))
  }

  // Initialize profiles from storage
  loadProfilesFromStorage()

  return {
    // State
    status,
    config,
    isStarting,
    isStopping,
    connectionHistory,
    profiles,
    activeProfileId,
    streamingData,
    realtimeState,
    realtimeStatistics,
    lastDataReceived,

    // Getters
    isConnected,
    isConnecting,
    hasError,
    isActive,
    formattedStatistics,
    connectionQuality,
    activeProfile,

    // Actions
    fetchStatus,
    fetchConfig,
    startRTCM,
    stopRTCM,
    startNTRIP,
    startTCP,
    startUDP,
    saveProfile,
    updateProfile,
    deleteProfile,
    applyProfile,
    setupWebSocketHandlers,
    handleRTCMData,
    handleStateChange,
    handleStatisticsUpdate
  }
})