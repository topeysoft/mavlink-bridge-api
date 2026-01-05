import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import type { MAVLinkMessage, TelemetryData, SystemHealth, Activity } from '@/types'
import type { StatusPayload, LogPayload, ErrorPayload } from '@mavlinkbridge/api-client'

export const useMonitoringStore = defineStore('monitoring', () => {
  const connectionStore = useConnectionStore()

  const mavlinkMessages = ref<MAVLinkMessage[]>([])
  const telemetry = ref<TelemetryData | null>(null)
  const systemHealth = ref<SystemHealth>({
    cpu: 0,
    memory: 0,
    temperature: 0,
    uptime: 0,
    status: 'healthy'
  })
  const activities = ref<Activity[]>([])
  const isMonitoring = ref(false)

  // WebSocket event listeners cleanup functions
  let statusUnsubscribe: (() => void) | null = null
  let logUnsubscribe: (() => void) | null = null
  let errorUnsubscribe: (() => void) | null = null

  const criticalMessages = computed(() =>
    mavlinkMessages.value.filter(m => m.severity === 'critical')
  )

  const recentMessages = computed(() =>
    mavlinkMessages.value.slice(-100)
  )

  const recentActivities = computed(() =>
    activities.value.slice(-50)
  )

  function addMAVLinkMessage(message: MAVLinkMessage) {
    mavlinkMessages.value.push(message)
    // Keep only last 1000 messages
    if (mavlinkMessages.value.length > 1000) {
      mavlinkMessages.value = mavlinkMessages.value.slice(-1000)
    }
  }

  function clearMAVLinkMessages() {
    mavlinkMessages.value = []
  }

  function updateTelemetry(data: TelemetryData) {
    telemetry.value = data
  }

  function updateSystemHealth(health: Partial<SystemHealth>) {
    systemHealth.value = { ...systemHealth.value, ...health }
  }

  function addActivity(activity: Activity) {
    activities.value.push(activity)
    // Keep only last 200 activities
    if (activities.value.length > 200) {
      activities.value = activities.value.slice(-200)
    }
  }

  /**
   * Fetch current system health from device
   */
  async function fetchSystemHealth(): Promise<void> {
    if (!connectionStore.isConnected) return

    try {
      const client = connectionStore.getClient()
      const health = await client.getHealth()

      // Update system health
      systemHealth.value = {
        cpu: health.system.cpuUsage || 0,
        memory: health.system.memoryUsage || 0,
        temperature: health.system.temperature || 0,
        uptime: health.system.uptime || 0,
        status: health.system.status === 'healthy' ? 'healthy' :
                health.system.status === 'degraded' ? 'warning' : 'critical'
      }

      console.log('System health updated:', systemHealth.value)
    } catch (error) {
      console.error('Failed to fetch system health:', error)
    }
  }

  /**
   * Setup WebSocket event listeners for real-time updates
   */
  function setupEventListeners() {
    if (!connectionStore.client) return

    const client = connectionStore.client

    // Listen for status updates
    statusUnsubscribe = client.onStatus((status: StatusPayload) => {
      // Update system health from status
      updateSystemHealth({
        cpu: status.cpuUsage || systemHealth.value.cpu,
        memory: status.freeHeap ? ((1 - status.freeHeap / 100000) * 100) : systemHealth.value.memory,
        temperature: status.temperature || systemHealth.value.temperature,
        uptime: status.uptime || systemHealth.value.uptime
      })

      // Add activity
      addActivity({
        id: `status_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'info',
        title: 'Status Update',
        description: `Uptime: ${status.uptime}s, Free heap: ${status.freeHeap} bytes`
      })
    })

    // Listen for log messages
    logUnsubscribe = client.onLog((log: LogPayload) => {
      const severity = log.level <= 3 ? 'critical' :
                      log.level === 4 ? 'error' :
                      log.level === 5 ? 'warning' : 'info'

      addMAVLinkMessage({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: 'LOG',
        severity,
        message: log.message
      })

      addActivity({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: severity === 'critical' || severity === 'error' ? 'error' :
             severity === 'warning' ? 'warning' : 'info',
        title: 'System Log',
        description: log.message
      })
    })

    // Listen for error messages
    errorUnsubscribe = client.onError((error: ErrorPayload) => {
      addMAVLinkMessage({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: 'ERROR',
        severity: 'error',
        message: error.message,
        details: { code: error.code }
      })

      addActivity({
        id: `error_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'error',
        title: 'Error',
        description: error.message
      })
    })

    console.log('Monitoring event listeners setup')
  }

  /**
   * Cleanup WebSocket event listeners
   */
  function cleanupEventListeners() {
    statusUnsubscribe?.()
    logUnsubscribe?.()
    errorUnsubscribe?.()

    statusUnsubscribe = null
    logUnsubscribe = null
    errorUnsubscribe = null

    console.log('Monitoring event listeners cleaned up')
  }

  /**
   * Start monitoring (setup listeners and fetch initial data)
   */
  async function startMonitoring() {
    if (!connectionStore.isConnected) {
      console.warn('Cannot start monitoring: not connected')
      return
    }

    isMonitoring.value = true
    setupEventListeners()
    await fetchSystemHealth()

    addActivity({
      id: `monitoring_start_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'success',
      title: 'Monitoring Started',
      description: 'Real-time monitoring started'
    })
  }

  /**
   * Stop monitoring (cleanup listeners)
   */
  function stopMonitoring() {
    isMonitoring.value = false
    cleanupEventListeners()

    addActivity({
      id: `monitoring_stop_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'info',
      title: 'Monitoring Stopped',
      description: 'Real-time monitoring stopped'
    })
  }

  // Watch for connection changes
  watch(() => connectionStore.isConnected, (connected) => {
    if (connected && isMonitoring.value) {
      // Reconnected while monitoring was active, restart monitoring
      setupEventListeners()
      fetchSystemHealth()
    } else if (!connected) {
      // Disconnected, cleanup listeners
      cleanupEventListeners()
    }
  })

  function exportMAVLinkMessages() {
    const data = JSON.stringify(mavlinkMessages.value, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mavlink-export-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportActivities() {
    const data = JSON.stringify(activities.value, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activities-export-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    // State
    mavlinkMessages,
    telemetry,
    systemHealth,
    activities,
    isMonitoring,

    // Computed
    criticalMessages,
    recentMessages,
    recentActivities,

    // Actions
    addMAVLinkMessage,
    clearMAVLinkMessages,
    updateTelemetry,
    updateSystemHealth,
    addActivity,
    fetchSystemHealth,
    startMonitoring,
    stopMonitoring,
    exportMAVLinkMessages,
    exportActivities
  }
})
