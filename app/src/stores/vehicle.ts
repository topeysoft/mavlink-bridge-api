import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import { useBatteryStore } from './battery'
import { useGpsStore } from './gps'
import type { MAVLinkCommandClient } from '@mavlinkbridge/api-client'

// MAVLink flight modes (based on ArduPilot)
export type FlightMode =
  | 'MANUAL'
  | 'HOLD'
  | 'AUTO'
  | 'GUIDED'
  | 'RTL' // Return to Launch
  | 'SMART_RTL'
  | 'ACRO'
  | 'STEERING'
  | 'INITIALIZING'

export interface VehicleState {
  armed: boolean
  mode: FlightMode
  gpsLock: boolean
  batteryVoltage: number
  batteryPercent: number
  heading: number
  speed: number
  altitude: number
  latitude: number | null
  longitude: number | null
  satellites: number
  lastUpdate: string | null
}

export interface MAVLinkCommand {
  command: number
  param1?: number
  param2?: number
  param3?: number
  param4?: number
  param5?: number
  param6?: number
  param7?: number
}

// Common MAVLink commands
export const MAV_CMD = {
  ARM_DISARM: 400,
  SET_MODE: 176,
  RETURN_TO_LAUNCH: 20,
  DO_SET_HOME: 179,
  MISSION_START: 300,
  DO_PAUSE_CONTINUE: 193,
  REPOSITION: 192,
} as const

