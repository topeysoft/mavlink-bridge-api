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
  const currentClientType = ref<string | null>(null)
  const statistics = ref<RTCMStatistics | null>(null)
  const lastError = ref<string | null>(null)
  const recentMessages = ref<RTCMDataEvent[]>([])

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
    // Support both camelCase and snake_case from backend
    // Backend sends data_rate in KB/s, convert to B/s for consistency
    const rateKBps = statistics.value.dataRate || (statistics.value as any).data_rate || 0
    return rateKBps * 1024 // Convert KB/s to B/s
  })

  const messagesPerSecond = computed(() => {
    if (!statistics.value) return 0
    // Support both camelCase and snake_case from backend
    const connectionTime = statistics.value.connectionTime || (statistics.value as any).connection_time
    const messagesReceived = statistics.value.messagesReceived || (statistics.value as any).messages_received
    if (!connectionTime) return 0
    const seconds = connectionTime / 1000
    return seconds > 0 ? messagesReceived / seconds : 0
  })

  /**
   * Get connection type icon
   */
  const connectionTypeIcon = computed(() => {
    switch (currentClientType.value) {
      case 'NTRIP':
        return '📡'
      case 'TCP':
        return '🔌'
      case 'UDP':
        return '📤'
      default:
        return '🔗'
    }
  })

  /**
   * Get connection type display name
   */
  const connectionTypeDisplay = computed(() => {
    return currentClientType.value || 'Unknown'
  })

  /**
   * Get connection details string (host:port or mountpoint info)
   */
  const connectionDetails = computed(() => {
    if (!currentConfig.value?.source) return null

    const source = currentConfig.value.source

    if (source.type === 'ntrip') {
      return `${source.host}:${source.port}/${source.mountpoint}`
    } else if (source.type === 'tcp') {
      return `${source.host}:${source.port}`
    } else if (source.type === 'udp') {
      return `Port ${source.port}${source.remoteHost ? ` → ${source.remoteHost}:${source.remotePort}` : ''}`
    }

    return null
  })

  /**
   * Get full connection description with type and details
   */
  const connectionDescription = computed(() => {
    if (!currentClientType.value || !connectionDetails.value) return null
    return `${connectionTypeIcon.value} ${currentClientType.value} • ${connectionDetails.value}`
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

        // Setup real-time event listeners for WebSocket updates
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
      currentClientType.value = status.clientType || null
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
      outputFormat: 'raw',
      outputs: []  // Backend automatically adds FC output using YARDROVER_SERIAL_PORT
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
      outputFormat: 'raw',
      outputs: []  // Backend automatically adds FC output using YARDROVER_SERIAL_PORT
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
      outputFormat: 'raw',
      outputs: []  // Backend automatically adds FC output using YARDROVER_SERIAL_PORT
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
   * Uses WebSocket events for all state updates - no polling needed
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

    // Listen for status/statistics updates via WebSocket
    // The backend emits 'rtcm.status.changed' events with updated statistics
    client.rtcm.onStatusChange((status: RTCMStatus) => {
      isRunning.value = status.running
      currentState.value = status.state || RTCMState.DISCONNECTED
      currentClientType.value = status.clientType || null

      // Ensure deep reactivity by creating new object reference
      // This is critical for Vue to detect changes in nested arrays like output_targets
      if (status.statistics) {
        statistics.value = {
          ...status.statistics,
          // Explicitly spread output_targets array to ensure reactivity
          output_targets: status.statistics.output_targets ? [...status.statistics.output_targets] : [],
          outputTargets: status.statistics.output_targets ? [...status.statistics.output_targets] : []
        }
      } else {
        statistics.value = null
      }

      // Debug: Log output targets received via WebSocket
      if (status.statistics?.output_targets) {
        console.log('[RTCM Store] WebSocket received output targets:', {
          count: status.statistics.output_targets.length,
          targets: status.statistics.output_targets
        })
      } else {
        console.log('[RTCM Store] WebSocket stats received but NO output_targets:', {
          hasStats: !!status.statistics,
          keys: status.statistics ? Object.keys(status.statistics) : []
        })
      }
    })
  }

  /**
   * Initialize event listeners (should be called on component mount)
   */
  async function initialize(): Promise<void> {
    if (!connectionStore.isConnected) return

    // Setup event listeners
    setupEventListeners()

    // Fetch initial status
    await refreshStatus()
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
    currentClientType.value = null
    statistics.value = null
    lastError.value = null
    recentMessages.value = []
  }

  return {
    // State
    isRunning,
    isStarting,
    isStopping,
    currentState,
    currentConfig,
    currentClientType,
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
    connectionTypeIcon,
    connectionTypeDisplay,
    connectionDetails,
    connectionDescription,

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
    initialize,
    reset
  }
})
