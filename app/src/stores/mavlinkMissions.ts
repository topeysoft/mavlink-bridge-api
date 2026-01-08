import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import type { MissionItem, MissionPlan } from '../../../client/dist/index'

/**
 * Waypoint type with user-friendly properties
 */
export interface Waypoint {
  seq: number
  frame: number
  command: number
  current: boolean
  autocontinue: boolean
  param1: number
  param2: number
  param3: number
  param4: number
  latitude: number
  longitude: number
  altitude: number
}

/**
 * MAVLink mission plan with waypoints
 */
export interface MAVLinkMissionPlan {
  id: string
  name: string
  description?: string
  created: string
  lastModified: string
  waypoints: Waypoint[]
  homePosition?: {
    latitude: number
    longitude: number
    altitude: number
  }
}

/**
 * Validation result for mission plans
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Mission statistics
 */
export interface MissionStatistics {
  totalWaypoints: number
  totalDistance: number
  estimatedTime: number
  navigationCommands: number
  doCommands: number
  conditionalCommands: number
  maxAltitude: number
  minAltitude: number
}

/**
 * MAVLink command definitions
 */
export enum MAV_CMD {
  NAV_WAYPOINT = 16,
  NAV_LOITER_UNLIM = 17,
  NAV_LOITER_TURNS = 18,
  NAV_LOITER_TIME = 19,
  NAV_RETURN_TO_LAUNCH = 20,
  NAV_LAND = 21,
  NAV_TAKEOFF = 22,
  CONDITION_DELAY = 112,
  CONDITION_DISTANCE = 114,
  DO_SET_SERVO = 183,
  DO_SET_RELAY = 181,
  DO_CHANGE_SPEED = 178
}

/**
 * Store for managing MAVLink waypoint-based mission plans
 *
 * This store is separate from the main missions store and is used for:
 * - Advanced waypoint editing
 * - Direct flight controller interaction (upload/download)
 * - Mission plan import/export (.mission files)
 * - Debugging and development
 */
