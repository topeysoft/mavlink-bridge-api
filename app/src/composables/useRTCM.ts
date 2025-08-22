import { computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRTCMStore } from '../stores/rtcm'
import { useMAVLinkClient } from './useMAVLinkClient'
import type { RTCMConfig } from '@mavlinkbridge/api-client'

export function useRTCM() {
  const store = useRTCMStore()
  const { isConnected: clientConnected } = useMAVLinkClient()

  // Reactive refs from store
  const {
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
    lastDataReceived
  } = storeToRefs(store)

  // Computed properties
  const canStart = computed(() => 
    clientConnected.value && !store.isActive && !isStarting.value
  )

  const canStop = computed(() => 
    clientConnected.value && store.isActive && !isStopping.value
  )

  const hasRecentData = computed(() => {
    if (!lastDataReceived.value) return false
    return Date.now() - lastDataReceived.value < 5000 // Data received in last 5 seconds
  })

  const connectionStatusText = computed(() => {
    if (isStarting.value) return 'Starting...'
    if (isStopping.value) return 'Stopping...'
    if (store.isConnecting) return 'Connecting...'
    if (store.isConnected) return 'Connected'
    if (store.hasError) return 'Error'
    if (store.isActive) return 'Active'
    return 'Disconnected'
  })

  const connectionStatusColor = computed(() => {
    if (store.isConnected && hasRecentData.value) return 'positive'
    if (store.isConnecting || isStarting.value || isStopping.value) return 'warning'
    if (store.hasError) return 'negative'
    if (store.isActive) return 'info'
    return 'grey'
  })

  // Quick connect methods
  async function quickConnectNTRIP(host: string, port: number, mountpoint: string) {
    const config = {
      enabled: true,
      source: {
        type: 'ntrip' as const,
        host,
        port,
        mountpoint
      },
      outputFormat: 'raw' as const
    }
    return store.startRTCM(config as unknown as RTCMConfig)
  }

  async function quickConnectTCP(host: string, port: number) {
    const config = {
      enabled: true,
      source: {
        type: 'tcp' as const,
        host,
        port
      },
      outputFormat: 'raw' as const
    }
    return store.startRTCM(config as unknown as RTCMConfig)
  }

  async function quickConnectUDP(port: number) {
    const config = {
      enabled: true,
      source: {
        type: 'udp' as const,
        port
      },
      outputFormat: 'raw' as const
    }
    return store.startRTCM(config as unknown as RTCMConfig)
  }

  // Lifecycle
  let cleanupFn: (() => void) | undefined

  onMounted(async () => {
    if (clientConnected.value) {
      // Fetch initial status
      try {
        await store.fetchStatus()
      } catch (e) {
        console.error('Failed to fetch RTCM status:', e)
      }

      // Set up WebSocket handlers
      cleanupFn = store.setupWebSocketHandlers() || undefined
    }
  })

  onUnmounted(() => {
    if (cleanupFn) {
      cleanupFn()
    }
  })

  return {
    // State
    status: computed(() => status.value),
    config: computed(() => config.value),
    isStarting: computed(() => isStarting.value),
    isStopping: computed(() => isStopping.value),
    connectionHistory: computed(() => connectionHistory.value),
    profiles: computed(() => profiles.value),
    activeProfileId: computed(() => activeProfileId.value),
    streamingData: computed(() => streamingData.value),
    realtimeState: computed(() => realtimeState.value),
    realtimeStatistics: computed(() => realtimeStatistics.value),

    // Computed
    isConnected: computed(() => store.isConnected),
    isConnecting: computed(() => store.isConnecting),
    hasError: computed(() => store.hasError),
    isActive: computed(() => store.isActive),
    formattedStatistics: computed(() => store.formattedStatistics),
    connectionQuality: computed(() => store.connectionQuality),
    activeProfile: computed(() => store.activeProfile),
    canStart,
    canStop,
    hasRecentData,
    connectionStatusText,
    connectionStatusColor,

    // Actions
    fetchStatus: store.fetchStatus,
    fetchConfig: store.fetchConfig,
    startRTCM: store.startRTCM,
    stopRTCM: store.stopRTCM,
    startNTRIP: store.startNTRIP,
    startTCP: store.startTCP,
    startUDP: store.startUDP,
    saveProfile: store.saveProfile,
    updateProfile: store.updateProfile,
    deleteProfile: store.deleteProfile,
    applyProfile: store.applyProfile,
    quickConnectNTRIP,
    quickConnectTCP,
    quickConnectUDP
  }
}