import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import type { CompassData, CompassHealth, AttitudeData } from '@client'

interface CompassHistoryEntry {
  timestamp: number
  heading: number
}

export const useCompassStore = defineStore('compass', () => {
  // Raw compass data
  const compassData = ref<CompassData | null>(null)

  // Attitude data (provides heading from yaw)
  const attitudeData = ref<AttitudeData | null>(null)

  // Historical data for charts
  const history = ref<CompassHistoryEntry[]>([])
  const maxHistoryLength = 300 // 5 minutes at 1Hz

  // Calibration data
  const calibrationQuality = ref(0) // 0-100
  const lastCalibrationDate = ref<Date | null>(null)

  // Computed: Current heading (degrees, 0-360, 0=North)
  const heading = computed(() => {
    // Prefer attitude data (from gyro integration) over magnetometer
    if (attitudeData.value) {
      // Convert yaw (radians) to heading (degrees)
      let headingDeg = (attitudeData.value.yaw * 180 / Math.PI + 360) % 360
      return headingDeg
    }

    return compassData.value?.heading || 0
  })

  // Computed: Magnetic field strength (total magnitude in milligauss)
  const fieldStrength = computed(() => {
    if (!compassData.value) return 0
    const { x, y, z } = compassData.value.fieldStrength
    return Math.sqrt(x * x + y * y + z * z) * 1000 // Convert to milligauss
  })

  // Computed: Declination (difference between magnetic and true north)
  const declination = computed(() => {
    return compassData.value?.declination || 0
  })

  // Computed: True heading (magnetic heading + declination)
  const trueHeading = computed(() => {
    return (heading.value + declination.value + 360) % 360
  })

  // Computed: Cardinal direction (N, NE, E, SE, S, SW, W, NW)
  const cardinalDirection = computed(() => {
    const h = heading.value
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round(h / 45) % 8
    return directions[index]
  })

  // Computed: Interference level based on field strength stability
  const interferenceLevel = computed<'low' | 'medium' | 'high'>(() => {
    if (history.value.length < 20) return 'low'

    const recent = history.value.slice(-20)
    const headings = recent.map(h => h.heading)

    // Calculate heading variance (accounting for circular nature)
    let sumSin = 0
    let sumCos = 0
    headings.forEach(h => {
      const rad = h * Math.PI / 180
      sumSin += Math.sin(rad)
      sumCos += Math.cos(rad)
    })

    const avgSin = sumSin / headings.length
    const avgCos = sumCos / headings.length
    const r = Math.sqrt(avgSin * avgSin + avgCos * avgCos)
    const variance = 1 - r

    if (variance < 0.1) return 'low'
    if (variance < 0.3) return 'medium'
    return 'high'
  })

  // Computed: Is compass calibrated?
  const isCalibrated = computed(() => {
    return calibrationQuality.value > 70
  })

  // Computed: Does compass need calibration?
  const needsCalibration = computed(() => {
    if (calibrationQuality.value < 50) return true
    if (interferenceLevel.value === 'high') return true
    if (lastCalibrationDate.value) {
      const daysSinceCalibration = (Date.now() - lastCalibrationDate.value.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceCalibration > 90) return true // Recalibrate every 90 days
    }
    return false
  })

  // Computed: Calibration status
  const calibrationStatus = computed<'uncalibrated' | 'calibrating' | 'calibrated' | 'error'>(() => {
    if (calibrationQuality.value === 0) return 'uncalibrated'
    if (calibrationQuality.value < 50) return 'error'
    if (calibrationQuality.value < 70) return 'calibrating'
    return 'calibrated'
  })

  // Computed: Compass health
  const compassHealth = computed<CompassHealth>(() => ({
    isCalibrated: isCalibrated.value,
    calibrationQuality: calibrationQuality.value,
    interferenceLevel: interferenceLevel.value,
    lastCalibrationDate: lastCalibrationDate.value || undefined,
    needsCalibration: needsCalibration.value
  }))

  // Computed: Last update timestamp
  const lastUpdate = computed(() => {
    const compassTime = compassData.value?.timestamp || 0
    const attitudeTime = attitudeData.value?.timestamp || 0
    return Math.max(compassTime, attitudeTime) || null
  })

  // Update compass data
  function updateCompassData(data: CompassData) {
    compassData.value = data

    // Add to history
    history.value.push({
      timestamp: data.timestamp,
      heading: data.heading
    })

    // Trim history
    if (history.value.length > maxHistoryLength) {
      history.value = history.value.slice(-maxHistoryLength)
    }

    // Update calibration status if provided
    if (data.calibrationStatus) {
      // Derive quality from status
      switch (data.calibrationStatus) {
        case 'calibrated':
          calibrationQuality.value = 100
          break
        case 'calibrating':
          calibrationQuality.value = 60
          break
        case 'uncalibrated':
          calibrationQuality.value = 0
          break
        case 'error':
          calibrationQuality.value = 30
          break
      }
    }
  }

  // Update attitude data
  function updateAttitudeData(data: AttitudeData) {
    attitudeData.value = data

    // Add to history
    const headingDeg = (data.yaw * 180 / Math.PI + 360) % 360
    history.value.push({
      timestamp: data.timestamp,
      heading: headingDeg
    })

    // Trim history
    if (history.value.length > maxHistoryLength) {
      history.value = history.value.slice(-maxHistoryLength)
    }
  }

  // Setup subscription to compass data from connection
  function setupSubscription() {
    const connectionStore = useConnectionStore()

    if (!connectionStore.isConnected) {
      console.warn('Cannot setup compass subscription: not connected')
      return
    }

    const client = connectionStore.getClient()

    // Subscribe to compass data via telemetry client
    const unsubscribeCompass = client.telemetry.onCompassData((data: CompassData) => {
      updateCompassData(data)
    })

    // Subscribe to attitude data for heading
    const unsubscribeAttitude = client.telemetry.onAttitudeData((data: AttitudeData) => {
      updateAttitudeData(data)
    })

    // Return unsubscribe function
    return () => {
      unsubscribeCompass()
      unsubscribeAttitude()
    }
  }

  // Perform compass calibration
  async function startCalibration() {
    // TODO: Implement actual calibration procedure via MAVLink commands
    // For now, just simulate
    calibrationQuality.value = 0
    console.log('Compass calibration started - rotate vehicle slowly in all directions')
  }

  // Clear history
  function clearHistory() {
    history.value = []
  }

  return {
    // State
    compassData,
    attitudeData,
    history,
    calibrationQuality,
    lastCalibrationDate,

    // Computed
    heading,
    trueHeading,
    fieldStrength,
    declination,
    cardinalDirection,
    interferenceLevel,
    isCalibrated,
    needsCalibration,
    calibrationStatus,
    compassHealth,
    lastUpdate,

    // Actions
    updateCompassData,
    updateAttitudeData,
    setupSubscription,
    startCalibration,
    clearHistory
  }
})
