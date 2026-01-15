import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import type {
  Peripheral,
  PeripheralType,
  PeripheralListResponse,
  CompatibilityCheckResponse,
  PeripheralStats
} from '@/types'

export const usePeripheralsStore = defineStore('peripherals', () => {
  const connectionStore = useConnectionStore()

  // State
  const peripherals = ref<Peripheral[]>([])
  const stats = ref<PeripheralStats | null>(null)
  const compatibility = ref<CompatibilityCheckResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const connectedPeripherals = computed(() =>
    peripherals.value.filter(p =>
      ['connected', 'ready', 'active', 'initializing'].includes(p.status.state)
    )
  )

  const enabledPeripherals = computed(() =>
    peripherals.value.filter(p => p.status.enabled)
  )

  const activePeripherals = computed(() =>
    peripherals.value.filter(p => p.status.active)
  )

  const hasCompatibilityIssues = computed(() =>
    compatibility.value && !compatibility.value.compatible
  )

  const peripheralsByType = computed(() => {
    const byType: Record<string, Peripheral[]> = {}
    for (const peripheral of peripherals.value) {
      const type = peripheral.metadata.type
      if (!byType[type]) {
        byType[type] = []
      }
      byType[type].push(peripheral)
    }
    return byType
  })

  // Actions

  /**
   * Fetch all peripherals from the API
   */
  async function fetchPeripherals(peripheralType?: PeripheralType): Promise<void> {
    if (!connectionStore.client) {
      error.value = 'No client connection'
      return
    }

    loading.value = true
    error.value = null

    try {
      const response: PeripheralListResponse = await connectionStore.client.peripherals.listPeripherals(peripheralType)
      peripherals.value = response.peripherals

      // Automatically fetch stats and compatibility
      await Promise.all([
        fetchStats(),
        checkCompatibility()
      ])
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch peripherals'
      console.error('Failed to fetch peripherals:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch peripheral statistics
   */
  async function fetchStats(): Promise<void> {
    if (!connectionStore.client) return

    try {
      stats.value = await connectionStore.client.peripherals.getStats()
    } catch (err) {
      console.error('Failed to fetch peripheral stats:', err)
    }
  }

  /**
   * Check peripheral compatibility
   */
  async function checkCompatibility(): Promise<void> {
    if (!connectionStore.client) return

    try {
      compatibility.value = await connectionStore.client.peripherals.checkCompatibility()
    } catch (err) {
      console.error('Failed to check compatibility:', err)
    }
  }

  /**
   * Get a specific peripheral by ID
   */
  async function getPeripheral(peripheralId: string): Promise<Peripheral | null> {
    if (!connectionStore.client) {
      error.value = 'No client connection'
      return null
    }

    try {
      return await connectionStore.client.peripherals.getPeripheral(peripheralId)
    } catch (err: any) {
      error.value = err.message || 'Failed to get peripheral'
      console.error('Failed to get peripheral:', err)
      return null
    }
  }

  /**
   * Enable a peripheral
   */
  async function enablePeripheral(peripheralId: string): Promise<boolean> {
    if (!connectionStore.client) {
      error.value = 'No client connection'
      return false
    }

    try {
      const response = await connectionStore.client.peripherals.enablePeripheral(peripheralId)

      if (response.status === 'success') {
        // Refresh peripheral list
        await fetchPeripherals()
        return true
      } else {
        error.value = response.message || 'Failed to enable peripheral'
        return false
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to enable peripheral'
      console.error('Failed to enable peripheral:', err)
      return false
    }
  }

  /**
   * Disable a peripheral
   */
  async function disablePeripheral(peripheralId: string): Promise<boolean> {
    if (!connectionStore.client) {
      error.value = 'No client connection'
      return false
    }

    try {
      const response = await connectionStore.client.peripherals.disablePeripheral(peripheralId)

      if (response.status === 'success') {
        // Refresh peripheral list
        await fetchPeripherals()
        return true
      } else {
        error.value = response.message || 'Failed to disable peripheral'
        return false
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to disable peripheral'
      console.error('Failed to disable peripheral:', err)
      return false
    }
  }

  /**
   * Send a command to a peripheral
   */
  async function sendCommand(peripheralId: string, command: string, parameters: Record<string, any> = {}): Promise<boolean> {
    if (!connectionStore.client) {
      error.value = 'No client connection'
      return false
    }

    try {
      const response = await connectionStore.client.peripherals.sendCommand(peripheralId, {
        command,
        parameters
      })

      if (response.status === 'success') {
        return true
      } else {
        error.value = response.message || 'Failed to send command'
        return false
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to send command'
      console.error('Failed to send command:', err)
      return false
    }
  }

  /**
   * Unregister a peripheral
   */
  async function unregisterPeripheral(peripheralId: string): Promise<boolean> {
    if (!connectionStore.client) {
      error.value = 'No client connection'
      return false
    }

    try {
      const response = await connectionStore.client.peripherals.unregisterPeripheral(peripheralId)

      if (response.status === 'success') {
        // Refresh peripheral list
        await fetchPeripherals()
        return true
      } else {
        error.value = response.message || 'Failed to unregister peripheral'
        return false
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to unregister peripheral'
      console.error('Failed to unregister peripheral:', err)
      return false
    }
  }

  /**
   * Get peripheral telemetry
   */
  async function getPeripheralTelemetry(peripheralId: string): Promise<any> {
    if (!connectionStore.client) return null

    try {
      return await connectionStore.client.peripherals.getPeripheralTelemetry(peripheralId)
    } catch (err) {
      console.error('Failed to get peripheral telemetry:', err)
      return null
    }
  }

  /**
   * Setup WebSocket listeners for real-time peripheral updates
   * Uses WebSocket events exclusively - no polling required
   */
  function setupWebSocketListeners(): void {
    if (!connectionStore.client) return

    const client = connectionStore.client

    // Listen for peripheral connection events
    client.ws.on('peripheral.connected' as any, (data: any) => {
      console.log('[Peripherals] Peripheral connected via WebSocket:', data)
      fetchPeripherals() // Refresh list
    })

    // Listen for peripheral disconnection events
    client.ws.on('peripheral.disconnected' as any, (data: any) => {
      console.log('[Peripherals] Peripheral disconnected via WebSocket:', data)
      fetchPeripherals() // Refresh list
    })

    // Listen for peripheral telemetry updates (real-time data)
    client.ws.on('peripheral.telemetry' as any, (data: any) => {
      // Update telemetry for specific peripheral without full refresh
      const peripheral = peripherals.value.find(p => p.metadata.peripheral_id === data.peripheral_id)
      if (peripheral) {
        peripheral.telemetry = data.telemetry || data
      }
    })

    // Listen for peripheral state changes
    client.ws.on('peripheral.enabled' as any, () => {
      console.log('[Peripherals] Peripheral enabled via WebSocket')
      fetchPeripherals() // Refresh list
      checkCompatibility() // Re-check compatibility
    })

    client.ws.on('peripheral.disabled' as any, () => {
      console.log('[Peripherals] Peripheral disabled via WebSocket')
      fetchPeripherals() // Refresh list
      checkCompatibility() // Re-check compatibility
    })

    // Listen for peripheral status changes
    client.ws.on('peripheral.status.changed' as any, (data: any) => {
      console.log('[Peripherals] Peripheral status changed via WebSocket:', data)
      // Update specific peripheral status without full refresh
      const peripheral = peripherals.value.find(p => p.metadata.peripheral_id === data.peripheral_id)
      if (peripheral && data.status) {
        peripheral.status = { ...peripheral.status, ...data.status }
      }
    })

    console.log('[Peripherals] WebSocket event listeners setup')
  }

  /**
   * Clear all peripheral data
   */
  function clearPeripherals(): void {
    peripherals.value = []
    stats.value = null
    compatibility.value = null
    error.value = null
  }

  return {
    // State
    peripherals,
    stats,
    compatibility,
    loading,
    error,

    // Computed
    connectedPeripherals,
    enabledPeripherals,
    activePeripherals,
    hasCompatibilityIssues,
    peripheralsByType,

    // Actions
    fetchPeripherals,
    fetchStats,
    checkCompatibility,
    getPeripheral,
    enablePeripheral,
    disablePeripheral,
    sendCommand,
    unregisterPeripheral,
    getPeripheralTelemetry,
    setupWebSocketListeners,
    clearPeripherals
  }
})
