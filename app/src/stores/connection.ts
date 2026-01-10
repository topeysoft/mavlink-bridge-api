import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  createClient,
  discoverDevices,
  type MAVLinkBridgeClient,
  type MAVLinkBridgeDevice,
  MAVLinkMessageType,
  type BatteryStatusMessage,
  type GpsRawIntMessage,
  type GlobalPositionIntMessage,
  type ScaledImuMessage,
  type RawImuMessage,
  type HighResImuMessage,
  type AttitudeMessage,
  type HeartbeatMessage,
  type ParamValueMessage,
  MAVLinkDecoder
} from '@mavlinkbridge/api-client'
import { useBatteryStore } from './battery'
import { useGpsStore } from './gps'
import { useImuStore } from './imu'
import { useCompassStore } from './compass'
import { useVehicleStore } from './vehicle'
import { useAuthStore } from './auth'

export interface SavedDevice {
  id: string
  name: string
  url: string
  lastConnected?: string
  favorite?: boolean
  authStatus?: 'needs_setup' | 'needs_login' | 'authenticated' | 'unknown'
  setupChecked?: boolean
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

  // MAVLink decoder with support for message truncation
  const mavlinkDecoder = new MAVLinkDecoder()

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

      // Try to get device configuration, but fall back to health endpoint if auth required
      let finalDeviceName = deviceName || 'YardRover Device'
      try {
        const config = await newClient.getConfiguration()
        finalDeviceName = deviceName || config.device.name || 'YardRover Device'
      } catch (configError: any) {
        // If config endpoint requires auth (401) or is forbidden (403), use health endpoint instead
        const isAuthError = configError?.status === 401 ||
                           configError?.status === 403 ||
                           configError?.message?.includes('401') ||
                           configError?.message?.includes('Unauthorized')

        if (isAuthError) {
          // Config endpoint requires auth, fallback to health endpoint
          try {
            const health = await newClient.health.getHealth()
            finalDeviceName = deviceName || health.device.name || 'YardRover Device'
          } catch (healthError) {
            // Use provided deviceName or default
          }
        } else {
          // Re-throw non-auth errors
          throw configError
        }
      }

      client.value = newClient
      isConnected.value = true
      currentDeviceUrl.value = deviceUrl
      currentDeviceName.value = finalDeviceName
      lastConnectionTime.value = new Date().toISOString()

      // Subscribe to all telemetry data
      setupTelemetrySubscriptions(newClient)

      // Initialize auth state from client (syncs localStorage token to auth store and fetches user)
      // Do this AFTER connection is fully established
      const authStore = useAuthStore()
      const authClient = (newClient as any).authClient
      if (authClient) {
        try {
          await authStore.initializeFromClient(authClient)
        } catch (error) {
          console.error('[Connection] Failed to initialize auth from client:', error)
          // Don't fail the connection if auth initialization fails
        }
      }

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
   * Check auth/setup status for a device
   */
  async function checkDeviceAuthStatus(deviceUrl: string): Promise<'needs_setup' | 'needs_login' | 'authenticated' | 'unknown'> {
    try {
      // Create a temporary client to check auth status
      const tempClient = createClient(deviceUrl, {
        httpTimeout: 5000,
        autoConnectWebSocket: false
      })

      // Check setup status (this endpoint should be public)
      try {
        const authClient = (tempClient as any).authClient
        if (authClient) {
          const setupStatus = await authClient.getSetupStatus()
          if (setupStatus.in_setup_mode) {
            return 'needs_setup'
          }
        }
      } catch (error) {
        // Setup check failed, likely needs login
      }

      // Try to access a protected endpoint to check if authenticated
      try {
        await tempClient.getConfiguration()
        return 'authenticated'
      } catch (error: any) {
        // Check if it's an auth error (401/403)
        const isAuthError = error?.status === 401 ||
                           error?.status === 403 ||
                           error?.message?.includes('401') ||
                           error?.message?.includes('Unauthorized')

        if (isAuthError) {
          return 'needs_login'
        }
      }

      return 'unknown'
    } catch (error) {
      console.error('Failed to check auth status:', error)
      return 'unknown'
    }
  }

