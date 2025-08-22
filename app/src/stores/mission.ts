import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMAVLinkStore } from './mavlink'
import type { AsyncState } from './types'
import { createAsyncState } from './types'

export interface Waypoint {
  lat: number
  lng: number
  alt: number
  type: 'waypoint' | 'takeoff' | 'land' | 'loiter'
  speed?: number
  delay?: number
}

export interface MissionSettings {
  defaultAltitude: number
  defaultSpeed: number
  takeoffAltitude: number
  landingSpeed: number
  rtlAltitude: number
}

export interface MissionData {
  waypoints: Waypoint[]
  settings: MissionSettings
  metadata: {
    created: number
    totalDistance: number
    estimatedTime: number
  }
}

export interface MissionProgress {
  currentWaypoint: number
  percentage: number
  remainingDistance: number
  estimatedTime: number
}

export interface PatternArea {
  center: { lat: number; lng: number }
  width: number
  height: number
}

export interface SurveySettings {
  spacing: number
  altitude: number
  angle: number
  alternating: boolean
}

export interface MowingSettings {
  spacing: number
  overlap: number
  height: number
  direction: string
}

export interface SearchSettings {
  type: string
  radius: number
  altitude: number
  spacing?: number
}

export interface PatternDefinition {
  type: string
  area: PatternArea
  settings: SurveySettings | MowingSettings | SearchSettings
}

export interface MissionExecutionState {
  isExecuting: boolean
  isPaused: boolean
  currentWaypointIndex: number
  totalWaypoints: number
  progressPercentage: number
  remainingDistance: number
  estimatedTimeRemaining: number
  currentSpeed: number
  batteryLevel: number
}