export const useVehicleStore = defineStore('vehicle', () => {
  // Get battery and GPS stores for live telemetry data
  const batteryStore = useBatteryStore()
  const gpsStore = useGpsStore()

  const vehicleState = ref<VehicleState>({
    armed: false,
    mode: 'HOLD',
    gpsLock: false,
    batteryVoltage: 0, // Updated from battery store
    batteryPercent: 0, // Updated from battery store
    heading: 0,
    speed: 0,
    altitude: 0,
    latitude: null,
    longitude: null,
    satellites: 0,
    lastUpdate: null,
  })

  const commandHistory = ref<Array<{ timestamp: string; command: string; success: boolean; error?: string }>>([])
  const isPendingCommand = ref(false)

  // Computed properties with live battery and GPS data
  const vehicleStateWithBattery = computed<VehicleState>(() => ({
    ...vehicleState.value,
    batteryVoltage: batteryStore.batteryInfo.voltage,
    batteryPercent: batteryStore.batteryInfo.percent,
    gpsLock: gpsStore.gpsInfo.hasLock,
    latitude: gpsStore.gpsInfo.latitude,
    longitude: gpsStore.gpsInfo.longitude,
    altitude: gpsStore.gpsInfo.altitude,
    satellites: gpsStore.gpsInfo.satellites,
    heading: gpsStore.gpsInfo.heading,
    speed: gpsStore.gpsInfo.speed
  }))

  const canArm = computed(() => {
    return (
      !vehicleStateWithBattery.value.armed &&
      vehicleStateWithBattery.value.gpsLock &&
      vehicleStateWithBattery.value.batteryPercent > 20 &&
      vehicleStateWithBattery.value.satellites >= 6
    )
  })

  const canDisarm = computed(() => {
    return vehicleStateWithBattery.value.armed && vehicleStateWithBattery.value.mode !== 'AUTO'
  })

  const isHealthy = computed(() => {
    return (
      vehicleStateWithBattery.value.batteryPercent > 20 &&
      vehicleStateWithBattery.value.gpsLock &&
      vehicleStateWithBattery.value.satellites >= 6
    )
  })

  const statusColor = computed(() => {
    if (!isHealthy.value) return 'error'
    if (vehicleState.value.armed) return 'success'
    return 'warning'
  })

  // Actions
  function updateVehicleState(update: Partial<VehicleState>) {
    vehicleState.value = {
      ...vehicleState.value,
      ...update,
      lastUpdate: new Date().toISOString(),
    }
  }

  async function sendCommand(command: MAVLinkCommand, description: string): Promise<boolean> {
    isPendingCommand.value = true
    const connectionStore = useConnectionStore()

    try {
      // Check if connected
      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()

      // For now, just log the command
      // In a real implementation, we would use a direct command API
      console.log('MAVLink command:', description, command)

      commandHistory.value.push({
        timestamp: new Date().toISOString(),
        command: description,
        success: true
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      commandHistory.value.push({
        timestamp: new Date().toISOString(),
        command: description,
        success: false,
        error: errorMessage,
      })
      console.error('MAVLink command failed:', error)
      return false
    } finally {
      isPendingCommand.value = false
    }
  }

  async function arm(): Promise<boolean> {
    if (!canArm.value) return false

    const connectionStore = useConnectionStore()

    try {
      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()
      await client.mavlink.arm()

      commandHistory.value.push({
        timestamp: new Date().toISOString(),
        command: 'ARM vehicle',
        success: true
      })

      vehicleState.value.armed = true
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      commandHistory.value.push({
        timestamp: new Date().toISOString(),
        command: 'ARM vehicle',
        success: false,
        error: errorMessage
      })
      console.error('Arm failed:', error)
      return false
    }
  }

  async function disarm(): Promise<boolean> {
    if (!canDisarm.value) return false

    const connectionStore = useConnectionStore()

    try {
      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()
      await client.mavlink.disarm()

      commandHistory.value.push({
        timestamp: new Date().toISOString(),
        command: 'DISARM vehicle',
        success: true
      })

      vehicleState.value.armed = false
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      commandHistory.value.push({
        timestamp: new Date().toISOString(),
        command: 'DISARM vehicle',
        success: false,
        error: errorMessage
      })
      console.error('Disarm failed:', error)
      return false
    }
  }

  async function setMode(mode: FlightMode): Promise<boolean> {
    // Map flight modes to MAVLink mode numbers (ArduRover)
    const modeMap: Record<FlightMode, number> = {
      MANUAL: 0,
      ACRO: 1,
      STEERING: 3,
      HOLD: 4,
      AUTO: 10,
      RTL: 11,
      SMART_RTL: 12,
      GUIDED: 15,
      INITIALIZING: 16,
    }

    const connectionStore = useConnectionStore()

    try {
      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()
      await client.mavlink.setMode(modeMap[mode])

      commandHistory.value.push({
        timestamp: new Date().toISOString(),
        command: `Set mode to ${mode}`,
        success: true
      })

      vehicleState.value.mode = mode
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      commandHistory.value.push({
        timestamp: new Date().toISOString(),
        command: `Set mode to ${mode}`,
        success: false,
        error: errorMessage
      })
      console.error('Set mode failed:', error)
      return false
    }
  }

  async function returnToLaunch(): Promise<boolean> {
    const success = await sendCommand(
      {
        command: MAV_CMD.RETURN_TO_LAUNCH,
      },
      'Return to Launch'
    )

    if (success) {
      vehicleState.value.mode = 'RTL'
    }
    return success
  }

  async function setHome(): Promise<boolean> {
    if (!vehicleState.value.latitude || !vehicleState.value.longitude) {
      return false
    }

    return await sendCommand(
      {
        command: MAV_CMD.DO_SET_HOME,
        param1: 0, // Use current location
        param5: vehicleState.value.latitude,
        param6: vehicleState.value.longitude,
        param7: vehicleState.value.altitude,
      },
      'Set home position'
    )
  }

  async function startMission(): Promise<boolean> {
    if (vehicleState.value.mode !== 'AUTO') {
      await setMode('AUTO')
    }

    return await sendCommand(
      {
        command: MAV_CMD.MISSION_START,
      },
      'Start mission'
    )
  }

  async function pauseMission(): Promise<boolean> {
    return await sendCommand(
      {
        command: MAV_CMD.DO_PAUSE_CONTINUE,
        param1: 0, // 0 = pause
      },
      'Pause mission'
    )
  }

  async function resumeMission(): Promise<boolean> {
    return await sendCommand(
      {
        command: MAV_CMD.DO_PAUSE_CONTINUE,
        param1: 1, // 1 = continue
      },
      'Resume mission'
    )
  }

  async function emergencyStop(): Promise<boolean> {
    // Emergency stop: disarm and set to HOLD mode
    const holdSuccess = await setMode('HOLD')
    const disarmSuccess = await disarm()

    return holdSuccess && disarmSuccess
  }

  function clearCommandHistory() {
    commandHistory.value = []
  }

  return {
    // State (with live battery data)
    vehicleState: vehicleStateWithBattery,
    commandHistory,
    isPendingCommand,

    // Computed
    canArm,
    canDisarm,
    isHealthy,
    statusColor,

    // Actions
    updateVehicleState,
    sendCommand,
    arm,
    disarm,
    setMode,
    returnToLaunch,
    setHome,
    startMission,
    pauseMission,
    resumeMission,
    emergencyStop,
    clearCommandHistory,
  }
})
