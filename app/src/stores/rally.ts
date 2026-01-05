import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  RallyPoint,
  RallyPointPriority,
  RallyPointUsage,
  RallyPointStats,
  ReturnToRallyOptions
} from '@/types/rally'

export const useRallyStore = defineStore('rally', () => {
  // State
  const rallyPoints = ref<RallyPoint[]>([])
  const usageHistory = ref<RallyPointUsage[]>([])
  const activeReturn = ref<RallyPointUsage | null>(null)
  const currentPosition = ref<{ lat: number; lng: number; alt: number } | null>(null)

  // Load from localStorage
  const loadFromStorage = () => {
    const stored = localStorage.getItem('yardrover_rally_points')
    if (stored) {
      try {
        rallyPoints.value = JSON.parse(stored)
      } catch (error) {
        console.error('Failed to load rally points from storage:', error)
      }
    }

    const storedUsage = localStorage.getItem('yardrover_rally_usage')
    if (storedUsage) {
      try {
        usageHistory.value = JSON.parse(storedUsage)
      } catch (error) {
        console.error('Failed to load rally usage from storage:', error)
      }
    }
  }

  // Save to localStorage
  const saveToStorage = () => {
    localStorage.setItem('yardrover_rally_points', JSON.stringify(rallyPoints.value))
  }

  const saveUsageToStorage = () => {
    localStorage.setItem('yardrover_rally_usage', JSON.stringify(usageHistory.value))
  }

  // Computed
  const activeRallyPoints = computed(() =>
    rallyPoints.value.filter(r => r.enabled && r.status === 'active')
  )

  const primaryRallyPoint = computed(() =>
    rallyPoints.value.find(r => r.priority === 'primary' && r.enabled)
  )

  const sortedRallyPoints = computed(() =>
    [...rallyPoints.value].sort((a, b) => {
      const priorityOrder = { primary: 0, secondary: 1, tertiary: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  )

  const stats = computed<RallyPointStats>(() => ({
    totalRallyPoints: rallyPoints.value.length,
    activeRallyPoints: activeRallyPoints.value.length,
    primaryRallyPoint: primaryRallyPoint.value,
    totalUsages: usageHistory.value.length,
    lastUsage: usageHistory.value.length > 0
      ? usageHistory.value[usageHistory.value.length - 1].timestamp
      : undefined
  }))

  const activeUsages = computed(() =>
    usageHistory.value.filter(u => !u.completed)
  )

  // Actions
  function createRallyPoint(
    name: string,
    position: { lat: number; lng: number; alt: number },
    priority: RallyPointPriority = 'secondary'
  ): RallyPoint {
    // If setting as primary, demote existing primary
    if (priority === 'primary') {
      rallyPoints.value.forEach(rp => {
        if (rp.priority === 'primary') {
          rp.priority = 'secondary'
        }
      })
    }

    const rallyPoint: RallyPoint = {
      id: crypto.randomUUID(),
      name,
      position,
      priority,
      status: 'inactive',
      enabled: false,
      color: getPriorityColor(priority),
      config: {
        landImmediately: false,
        loiterRadius: 50,
        loiterAltitude: position.alt + 10,
        approachAltitude: position.alt + 20
      },
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      stats: {
        timesUsed: 0
      }
    }

    rallyPoints.value.push(rallyPoint)
    saveToStorage()
    return rallyPoint
  }

  function updateRallyPoint(id: string, updates: Partial<RallyPoint>) {
    const index = rallyPoints.value.findIndex(r => r.id === id)
    if (index !== -1) {
      // If changing to primary, demote other primary points
      if (updates.priority === 'primary') {
        rallyPoints.value.forEach(rp => {
          if (rp.id !== id && rp.priority === 'primary') {
            rp.priority = 'secondary'
          }
        })
      }

      rallyPoints.value[index] = {
        ...rallyPoints.value[index],
        ...updates,
        lastModified: new Date().toISOString()
      }

      // Update color if priority changed
      if (updates.priority) {
        rallyPoints.value[index].color = getPriorityColor(updates.priority)
      }

      saveToStorage()
    }
  }

  function deleteRallyPoint(id: string) {
    const index = rallyPoints.value.findIndex(r => r.id === id)
    if (index !== -1) {
      rallyPoints.value.splice(index, 1)
      saveToStorage()
    }
  }

  function toggleRallyPoint(id: string) {
    const rallyPoint = rallyPoints.value.find(r => r.id === id)
    if (rallyPoint) {
      rallyPoint.enabled = !rallyPoint.enabled
      rallyPoint.status = rallyPoint.enabled ? 'active' : 'inactive'
      rallyPoint.lastModified = new Date().toISOString()
      saveToStorage()
    }
  }

  function enableAllRallyPoints() {
    rallyPoints.value.forEach(r => {
      r.enabled = true
      r.status = 'active'
    })
    saveToStorage()
  }

  function disableAllRallyPoints() {
    rallyPoints.value.forEach(r => {
      r.enabled = false
      r.status = 'inactive'
    })
    saveToStorage()
  }

  function setPrimary(id: string) {
    // Demote all to secondary
    rallyPoints.value.forEach(rp => {
      if (rp.priority === 'primary') {
        rp.priority = 'secondary'
        rp.color = getPriorityColor('secondary')
      }
    })

    // Promote target to primary
    const rallyPoint = rallyPoints.value.find(r => r.id === id)
    if (rallyPoint) {
      rallyPoint.priority = 'primary'
      rallyPoint.color = getPriorityColor('primary')
      rallyPoint.lastModified = new Date().toISOString()
      saveToStorage()
    }
  }

  // Return to Rally Logic
  function returnToRally(options: ReturnToRallyOptions): RallyPointUsage | null {
    if (!currentPosition.value) {
      console.error('Cannot return to rally: current position unknown')
      return null
    }

    let targetRallyPoint: RallyPoint | undefined

    if (options.rallyPointId) {
      // Use specified rally point
      targetRallyPoint = rallyPoints.value.find(r => r.id === options.rallyPointId && r.enabled)
    } else {
      // Auto-select: Find nearest enabled rally point
      targetRallyPoint = findNearestRallyPoint(currentPosition.value)
    }

    if (!targetRallyPoint) {
      console.error('No suitable rally point found')
      return null
    }

    // Create usage record
    const usage: RallyPointUsage = {
      id: crypto.randomUUID(),
      rallyPointId: targetRallyPoint.id,
      rallyPointName: targetRallyPoint.name,
      timestamp: new Date().toISOString(),
      reason: options.reason,
      vehiclePosition: currentPosition.value,
      completed: false
    }

    usageHistory.value.push(usage)
    activeReturn.value = usage

    // Update rally point status
    targetRallyPoint.status = 'in-use'
    targetRallyPoint.lastUsed = usage.timestamp
    if (targetRallyPoint.stats) {
      targetRallyPoint.stats.timesUsed++
      targetRallyPoint.stats.lastReturnReason = options.reason
    }

    saveToStorage()
    saveUsageToStorage()

    return usage
  }

  function completeReturn(usageId: string) {
    const usage = usageHistory.value.find(u => u.id === usageId)
    if (usage) {
      usage.completed = true
      usage.completedAt = new Date().toISOString()

      // Update rally point status
      const rallyPoint = rallyPoints.value.find(r => r.id === usage.rallyPointId)
      if (rallyPoint) {
        rallyPoint.status = 'active'
      }

      if (activeReturn.value?.id === usageId) {
        activeReturn.value = null
      }

      saveToStorage()
      saveUsageToStorage()
    }
  }

  function cancelReturn(usageId: string) {
    const usage = usageHistory.value.find(u => u.id === usageId)
    if (usage && !usage.completed) {
      // Mark as completed without actually returning
      usage.completed = true
      usage.completedAt = new Date().toISOString()

      // Update rally point status
      const rallyPoint = rallyPoints.value.find(r => r.id === usage.rallyPointId)
      if (rallyPoint && rallyPoint.status === 'in-use') {
        rallyPoint.status = 'active'
      }

      if (activeReturn.value?.id === usageId) {
        activeReturn.value = null
      }

      saveToStorage()
      saveUsageToStorage()
    }
  }

  // Helper: Find nearest rally point
  function findNearestRallyPoint(
    position: { lat: number; lng: number }
  ): RallyPoint | undefined {
    const enabled = activeRallyPoints.value
    if (enabled.length === 0) return undefined

    // Prefer primary if available
    const primary = enabled.find(r => r.priority === 'primary')
    if (primary) return primary

    // Otherwise find nearest
    let nearest: RallyPoint | undefined
    let minDistance = Infinity

    enabled.forEach(rallyPoint => {
      const distance = getDistance(position, rallyPoint.position)
      if (distance < minDistance) {
        minDistance = distance
        nearest = rallyPoint
      }
    })

    return nearest
  }

  // Helper: Calculate distance between two points (Haversine formula)
  function getDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371000 // Earth radius in meters
    const lat1 = (point1.lat * Math.PI) / 180
    const lat2 = (point2.lat * Math.PI) / 180
    const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180
    const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Helper: Get color based on priority
  function getPriorityColor(priority: RallyPointPriority): string {
    const colors = {
      primary: '#10b981', // green
      secondary: '#3b82f6', // blue
      tertiary: '#8b5cf6' // purple
    }
    return colors[priority]
  }

  // Update current position
  function updateCurrentPosition(lat: number, lng: number, alt: number = 0) {
    currentPosition.value = { lat, lng, alt }
  }

  // Export/Import
  function exportRallyPoints(): string {
    return JSON.stringify(rallyPoints.value, null, 2)
  }

  function importRallyPoints(data: string): boolean {
    try {
      const imported = JSON.parse(data)
      if (Array.isArray(imported)) {
        rallyPoints.value = imported
        saveToStorage()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to import rally points:', error)
      return false
    }
  }

  // Clear usage history
  function clearUsageHistory() {
    usageHistory.value = usageHistory.value.filter(u => !u.completed)
    saveUsageToStorage()
  }

  // Initialize
  loadFromStorage()

  return {
    // State
    rallyPoints,
    usageHistory,
    activeReturn,
    currentPosition,

    // Computed
    activeRallyPoints,
    primaryRallyPoint,
    sortedRallyPoints,
    stats,
    activeUsages,

    // Actions
    createRallyPoint,
    updateRallyPoint,
    deleteRallyPoint,
    toggleRallyPoint,
    enableAllRallyPoints,
    disableAllRallyPoints,
    setPrimary,
    returnToRally,
    completeReturn,
    cancelReturn,
    findNearestRallyPoint,
    updateCurrentPosition,
    exportRallyPoints,
    importRallyPoints,
    clearUsageHistory
  }
})
