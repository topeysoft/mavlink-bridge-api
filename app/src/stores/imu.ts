import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import type { IMUData, IMUMetrics } from '@client'

interface IMUHistoryEntry {
  timestamp: number
  totalAcceleration: number
  vibrationLevel: number
  tiltAngle: number
}

export const useImuStore = defineStore('imu', () => {
  // Raw IMU data
  const imuData = ref<IMUData | null>(null)

  // Historical data for charts
  const history = ref<IMUHistoryEntry[]>([])
  const maxHistoryLength = 300 // 5 minutes at 1Hz

  // Computed: Total acceleration magnitude
  const totalAcceleration = computed(() => {
    if (!imuData.value) return 0
    const { x, y, z } = imuData.value.acceleration
    return Math.sqrt(x * x + y * y + z * z)
  })

  // Computed: Vibration level (normalized 0-1 based on acceleration variance)
  const vibrationLevel = computed(() => {
    if (history.value.length < 10) return 0

    const recent = history.value.slice(-20) // Last 20 samples
    const accelerations = recent.map(h => h.totalAcceleration)
    const avg = accelerations.reduce((sum, val) => sum + val, 0) / accelerations.length
    const variance = accelerations.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / accelerations.length
    const stdDev = Math.sqrt(variance)

    // Normalize to 0-1 range (0.5 m/s^2 stddev = max vibration)
    return Math.min(stdDev / 0.5, 1)
  })

  // Computed: Tilt angle from vertical (degrees)
  const tiltAngle = computed(() => {
    if (!imuData.value) return 0
    const { x, y, z } = imuData.value.acceleration

    // Calculate tilt from gravity vector
    const gravityMagnitude = Math.sqrt(x * x + y * y + z * z)
    if (gravityMagnitude === 0) return 0

    // Assuming Z is vertical, calculate tilt angle
    const tiltRad = Math.acos(Math.abs(z) / gravityMagnitude)
    return (tiltRad * 180) / Math.PI
  })

  // Computed: Is vehicle level?
  const isLevel = computed(() => {
    return tiltAngle.value < 15 // Less than 15 degrees is considered level
  })

  // Computed: IMU health status
  const health = computed<'excellent' | 'good' | 'fair' | 'poor' | 'error'>(() => {
    if (!imuData.value) return 'error'

    const vib = vibrationLevel.value
    const tilt = tiltAngle.value

    if (vib < 0.2 && tilt < 20) return 'excellent'
    if (vib < 0.4 && tilt < 30) return 'good'
    if (vib < 0.6 && tilt < 45) return 'fair'
    if (vib < 0.8 && tilt < 60) return 'poor'
    return 'error'
  })

  // Computed: IMU metrics
  const metrics = computed<IMUMetrics>(() => ({
    totalAcceleration: totalAcceleration.value,
    vibrationLevel: vibrationLevel.value,
    tiltAngle: tiltAngle.value,
    isLevel: isLevel.value,
    health: health.value
  }))

  // Computed: Last update timestamp
  const lastUpdate = computed(() => imuData.value?.timestamp || null)

  // Computed: Temperature
  const temperature = computed(() => imuData.value?.temperature || null)

  // Update IMU data
  function updateIMUData(data: IMUData) {
    imuData.value = data

    // Add to history
    history.value.push({
      timestamp: data.timestamp,
      totalAcceleration: totalAcceleration.value,
      vibrationLevel: vibrationLevel.value,
      tiltAngle: tiltAngle.value
    })

    // Trim history
    if (history.value.length > maxHistoryLength) {
      history.value = history.value.slice(-maxHistoryLength)
    }
  }

  // Setup subscription to IMU data from connection
  function setupSubscription() {
    const connectionStore = useConnectionStore()

    if (!connectionStore.isConnected) {
      console.warn('Cannot setup IMU subscription: not connected')
      return
    }

    const client = connectionStore.getClient()

    // Subscribe to IMU data via telemetry client
    const unsubscribe = client.telemetry.onIMUData((data: IMUData) => {
      updateIMUData(data)
    })

    // Return unsubscribe function
    return unsubscribe
  }

  // Clear history
  function clearHistory() {
    history.value = []
  }

  return {
    // State
    imuData,
    history,

    // Computed
    totalAcceleration,
    vibrationLevel,
    tiltAngle,
    isLevel,
    health,
    metrics,
    lastUpdate,
    temperature,

    // Actions
    updateIMUData,
    setupSubscription,
    clearHistory
  }
})
