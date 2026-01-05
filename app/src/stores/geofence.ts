import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Geofence, GeofenceType, GeofenceShape, GeofenceViolation, GeofenceStats } from '@/types/geofence'

export const useGeofenceStore = defineStore('geofence', () => {
  // State
  const geofences = ref<Geofence[]>([])
  const violations = ref<GeofenceViolation[]>([])
  const isMonitoring = ref(false)
  const currentPosition = ref<{ lat: number; lng: number } | null>(null)

  // Load from localStorage
  const loadFromStorage = () => {
    const stored = localStorage.getItem('yardrover_geofences')
    if (stored) {
      try {
        geofences.value = JSON.parse(stored)
      } catch (error) {
        console.error('Failed to load geofences from storage:', error)
      }
    }

    const storedViolations = localStorage.getItem('yardrover_geofence_violations')
    if (storedViolations) {
      try {
        violations.value = JSON.parse(storedViolations)
      } catch (error) {
        console.error('Failed to load violations from storage:', error)
      }
    }
  }

  // Save to localStorage
  const saveToStorage = () => {
    localStorage.setItem('yardrover_geofences', JSON.stringify(geofences.value))
  }

  const saveViolationsToStorage = () => {
    localStorage.setItem('yardrover_geofence_violations', JSON.stringify(violations.value))
  }

  // Computed
  const activeGeofences = computed(() =>
    geofences.value.filter(g => g.enabled && g.status === 'active')
  )

  const stats = computed<GeofenceStats>(() => ({
    totalGeofences: geofences.value.length,
    activeGeofences: activeGeofences.value.length,
    violations: violations.value.filter(v => !v.resolved).length,
    lastViolation: violations.value.length > 0
      ? violations.value[violations.value.length - 1].timestamp
      : undefined
  }))

  const unresolvedViolations = computed(() =>
    violations.value.filter(v => !v.resolved)
  )

  // Actions
  function createGeofence(
    name: string,
    type: GeofenceType,
    shape: GeofenceShape,
    shapeData: any
  ): Geofence {
    const geofence: Geofence = {
      id: crypto.randomUUID(),
      name,
      type,
      shape,
      status: 'inactive',
      enabled: false,
      color: type === 'inclusion' ? '#10b981' : '#ef4444',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      ...(shape === 'circle' ? { circle: shapeData } : { polygon: shapeData }),
      actions: {
        stopVehicle: type === 'exclusion',
        returnToHome: false,
        returnToRally: false,
        notifyUser: true
      }
    }

    geofences.value.push(geofence)
    saveToStorage()
    return geofence
  }

  function updateGeofence(id: string, updates: Partial<Geofence>) {
    const index = geofences.value.findIndex(g => g.id === id)
    if (index !== -1) {
      geofences.value[index] = {
        ...geofences.value[index],
        ...updates,
        lastModified: new Date().toISOString()
      }
      saveToStorage()
    }
  }

  function deleteGeofence(id: string) {
    const index = geofences.value.findIndex(g => g.id === id)
    if (index !== -1) {
      geofences.value.splice(index, 1)
      saveToStorage()
    }
  }

  function toggleGeofence(id: string) {
    const geofence = geofences.value.find(g => g.id === id)
    if (geofence) {
      geofence.enabled = !geofence.enabled
      geofence.status = geofence.enabled ? 'active' : 'inactive'
      geofence.lastModified = new Date().toISOString()
      saveToStorage()
    }
  }

  function enableAllGeofences() {
    geofences.value.forEach(g => {
      g.enabled = true
      g.status = 'active'
    })
    saveToStorage()
  }

  function disableAllGeofences() {
    geofences.value.forEach(g => {
      g.enabled = false
      g.status = 'inactive'
    })
    saveToStorage()
  }

  // Violation Management
  function recordViolation(geofenceId: string, position: { lat: number; lng: number }) {
    const geofence = geofences.value.find(g => g.id === geofenceId)
    if (!geofence) return

    const violation: GeofenceViolation = {
      id: crypto.randomUUID(),
      geofenceId,
      geofenceName: geofence.name,
      timestamp: new Date().toISOString(),
      position,
      resolved: false
    }

    violations.value.push(violation)

    // Update geofence status
    geofence.status = 'breached'

    // Trigger configured actions
    if (geofence.actions) {
      if (geofence.actions.returnToRally) {
        // Dispatch event for rally return (will be handled by view)
        window.dispatchEvent(new CustomEvent('geofence-breach-return-to-rally', {
          detail: { geofenceId, violation }
        }))
      }
    }

    saveToStorage()
    saveViolationsToStorage()
  }

  function resolveViolation(id: string) {
    const violation = violations.value.find(v => v.id === id)
    if (violation) {
      violation.resolved = true
      violation.resolvedAt = new Date().toISOString()

      // Check if geofence should return to active status
      const geofence = geofences.value.find(g => g.id === violation.geofenceId)
      if (geofence && geofence.status === 'breached') {
        const hasUnresolvedViolations = violations.value.some(
          v => v.geofenceId === geofence.id && !v.resolved
        )
        if (!hasUnresolvedViolations) {
          geofence.status = 'active'
        }
      }

      saveToStorage()
      saveViolationsToStorage()
    }
  }

  function clearResolvedViolations() {
    violations.value = violations.value.filter(v => !v.resolved)
    saveViolationsToStorage()
  }

  // Monitoring
  function startMonitoring() {
    isMonitoring.value = true
  }

  function stopMonitoring() {
    isMonitoring.value = false
  }

  function updateCurrentPosition(lat: number, lng: number) {
    currentPosition.value = { lat, lng }
    if (isMonitoring.value) {
      checkViolations({ lat, lng })
    }
  }

  // Geofence violation detection
  function checkViolations(position: { lat: number; lng: number }) {
    activeGeofences.value.forEach(geofence => {
      const isInside = isPointInGeofence(position, geofence)

      // Violation logic:
      // - Inclusion fence: violation if OUTSIDE
      // - Exclusion fence: violation if INSIDE
      const hasViolation = geofence.type === 'inclusion' ? !isInside : isInside

      if (hasViolation && geofence.status !== 'breached') {
        recordViolation(geofence.id, position)
      }
    })
  }

  // Helper: Check if point is inside geofence
  function isPointInGeofence(point: { lat: number; lng: number }, geofence: Geofence): boolean {
    if (geofence.shape === 'circle' && geofence.circle) {
      const distance = getDistance(point, geofence.circle.center)
      return distance <= geofence.circle.radius
    }

    if (geofence.shape === 'polygon' && geofence.polygon) {
      return isPointInPolygon(point, geofence.polygon.coordinates)
    }

    return false
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

  // Helper: Ray casting algorithm for point in polygon
  function isPointInPolygon(
    point: { lat: number; lng: number },
    polygon: Array<{ lat: number; lng: number }>
  ): boolean {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng
      const yi = polygon[i].lat
      const xj = polygon[j].lng
      const yj = polygon[j].lat

      const intersect =
        yi > point.lat !== yj > point.lat &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi

      if (intersect) inside = !inside
    }
    return inside
  }

  // Export/Import
  function exportGeofences(): string {
    return JSON.stringify(geofences.value, null, 2)
  }

  function importGeofences(data: string): boolean {
    try {
      const imported = JSON.parse(data)
      if (Array.isArray(imported)) {
        geofences.value = imported
        saveToStorage()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to import geofences:', error)
      return false
    }
  }

  // Initialize
  loadFromStorage()

  return {
    // State
    geofences,
    violations,
    isMonitoring,
    currentPosition,

    // Computed
    activeGeofences,
    stats,
    unresolvedViolations,

    // Actions
    createGeofence,
    updateGeofence,
    deleteGeofence,
    toggleGeofence,
    enableAllGeofences,
    disableAllGeofences,
    recordViolation,
    resolveViolation,
    clearResolvedViolations,
    startMonitoring,
    stopMonitoring,
    updateCurrentPosition,
    checkViolations,
    isPointInGeofence,
    exportGeofences,
    importGeofences
  }
})
