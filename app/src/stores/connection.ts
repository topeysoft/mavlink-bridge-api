import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { createClient, discoverDevices, type MAVLinkBridgeClient, type MAVLinkBridgeDevice, MAVLinkMessageType, type BatteryStatusMessage } from '@mavlinkbridge/api-client'
import { useBatteryStore } from './battery'

export interface SavedDevice {
  id: string
  name: string
  url: string
  lastConnected?: string
  favorite?: boolean
}

interface PersistedConnection {
  deviceUrl: string
  deviceName: string
  timestamp: string
}

export const useConnectionStore = defineStore('connection', () => {
  // Load persisted connection info
  const persistedConnection = localStorage.getItem('yardrover_current_connection')
  const connectionData: PersistedConnection | null = persistedConnection
    ? JSON.parse(persistedConnection)
    : null

  // State
  const client = ref<MAVLinkBridgeClient | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const isDiscovering = ref(false)
  const currentDeviceUrl = ref<string | null>(connectionData?.deviceUrl || null)
  const currentDeviceName = ref<string | null>(connectionData?.deviceName || null)
  const discoveredDevices = ref<MAVLinkBridgeDevice[]>([])
  const savedDevices = ref<SavedDevice[]>(
    JSON.parse(localStorage.getItem('yardrover_saved_devices') || '[]')
  )
  const connectionError = ref<string | null>(null)
  const lastConnectionTime = ref<string | null>(connectionData?.timestamp || null)
  const autoReconnectAttempted = ref(false)

  // Computed
  const hasClient = computed(() => client.value !== null)
  const canConnect = computed(() => !isConnecting.value && !isConnected.value)
  const deviceInfo = computed(() => {
    if (!currentDeviceUrl.value) return null
    return {
      url: currentDeviceUrl.value,
      name: currentDeviceName.value || 'YardRover Device'
    }
  })

  // Actions

  /**
   * Discover devices on the local network using mDNS
   */
  async function discoverLocalDevices(timeout: number = 5000): Promise<MAVLinkBridgeDevice[]> {
    isDiscovering.value = true
    connectionError.value = null

    try {
      // discoverDevices returns a string array of URLs, but we need to use discoverMAVLinkBridgeDevices
      // which returns the full device information
      const { discoverMAVLinkBridgeDevices } = await import('@mavlinkbridge/api-client')
      const result = await discoverMAVLinkBridgeDevices({ timeout })
      discoveredDevices.value = result.devices
      console.log('Discovered devices:', result.devices)
      return result.devices
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown discovery error'
      connectionError.value = `Discovery failed: ${errorMessage}`
      console.error('Device discovery failed:', error)
      return []
    } finally {
      isDiscovering.value = false
    }
  }

  /**
   * Connect to a device by URL
   */
  async function connect(deviceUrl: string, deviceName?: string): Promise<boolean> {
    if (isConnected.value) {
      await disconnect()
    }

    isConnecting.value = true
    connectionError.value = null

    try {
      // Create client instance
      const newClient = createClient(deviceUrl, {
        httpTimeout: 15000,
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        autoConnectWebSocket: true
      })

      // Initialize client and establish connections
      await newClient.connect()

      // Get device configuration to verify connection
      const config = await newClient.getConfiguration()

      client.value = newClient
      isConnected.value = true
      currentDeviceUrl.value = deviceUrl
      currentDeviceName.value = deviceName || config.device.name || 'YardRover Device'
      lastConnectionTime.value = new Date().toISOString()

      // Subscribe to battery telemetry
      setupBatterySubscription(newClient)

      // Persist current connection to localStorage
      const connectionData: PersistedConnection = {
        deviceUrl: deviceUrl,
        deviceName: currentDeviceName.value,
        timestamp: lastConnectionTime.value
      }
      localStorage.setItem('yardrover_current_connection', JSON.stringify(connectionData))

      // Save device to saved devices list
      saveDevice({
        id: deviceUrl,
        name: currentDeviceName.value,
        url: deviceUrl,
        lastConnected: lastConnectionTime.value
      })

      console.log('Connected to device:', currentDeviceName.value)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error'
      connectionError.value = `Connection failed: ${errorMessage}`
      console.error('Connection failed:', error)

      // Clean up on failure
      client.value = null
      isConnected.value = false
      currentDeviceUrl.value = null
      currentDeviceName.value = null

      return false
    } finally {
      isConnecting.value = false
    }
  }

  /**
   * Disconnect from current device
   */
  async function disconnect(): Promise<void> {
    if (!client.value) return

    try {
      await client.value.disconnect()
      console.log('Disconnected from device')
    } catch (error) {
      console.error('Error during disconnect:', error)
    } finally {
      client.value = null
      isConnected.value = false
      currentDeviceUrl.value = null
      currentDeviceName.value = null
      connectionError.value = null

      // Clear persisted connection
      localStorage.removeItem('yardrover_current_connection')
    }
  }

  /**
   * Reconnect to current device
   */
  async function reconnect(): Promise<boolean> {
    if (!currentDeviceUrl.value) return false
    return await connect(currentDeviceUrl.value, currentDeviceName.value || undefined)
  }

  /**
   * Save a device to the saved devices list
   */
  function saveDevice(device: SavedDevice): void {
    const existingIndex = savedDevices.value.findIndex(d => d.id === device.id)

    if (existingIndex !== -1) {
      // Update existing device
      savedDevices.value[existingIndex] = {
        ...savedDevices.value[existingIndex],
        ...device
      }
    } else {
      // Add new device
      savedDevices.value.push(device)
    }

    // Persist to localStorage
    localStorage.setItem('yardrover_saved_devices', JSON.stringify(savedDevices.value))
  }

  /**
   * Remove a device from saved devices
   */
  function removeSavedDevice(deviceId: string): void {
    savedDevices.value = savedDevices.value.filter(d => d.id !== deviceId)
    localStorage.setItem('yardrover_saved_devices', JSON.stringify(savedDevices.value))
  }

  /**
   * Toggle favorite status for a saved device
   */
  function toggleFavorite(deviceId: string): void {
    const device = savedDevices.value.find(d => d.id === deviceId)
    if (device) {
      device.favorite = !device.favorite
      localStorage.setItem('yardrover_saved_devices', JSON.stringify(savedDevices.value))
    }
  }

  /**
   * Clear connection error
   */
  function clearError(): void {
    connectionError.value = null
  }

  /**
   * Get the active client instance (throws if not connected)
   */
  function getClient(): MAVLinkBridgeClient {
    if (!client.value) {
      throw new Error('Not connected to device. Please connect first.')
    }
    return client.value
  }

  /**
   * Auto-reconnect to the last connected device on app startup
   * Should be called once when the app initializes
   */
  async function autoReconnect(): Promise<boolean> {
    // Only attempt auto-reconnect once
    if (autoReconnectAttempted.value) {
      return false
    }

    autoReconnectAttempted.value = true

    // Check if we have a persisted connection
    if (!currentDeviceUrl.value) {
      console.log('No persisted connection found')
      return false
    }

    // Don't auto-reconnect if already connected
    if (isConnected.value) {
      console.log('Already connected')
      return true
    }

    console.log('Attempting auto-reconnect to:', currentDeviceUrl.value)

    try {
      const success = await connect(currentDeviceUrl.value, currentDeviceName.value || undefined)

      if (success) {
        console.log('Auto-reconnect successful')
      } else {
        console.log('Auto-reconnect failed')
      }

      return success
    } catch (error) {
      console.error('Auto-reconnect error:', error)
      return false
    }
  }

  /**
   * Check if there is a persisted connection available
   */
  function hasPersistedConnection(): boolean {
    return currentDeviceUrl.value !== null
  }

  /**
   * Setup battery telemetry subscription
   */
  function setupBatterySubscription(clientInstance: MAVLinkBridgeClient): void {
    const batteryStore = useBatteryStore()

    // Start battery monitoring
    batteryStore.startMonitoring()

    // Subscribe to BATTERY_STATUS messages (ID: 147)
    clientInstance.communication.onMAVLinkMessage((message) => {
      if (message.messageId === MAVLinkMessageType.BATTERY_STATUS) {
        const batteryMsg = message.payload as BatteryStatusMessage

        // Calculate total voltage from cell voltages
        const totalVoltage = batteryMsg.voltages
          .filter(v => v !== 65535) // Filter out invalid cells (65535 = 0xFFFF = not used)
          .reduce((sum, v) => sum + v / 1000, 0) // Convert mV to V

        // Current in A (negative for charging, positive for discharging)
        const current = batteryMsg.currentBattery / 100 // Convert cA to A

        // Battery percentage
        const percent = batteryMsg.batteryRemaining

        // Temperature in Celsius (convert from centi-degrees)
        const temperature = batteryMsg.temperature / 100

        // Update battery store with real data
        batteryStore.updateBatteryState(
          totalVoltage > 0 ? totalVoltage : batteryMsg.voltages[0] / 1000, // Fallback to first cell if total is 0
          current,
          percent,
          temperature
        )
      }
    })
  }

  return {
    // State
    client,
    isConnected,
    isConnecting,
    isDiscovering,
    currentDeviceUrl,
    currentDeviceName,
    discoveredDevices,
    savedDevices,
    connectionError,
    lastConnectionTime,

    // Computed
    hasClient,
    canConnect,
    deviceInfo,

    // Actions
    discoverLocalDevices,
    connect,
    disconnect,
    reconnect,
    autoReconnect,
    hasPersistedConnection,
    saveDevice,
    removeSavedDevice,
    toggleFavorite,
    clearError,
    getClient
  }
})
