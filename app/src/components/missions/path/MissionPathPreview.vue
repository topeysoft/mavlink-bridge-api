<script setup lang="ts">
/**
 * MissionPathPreview - Leaflet map showing zones and generated mission path
 *
 * Displays zone polygons with colors and overlays the generated path
 * as an animated polyline for mission preview.
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'
import { useLeafletMap, type MapLayerType } from '@/composables/useLeafletMap'
import type { PathPreviewData } from '@/composables/useMissionPathGeneration'
import type { MissionTypeConfig } from '@/config/missionTypeConfig'
import { getMissionTypeConfig } from '@/config/missionTypeConfig'
import {
  StripRenderer,
  WaypointRenderer,
  CoverageRenderer,
  LineRenderer,
  type PathRenderer
} from './renderers'

interface Props {
  previewData: PathPreviewData | null
  height?: string
  showLayerToggle?: boolean
  showStatistics?: boolean
  interactive?: boolean
  /** Optional mission type config for type-specific rendering */
  missionTypeConfig?: MissionTypeConfig
}

const props = withDefaults(defineProps<Props>(), {
  height: '300px',
  showLayerToggle: true,
  showStatistics: false,
  interactive: false,
  missionTypeConfig: undefined
})

const containerId = `mission-path-preview-${Math.random().toString(36).substring(7)}`
const mapContainer = ref<HTMLElement | null>(null)

// Layer references for cleanup
const zonePolygons = ref<L.Polygon[]>([])

// Type-specific renderers
const renderers: Record<string, PathRenderer> = {
  strips: new StripRenderer(),
  waypoints: new WaypointRenderer(),
  coverage: new CoverageRenderer(),
  line: new LineRenderer()
}

// Track current renderer for cleanup
let currentRenderer: PathRenderer | null = null

const {
  map,
  isInitialized,
  initializeMap,
  setLayerType,
  fitBounds,
  invalidateSize,
  currentLayerType
} = useLeafletMap(containerId, {
  zoom: 17,
  layerType: 'satellite'
})

const layerOptions: Array<{ value: MapLayerType; label: string }> = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'streets', label: 'Streets' }
]

// ============================================================================
// Computed
// ============================================================================

const hasData = computed(() => {
  return props.previewData !== null &&
    (props.previewData.zones.length > 0 || props.previewData.paths.length > 0)
})

const statistics = computed(() => props.previewData?.statistics || null)

const formattedDistance = computed(() => {
  if (!statistics.value) return '--'
  const km = statistics.value.totalDistance / 1000
  if (km < 1) {
    return `${Math.round(statistics.value.totalDistance)} m`
  }
  return `${km.toFixed(2)} km`
})