export const useMissionStore = defineStore('mission', () => {
  // State
  const waypoints = ref<Waypoint[]>([])
  const missionSettings = ref<MissionSettings>({
    defaultAltitude: 10,
    defaultSpeed: 5,
    takeoffAltitude: 10,
    landingSpeed: 2,
    rtlAltitude: 20
  })
  
  const executionState = ref<MissionExecutionState>({
    isExecuting: false,
    isPaused: false,
    currentWaypointIndex: 0,
    totalWaypoints: 0,
    progressPercentage: 0,
    remainingDistance: 0,
    estimatedTimeRemaining: 0,
    currentSpeed: 0,
    batteryLevel: 100
  })

  const uploadState = ref<AsyncState<boolean>>(createAsyncState(false))
  const downloadState = ref<AsyncState<boolean>>(createAsyncState(false))

  // Getters (computed)
  const totalDistance = computed(() => {
    if (waypoints.value.length < 2) return 0
    
    let distance = 0
    for (let i = 1; i < waypoints.value.length; i++) {
      const prev = waypoints.value[i - 1]
      const curr = waypoints.value[i]
      if (prev && curr) {
        distance += calculateDistance(prev, curr)
      }
    }
    return distance
  })

  const estimatedTime = computed(() => {
    let time = 0
    for (let i = 1; i < waypoints.value.length; i++) {
      const prev = waypoints.value[i - 1]
      const curr = waypoints.value[i]
      if (prev && curr) {
        const distance = calculateDistance(prev, curr)
        const speed = curr.speed || missionSettings.value.defaultSpeed
        time += distance / speed
      }
    }
    return time
  })

  const canStart = computed(() => {
    return waypoints.value.length > 0 && 
           !executionState.value.isExecuting && 
           executionState.value.batteryLevel > 20
  })

  const isReady = computed(() => {
    const mavlinkStore = useMAVLinkStore()
    return mavlinkStore.isReady && waypoints.value.length > 0
  })

  // Actions
  function addWaypoint(waypoint: Waypoint) {
    waypoints.value.push(waypoint)
    executionState.value.totalWaypoints = waypoints.value.length
  }

  function updateWaypoint(index: number, waypoint: Waypoint) {
    if (index >= 0 && index < waypoints.value.length) {
      waypoints.value[index] = { ...waypoint }
    }
  }

  function deleteWaypoint(index: number) {
    if (index >= 0 && index < waypoints.value.length) {
      waypoints.value.splice(index, 1)
      executionState.value.totalWaypoints = waypoints.value.length
    }
  }

  function reorderWaypoints(from: number, to: number) {
    if (from >= 0 && from < waypoints.value.length && 
        to >= 0 && to < waypoints.value.length) {
      const item = waypoints.value.splice(from, 1)[0]
      if (item) {
        waypoints.value.splice(to, 0, item)
      }
    }
  }

  function clearWaypoints() {
    waypoints.value = []
    executionState.value.totalWaypoints = 0
    executionState.value.currentWaypointIndex = 0
    executionState.value.progressPercentage = 0
  }

  function generatePattern(pattern: PatternDefinition): Waypoint[] {
    switch (pattern.type) {
      case 'survey':
        return generateSurveyPattern({ area: pattern.area, settings: pattern.settings as SurveySettings })
      case 'mowing':
        return generateMowingPattern({ area: pattern.area, settings: pattern.settings as MowingSettings })
      case 'search':
        return generateSearchPattern({ area: pattern.area, settings: pattern.settings as SearchSettings })
      default:
        return []
    }
  }

  function setWaypoints(newWaypoints: Waypoint[]) {
    waypoints.value = [...newWaypoints]
    executionState.value.totalWaypoints = waypoints.value.length
  }

  // Mission execution
  async function startExecution() {
    const mavlinkStore = useMAVLinkStore()
    if (!mavlinkStore.client) {
      throw new Error('MAVLink client not connected')
    }

    if (waypoints.value.length === 0) {
      throw new Error('No waypoints to execute')
    }

    try {
      // TODO: Replace with actual MAVLink mission API when available
      // await mavlinkStore.client.mavlink.mission.uploadMission(waypoints.value)
      // await mavlinkStore.client.mavlink.mission.start()
      
      // Mock implementation for now
      console.log('Mission: Starting execution with', waypoints.value.length, 'waypoints')
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      executionState.value.isExecuting = true
      executionState.value.isPaused = false
      executionState.value.currentWaypointIndex = 0
      executionState.value.progressPercentage = 0
    } catch (error) {
      throw new Error(`Failed to start mission execution: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function pauseExecution() {
    const mavlinkStore = useMAVLinkStore()
    if (!mavlinkStore.client) {
      throw new Error('MAVLink client not connected')
    }

    try {
      // TODO: Replace with actual MAVLink API
      // await mavlinkStore.client.mavlink.mission.pause()
      
      console.log('Mission: Pausing execution')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      executionState.value.isPaused = true
    } catch (error) {
      throw new Error(`Failed to pause mission: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function resumeExecution() {
    const mavlinkStore = useMAVLinkStore()
    if (!mavlinkStore.client) {
      throw new Error('MAVLink client not connected')
    }

    try {
      // TODO: Replace with actual MAVLink API
      // await mavlinkStore.client.mavlink.mission.resume()
      
      console.log('Mission: Resuming execution')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      executionState.value.isPaused = false
    } catch (error) {
      throw new Error(`Failed to resume mission: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function stopExecution() {
    const mavlinkStore = useMAVLinkStore()
    if (!mavlinkStore.client) {
      throw new Error('MAVLink client not connected')
    }

    try {
      // TODO: Replace with actual MAVLink API
      // await mavlinkStore.client.mavlink.mission.stop()
      
      console.log('Mission: Stopping execution')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      executionState.value.isExecuting = false
      executionState.value.isPaused = false
      executionState.value.currentWaypointIndex = 0
      executionState.value.progressPercentage = 0
    } catch (error) {
      throw new Error(`Failed to stop mission: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function returnToLaunch() {
    const mavlinkStore = useMAVLinkStore()
    if (!mavlinkStore.client) {
      throw new Error('MAVLink client not connected')
    }

    try {
      // TODO: Replace with actual MAVLink API
      // await mavlinkStore.client.mavlink.returnToLaunch()
      
      console.log('Mission: Return to launch')
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      throw new Error(`Failed to return to launch: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Mission I/O
  function exportMission(): MissionData {
    return {
      waypoints: waypoints.value,
      settings: missionSettings.value,
      metadata: {
        created: Date.now(),
        totalDistance: totalDistance.value,
        estimatedTime: estimatedTime.value
      }
    }
  }

  function importMission(missionData: MissionData) {
    waypoints.value = missionData.waypoints || []
    if (missionData.settings) {
      missionSettings.value = { ...missionSettings.value, ...missionData.settings }
    }
    executionState.value.totalWaypoints = waypoints.value.length
  }

  // Utility functions
  function calculateDistance(a: Waypoint, b: Waypoint): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const lat1 = a.lat * Math.PI / 180
    const lat2 = b.lat * Math.PI / 180

    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
    const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))

    return R * y
  }

  function calculateBounds(waypointList: Waypoint[]): [[number, number], [number, number]] {
    if (waypointList.length === 0) return [[0, 0], [0, 0]]
    
    const lats = waypointList.map(wp => wp.lat)
    const lngs = waypointList.map(wp => wp.lng)
    
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ]
  }

  // Pattern generation functions
  function generateSurveyPattern(pattern: { area: PatternArea; settings: SurveySettings }): Waypoint[] {
    const waypoints: Waypoint[] = []
    const { area, settings } = pattern
    
    // Simple grid pattern implementation
    const { spacing, altitude } = settings
    const rows = Math.ceil(area.height / spacing)
    
    for (let row = 0; row < rows; row++) {
      const lat = area.center.lat - area.height / 2 / 111000 + (row * spacing) / 111000
      const startLng = area.center.lng - area.width / 2 / (111000 * Math.cos(lat * Math.PI / 180))
      const endLng = area.center.lng + area.width / 2 / (111000 * Math.cos(lat * Math.PI / 180))
      
      if (row % 2 === 0) {
        // Left to right
        waypoints.push({ lat, lng: startLng, alt: altitude, type: 'waypoint' })
        waypoints.push({ lat, lng: endLng, alt: altitude, type: 'waypoint' })
      } else {
        // Right to left
        waypoints.push({ lat, lng: endLng, alt: altitude, type: 'waypoint' })
        waypoints.push({ lat, lng: startLng, alt: altitude, type: 'waypoint' })
      }
    }
    
    return waypoints
  }

  function generateMowingPattern(pattern: { area: PatternArea; settings: MowingSettings }): Waypoint[] {
    const waypoints: Waypoint[] = []
    const { area, settings } = pattern
    
    // Lawn mowing pattern with turns
    const { spacing, height } = settings
    const rows = Math.ceil(area.height / spacing)
    
    for (let row = 0; row < rows; row++) {
      const lat = area.center.lat - area.height / 2 / 111000 + (row * spacing) / 111000
      const startLng = area.center.lng - area.width / 2 / (111000 * Math.cos(lat * Math.PI / 180))
      const endLng = area.center.lng + area.width / 2 / (111000 * Math.cos(lat * Math.PI / 180))
      
      if (row % 2 === 0) {
        waypoints.push({ lat, lng: startLng, alt: height, type: 'waypoint' })
        waypoints.push({ lat, lng: endLng, alt: height, type: 'waypoint' })
      } else {
        waypoints.push({ lat, lng: endLng, alt: height, type: 'waypoint' })
        waypoints.push({ lat, lng: startLng, alt: height, type: 'waypoint' })
      }
    }
    
    return waypoints
  }

  function generateSearchPattern(pattern: { area: PatternArea; settings: SearchSettings }): Waypoint[] {
    const waypoints: Waypoint[] = []
    const { area, settings } = pattern
    
    if (settings.type === 'spiral') {
      // Spiral search pattern
      const { radius, altitude, spacing = 10 } = settings
      const center = area.center
      const turns = Math.ceil(radius / spacing)
      
      for (let turn = 0; turn < turns; turn++) {
        const currentRadius = (turn + 1) * spacing
        const points = Math.max(8, turn * 2 + 8) // More points for larger spirals
        
        for (let point = 0; point < points; point++) {
          const angle = (point / points) * 2 * Math.PI + turn * Math.PI / 4
          const lat = center.lat + (currentRadius * Math.cos(angle)) / 111000
          const lng = center.lng + (currentRadius * Math.sin(angle)) / (111000 * Math.cos(center.lat * Math.PI / 180))
          
          waypoints.push({ lat, lng, alt: altitude, type: 'waypoint' })
        }
      }
    }
    
    return waypoints
  }

  // Mock progress updates
  function updateProgress(progress: MissionProgress) {
    executionState.value.currentWaypointIndex = progress.currentWaypoint
    executionState.value.progressPercentage = progress.percentage
    executionState.value.remainingDistance = progress.remainingDistance
    executionState.value.estimatedTimeRemaining = progress.estimatedTime
  }

  return {
    // State
    waypoints,
    missionSettings,
    executionState,
    uploadState,
    downloadState,
    
    // Getters
    totalDistance,
    estimatedTime,
    canStart,
    isReady,
    
    // Actions
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    reorderWaypoints,
    clearWaypoints,
    generatePattern,
    setWaypoints,
    
    // Execution
    startExecution,
    pauseExecution,
    resumeExecution,
    stopExecution,
    returnToLaunch,
    
    // I/O
    exportMission,
    importMission,
    
    // Utilities
    calculateDistance,
    calculateBounds,
    updateProgress
  }
})