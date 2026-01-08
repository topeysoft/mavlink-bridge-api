import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
// Import RTCM types from the rtcm sub-module to avoid conflicts with ConfigTypes
import type {
  RTCMConfig,
  RTCMStatus,
  RTCMStatistics,
  RTCMDataEvent,
  NTRIPSource,
  TCPSource,
  UDPSource
} from '@mavlinkbridge/api-client/dist/rtcm/RTCMTypes'
import { RTCMState } from '@mavlinkbridge/api-client/dist/rtcm/RTCMTypes'

export interface RTCMPreset {
  id: string
  name: string
  description: string
  type: 'ntrip' | 'tcp' | 'udp'
  config: RTCMConfig
}

// Popular NTRIP casters and base station presets for quick setup
export const NTRIP_PRESETS: RTCMPreset[] = [
  {
    id: 'docking-station',
    name: 'Docking Station',
    description: 'Connect to your YardRover docking station base station',
    type: 'tcp',
    config: {
      enabled: true,
      source: {
        type: 'tcp',
        host: '', // Auto-detected or user-entered
        port: 5015
      } as TCPSource,
      outputFormat: 'raw'
    }
  },
  {
    id: 'rtk2go',
    name: 'RTK2GO (Free)',
    description: 'Community NTRIP caster - free but may require registration',
    type: 'ntrip',
    config: {
      enabled: true,
      source: {
        type: 'ntrip',
        host: 'rtk2go.com',
        port: 2101,
        mountpoint: '', // User must provide
        username: 'your_email@example.com', // Placeholder
        password: 'none'
      } as NTRIPSource,
      outputFormat: 'raw'
    }
  },
  {
    id: 'emlid',
    name: 'Emlid Caster',
    description: 'Emlid NTRIP service - requires Emlid account',
    type: 'ntrip',
    config: {
      enabled: true,
      source: {
        type: 'ntrip',
        host: 'caster.emlid.com',
        port: 2101,
        mountpoint: '', // User must provide
        username: '', // User must provide
        password: '' // User must provide
      } as NTRIPSource,
      outputFormat: 'raw'
    }
  },
  {
    id: 'custom-ntrip',
    name: 'Custom NTRIP',
    description: 'Configure your own NTRIP caster',
    type: 'ntrip',
    config: {
      enabled: true,
      source: {
        type: 'ntrip',
        host: '',
        port: 2101,
        mountpoint: '',
        username: '',
        password: ''
      } as NTRIPSource,
      outputFormat: 'raw'
    }
  },
  {
    id: 'tcp',
    name: 'TCP Server',
    description: 'Connect to a TCP RTCM server',
    type: 'tcp',
    config: {
      enabled: true,
      source: {
        type: 'tcp',
        host: '',
        port: 5015
      } as TCPSource,
      outputFormat: 'raw'
    }
  },
  {
    id: 'udp',
    name: 'UDP Client',
    description: 'Receive RTCM data via UDP',
    type: 'udp',
    config: {
      enabled: true,
      source: {
        type: 'udp',
        port: 5015
      } as UDPSource,
      outputFormat: 'raw'
    }
  }
]

