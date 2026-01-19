/**
 * Composable for client-side mission path generation and preview
 *
 * Provides pattern generation algorithms for mission path preview,
 * ported from MissionExecutor.ts for real-time client-side rendering.
 */

import { ref, computed, watch, type Ref } from 'vue'
import type { Zone } from '@client'
import {
  isPointInPolygon,
  isPointInPolygonFast,
  clipLineToPolygon,
  ensurePolygonClosed,
  calculatePolygonBounds,
  minDistanceToPolygonEdge,
  lineToStripPolygon,
  clipPolygonToPolygon,
  type Coordinate,
  type Polygon,
  type Bounds
} from '@/utils/polygonGeometry'

// ============================================================================
// Types
// ============================================================================

export type PatternType = 'stripe' | 'spiral' | 'random' | 'checkerboard' | 'perimeter'
export type EdgeMode = 'trim' | 'skip' | 'overlap'

export interface PathConfiguration {
  pattern: PatternType
  spacing: number        // meters between passes
  overlapPercent: number // 0-50%
  heading: number        // degrees for stripe pattern (0-359)
  edgeMode: EdgeMode
  equipmentWidth: number // meters - actual cutting/clearing width
  perimeterFirst: boolean // mow perimeter before interior (default true for mowing)
}

export interface Waypoint {
  lat: number
  lng: number
  sequence: number
  zoneId: string
}

export interface GeneratedPath {
  waypoints: Waypoint[]
  totalDistance: number  // meters
  estimatedTime: number  // seconds
  waypointCount: number
  coverage: number       // estimated coverage percentage
}

export interface PathStrip {
  zoneId: string
  polygon: Array<[number, number]>  // [lng, lat] vertices
  passIndex: number
  color: string
  opacity: number
}