const formattedTime = computed(() => {
  if (!statistics.value) return '--'
  const minutes = Math.ceil(statistics.value.estimatedTime / 60)
  if (minutes < 60) {
    return `~${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return `~${hours}h ${remainingMins}m`
})

// ============================================================================
// Methods
// ============================================================================

function clearLayers() {
  // Remove existing zone polygons
  for (const polygon of zonePolygons.value) {
    polygon.remove()
  }
  zonePolygons.value = []

  // Clear current renderer
  if (currentRenderer) {
    currentRenderer.clear()
  }
}

function renderPreview() {
  if (!map.value || !props.previewData) return

  clearLayers()

  const allBounds: L.LatLngBounds[] = []

  // Get mission type config (use provided or default to lawn_care)
  const config = props.missionTypeConfig || getMissionTypeConfig('lawn_care')

  // Render zone polygons (boundary only, coverage provided by renderer)
  for (const zone of props.previewData.zones) {
    // Convert [lng, lat] to [lat, lng] for Leaflet
    const latLngs = zone.polygon.map(([lng, lat]) => [lat, lng] as [number, number])

    if (latLngs.length < 3) continue

    const polygon = L.polygon(latLngs, {
      color: zone.color,
      fillColor: zone.color,
      fillOpacity: 0.1,  // Reduced since renderer provides visual coverage
      weight: 2
    }).addTo(map.value)

    zonePolygons.value.push(polygon)
    allBounds.push(polygon.getBounds())
  }

  // Select renderer based on mission type visualization mode
  const vizType = config.pathVisualization
  const renderer = renderers[vizType]

  if (renderer) {
    currentRenderer = renderer
    renderer.render(map.value, props.previewData, config)
  }

  // Fit bounds to show all content
  if (allBounds.length > 0 && allBounds[0]) {
    const initialBounds = allBounds[0]
    const combinedBounds = allBounds.slice(1).reduce(
      (acc, bounds) => acc.extend(bounds),
      initialBounds
    )
    fitBounds(combinedBounds, { padding: [20, 20] })
  }
}

function handleLayerChange(layerType: MapLayerType) {
  setLayerType(layerType)
}

// ============================================================================
// Watchers
// ============================================================================

watch(() => props.previewData, () => {
  if (isInitialized.value) {
    renderPreview()
  }
}, { deep: true })

watch(isInitialized, (initialized) => {
  if (initialized && props.previewData) {
    nextTick(() => {
      renderPreview()
    })
  }
})

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  nextTick(() => {
    // Calculate center from first zone if available
    let center: [number, number] | undefined
    if (props.previewData?.zones && props.previewData.zones.length > 0) {
      const firstZone = props.previewData.zones[0]
      if (firstZone && firstZone.polygon.length > 0) {
        // Calculate centroid
        let sumLat = 0
        let sumLng = 0
        for (const [lng, lat] of firstZone.polygon) {
          sumLat += lat
          sumLng += lng
        }
        center = [sumLat / firstZone.polygon.length, sumLng / firstZone.polygon.length]
      }
    }

    initializeMap(center)

    // Render initial data if available
    if (props.previewData) {
      nextTick(() => {
        renderPreview()
      })
    }
  })
})

onUnmounted(() => {
  clearLayers()
})

// Expose invalidateSize for parent components
defineExpose({
  invalidateSize
})
</script>

<template>
  <div class="mission-path-preview" :style="{ height }">
    <!-- Map Container -->
    <div :id="containerId" ref="mapContainer" class="map-container"></div>

    <!-- Empty State -->
    <div v-if="!hasData && isInitialized" class="empty-overlay">
      <div class="empty-content">
        <span class="empty-icon">🗺️</span>
        <span class="empty-text">Select zones to preview path</span>
      </div>
    </div>

    <!-- Layer Toggle -->
    <div v-if="showLayerToggle && isInitialized" class="layer-toggle">
      <button
        v-for="option in layerOptions"
        :key="option.value"
        class="layer-button"
        :class="{ active: currentLayerType === option.value }"
        @click="handleLayerChange(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- Statistics Overlay -->
    <div v-if="showStatistics && statistics" class="statistics-overlay">
      <div class="stat-item">
        <span class="stat-label">Distance</span>
        <span class="stat-value">{{ formattedDistance }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Time</span>
        <span class="stat-value">{{ formattedTime }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Waypoints</span>
        <span class="stat-value">{{ statistics.waypointCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mission-path-preview {
  position: relative;
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-tertiary);
}

.map-container {
  width: 100%;
  height: 100%;
}

.empty-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--bg-primary-rgb), 0.7);
  pointer-events: none;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.empty-icon {
  font-size: 32px;
}

.empty-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.layer-toggle {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  display: flex;
  gap: 2px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.layer-button {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-xs);
  transition: all 0.15s ease;

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary);
    color: white;
  }
}

.statistics-overlay {
  position: absolute;
  bottom: var(--spacing-sm);
  left: var(--spacing-sm);
  display: flex;
  gap: var(--spacing-md);
  background: rgba(var(--bg-primary-rgb), 0.9);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.stat-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}
</style>