export const useRTCMStore = defineStore('rtcm', () => {
  // State
  const isRunning = ref(false)
  const isStarting = ref(false)
  const isStopping = ref(false)
  const currentState = ref<RTCMState>(RTCMState.DISCONNECTED)
  const currentConfig = ref<RTCMConfig | null>(null)
  const statistics = ref<RTCMStatistics | null>(null)
  const lastError = ref<string | null>(null)
  const recentMessages = ref<RTCMDataEvent[]>([])
  const statusPollInterval = ref<number | null>(null)

  // Saved configurations
  const savedConfigs = ref<Array<{ id: string; name: string; config: RTCMConfig }>>(
    JSON.parse(localStorage.getItem('yardrover_rtcm_configs') || '[]')
  )

  // Computed
  const connectionStore = useConnectionStore()

  const canStart = computed(() => {
    return connectionStore.isConnected && !isRunning.value && !isStarting.value
  })

  const canStop = computed(() => {
    return isRunning.value && !isStopping.value
  })

  const isConnected = computed(() => {
    return currentState.value === RTCMState.CONNECTED
  })

  const hasError = computed(() => {
    return currentState.value === RTCMState.ERROR || lastError.value !== null
  })

  const dataRate = computed(() => {
    if (!statistics.value) return 0
    return statistics.value.dataRate || 0
  })

  const messagesPerSecond = computed(() => {
    if (!statistics.value || !statistics.value.connectionTime) return 0
    const seconds = statistics.value.connectionTime / 1000
    return seconds > 0 ? statistics.value.messagesReceived / seconds : 0
  })

  // Actions

  /**
   * Start RTCM client with configuration
   */
  async function start(config: RTCMConfig): Promise<boolean> {
    if (!connectionStore.isConnected) {
      lastError.value = 'Not connected to device'
      return false
    }

    isStarting.value = true
    lastError.value = null

    try {
      const client = connectionStore.getClient()
      const response = await client.rtcm.start(config)

      if (response.success) {
        isRunning.value = true
        currentConfig.value = config as RTCMConfig

        // Start polling for status updates
        startStatusPolling()

        // Setup real-time event listeners
        setupEventListeners()

        console.log('RTCM client started successfully')
        return true
      } else {
        lastError.value = response.error || response.message || 'Failed to start RTCM client'
        console.error('Failed to start RTCM client:', lastError.value)
        return false
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      lastError.value = `Failed to start RTCM: ${errorMessage}`
      console.error('Error starting RTCM:', error)
      return false
    } finally {
      isStarting.value = false
    }
  }

  /**
   * Stop RTCM client
   */
  async function stop(): Promise<boolean> {
    if (!connectionStore.isConnected) {
      return false
    }

    isStopping.value = true
    lastError.value = null

    try {
      const client = connectionStore.getClient()
      const response = await client.rtcm.stop()

      if (response.success) {
        isRunning.value = false
        currentState.value = RTCMState.DISCONNECTED
        currentConfig.value = null
        statistics.value = null

        // Stop polling
        stopStatusPolling()

        console.log('RTCM client stopped successfully')
        return true
      } else {
        lastError.value = response.error || response.message || 'Failed to stop RTCM client'
        console.error('Failed to stop RTCM client:', lastError.value)
        return false
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      lastError.value = `Failed to stop RTCM: ${errorMessage}`
      console.error('Error stopping RTCM:', error)
      return false
    } finally {
      isStopping.value = false
    }
  }

  /**
   * Get current RTCM status
   */
  async function refreshStatus(): Promise<RTCMStatus | null> {
    if (!connectionStore.isConnected) {
      return null
    }

    try {
      const client = connectionStore.getClient()
      const status = await client.rtcm.getStatus()

      isRunning.value = status.running
      currentState.value = status.state || RTCMState.DISCONNECTED
      statistics.value = status.statistics || null

      return status
    } catch (error) {
      console.error('Error fetching RTCM status:', error)
      return null
    }
  }

  /**
   * Start NTRIP with quick setup
   */
  async function startNTRIP(params: {
    host: string
    port: number
    mountpoint: string
    username?: string
    password?: string
    latitude?: number
    longitude?: number
    altitude?: number
  }): Promise<boolean> {
    const source: NTRIPSource = {
      type: 'ntrip',
      host: params.host,
      port: params.port,
      mountpoint: params.mountpoint,
      username: params.username,
      password: params.password,
      sendPosition: !!(params.latitude && params.longitude),
      position: params.latitude && params.longitude ? {
        latitude: params.latitude,
        longitude: params.longitude,
        altitude: params.altitude || 0
      } : undefined
    }

    const config: RTCMConfig = {
      enabled: true,
      source,
      outputFormat: 'raw'
    }

    return await start(config)
  }

  /**
   * Start TCP connection
   */
  async function startTCP(host: string, port: number): Promise<boolean> {
    const source: TCPSource = {
      type: 'tcp',
      host,
      port
    }

    const config: RTCMConfig = {
      enabled: true,
      source,
      outputFormat: 'raw'
    }

    return await start(config)
  }

  /**
   * Start UDP connection
   */
  async function startUDP(port: number, remoteHost?: string, remotePort?: number): Promise<boolean> {
    const source: UDPSource = {
      type: 'udp',
      port,
      remoteHost,
      remotePort
    }

    const config: RTCMConfig = {
      enabled: true,
      source,
      outputFormat: 'raw'
    }

    return await start(config)
  }

  /**
   * Save current configuration
   */
  function saveConfig(name: string): void {
    if (!currentConfig.value) return

    const newConfig = {
      id: Date.now().toString(),
      name,
      config: currentConfig.value
    }

    savedConfigs.value.push(newConfig)
    localStorage.setItem('yardrover_rtcm_configs', JSON.stringify(savedConfigs.value))
  }

  /**
   * Load saved configuration
   */
  async function loadConfig(configId: string): Promise<boolean> {
    const saved = savedConfigs.value.find(c => c.id === configId)
    if (!saved) return false

    return await start(saved.config)
  }

  /**
   * Delete saved configuration
   */
  function deleteConfig(configId: string): void {
    savedConfigs.value = savedConfigs.value.filter(c => c.id !== configId)
    localStorage.setItem('yardrover_rtcm_configs', JSON.stringify(savedConfigs.value))
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    lastError.value = null
  }

  /**
   * Setup real-time event listeners for RTCM data
   */
  function setupEventListeners(): void {
    if (!connectionStore.client) return

    const client = connectionStore.client

    // Listen for RTCM data events
    client.rtcm.onDataReceived((data: RTCMDataEvent) => {
      // Add to recent messages (keep last 100)
      recentMessages.value.unshift(data)
      if (recentMessages.value.length > 100) {
        recentMessages.value.pop()
      }
    })

    // Listen for state changes
    client.rtcm.onStateChange((state: RTCMState) => {
      currentState.value = state

      if (state === RTCMState.ERROR) {
        lastError.value = 'RTCM connection error'
      }
    })
  }

  /**
   * Start polling for status updates (fallback if WebSocket events aren't working)
   */
  function startStatusPolling(): void {
    if (statusPollInterval.value) {
      clearInterval(statusPollInterval.value)
    }

    // Poll every 2 seconds
    statusPollInterval.value = window.setInterval(async () => {
      await refreshStatus()
    }, 2000)
  }

  /**
   * Stop status polling
   */
  function stopStatusPolling(): void {
    if (statusPollInterval.value) {
      clearInterval(statusPollInterval.value)
      statusPollInterval.value = null
    }
  }

  /**
   * Reset all state (useful when disconnecting from device)
   */
  function reset(): void {
    isRunning.value = false
    isStarting.value = false
    isStopping.value = false
    currentState.value = RTCMState.DISCONNECTED
    currentConfig.value = null
    statistics.value = null
    lastError.value = null
    recentMessages.value = []
    stopStatusPolling()
  }

  return {
    // State
    isRunning,
    isStarting,
    isStopping,
    currentState,
    currentConfig,
    statistics,
    lastError,
    recentMessages,
    savedConfigs,

    // Computed
    canStart,
    canStop,
    isConnected,
    hasError,
    dataRate,
    messagesPerSecond,

    // Actions
    start,
    stop,
    refreshStatus,
    startNTRIP,
    startTCP,
    startUDP,
    saveConfig,
    loadConfig,
    deleteConfig,
    clearError,
    reset
  }
})
