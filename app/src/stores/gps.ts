import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { GpsRawIntMessage, GlobalPositionIntMessage } from '@mavlinkbridge/api-client'

export type GpsFixType = 'No Fix' | '2D Fix' | '3D Fix' | 'DGPS' | 'RTK Float' | 'RTK Fixed'

export interface GpsInfo {
  latitude: number | null       // Decimal degrees
  longitude: number | null      // Decimal degrees
  altitude: number              // Meters above MSL
  satellites: number            // Number of visible satellites
  hdop: number                  // Horizontal dilution of precision (unitless)
  vdop: number                  // Vertical dilution of precision (unitless)
  speed: number                 // Ground speed in m/s
  heading: number               // Course over ground in degrees
  fixType: number               // 0-1: no fix, 2: 2D, 3: 3D, 4: DGPS, 5: RTK Float, 6: RTK Fixed
  hasLock: boolean              // True if GPS has 3D fix or better
  accuracy: number | null       // Horizontal accuracy in meters (if available)
  lastUpdate: string | null     // ISO timestamp of last update
}

export const useGpsStore = defineStore('gps', () => {
  // State
  const gpsInfo = ref<GpsInfo>({
    latitude: null,
    longitude: null,
    altitude: 0,
    satellites: 0,
    hdop: 99.99,
    vdop: 99.99,
    speed: 0,
    heading: 0,
    fixType: 0,
    hasLock: false,
    accuracy: null,
    lastUpdate: null
  })

  const isMonitoring = ref(false)

  // Computed properties
  const fixTypeString = computed<GpsFixType>(() => {
    switch (gpsInfo.value.fixType) {
      case 0:
      case 1:
        return 'No Fix'
      case 2:
        return '2D Fix'
      case 3:
        return '3D Fix'
      case 4:
        return 'DGPS'
      case 5:
        return 'RTK Float'
      case 6:
        return 'RTK Fixed'
      default:
        return 'No Fix'
    }
  })

  const signalQuality = computed<'excellent' | 'good' | 'fair' | 'poor'>(() => {
    if (gpsInfo.value.hdop < 1.5) return 'excellent'
    if (gpsInfo.value.hdop < 2.5) return 'good'
    if (gpsInfo.value.hdop < 5.0) return 'fair'
    return 'poor'
  })

  const hasValidPosition = computed(() => {
    return gpsInfo.value.hasLock &&
           gpsInfo.value.latitude !== null &&
           gpsInfo.value.longitude !== null
  })

  // Actions
  function updateFromGpsRawInt(message: GpsRawIntMessage) {
    // Convert from MAVLink units to standard units
    const lat = message.lat / 1e7  // Convert from degrees * 1e7 to decimal degrees
    const lon = message.lon / 1e7  // Convert from degrees * 1e7 to decimal degrees
    const alt = message.alt / 1000 // Convert from mm to meters
    const hdop = message.eph / 100 // Convert from unitless * 100 to unitless
    const vdop = message.epv / 100 // Convert from unitless * 100 to unitless
    const speed = message.vel / 100 // Convert from cm/s to m/s
    const heading = message.cog / 100 // Convert from degrees * 100 to degrees
    const accuracy = message.hAcc ? message.hAcc / 1000 : null // Convert from mm to meters

    gpsInfo.value = {
      latitude: lat !== 0 ? lat : null,
      longitude: lon !== 0 ? lon : null,
      altitude: alt,
      satellites: message.satellitesVisible,
      hdop,
      vdop,
      speed,
      heading,
      fixType: message.fixType,
      hasLock: message.fixType >= 3 && message.satellitesVisible >= 6,
      accuracy,
      lastUpdate: new Date().toISOString()
    }
  }

  function updateFromGlobalPositionInt(message: GlobalPositionIntMessage) {
    // This message provides position info, update if we have it
    const lat = message.lat / 1e7  // Convert from degrees * 1e7 to decimal degrees
    const lon = message.lon / 1e7  // Convert from degrees * 1e7 to decimal degrees
    const alt = message.alt / 1000 // Convert from mm to meters
    const heading = message.hdg / 100 // Convert from degrees * 100 to degrees

    // Calculate ground speed from velocity components
    const vx = message.vx / 100 // Convert from cm/s to m/s
    const vy = message.vy / 100 // Convert from cm/s to m/s
    const speed = Math.sqrt(vx * vx + vy * vy)

    // Only update position and speed, keep GPS quality metrics from GPS_RAW_INT
    if (lat !== 0 && lon !== 0) {
      gpsInfo.value.latitude = lat
      gpsInfo.value.longitude = lon
      gpsInfo.value.altitude = alt
      gpsInfo.value.heading = heading
      gpsInfo.value.speed = speed
      gpsInfo.value.lastUpdate = new Date().toISOString()
    }
  }

  function startMonitoring() {
    isMonitoring.value = true
  }

  function stopMonitoring() {
    isMonitoring.value = false
  }

  function reset() {
    gpsInfo.value = {
      latitude: null,
      longitude: null,
      altitude: 0,
      satellites: 0,
      hdop: 99.99,
      vdop: 99.99,
      speed: 0,
      heading: 0,
      fixType: 0,
      hasLock: false,
      accuracy: null,
      lastUpdate: null
    }
  }

  return {
    // State
    gpsInfo,
    isMonitoring,

    // Computed
    fixTypeString,
    signalQuality,
    hasValidPosition,

    // Actions
    updateFromGpsRawInt,
    updateFromGlobalPositionInt,
    startMonitoring,
    stopMonitoring,
    reset
  }
})