  /**
   * Update auth status for a discovered or saved device
   */
  async function updateDeviceAuthStatus(deviceId: string): Promise<void> {
    const device = savedDevices.value.find(d => d.id === deviceId)
    if (!device) return

    const status = await checkDeviceAuthStatus(device.url)
    device.authStatus = status
    device.setupChecked = true

    // Persist updated device info
    localStorage.setItem('yardrover_saved_devices', JSON.stringify(savedDevices.value))
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
      return false
    }

    // Don't auto-reconnect if already connected
    if (isConnected.value) {
      return true
    }

    try {
      const success = await connect(currentDeviceUrl.value, currentDeviceName.value || undefined)
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
   * Setup all telemetry subscriptions using MAVLinkDecoder
   */
  function setupTelemetrySubscriptions(clientInstance: MAVLinkBridgeClient): void {
    const batteryStore = useBatteryStore()
    const gpsStore = useGpsStore()
    const imuStore = useImuStore()
    const compassStore = useCompassStore()
    const vehicleStore = useVehicleStore()

    // Start monitoring in all stores
    batteryStore.startMonitoring()
    gpsStore.startMonitoring()

    // Critical messages that we need for telemetry display
    const criticalMessages = new Set([
      MAVLinkMessageType.HEARTBEAT,
      MAVLinkMessageType.ATTITUDE,
      MAVLinkMessageType.GPS_RAW_INT,
      MAVLinkMessageType.GLOBAL_POSITION_INT,
      MAVLinkMessageType.BATTERY_STATUS,
      MAVLinkMessageType.SCALED_IMU,
      MAVLinkMessageType.RAW_IMU,
      MAVLinkMessageType.HIGHRES_IMU
    ])

    // Subscribe to MAVLink messages and decode them
    clientInstance.communication.onMAVLinkMessage((message) => {
      // Check if payload is already decoded (object) or needs decoding (base64 string)
      let decoded
      if (typeof message.payload === 'object' && message.payload !== null) {
        // Backend has already decoded the message - use it directly
        decoded = {
          messageId: message.messageId,
          data: message.payload
        }
      } else {
        // Payload is base64 - decode it
        try {
          decoded = mavlinkDecoder.decode(
            message.messageId,
            message.systemId,
            message.componentId,
            message.payload
          )
        } catch (error) {
          // Only warn about critical messages that failed to decode
          if (criticalMessages.has(message.messageId)) {
            console.warn(`Failed to decode critical MAVLink message ${message.messageId}:`, error)
          }
          // Skip this message
          return
        }

        if (!decoded) {
          // Message type not supported by decoder, skip silently
          return
        }
      }

      // Route decoded messages to appropriate stores
      switch (decoded.messageId) {
        case MAVLinkMessageType.HEARTBEAT:
          {
            const heartbeat = decoded.data as HeartbeatMessage
            // Update vehicle armed/mode state
            vehicleStore.updateVehicleState({
              armed: (heartbeat.baseMode & 0x80) !== 0, // MAV_MODE_FLAG_SAFETY_ARMED
              mode: getFlightModeFromCustomMode(heartbeat.customMode)
            })
          }
          break

        case MAVLinkMessageType.BATTERY_STATUS:
          {
            const batteryMsg = decoded.data as BatteryStatusMessage

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
          break

        case MAVLinkMessageType.GPS_RAW_INT:
          {
            const gpsMsg = decoded.data as GpsRawIntMessage
            gpsStore.updateFromGpsRawInt(gpsMsg)
          }
          break

        case MAVLinkMessageType.GLOBAL_POSITION_INT:
          {
            const posMsg = decoded.data as GlobalPositionIntMessage
            gpsStore.updateFromGlobalPositionInt(posMsg)
          }
          break

        case MAVLinkMessageType.ATTITUDE:
          {
            const attitudeMsg = decoded.data as AttitudeMessage
            // Update compass store with attitude data
            compassStore.updateAttitudeData({
              timestamp: Date.now(),
              roll: attitudeMsg.roll,
              pitch: attitudeMsg.pitch,
              yaw: attitudeMsg.yaw,
              rollspeed: attitudeMsg.rollspeed,
              pitchspeed: attitudeMsg.pitchspeed,
              yawspeed: attitudeMsg.yawspeed
            })
          }
          break

        case MAVLinkMessageType.SCALED_IMU:
          {
            const imuMsg = decoded.data as ScaledImuMessage
            // Convert from milli-g to m/s^2 for acceleration
            // Convert from milli-rad/s to rad/s for gyro
            imuStore.updateIMUData({
              timestamp: Date.now(),
              acceleration: {
                x: (imuMsg.xacc / 1000) * 9.81,
                y: (imuMsg.yacc / 1000) * 9.81,
                z: (imuMsg.zacc / 1000) * 9.81
              },
              gyro: {
                x: imuMsg.xgyro / 1000,
                y: imuMsg.ygyro / 1000,
                z: imuMsg.zgyro / 1000
              },
              magnetometer: {
                x: imuMsg.xmag,
                y: imuMsg.ymag,
                z: imuMsg.zmag
              },
              temperature: imuMsg.temperature !== undefined ? imuMsg.temperature / 100 : undefined
            })
          }
          break

        case MAVLinkMessageType.RAW_IMU:
          {
            const imuMsg = decoded.data as RawImuMessage
            // Raw IMU values are in raw sensor units, convert to standard units
            imuStore.updateIMUData({
              timestamp: Date.now(),
              acceleration: {
                x: (imuMsg.xacc / 1000) * 9.81,
                y: (imuMsg.yacc / 1000) * 9.81,
                z: (imuMsg.zacc / 1000) * 9.81
              },
              gyro: {
                x: imuMsg.xgyro / 1000,
                y: imuMsg.ygyro / 1000,
                z: imuMsg.zgyro / 1000
              },
              magnetometer: {
                x: imuMsg.xmag,
                y: imuMsg.ymag,
                z: imuMsg.zmag
              },
              temperature: imuMsg.temperature !== undefined ? imuMsg.temperature / 100 : undefined
            })
          }
          break

        case MAVLinkMessageType.HIGHRES_IMU:
          {
            const imuMsg = decoded.data as HighResImuMessage
            // High-res IMU provides data in standard units already
            imuStore.updateIMUData({
              timestamp: Date.now(),
              acceleration: {
                x: imuMsg.xacc,
                y: imuMsg.yacc,
                z: imuMsg.zacc
              },
              gyro: {
                x: imuMsg.xgyro,
                y: imuMsg.ygyro,
                z: imuMsg.zgyro
              },
              magnetometer: {
                x: imuMsg.xmag,
                y: imuMsg.ymag,
                z: imuMsg.zmag
              },
              temperature: imuMsg.temperature
            })
          }
          break

        case MAVLinkMessageType.PARAM_VALUE:
          {
            const paramMsg = decoded.data as ParamValueMessage
            // Forward parameter to the parameter client for caching
            if (clientInstance && clientInstance.parameters) {
              // Update the parameter cache directly
              clientInstance.parameters['updateCacheParameter'](
                paramMsg.paramId,
                paramMsg.paramValue,
                paramMsg.paramType === 1 ? 'int' : 'float',
                Date.now()
              )
            }
          }
          break
      }
    })
  }

  /**
   * Convert MAVLink custom mode to flight mode string
   * Based on ArduRover mode numbers
   */
  function getFlightModeFromCustomMode(customMode: number): string {
    const modeMap: Record<number, string> = {
      0: 'MANUAL',
      1: 'ACRO',
      3: 'STEERING',
      4: 'HOLD',
      10: 'AUTO',
      11: 'RTL',
      12: 'SMART_RTL',
      15: 'GUIDED',
      16: 'INITIALIZING'
    }
    return modeMap[customMode] || 'HOLD'
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
    getClient,
    checkDeviceAuthStatus,
    updateDeviceAuthStatus
  }
})
