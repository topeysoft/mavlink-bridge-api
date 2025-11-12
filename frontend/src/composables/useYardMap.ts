import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useYardStore } from '@/stores/yard'
import { useNotificationsStore } from '@/stores/notifications'
import type { 
  Yard, 
  YardZone, 
  Obstacle, 
  MowingPath, 
  MapSettings 
} from '@/services/types/yard.types'

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface RouteOptions {
  pattern?: 'random' | 'spiral' | 'lines' | 'perimeter' | 'zones'
  startFromCharging?: boolean
  returnToCharging?: boolean
  zones?: string[]
  avoidObstacles?: boolean
}

export interface ZoneCreationData {
  name: string
  type: YardZone['type']
  priority: YardZone['priority']
  boundaries: Coordinate[]
  mowingHeight?: number
  mowingFrequency?: number
  color?: string
}

export function useYardMap(yardId?: string) {
  const yardStore = useYardStore()
  const notificationsStore = useNotificationsStore()
  
  const {
    currentYard,
    zones,
    yardLocations,
    currentYardZones,
    activeZones,
    yardStats,
    isLoading,
    hasError
  } = storeToRefs(yardStore)
  
  // Map state
  const mapRef = ref<HTMLElement>()
  const mapSettings = ref<MapSettings>({
    defaultZoom: 18,
    mapType: 'satellite',
    showZones: true,
    showObstacles: true,
    showPaths: false,
    showMachine: true,
    showWeather: false,
    autoCenter: true,
    trackMachine: false,
    pathHistory: 7
  })
  
  // Drawing state
  const drawingMode = ref<'zone' | 'obstacle' | 'path' | null>(null)
  const drawingPoints = ref<Coordinate[]>([])
  const selectedZone = ref<YardZone | null>(null)
  const selectedObstacle = ref<Obstacle | null>(null)
  const selectedPath = ref<MowingPath | null>(null)
  
  // Map interaction state
  const isDrawing = ref(false)
  const isDragging = ref(false)
  const showContextMenu = ref(false)
  const contextMenuPosition = ref({ x: 0, y: 0 })
  const contextMenuTarget = ref<any>(null)
  
  // Computed properties
  const currentYardId = computed(() => yardId || currentYard.value?.id)
  
  const mapBounds = computed((): MapBounds | null => {
    const yard = currentYard.value
    if (!yard?.boundaries.length) return null
    
    const lats = yard.boundaries.map(p => p.latitude)
    const lngs = yard.boundaries.map(p => p.longitude)
    
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    }
  })
  
  const mapCenter = computed((): Coordinate | null => {
    const bounds = mapBounds.value
    if (!bounds) return null
    
    return {
      latitude: (bounds.north + bounds.south) / 2,
      longitude: (bounds.east + bounds.west) / 2
    }
  })
  
  const totalYardArea = computed(() => {
    return currentYardZones.value.reduce((total, zone) => total + zone.area, 0)
  })
  
  const zonesByType = computed(() => {
    const grouped: Record<string, YardZone[]> = {}
    currentYardZones.value.forEach(zone => {
      if (!grouped[zone.type]) {
        grouped[zone.type] = []
      }
      grouped[zone.type].push(zone)
    })
    return grouped
  })
  
  const obstaclesByType = computed(() => {
    const yard = currentYard.value
    if (!yard?.obstacles) return {}
    
    const grouped: Record<string, Obstacle[]> = {}
    yard.obstacles.forEach(obstacle => {
      if (!grouped[obstacle.category]) {
        grouped[obstacle.category] = []
      }
      grouped[obstacle.category].push(obstacle)
    })
    return grouped
  })
  
  const isValidZone = computed(() => {
    return drawingPoints.value.length >= 3 && drawingMode.value === 'zone'
  })
  
  const drawingArea = computed(() => {
    if (drawingPoints.value.length < 3) return 0
    return calculatePolygonArea(drawingPoints.value)
  })
  
  // Zone management
  async function createZone(zoneData: ZoneCreationData): Promise<YardZone | null> {
    if (!currentYardId.value) {
      notificationsStore.addNotification({
        type: 'error',
        title: 'No Yard Selected',
        message: 'Please select a yard before creating zones',
        timestamp: new Date().toISOString()
      })
      return null
    }
    
    try {
      const area = calculatePolygonArea(zoneData.boundaries)
      const color = zoneData.color || generateZoneColor(zoneData.type)
      
      const newZone = await yardStore.createZone(currentYardId.value, {
        ...zoneData,
        area,
        color,
        active: true
      })
      
      notificationsStore.addNotification({
        type: 'success',
        title: 'Zone Created',
        message: `Zone "${zoneData.name}" created successfully`,
        timestamp: new Date().toISOString()
      })
      
      return newZone
    } catch (error) {
      notificationsStore.addNotification({
        type: 'error',
        title: 'Create Zone Failed',
        message: (error as Error).message || 'Failed to create zone',
        timestamp: new Date().toISOString()
      })
      return null
    }
  }
  
  async function updateZone(zoneId: string, updates: Partial<YardZone>): Promise<YardZone | null> {
    try {
      // Recalculate area if boundaries changed
      if (updates.boundaries) {
        updates.area = calculatePolygonArea(updates.boundaries)
      }
      
      const updatedZone = await yardStore.updateZoneById(zoneId, updates)
      
      notificationsStore.addNotification({
        type: 'success',
        title: 'Zone Updated',
        message: `Zone updated successfully`,
        timestamp: new Date().toISOString()
      })
      
      return updatedZone
    } catch (error) {
      notificationsStore.addNotification({
        type: 'error',
        title: 'Update Zone Failed',
        message: (error as Error).message || 'Failed to update zone',
        timestamp: new Date().toISOString()
      })
      return null
    }
  }
  
  async function deleteZone(zoneId: string): Promise<boolean> {
    try {
      await yardStore.deleteZone(zoneId)
      
      notificationsStore.addNotification({
        type: 'info',
        title: 'Zone Deleted',
        message: 'Zone deleted successfully',
        timestamp: new Date().toISOString()
      })
      
      return true
    } catch (error) {
      notificationsStore.addNotification({
        type: 'error',
        title: 'Delete Zone Failed',
        message: (error as Error).message || 'Failed to delete zone',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }
  
  // Obstacle management
  async function addObstacle(obstacleData: Omit<Obstacle, 'id'>): Promise<boolean> {
    if (!currentYardId.value) return false
    
    try {
      const yard = currentYard.value
      if (!yard) return false
      
      const newObstacle: Obstacle = {
        id: generateObstacleId(),
        ...obstacleData
      }
      
      const updatedYard = await yardStore.updateYardById(currentYardId.value, {
        obstacles: [...yard.obstacles, newObstacle]
      })
      
      notificationsStore.addNotification({
        type: 'success',
        title: 'Obstacle Added',
        message: `Obstacle "${obstacleData.name}" added successfully`,
        timestamp: new Date().toISOString()
      })
      
      return true
    } catch (error) {
      notificationsStore.addNotification({
        type: 'error',
        title: 'Add Obstacle Failed',
        message: (error as Error).message || 'Failed to add obstacle',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }
  
  async function updateObstacle(obstacleId: string, updates: Partial<Obstacle>): Promise<boolean> {
    if (!currentYardId.value) return false
    
    try {
      const yard = currentYard.value
      if (!yard) return false
      
      const obstacles = yard.obstacles.map(obstacle => 
        obstacle.id === obstacleId ? { ...obstacle, ...updates } : obstacle
      )
      
      await yardStore.updateYardById(currentYardId.value, { obstacles })
      
      notificationsStore.addNotification({
        type: 'success',
        title: 'Obstacle Updated',
        message: 'Obstacle updated successfully',
        timestamp: new Date().toISOString()
      })
      
      return true
    } catch (error) {
      notificationsStore.addNotification({
        type: 'error',
        title: 'Update Obstacle Failed',
        message: (error as Error).message || 'Failed to update obstacle',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }
  
  async function removeObstacle(obstacleId: string): Promise<boolean> {
    if (!currentYardId.value) return false
    
    try {
      const yard = currentYard.value
      if (!yard) return false
      
      const obstacles = yard.obstacles.filter(obstacle => obstacle.id !== obstacleId)
      await yardStore.updateYardById(currentYardId.value, { obstacles })
      
      notificationsStore.addNotification({
        type: 'info',
        title: 'Obstacle Removed',
        message: 'Obstacle removed successfully',
        timestamp: new Date().toISOString()
      })
      
      return true
    } catch (error) {
      notificationsStore.addNotification({
        type: 'error',
        title: 'Remove Obstacle Failed',
        message: (error as Error).message || 'Failed to remove obstacle',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }
  
  // Route calculation
  function calculateRoute(start: Coordinate, targetZones: string[], options: RouteOptions = {}): MowingPath | null {
    if (!currentYard.value) return null
    
    const zones = currentYardZones.value.filter(zone => targetZones.includes(zone.id))
    if (zones.length === 0) return null
    
    // Simple route calculation - in a real app, this would be more sophisticated
    const points: MowingPath['points'] = []
    let totalDistance = 0
    
    // Start point
    points.push({
      latitude: start.latitude,
      longitude: start.longitude,
      timestamp: new Date().toISOString(),
      heading: 0,
      speed: 0
    })
    
    // Generate points for each zone based on pattern
    zones.forEach((zone, zoneIndex) => {
      const zonePoints = generateZoneRoute(zone, options.pattern || 'lines')
      
      zonePoints.forEach((point, pointIndex) => {
        const prevPoint = points[points.length - 1]
        const distance = calculateDistance(
          { latitude: prevPoint.latitude, longitude: prevPoint.longitude },
          { latitude: point.latitude, longitude: point.longitude }
        )
        
        totalDistance += distance
        
        points.push({
          ...point,
          timestamp: new Date(Date.now() + points.length * 1000).toISOString(),
          heading: calculateHeading(
            { latitude: prevPoint.latitude, longitude: prevPoint.longitude },
            { latitude: point.latitude, longitude: point.longitude }
          ),
          speed: 5 // km/h
        })
      })
    })
    
    // Return to charging station if requested
    if (options.returnToCharging && currentYard.value.chargingStation) {
      const chargingStation = currentYard.value.chargingStation
      const lastPoint = points[points.length - 1]
      
      const returnDistance = calculateDistance(
        { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
        { latitude: chargingStation.latitude, longitude: chargingStation.longitude }
      )
      
      totalDistance += returnDistance
      
      points.push({
        latitude: chargingStation.latitude,
        longitude: chargingStation.longitude,
        timestamp: new Date(Date.now() + points.length * 1000).toISOString(),
        heading: calculateHeading(
          { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
          { latitude: chargingStation.latitude, longitude: chargingStation.longitude }
        ),
        speed: 5
      })
    }
    
    return {
      id: `route_${Date.now()}`,
      name: `Route for ${zones.map(z => z.name).join(', ')}`,
      yardId: currentYard.value.id,
      zoneId: zones.length === 1 ? zones[0].id : undefined,
      points,
      distance: totalDistance,
      duration: Math.round(totalDistance / 5 * 60), // minutes at 5 km/h
      efficiency: 85, // placeholder
      pattern: options.pattern || 'lines',
      createdAt: new Date().toISOString(),
      machineId: '' // Would be set when assigning to a machine
    }
  }
  
  // Drawing utilities
  function startDrawing(mode: 'zone' | 'obstacle' | 'path') {
    drawingMode.value = mode
    drawingPoints.value = []
    isDrawing.value = true
  }
  
  function addDrawingPoint(coordinate: Coordinate) {
    if (!isDrawing.value) return
    drawingPoints.value.push(coordinate)
  }
  
  function finishDrawing() {
    isDrawing.value = false
    const points = [...drawingPoints.value]
    drawingPoints.value = []
    return points
  }
  
  function cancelDrawing() {
    isDrawing.value = false
    drawingMode.value = null
    drawingPoints.value = []
  }
  
  // Map export/import
  function exportMapData() {
    const data = {
      yard: currentYard.value,
      zones: currentYardZones.value,
      settings: mapSettings.value,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yard-map-${currentYard.value?.name || 'unnamed'}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    notificationsStore.addNotification({
      type: 'success',
      title: 'Map Exported',
      message: 'Map data exported successfully',
      timestamp: new Date().toISOString()
    })
  }
  
  async function importMapData(file: File): Promise<boolean> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      // Validate data structure
      if (!data.yard || !data.zones || !Array.isArray(data.zones)) {
        throw new Error('Invalid map data format')
      }
      
      // Import zones
      for (const zone of data.zones) {
        if (currentYardId.value) {
          await yardStore.createZone(currentYardId.value, zone)
        }
      }
      
      // Import settings if available
      if (data.settings) {
        mapSettings.value = { ...mapSettings.value, ...data.settings }
      }
      
      notificationsStore.addNotification({
        type: 'success',
        title: 'Map Imported',
        message: `Imported ${data.zones.length} zones successfully`,
        timestamp: new Date().toISOString()
      })
      
      return true
    } catch (error) {
      notificationsStore.addNotification({
        type: 'error',
        title: 'Import Failed',
        message: (error as Error).message || 'Failed to import map data',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }
  
  // Utility functions
  function calculatePolygonArea(coordinates: Coordinate[]): number {
    if (coordinates.length < 3) return 0
    
    let area = 0
    const n = coordinates.length
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += coordinates[i].latitude * coordinates[j].longitude
      area -= coordinates[j].latitude * coordinates[i].longitude
    }
    
    area = Math.abs(area) / 2
    
    // Convert to square meters (approximate)
    const earthRadius = 6371000 // meters
    const degreesToRadians = Math.PI / 180
    const latRadians = coordinates[0].latitude * degreesToRadians
    const metersPerDegree = earthRadius * degreesToRadians * Math.cos(latRadians)
    
    return area * metersPerDegree * metersPerDegree
  }
  
  function calculateDistance(from: Coordinate, to: Coordinate): number {
    const R = 6371 // Earth's radius in km
    const dLat = (to.latitude - from.latitude) * Math.PI / 180
    const dLon = (to.longitude - from.longitude) * Math.PI / 180
    const lat1 = from.latitude * Math.PI / 180
    const lat2 = to.latitude * Math.PI / 180
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    
    return R * c * 1000 // Convert to meters
  }
  
  function calculateHeading(from: Coordinate, to: Coordinate): number {
    const dLon = (to.longitude - from.longitude) * Math.PI / 180
    const lat1 = from.latitude * Math.PI / 180
    const lat2 = to.latitude * Math.PI / 180
    
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI
    return (bearing + 360) % 360
  }
  
  function generateZoneColor(type: YardZone['type']): string {
    const colors = {
      mowing: '#4CAF50',
      no_mow: '#F44336',
      slow_mow: '#FF9800',
      flower_bed: '#E91E63',
      trees: '#795548',
      path: '#9E9E9E',
      water: '#2196F3'
    }
    return colors[type] || '#4CAF50'
  }
  
  function generateObstacleId(): string {
    return `obstacle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  function generateZoneRoute(zone: YardZone, pattern: string): Coordinate[] {
    // Simple line pattern implementation
    const points: Coordinate[] = []
    const bounds = zone.boundaries
    
    if (bounds.length < 3) return points
    
    const minLat = Math.min(...bounds.map(p => p.latitude))
    const maxLat = Math.max(...bounds.map(p => p.latitude))
    const minLng = Math.min(...bounds.map(p => p.longitude))
    const maxLng = Math.max(...bounds.map(p => p.longitude))
    
    const lineSpacing = 0.00005 // Approximate 5 meter spacing
    
    for (let lat = minLat; lat <= maxLat; lat += lineSpacing) {
      points.push({ latitude: lat, longitude: minLng })
      points.push({ latitude: lat, longitude: maxLng })
    }
    
    return points
  }
  
  // Initialize
  onMounted(() => {
    if (yardId) {
      yardStore.setCurrentYard(yardStore.yards.find(y => y.id === yardId) || null)
    }
  })
  
  return {
    // Map reference
    mapRef,
    
    // Map settings
    mapSettings,
    
    // State
    currentYard,
    zones: currentYardZones,
    activeZones,
    yardStats,
    isLoading,
    hasError,
    
    // Drawing state
    drawingMode: computed(() => drawingMode.value),
    drawingPoints: computed(() => drawingPoints.value),
    isDrawing: computed(() => isDrawing.value),
    isValidZone,
    drawingArea,
    
    // Selection state
    selectedZone: computed(() => selectedZone.value),
    selectedObstacle: computed(() => selectedObstacle.value),
    selectedPath: computed(() => selectedPath.value),
    
    // Computed properties
    mapBounds,
    mapCenter,
    totalYardArea,
    zonesByType,
    obstaclesByType,
    
    // Zone methods
    createZone,
    updateZone,
    deleteZone,
    
    // Obstacle methods
    addObstacle,
    updateObstacle,
    removeObstacle,
    
    // Route methods
    calculateRoute,
    
    // Drawing methods
    startDrawing,
    addDrawingPoint,
    finishDrawing,
    cancelDrawing,
    
    // Import/Export
    exportMapData,
    importMapData,
    
    // Utility methods
    calculatePolygonArea,
    calculateDistance,
    calculateHeading,
    
    // Selection methods
    selectZone: (zone: YardZone) => { selectedZone.value = zone },
    selectObstacle: (obstacle: Obstacle) => { selectedObstacle.value = obstacle },
    selectPath: (path: MowingPath) => { selectedPath.value = path },
    clearSelection: () => {
      selectedZone.value = null
      selectedObstacle.value = null
      selectedPath.value = null
    },
    
    // Store methods
    fetchZones: () => yardStore.fetchZones(currentYardId.value || ''),
    setCurrentYard: yardStore.setCurrentYard
  }
}