export interface PathPreviewData {
  zones: Array<{
    id: string
    name: string
    polygon: Array<[number, number]>  // [lng, lat] pairs
    color: string
  }>
  paths: Array<{
    zoneId: string
    waypoints: Array<[number, number]>  // [lat, lng] for Leaflet
    color: string
  }>
  strips: PathStrip[]  // filled coverage strips
  statistics: GeneratedPath
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PATH_CONFIG: PathConfiguration = {
  pattern: 'stripe',
  spacing: 3,
  overlapPercent: 10,
  heading: 0,
  edgeMode: 'trim',
  equipmentWidth: 1.5,  // DEBUG: Increased to 1.5m for visibility (normally 0.5m)
  perimeterFirst: true  // Default: mow perimeter before interior
}

const DEFAULT_SPEED = 1.5 // meters per second

// Zone type to color mapping
const ZONE_COLORS: Record<string, string> = {
  mowing: '#2C5F2D',
  lawn: '#2C5F2D',
  garden: '#7CB342',
  patrol: '#3498db',
  snow_clearing: '#87CEEB',
  default: '#2C5F2D'
}

// Zone type specific strip styling for realistic visualization
const ZONE_STRIP_STYLES: Record<string, { fillColor: string; opacity: number; altOpacity: number }> = {
  mowing: {
    fillColor: '#2C5F2D',
    opacity: 0.35,
    altOpacity: 0.50
  },
  lawn: {
    fillColor: '#2C5F2D',
    opacity: 0.35,
    altOpacity: 0.50
  },
  snow_clearing: {
    fillColor: '#87CEEB',
    opacity: 0.40,
    altOpacity: 0.55
  },
  spraying: {
    fillColor: '#7CB342',
    opacity: 0.30,
    altOpacity: 0.45
  },
  collection: {
    fillColor: '#8D6E63',
    opacity: 0.35,
    altOpacity: 0.50
  },
  default: {
    fillColor: '#2C5F2D',
    opacity: 0.35,
    altOpacity: 0.50
  }
}

// ============================================================================
// Composable
// ============================================================================

export function useMissionPathGeneration() {
  // State
  const zones = ref<Zone[]>([])
  const pathConfig = ref<PathConfiguration>({ ...DEFAULT_PATH_CONFIG })
  const generatedPath = ref<GeneratedPath | null>(null)
  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  // Debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const DEBOUNCE_DELAY = 300

  // ============================================================================
  // Computed
  // ============================================================================

  const hasZones = computed(() => zones.value.length > 0)

  const pathPreviewData = computed((): PathPreviewData | null => {
    // Force reactivity on pathConfig for strip generation
    const currentConfig = pathConfig.value
    const _trackEquipmentWidth = currentConfig.equipmentWidth

    if (!hasZones.value || !generatedPath.value) {
      return null
    }

    const zoneData = zones.value.map(zone => ({
      id: zone.id,
      name: zone.name,
      polygon: zone.coordinates as Array<[number, number]>,
      color: (ZONE_COLORS[zone.type] || ZONE_COLORS.default) as string
    }))

    // Group waypoints by zone
    const pathsByZone = new Map<string, Array<[number, number]>>()
    for (const wp of generatedPath.value.waypoints) {
      if (!pathsByZone.has(wp.zoneId)) {
        pathsByZone.set(wp.zoneId, [])
      }
      pathsByZone.get(wp.zoneId)!.push([wp.lat, wp.lng])
    }

    const paths = Array.from(pathsByZone.entries()).map(([zoneId, waypoints]) => {
      const zone = zones.value.find(z => z.id === zoneId)
      const color = zone ? (ZONE_COLORS[zone.type] || ZONE_COLORS.default) : ZONE_COLORS.default
      return {
        zoneId,
        waypoints,
        color: color as string
      }
    })

    // Generate filled coverage strips from waypoint pairs
    const strips = generateStripsFromWaypoints(
      generatedPath.value.waypoints,
      zones.value,
      currentConfig
    )

    // Debug logging
    console.log('[PathGen] Equipment width:', currentConfig.equipmentWidth)
    console.log('[PathGen] Generated strips:', strips.length)
    if (strips.length > 0 && strips[0]) {
      console.log('[PathGen] First strip polygon vertices:', strips[0].polygon.length)
    }

    return {
      zones: zoneData,
      paths,
      strips,
      statistics: generatedPath.value
    }
  })

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Set zones for path generation
   */
  function setZones(newZones: Zone[]) {
    zones.value = newZones
    debouncedGenerate()
  }

  /**
   * Update path configuration
   */
  function setPathConfig(config: Partial<PathConfiguration>) {
    pathConfig.value = { ...pathConfig.value, ...config }
    debouncedGenerate()
  }

  /**
   * Reset to default configuration
   */
  function resetConfig() {
    pathConfig.value = { ...DEFAULT_PATH_CONFIG }
    debouncedGenerate()
  }

  /**
   * Debounced path generation
   */
  function debouncedGenerate() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      generateAllPaths()
    }, DEBOUNCE_DELAY)
  }

  /**
   * Generate paths for all zones immediately
   */
  function generateAllPaths() {
    if (!hasZones.value) {
      generatedPath.value = null
      return
    }

    isGenerating.value = true
    error.value = null

    try {
      const allWaypoints: Waypoint[] = []
      let seq = 0

      for (const zone of zones.value) {
        const zoneWaypoints = generateZonePath(zone, pathConfig.value, seq)
        allWaypoints.push(...zoneWaypoints)
        seq += zoneWaypoints.length
      }

      const totalDistance = calculateTotalDistance(allWaypoints)
      const estimatedTime = calculateEstimatedTime(totalDistance, DEFAULT_SPEED)
      const coverage = estimateCoverage(zones.value, pathConfig.value)

      generatedPath.value = {
        waypoints: allWaypoints,
        totalDistance,
        estimatedTime,
        waypointCount: allWaypoints.length,
        coverage
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate path'
      generatedPath.value = null
    } finally {
      isGenerating.value = false
    }
  }

  /**
   * Generate path for a single zone
   */
  function generateZonePath(zone: Zone, config: PathConfiguration, startSeq: number): Waypoint[] {
    const coords = zone.coordinates
    if (!coords || coords.length < 3) {
      return []
    }

    switch (config.pattern) {
      case 'stripe':
        return generateParallelPattern(zone, config, startSeq)
      case 'spiral':
        return generateSpiralPattern(zone, config, startSeq)
      case 'checkerboard':
        return generateCheckerboardPattern(zone, config, startSeq)
      case 'perimeter':
        return generatePerimeterPattern(zone, config, startSeq)
      case 'random':
        // Random uses spiral as base with some randomization
        return generateSpiralPattern(zone, config, startSeq)
      default:
        return generateParallelPattern(zone, config, startSeq)
    }
  }

  // ============================================================================
  // Pattern Generators
  // ============================================================================

  /**
   * Generate a single perimeter pass around the zone boundary
   * Used by patterns that support perimeterFirst option
   */
  function generatePerimeterPass(zone: Zone, startSeq: number): Waypoint[] {
    const waypoints: Waypoint[] = []
    const coords = zone.coordinates
    let seq = startSeq

    if (!coords || coords.length < 3) return waypoints

    // Follow zone boundary
    for (const [lng, lat] of coords) {
      waypoints.push({
        lat,
        lng,
        sequence: seq++,
        zoneId: zone.id
      })
    }

    // Close the perimeter loop by returning to start
    if (coords.length > 0 && coords[0]) {
      const [lng, lat] = coords[0]
      waypoints.push({
        lat,
        lng,
        sequence: seq,
        zoneId: zone.id
      })
    }

    return waypoints
  }

  /**
   * Generate parallel (stripe/lawnmower) pattern with polygon clipping
   * Optionally generates perimeter pass first for cleaner edges
   */
  function generateParallelPattern(zone: Zone, config: PathConfiguration, startSeq: number): Waypoint[] {
    const waypoints: Waypoint[] = []
    const coords = zone.coordinates

    if (!coords || coords.length < 3) return waypoints

    // Ensure polygon is closed and get bounds
    const polygon = ensurePolygonClosed(coords as Coordinate[]) as Polygon
    const bounds = calculatePolygonBounds(polygon)

    let seq = startSeq

    // Generate perimeter pass first if enabled
    if (config.perimeterFirst) {
      const perimeterWaypoints = generatePerimeterPass(zone, seq)
      waypoints.push(...perimeterWaypoints)
      seq += perimeterWaypoints.length
    }

    // Calculate effective spacing with overlap
    const effectiveSpacing = config.spacing * (1 - config.overlapPercent / 100)

    // Calculate number of passes
    const width = calculateDistance(
      bounds.minLat, bounds.minLng,
      bounds.minLat, bounds.maxLng
    )
    const numPasses = Math.ceil(width / effectiveSpacing)

    // Edge mode buffer in degrees (approximately 0.5 meters)
    const EDGE_BUFFER_DEGREES = 0.000005

    let direction = 1

    for (let i = 0; i <= numPasses; i++) {
      const progress = i / numPasses
      const lng = bounds.minLng + (bounds.maxLng - bounds.minLng) * progress

      // Create line spanning full latitude range
      const lineStart: Coordinate = [lng, bounds.minLat]
      const lineEnd: Coordinate = [lng, bounds.maxLat]

      // Clip line to polygon boundary
      const clippedSegments = clipLineToPolygon(lineStart, lineEnd, polygon)

      // Process each clipped segment
      for (const segment of clippedSegments) {
        let [start, end] = direction === 1 ? segment : [segment[1], segment[0]]

        // Apply edge mode adjustments
        if (config.edgeMode === 'skip') {
          // Shrink segment inward from both ends
          const dx = end[0] - start[0]
          const dy = end[1] - start[1]
          const segLength = Math.hypot(dx, dy)
          if (segLength < EDGE_BUFFER_DEGREES * 4) continue // Segment too short

          const ratio = EDGE_BUFFER_DEGREES / segLength
          start = [
            start[0] + dx * ratio,
            start[1] + dy * ratio
          ]
          end = [
            end[0] - dx * ratio,
            end[1] - dy * ratio
          ]
        } else if (config.edgeMode === 'overlap') {
          // Extend segment outward from both ends
          const dx = end[0] - start[0]
          const dy = end[1] - start[1]
          const segLength = Math.hypot(dx, dy)
          if (segLength > 0) {
            const ratio = EDGE_BUFFER_DEGREES / segLength
            start = [start[0] - dx * ratio, start[1] - dy * ratio]
            end = [end[0] + dx * ratio, end[1] + dy * ratio]
          }
        }
        // 'trim' mode: use segment as-is

        // Add start waypoint
        waypoints.push({
          lat: start[1],
          lng: start[0],
          sequence: seq++,
          zoneId: zone.id
        })

        // Add end waypoint
        waypoints.push({
          lat: end[1],
          lng: end[0],
          sequence: seq++,
          zoneId: zone.id
        })
      }

      direction *= -1
    }

    return waypoints
  }

  /**
   * Generate spiral pattern (outside-in) with polygon filtering
   */
  function generateSpiralPattern(zone: Zone, config: PathConfiguration, startSeq: number): Waypoint[] {
    const waypoints: Waypoint[] = []
    const coords = zone.coordinates

    if (!coords || coords.length < 3) return waypoints

    // Ensure polygon is closed and get bounds
    const polygon = ensurePolygonClosed(coords as Coordinate[]) as Polygon
    const bounds = calculatePolygonBounds(polygon)

    // Calculate centroid
    const center = calculateCentroid(coords)

    // Calculate effective spacing
    const effectiveSpacing = config.spacing * (1 - config.overlapPercent / 100)

    // Calculate max radius
    const maxRadius = calculateDistance(
      center.lat, center.lng,
      bounds.maxLat, bounds.maxLng
    )

    // Edge mode buffer in degrees (approximately 0.5 meters)
    const EDGE_BUFFER_DEGREES = 0.000005

    let radius = maxRadius
    const pointsPerCircle = 16
    let seq = startSeq

    while (radius > effectiveSpacing) {
      for (let i = 0; i < pointsPerCircle; i++) {
        const angle = (i / pointsPerCircle) * 2 * Math.PI
        const lat = center.lat + (radius / 111320) * Math.cos(angle)
        const lng = center.lng + (radius / (111320 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle)

        const point: Coordinate = [lng, lat]

        // Check if point is inside polygon
        const isInside = isPointInPolygonFast(point, polygon, bounds)

        if (isInside) {
          // For 'skip' mode, also check distance to edge
          if (config.edgeMode === 'skip') {
            const distToEdge = minDistanceToPolygonEdge(point, polygon)
            if (distToEdge < EDGE_BUFFER_DEGREES) continue
          }

          waypoints.push({
            lat,
            lng,
            sequence: seq++,
            zoneId: zone.id
          })
        } else if (config.edgeMode === 'overlap') {
          // In overlap mode, include points slightly outside
          const distToEdge = minDistanceToPolygonEdge(point, polygon)
          if (distToEdge < EDGE_BUFFER_DEGREES) {
            waypoints.push({
              lat,
              lng,
              sequence: seq++,
              zoneId: zone.id
            })
          }
        }
        // 'trim' mode: only include points strictly inside (default behavior)
      }
      radius -= effectiveSpacing
    }

    // Add center point if inside polygon
    const centerPoint: Coordinate = [center.lng, center.lat]
    if (isPointInPolygon(centerPoint, polygon)) {
      waypoints.push({
        lat: center.lat,
        lng: center.lng,
        sequence: seq,
        zoneId: zone.id
      })
    }

    return waypoints
  }

  /**
   * Generate checkerboard pattern with polygon filtering
   */
  function generateCheckerboardPattern(zone: Zone, config: PathConfiguration, startSeq: number): Waypoint[] {
    const waypoints: Waypoint[] = []
    const coords = zone.coordinates

    if (!coords || coords.length < 3) return waypoints

    // Ensure polygon is closed and get bounds
    const polygon = ensurePolygonClosed(coords as Coordinate[]) as Polygon
    const bounds = calculatePolygonBounds(polygon)

    // Calculate effective spacing
    const effectiveSpacing = config.spacing * (1 - config.overlapPercent / 100)

    // Grid dimensions
    const width = calculateDistance(bounds.minLat, bounds.minLng, bounds.minLat, bounds.maxLng)
    const height = calculateDistance(bounds.minLat, bounds.minLng, bounds.maxLat, bounds.minLng)

    const numCols = Math.ceil(width / effectiveSpacing)
    const numRows = Math.ceil(height / effectiveSpacing)

    // Edge mode buffer in degrees (approximately 0.5 meters)
    const EDGE_BUFFER_DEGREES = 0.000005

    let seq = startSeq

    // Generate checkerboard - visit alternating squares
    for (let pass = 0; pass < 2; pass++) {
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          // Checkerboard pattern: only visit if (row + col) % 2 matches pass
          if ((row + col) % 2 !== pass) continue

          const latProgress = row / numRows
          const lngProgress = col / numCols

          const lat = bounds.minLat + (bounds.maxLat - bounds.minLat) * latProgress
          const lng = bounds.minLng + (bounds.maxLng - bounds.minLng) * lngProgress

          const point: Coordinate = [lng, lat]

          // Check if point is inside polygon
          const isInside = isPointInPolygonFast(point, polygon, bounds)

          if (isInside) {
            // For 'skip' mode, also check distance to edge
            if (config.edgeMode === 'skip') {
              const distToEdge = minDistanceToPolygonEdge(point, polygon)
              if (distToEdge < EDGE_BUFFER_DEGREES) continue
            }

            waypoints.push({
              lat,
              lng,
              sequence: seq++,
              zoneId: zone.id
            })
          } else if (config.edgeMode === 'overlap') {
            // In overlap mode, include points slightly outside
            const distToEdge = minDistanceToPolygonEdge(point, polygon)
            if (distToEdge < EDGE_BUFFER_DEGREES) {
              waypoints.push({
                lat,
                lng,
                sequence: seq++,
                zoneId: zone.id
              })
            }
          }
          // 'trim' mode: only include points strictly inside (default behavior)
        }
      }
    }

    return waypoints
  }

  /**
   * Generate perimeter pattern (boundary following)
   */
  function generatePerimeterPattern(zone: Zone, config: PathConfiguration, startSeq: number): Waypoint[] {
    const waypoints: Waypoint[] = []
    const coords = zone.coordinates
    let seq = startSeq

    // Follow zone boundary
    for (const [lng, lat] of coords) {
      waypoints.push({
        lat,
        lng,
        sequence: seq++,
        zoneId: zone.id
      })
    }

    // Close the loop
    if (coords.length > 0 && coords[0]) {
      const [lng, lat] = coords[0]
      waypoints.push({
        lat,
        lng,
        sequence: seq,
        zoneId: zone.id
      })
    }

    return waypoints
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Calculate centroid of polygon
   */
  function calculateCentroid(coords: Array<[number, number]>): { lat: number; lng: number } {
    let sumLat = 0
    let sumLng = 0

    for (const [lng, lat] of coords) {
      sumLat += lat
      sumLng += lng
    }

    return {
      lat: sumLat / coords.length,
      lng: sumLng / coords.length
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180
    const phi2 = (lat2 * Math.PI) / 180
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  /**
   * Calculate total distance of path
   */
  function calculateTotalDistance(waypoints: Waypoint[]): number {
    let total = 0
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1]
      const curr = waypoints[i]
      if (prev && curr) {
        total += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng)
      }
    }
    return total
  }

  /**
   * Calculate estimated time based on distance and speed
   */
  function calculateEstimatedTime(distance: number, speed: number): number {
    return distance / speed
  }

  /**
   * Estimate coverage percentage
   */
  function estimateCoverage(zones: Zone[], config: PathConfiguration): number {
    // Simple estimation based on overlap percentage
    // Higher overlap = better coverage
    const baseConverage = 85
    const overlapBonus = config.overlapPercent * 0.3
    return Math.min(100, baseConverage + overlapBonus)
  }

  /**
   * Generate strip polygons for the perimeter pass
   * Creates strips for each edge of the zone boundary
   */
  function generatePerimeterStrips(
    zonePolygon: Polygon,
    zoneId: string,
    equipmentWidth: number,
    centerLat: number,
    style: { fillColor: string; opacity: number; altOpacity: number }
  ): PathStrip[] {
    const strips: PathStrip[] = []

    // Process each edge of the polygon
    for (let i = 0; i < zonePolygon.length - 1; i++) {
      const start = zonePolygon[i]
      const end = zonePolygon[i + 1]
      if (!start || !end) continue

      // Skip if points are the same (closing point)
      if (start[0] === end[0] && start[1] === end[1]) continue

      // Generate strip polygon for this edge
      const stripCoords = lineToStripPolygon(
        start,
        end,
        equipmentWidth,
        centerLat
      )

      if (stripCoords.length < 4) continue

      // Clip strip to zone boundary for clean edges at corners
      const clippedStrip = clipPolygonToPolygon(stripCoords, zonePolygon)
      const finalStrip = clippedStrip.length >= 3 ? clippedStrip : stripCoords

      if (finalStrip.length >= 3) {
        strips.push({
          zoneId,
          polygon: finalStrip as Array<[number, number]>,
          passIndex: -1,  // Use -1 to indicate perimeter pass
          color: style.fillColor,
          opacity: style.altOpacity  // Use alternate opacity for perimeter
        })
      }
    }

    return strips
  }

  /**
   * Generate filled coverage strips from waypoint pairs
   * Creates rectangular polygons representing actual equipment coverage area
   *
   * NOTE: This function now generates strips directly from zone geometry,
   * not from waypoints, to properly handle perimeterFirst mode where
   * perimeter waypoints are sequential (not pairs).
   */
  function generateStripsFromWaypoints(
    _waypoints: Waypoint[],  // Not used - kept for API compatibility
    allZones: Zone[],
    config: PathConfiguration
  ): PathStrip[] {
    const strips: PathStrip[] = []

    console.log('[StripGen] Equipment width:', config.equipmentWidth)
    console.log('[StripGen] Pattern:', config.pattern)

    // Only generate strips for stripe pattern currently
    if (config.pattern !== 'stripe') {
      console.log('[StripGen] Strips only supported for stripe pattern')
      return strips
    }

    // Process each zone
    for (const zone of allZones) {
      const zoneId = zone.id
      const coords = zone.coordinates as Coordinate[]

      // Get zone polygon for clipping
      const zonePolygon = ensurePolygonClosed(coords)
      const bounds = calculatePolygonBounds(zonePolygon)
      console.log('[StripGen] Zone', zoneId, 'polygon vertices:', zonePolygon.length)

      // Get zone-specific styling
      const style = ZONE_STRIP_STYLES[zone.type] ?? ZONE_STRIP_STYLES['default']!

      // Calculate center latitude for coordinate conversion
      const centerLat = (bounds.minLat + bounds.maxLat) / 2

      // Generate perimeter strip first if enabled
      if (config.perimeterFirst) {
        const perimeterStrips = generatePerimeterStrips(
          zonePolygon,
          zoneId,
          config.equipmentWidth,
          centerLat,
          style
        )
        strips.push(...perimeterStrips)
        console.log('[StripGen] Zone', zoneId, 'perimeter strips:', perimeterStrips.length)
      }

      // Calculate effective spacing with overlap
      const effectiveSpacing = config.spacing * (1 - config.overlapPercent / 100)

      // Calculate number of passes based on zone width
      const width = calculateDistance(
        bounds.minLat, bounds.minLng,
        bounds.minLat, bounds.maxLng
      )
      const numPasses = Math.ceil(width / effectiveSpacing)

      console.log('[StripGen] Zone width:', width.toFixed(1), 'm, passes:', numPasses)

      // Generate strips for each pass (same logic as generateParallelPattern)
      for (let i = 0; i <= numPasses; i++) {
        const progress = i / numPasses
        const lng = bounds.minLng + (bounds.maxLng - bounds.minLng) * progress

        // Create vertical line spanning full latitude range
        const lineStart: Coordinate = [lng, bounds.minLat]
        const lineEnd: Coordinate = [lng, bounds.maxLat]

        // Clip line to polygon boundary to get segment(s) inside zone
        const clippedSegments = clipLineToPolygon(lineStart, lineEnd, zonePolygon)

        // Generate strip for each clipped segment
        for (const segment of clippedSegments) {
          const [start, end] = segment

          // Generate strip polygon from line segment
          const stripCoords = lineToStripPolygon(
            start,
            end,
            config.equipmentWidth,
            centerLat
          )

          if (stripCoords.length < 4) continue

          // Clip strip to zone boundary for clean edges
          const clippedStrip = clipPolygonToPolygon(stripCoords, zonePolygon)

          // Use clipped strip if valid, otherwise use original strip
          const finalStrip = clippedStrip.length >= 3 ? clippedStrip : stripCoords

          if (finalStrip.length >= 3) {
            strips.push({
              zoneId,
              polygon: finalStrip as Array<[number, number]>,
              passIndex: i,
              color: style.fillColor,
              opacity: i % 2 === 0 ? style.opacity : style.altOpacity
            })
          }
        }
      }

      console.log('[StripGen] Zone', zoneId, 'generated', strips.filter(s => s.zoneId === zoneId).length, 'strips')
    }

    return strips
  }

  // ============================================================================
  // Watchers
  // ============================================================================

  // Auto-regenerate when config changes
  watch(pathConfig, () => {
    debouncedGenerate()
  }, { deep: true })

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    zones,
    pathConfig,
    generatedPath,
    isGenerating,
    error,

    // Computed
    hasZones,
    pathPreviewData,

    // Methods
    setZones,
    setPathConfig,
    resetConfig,
    generateAllPaths,

    // Utilities (exposed for testing)
    calculateDistance,
    calculateTotalDistance,
    calculateEstimatedTime
  }
}