export const useMAVLinkMissionsStore = defineStore('mavlinkMissions', () => {
  const connectionStore = useConnectionStore()

  const missionPlans = ref<MAVLinkMissionPlan[]>(
    JSON.parse(localStorage.getItem('yardrover_mavlink_mission_plans') || '[]')
  )
  const currentMissionPlan = ref<MAVLinkMissionPlan | null>(null)
  const isUploadingMission = ref(false)
  const isDownloadingMission = ref(false)

  // Create new mission plan
  function createMissionPlan(name: string, description?: string): MAVLinkMissionPlan {
    const plan: MAVLinkMissionPlan = {
      id: `mavlink_plan_${Date.now()}`,
      name,
      description,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      waypoints: []
    }

    missionPlans.value.push(plan)
    currentMissionPlan.value = plan
    saveMissionPlans()
    return plan
  }

  // Update mission plan
  function updateMissionPlan(id: string, updates: Partial<MAVLinkMissionPlan>) {
    const index = missionPlans.value.findIndex(p => p.id === id)
    if (index !== -1) {
      missionPlans.value[index] = {
        ...missionPlans.value[index],
        ...updates,
        lastModified: new Date().toISOString()
      }
      saveMissionPlans()

      if (currentMissionPlan.value?.id === id) {
        currentMissionPlan.value = missionPlans.value[index]
      }
    }
  }

  // Delete mission plan
  function deleteMissionPlan(id: string) {
    missionPlans.value = missionPlans.value.filter(p => p.id !== id)
    if (currentMissionPlan.value?.id === id) {
      currentMissionPlan.value = null
    }
    saveMissionPlans()
  }

  // Set current mission plan
  function setCurrentMissionPlan(planId: string | null) {
    if (!planId) {
      currentMissionPlan.value = null
      return
    }
    const plan = missionPlans.value.find(p => p.id === planId)
    if (plan) {
      currentMissionPlan.value = plan
    }
  }

  // Update waypoints for a plan
  function updateWaypoints(planId: string, waypoints: Waypoint[]) {
    updateMissionPlan(planId, { waypoints })
  }

  // Save to localStorage
  function saveMissionPlans() {
    localStorage.setItem('yardrover_mavlink_mission_plans', JSON.stringify(missionPlans.value))
  }

  // Convert Waypoint to MAVLink MissionItem format
  function waypointToMissionItem(waypoint: Waypoint): MissionItem {
    return {
      seq: waypoint.seq,
      frame: waypoint.frame,
      command: waypoint.command,
      current: waypoint.current ? 1 : 0,
      autocontinue: waypoint.autocontinue ? 1 : 0,
      param1: waypoint.param1,
      param2: waypoint.param2,
      param3: waypoint.param3,
      param4: waypoint.param4,
      x: waypoint.latitude,
      y: waypoint.longitude,
      z: waypoint.altitude,
      missionType: 0 // MAV_MISSION_TYPE_MISSION
    }
  }

  // Convert MAVLink MissionItem to Waypoint format
  function missionItemToWaypoint(item: MissionItem): Waypoint {
    return {
      seq: item.seq,
      frame: item.frame,
      command: item.command,
      current: item.current === 1,
      autocontinue: item.autocontinue === 1,
      param1: item.param1,
      param2: item.param2,
      param3: item.param3,
      param4: item.param4,
      latitude: item.x,
      longitude: item.y,
      altitude: item.z
    }
  }

  // Validate mission plan
  function validateMission(plan: MAVLinkMissionPlan): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for empty mission
    if (plan.waypoints.length === 0) {
      errors.push('Mission must contain at least one waypoint')
    }

    // Check for proper sequencing
    const sequences = plan.waypoints.map(w => w.seq)
    const expectedSequences = Array.from({ length: plan.waypoints.length }, (_, i) => i)
    if (JSON.stringify(sequences) !== JSON.stringify(expectedSequences)) {
      errors.push('Waypoint sequence numbers are not consecutive')
    }

    // Check for home position
    if (!plan.homePosition) {
      warnings.push('No home position set - vehicle will use current location')
    }

    // Check for navigation commands
    const hasNavCommands = plan.waypoints.some(
      w =>
        w.command === MAV_CMD.NAV_WAYPOINT ||
        w.command === MAV_CMD.NAV_LOITER_TIME ||
        w.command === MAV_CMD.NAV_LOITER_UNLIM
    )

    if (!hasNavCommands) {
      warnings.push('Mission contains no navigation waypoints')
    }

    // Check for realistic coordinates
    plan.waypoints.forEach((wp, i) => {
      if (Math.abs(wp.latitude) > 90) {
        errors.push(`Waypoint ${i + 1}: Invalid latitude (${wp.latitude})`)
      }
      if (Math.abs(wp.longitude) > 180) {
        errors.push(`Waypoint ${i + 1}: Invalid longitude (${wp.longitude})`)
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Calculate mission statistics
  function calculateMissionStatistics(plan: MAVLinkMissionPlan): MissionStatistics {
    let totalDistance = 0
    let maxAltitude = -Infinity
    let minAltitude = Infinity

    const navCommands = plan.waypoints.filter(
      w =>
        w.command === MAV_CMD.NAV_WAYPOINT ||
        w.command === MAV_CMD.NAV_LOITER_TIME ||
        w.command === MAV_CMD.NAV_LOITER_UNLIM ||
        w.command === MAV_CMD.NAV_RETURN_TO_LAUNCH
    )

    const doCommands = plan.waypoints.filter(
      w =>
        w.command === MAV_CMD.DO_SET_SERVO ||
        w.command === MAV_CMD.DO_SET_RELAY ||
        w.command === MAV_CMD.DO_CHANGE_SPEED
    )

    const conditionalCommands = plan.waypoints.filter(
      w => w.command === MAV_CMD.CONDITION_DELAY || w.command === MAV_CMD.CONDITION_DISTANCE
    )

    // Calculate distance between waypoints
    for (let i = 1; i < navCommands.length; i++) {
      const prev = navCommands[i - 1]
      const curr = navCommands[i]
      totalDistance += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
    }

    // Calculate altitude range
    plan.waypoints.forEach(wp => {
      maxAltitude = Math.max(maxAltitude, wp.altitude)
      minAltitude = Math.min(minAltitude, wp.altitude)
    })

    // Estimate time (assuming 2 m/s average speed)
    const estimatedTime = totalDistance / 2

    return {
      totalWaypoints: plan.waypoints.length,
      totalDistance,
      estimatedTime,
      navigationCommands: navCommands.length,
      doCommands: doCommands.length,
      conditionalCommands: conditionalCommands.length,
      maxAltitude: maxAltitude === -Infinity ? 0 : maxAltitude,
      minAltitude: minAltitude === Infinity ? 0 : minAltitude
    }
  }

  // Haversine formula for distance calculation
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Upload mission to vehicle
  async function uploadMissionToVehicle(plan: MAVLinkMissionPlan): Promise<boolean> {
    isUploadingMission.value = true

    try {
      // Validate mission first
      const validation = validateMission(plan)
      if (!validation.valid) {
        throw new Error(`Mission validation failed: ${validation.errors.join(', ')}`)
      }

      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()

      // Convert waypoints to mission items
      const missionItems = plan.waypoints.map(waypointToMissionItem)

      // Upload mission to vehicle
      await client.mission.uploadMission({ items: missionItems })

      console.log('Mission uploaded to vehicle:', plan)
      console.log('Waypoints:', plan.waypoints.length)

      return true
    } catch (error) {
      console.error('Mission upload failed:', error)
      return false
    } finally {
      isUploadingMission.value = false
    }
  }

  // Download mission from vehicle
  async function downloadMissionFromVehicle(): Promise<MAVLinkMissionPlan | null> {
    isDownloadingMission.value = true

    try {
      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()

      // Download mission from vehicle
      const missionPlan = await client.mission.downloadMission()

      if (!missionPlan.items || missionPlan.items.length === 0) {
        console.log('No mission on vehicle')
        return null
      }

      // Convert mission items to waypoints
      const waypoints = missionPlan.items.map(missionItemToWaypoint)

      // Create mission plan from downloaded mission
      const plan: MAVLinkMissionPlan = {
        id: `downloaded_${Date.now()}`,
        name: `Downloaded Mission ${new Date().toLocaleDateString()}`,
        description: 'Mission downloaded from vehicle',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        waypoints
      }

      console.log('Mission downloaded from vehicle:', plan)

      return plan
    } catch (error) {
      console.error('Mission download failed:', error)
      return null
    } finally {
      isDownloadingMission.value = false
    }
  }

  // Clear vehicle mission
  async function clearVehicleMission(): Promise<boolean> {
    try {
      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()

      // Clear mission on vehicle
      await client.mission.clearMission()

      console.log('Mission cleared from vehicle')
      return true
    } catch (error) {
      console.error('Mission clear failed:', error)
      return false
    }
  }

  // Export mission plan to file
  function exportMissionPlan(plan: MAVLinkMissionPlan): void {
    const data = JSON.stringify(plan, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${plan.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.mission`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import mission plan from file
  function importMissionPlan(fileContent: string): MAVLinkMissionPlan | null {
    try {
      const plan: MAVLinkMissionPlan = JSON.parse(fileContent)

      // Validate structure
      if (!plan.waypoints || !Array.isArray(plan.waypoints)) {
        throw new Error('Invalid mission plan format')
      }

      // Generate new ID and timestamps
      plan.id = `plan_${Date.now()}`
      plan.created = new Date().toISOString()
      plan.lastModified = new Date().toISOString()

      missionPlans.value.push(plan)
      saveMissionPlans()

      return plan
    } catch (error) {
      console.error('Failed to import mission plan:', error)
      return null
    }
  }

  return {
    missionPlans,
    currentMissionPlan,
    isUploadingMission,
    isDownloadingMission,
    createMissionPlan,
    updateMissionPlan,
    deleteMissionPlan,
    setCurrentMissionPlan,
    updateWaypoints,
    validateMission,
    calculateMissionStatistics,
    uploadMissionToVehicle,
    downloadMissionFromVehicle,
    clearVehicleMission,
    exportMissionPlan,
    importMissionPlan
  }
})
