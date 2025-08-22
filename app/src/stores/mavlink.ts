import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { MAVLinkBridgeClient } from '@mavlinkbridge/api-client'
import type { MAVLinkBridgeClientOptions } from '@mavlinkbridge/api-client'

export interface MAVLinkState {
  client: MAVLinkBridgeClient | null
  isConnected: boolean
  isConnecting: boolean
  connectionError: Error | null
  lastConnectedUrl: string | null
}

export interface VehicleState {
  armed: boolean
  mode: string
  battery: {
    voltage: number
    current: number
    percentage: number
  }
  gps: {
    fixType: number
    satellites: number
    hdop: number
  }
  position: {
    lat: number
    lng: number
  }
  altitude: number
  altitudeMSL: number
  groundSpeed: number
  airSpeed: number
  climbRate: number
  heading: number
  throttle: number
  attitude: {
    roll: number
    pitch: number
    yaw: number
  }
}

export interface PreflightCheck {
  id: string
  name: string
  passed: boolean
  message?: string
}

export interface CommandHistoryEntry {
  timestamp: number
  id: number
  name: string
  params: number[]
  success: boolean
}

export interface SystemMessage {
  severity: string
  text: string
}

export const useMAVLinkStore = defineStore('mavlink', () => {
  // State
  const client = ref<MAVLinkBridgeClient | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const connectionError = ref<Error | null>(null)
  const lastConnectedUrl = ref<string | null>(null)
  
  // Vehicle control state
  const vehicleState = ref<VehicleState>({
    armed: false,
    mode: '',
    battery: { voltage: 0, current: 0, percentage: 0 },
    gps: { fixType: 0, satellites: 0, hdop: 0 },
    position: { lat: 0, lng: 0 },
    altitude: 0,
    altitudeMSL: 0,
    groundSpeed: 0,
    airSpeed: 0,
    climbRate: 0,
    heading: 0,
    throttle: 0,
    attitude: { roll: 0, pitch: 0, yaw: 0 }
  })
  
  const preflightChecks = ref<PreflightCheck[]>([])
  const commandHistory = ref<CommandHistoryEntry[]>([])
  const systemMessages = ref<SystemMessage[]>([])
  const lastTelemetryUpdate = ref<number>(0)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // Getters (computed)
  const connectionStatus = computed((): 'connected' | 'connecting' | 'disconnected' | 'error' => {
    if (connectionError.value) return 'error'
    if (isConnecting.value) return 'connecting'
    if (isConnected.value) return 'connected'
    return 'disconnected'
  })

  const isReady = computed((): boolean => {
    return isConnected.value && client.value !== null
  })

  // Actions
  async function connect(deviceUrl: string, options?: Partial<MAVLinkBridgeClientOptions>) {
    if (isConnecting.value) {
      throw new Error('Connection already in progress')
    }

    isConnecting.value = true
    connectionError.value = null

    try {
      const clientOptions: MAVLinkBridgeClientOptions = {
        httpTimeout: 10000,
        maxReconnectAttempts: parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECT_ATTEMPTS) || 5,
        reconnectDelay: parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECT_DELAY) || 1000,
        autoConnectWebSocket: true,
        ...options
      }

      client.value = new MAVLinkBridgeClient(deviceUrl, clientOptions)
      
      // Test connection with a simple health check
      await client.value.health.getSystemHealth()
      
      isConnected.value = true
      lastConnectedUrl.value = deviceUrl
      connectionError.value = null
    } catch (error) {
      connectionError.value = error instanceof Error ? error : new Error('Unknown connection error')
      isConnected.value = false
      client.value = null
      throw connectionError.value
    } finally {
      isConnecting.value = false
    }
  }

  function disconnect() {
    if (client.value) {
      try {
        // If client has a disconnect method, call it
        if (typeof client.value.disconnect === 'function') {
          client.value.disconnect()
        }
      } catch (error) {
        console.warn('Error during disconnect:', error)
      }
    }

    client.value = null
    isConnected.value = false
    isConnecting.value = false
    connectionError.value = null
  }

  async function reconnect() {
    if (!lastConnectedUrl.value) {
      throw new Error('No previous connection URL available for reconnection')
    }
    
    disconnect()
    await connect(lastConnectedUrl.value)
  }

  function clearError() {
    connectionError.value = null
  }

  // Control actions
  async function armVehicle(force = false) {
    if (!client.value) throw new Error('Client not connected')
    
    loading.value = true
    error.value = null
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // if (force) {
      //   await client.value.mavlink.forceArm()
      // } else {
      //   await client.value.mavlink.arm()
      // }
      
      // Mock implementation for now
      console.log(`MAVLink: ${force ? 'Force arm' : 'Arm'} vehicle`)
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call
      vehicleState.value.armed = true
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to arm vehicle')
      throw error.value
    } finally {
      loading.value = false
    }
  }

  async function disarmVehicle() {
    if (!client.value) throw new Error('Client not connected')
    
    loading.value = true
    error.value = null
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // await client.value.mavlink.disarm()
      
      // Mock implementation for now
      console.log('MAVLink: Disarm vehicle')
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call
      vehicleState.value.armed = false
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to disarm vehicle')
      throw error.value
    } finally {
      loading.value = false
    }
  }

  async function setFlightMode(mode: string) {
    if (!client.value) throw new Error('Client not connected')
    
    loading.value = true
    error.value = null
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // await client.value.mavlink.setMode(mode)
      
      // Mock implementation for now
      console.log(`MAVLink: Set flight mode to ${mode}`)
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call
      vehicleState.value.mode = mode
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to set flight mode')
      throw error.value
    } finally {
      loading.value = false
    }
  }

  async function sendCommand(commandId: number, params: number[]) {
    if (!client.value) throw new Error('Client not connected')
    
    const entry: CommandHistoryEntry = {
      timestamp: Date.now(),
      id: commandId,
      name: `Command ${commandId}`,
      params,
      success: false
    }
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // await client.value.mavlink.sendCommand({
      //   command: commandId,
      //   params
      // })
      
      // Mock implementation for now
      console.log(`MAVLink: Send command ${commandId} with params:`, params)
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call
      entry.success = true
    } catch (err) {
      entry.success = false
      throw err
    } finally {
      commandHistory.value.unshift(entry)
      if (commandHistory.value.length > 50) {
        commandHistory.value = commandHistory.value.slice(0, 50)
      }
    }
  }

  async function emergencyStop() {
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // await client.value.mavlink.emergencyStop()
      
      // Mock implementation for now
      console.log('MAVLink: EMERGENCY STOP')
      await new Promise(resolve => setTimeout(resolve, 200)) // Simulate fast emergency response
      vehicleState.value.armed = false
    } catch (err) {
      throw err instanceof Error ? err : new Error('Emergency stop failed')
    }
  }

  async function requestDataStreams() {
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // await client.value.mavlink.requestDataStreams()
      
      // Mock implementation for now
      console.log('MAVLink: Request data streams')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Start mock telemetry updates
      startMockTelemetry()
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to request data streams')
    }
  }

  async function setHomePosition() {
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // await client.value.mavlink.setHomePosition()
      
      // Mock implementation for now
      console.log('MAVLink: Set home position')
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to set home position')
    }
  }

  async function startCompassCalibration() {
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // await client.value.mavlink.startCompassCalibration()
      
      // Mock implementation for now
      console.log('MAVLink: Start compass calibration')
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to start compass calibration')
    }
  }

  async function rebootFlightController() {
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // TODO: Replace with actual MAVLink API when available
      // await client.value.mavlink.rebootFlightController()
      
      // Mock implementation for now
      console.log('MAVLink: Reboot flight controller')
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to reboot flight controller')
    }
  }

  function updateTelemetry() {
    // This would be called periodically to update telemetry data
    lastTelemetryUpdate.value = Date.now()
  }

  let mockTelemetryInterval: number | null = null

  function startMockTelemetry() {
    if (mockTelemetryInterval) return
    
    // Initialize with some default values
    vehicleState.value.gps.fixType = 3
    vehicleState.value.gps.satellites = 8
    vehicleState.value.battery.percentage = 85
    vehicleState.value.battery.voltage = 12.4
    vehicleState.value.mode = 'STABILIZE'
    
    mockTelemetryInterval = window.setInterval(() => {
      // Simulate changing telemetry data
      vehicleState.value.attitude.roll = Math.sin(Date.now() / 10000) * 5
      vehicleState.value.attitude.pitch = Math.cos(Date.now() / 8000) * 3
      vehicleState.value.heading = (Date.now() / 1000) % 360
      vehicleState.value.groundSpeed = Math.random() * 2 + 1
      vehicleState.value.altitude = 50 + Math.sin(Date.now() / 15000) * 10
      vehicleState.value.battery.percentage = Math.max(20, 85 - (Date.now() % 600000) / 10000)
      
      updateTelemetry()
      initializePreflightChecks()
    }, 1000)
  }

  function stopMockTelemetry() {
    if (mockTelemetryInterval) {
      clearInterval(mockTelemetryInterval)
      mockTelemetryInterval = null
    }
  }

  function initializePreflightChecks() {
    preflightChecks.value = [
      {
        id: 'gps',
        name: 'GPS Lock',
        passed: vehicleState.value.gps.fixType >= 3,
        ...(vehicleState.value.gps.fixType < 3 && { message: 'Waiting for GPS lock' })
      },
      {
        id: 'battery',
        name: 'Battery Level',
        passed: vehicleState.value.battery.percentage > 20,
        ...(vehicleState.value.battery.percentage <= 20 && { message: 'Low battery level' })
      },
      {
        id: 'calibration',
        name: 'Sensors Calibrated',
        passed: true // Would check actual calibration status
      },
      {
        id: 'failsafes',
        name: 'Failsafes Configured',
        passed: true // Would check failsafe configuration
      }
    ]
  }

  function setupWebSocketHandlers() {
    if (!client.value) return

    // TODO: Replace with actual MAVLink WebSocket handlers when available
    // The current client doesn't expose MAVLink-specific event handlers
    // This is a placeholder for when the API is implemented
    
    console.log('MAVLink: Setting up WebSocket handlers (mock)')
    
    // For now, we'll use the mock telemetry system
    // In the future, this would subscribe to real MAVLink telemetry events:
    // client.value.onMAVLinkTelemetry?.((data) => { ... })
    // client.value.onMAVLinkMessage?.((msg) => { ... })
  }

  return {
    // State
    client,
    isConnected,
    isConnecting,
    connectionError,
    lastConnectedUrl,
    vehicleState,
    preflightChecks,
    commandHistory,
    systemMessages,
    lastTelemetryUpdate,
    loading,
    error,
    
    // Getters
    connectionStatus,
    isReady,
    
    // Actions
    connect,
    disconnect,
    reconnect,
    clearError,
    
    // Control actions
    armVehicle,
    disarmVehicle,
    setFlightMode,
    sendCommand,
    emergencyStop,
    requestDataStreams,
    setHomePosition,
    startCompassCalibration,
    rebootFlightController,
    updateTelemetry,
    initializePreflightChecks,
    setupWebSocketHandlers,
    startMockTelemetry,
    stopMockTelemetry
  }
})