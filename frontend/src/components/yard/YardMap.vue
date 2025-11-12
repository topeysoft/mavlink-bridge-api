<template>
  <div class="yard-map">
    <!-- Map Controls -->
    <div class="yard-map__controls">
      <div class="yard-map__controls-left">
        <q-btn-group outline>
          <q-btn
            :color="mapMode === 'view' ? 'primary' : 'grey'"
            icon="visibility"
            label="View"
            size="sm"
            @click="setMapMode('view')"
          />
          <q-btn
            :color="mapMode === 'edit' ? 'primary' : 'grey'"
            icon="edit"
            label="Edit"
            size="sm"
            @click="setMapMode('edit')"
          />
          <q-btn
            :color="mapMode === 'measure' ? 'primary' : 'grey'"
            icon="straighten"
            label="Measure"
            size="sm"
            @click="setMapMode('measure')"
          />
        </q-btn-group>

        <q-separator vertical class="q-mx-sm" />

        <q-btn-group outline>
          <q-btn icon="zoom_in" size="sm" @click="zoomIn" />
          <q-btn icon="zoom_out" size="sm" @click="zoomOut" />
          <q-btn icon="my_location" size="sm" @click="centerMap" />
        </q-btn-group>
      </div>

      <div class="yard-map__controls-right">
        <q-select
          v-model="mapLayer"
          :options="layerOptions"
          label="Map Layer"
          outlined
          dense
          style="min-width: 120px"
          @update:model-value="updateMapLayer"
        />

        <q-btn
          icon="layers"
          label="Layers"
          :color="showLayersPanel ? 'primary' : 'grey'"
          outline
          size="sm"
          @click="showLayersPanel = !showLayersPanel"
        />
      </div>
    </div>

    <!-- Map Container -->
    <div class="yard-map__container">
      <div
        ref="mapElement"
        class="yard-map__canvas"
        @click="handleMapClick"
        @mousemove="handleMouseMove"
      >
        <!-- SVG Overlay for zones, boundaries, etc. -->
        <svg class="yard-map__overlay" width="100%" height="100%">
          <!-- Zones -->
          <g class="yard-map__zones">
            <polygon
              v-for="zone in zones"
              :key="zone.id"
              :points="getPolygonPoints(zone.coordinates)"
              :fill="zone.color"
              :fill-opacity="zone.enabled ? 0.3 : 0.1"
              :stroke="zone.color"
              :stroke-width="selectedZone?.id === zone.id ? 3 : 2"
              :stroke-dasharray="zone.enabled ? 'none' : '5,5'"
              class="yard-map__zone"
              @click="$emit('zone-select', zone)"
            />

            <!-- Zone Labels -->
            <text
              v-for="zone in zones"
              :key="`label-${zone.id}`"
              :x="getZoneCenter(zone.coordinates).x"
              :y="getZoneCenter(zone.coordinates).y"
              text-anchor="middle"
              class="yard-map__zone-label"
            >
              {{ zone.name }}
            </text>
          </g>

          <!-- Boundaries -->
          <g class="yard-map__boundaries">
            <polyline
              v-for="boundary in boundaries"
              :key="boundary.id"
              :points="getPolylinePoints(boundary.coordinates)"
              :stroke="getBoundaryColor(boundary.type)"
              :stroke-width="boundary.active ? 3 : 2"
              :stroke-dasharray="boundary.active ? 'none' : '10,5'"
              fill="none"
              class="yard-map__boundary"
              @click="$emit('boundary-edit', boundary)"
            />
          </g>

          <!-- Obstacles -->
          <g class="yard-map__obstacles">
            <g v-for="obstacle in obstacles" :key="obstacle.id" class="yard-map__obstacle">
              <!-- Circle Obstacles -->
              <circle
                v-if="obstacle.shape === 'circle'"
                :cx="convertToMapX(obstacle.position.lng)"
                :cy="convertToMapY(obstacle.position.lat)"
                :r="obstacle.dimensions.radius || 10"
                :fill="obstacle.detected ? '#FF5722' : '#FFC107'"
                :fill-opacity="0.6"
                :stroke="obstacle.detected ? '#D32F2F' : '#F57C00'"
                stroke-width="2"
              />

              <!-- Rectangle Obstacles -->
              <rect
                v-if="obstacle.shape === 'rectangle'"
                :x="convertToMapX(obstacle.position.lng) - obstacle.dimensions.width / 2"
                :y="convertToMapY(obstacle.position.lat) - obstacle.dimensions.height / 2"
                :width="obstacle.dimensions.width"
                :height="obstacle.dimensions.height"
                :fill="obstacle.detected ? '#FF5722' : '#FFC107'"
                :fill-opacity="0.6"
                :stroke="obstacle.detected ? '#D32F2F' : '#F57C00'"
                stroke-width="2"
              />
            </g>
          </g>

          <!-- Docking Stations -->
          <g class="yard-map__docking-stations">
            <g
              v-for="station in dockingStations"
              :key="station.id"
              class="yard-map__docking-station"
            >
              <circle
                :cx="convertToMapX(station.position.lng)"
                :cy="convertToMapY(station.position.lat)"
                r="8"
                :fill="getStationColor(station.status)"
                stroke="white"
                stroke-width="2"
              />
              <text
                :x="convertToMapX(station.position.lng)"
                :y="convertToMapY(station.position.lat) - 15"
                text-anchor="middle"
                class="yard-map__station-label"
              >
                {{ station.name }}
              </text>
            </g>
          </g>
        </svg>

        <!-- Map placeholder (will be replaced with actual map) -->
        <div class="yard-map__placeholder">
          <q-icon name="map" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">Interactive Yard Map</div>
          <div class="text-body2 text-grey-5">
            Coordinate-based mapping system ready for integration
          </div>
        </div>
      </div>
    </div>

    <!-- Layers Panel -->
    <q-slide-transition>
      <div v-if="showLayersPanel" class="yard-map__layers-panel">
        <div class="yard-map__layers-header">
          <div class="text-subtitle2">Map Layers</div>
          <q-btn icon="close" flat round dense size="sm" @click="showLayersPanel = false" />
        </div>

        <q-separator />

        <div class="yard-map__layers-content">
          <div class="yard-map__layer-group">
            <div class="text-caption text-weight-bold q-mb-sm">Base Map</div>
            <q-checkbox v-model="layerVisibility.satellite" label="Satellite View" />
            <q-checkbox v-model="layerVisibility.terrain" label="Terrain" />
            <q-checkbox v-model="layerVisibility.roads" label="Roads" />
          </div>

          <div class="yard-map__layer-group">
            <div class="text-caption text-weight-bold q-mb-sm">Yard Elements</div>
            <q-checkbox v-model="layerVisibility.zones" label="Zones" />
            <q-checkbox v-model="layerVisibility.boundaries" label="Boundaries" />
            <q-checkbox v-model="layerVisibility.obstacles" label="Obstacles" />
            <q-checkbox v-model="layerVisibility.dockingStations" label="Docking Stations" />
          </div>

          <div class="yard-map__layer-group">
            <div class="text-caption text-weight-bold q-mb-sm">Machine Data</div>
            <q-checkbox v-model="layerVisibility.machinePositions" label="Machine Positions" />
            <q-checkbox v-model="layerVisibility.taskPaths" label="Task Paths" />
            <q-checkbox v-model="layerVisibility.coverage" label="Coverage Areas" />
          </div>
        </div>
      </div>
    </q-slide-transition>

    <!-- Measurement Tools -->
    <div v-if="mapMode === 'measure'" class="yard-map__measurement">
      <q-card class="yard-map__measurement-card">
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Measurement Tools</div>
          <div class="yard-map__measurement-info">
            <div>Distance: {{ measurementData.distance }}m</div>
            <div>Area: {{ measurementData.area }}m²</div>
          </div>
          <q-btn label="Clear" size="sm" outline @click="clearMeasurements" />
        </q-card-section>
      </q-card>
    </div>

    <!-- Map Info -->
    <div class="yard-map__info">
      <div class="yard-map__coordinates">
        Lat: {{ currentCoordinates.lat.toFixed(6) }}, Lng: {{ currentCoordinates.lng.toFixed(6) }}
      </div>
      <div class="yard-map__zoom">Zoom: {{ zoomLevel }}x</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Props
interface Zone {
  id: string
  name: string
  type: string
  coordinates: Array<{ lat: number; lng: number }>
  color: string
  enabled: boolean
}

interface Boundary {
  id: string
  name: string
  type: 'perimeter' | 'exclusion' | 'guide'
  coordinates: Array<{ lat: number; lng: number }>
  active: boolean
}

interface Obstacle {
  id: string
  name: string
  shape: 'circle' | 'rectangle' | 'polygon'
  position: { lat: number; lng: number }
  dimensions: { width: number; height: number; radius?: number }
  detected: boolean
}

interface DockingStation {
  id: string
  name: string
  position: { lat: number; lng: number }
  status: 'active' | 'inactive' | 'maintenance'
}

const props = defineProps<{
  zones: Zone[]
  boundaries: Boundary[]
  obstacles: Obstacle[]
  dockingStations: DockingStation[]
  selectedZone?: Zone | null
}>()

// Emits
const emit = defineEmits<{
  'zone-select': [zone: Zone]
  'zone-edit': [zone: Zone]
  'boundary-edit': [boundary: Boundary]
  'obstacle-add': [obstacle: Partial<Obstacle>]
  'map-click': [coordinates: { lat: number; lng: number }]
}>()

// Refs
const mapElement = ref<HTMLElement>()

// Local state
const mapMode = ref<'view' | 'edit' | 'measure'>('view')
const mapLayer = ref('satellite')
const showLayersPanel = ref(false)
const zoomLevel = ref(1)
const currentCoordinates = ref({ lat: 40.7128, lng: -74.006 })

const layerVisibility = ref({
  satellite: true,
  terrain: false,
  roads: true,
  zones: true,
  boundaries: true,
  obstacles: true,
  dockingStations: true,
  machinePositions: false,
  taskPaths: false,
  coverage: false
})

const measurementData = ref({
  distance: 0,
  area: 0
})

// Options
const layerOptions = [
  { label: 'Satellite', value: 'satellite' },
  { label: 'Terrain', value: 'terrain' },
  { label: 'Road Map', value: 'roadmap' },
  { label: 'Hybrid', value: 'hybrid' }
]

// Methods
const setMapMode = (mode: 'view' | 'edit' | 'measure') => {
  mapMode.value = mode
}

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 1.2, 5)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.1)
}

const centerMap = () => {
  // Center map on yard center
  currentCoordinates.value = { lat: 40.7128, lng: -74.006 }
}

const updateMapLayer = (layer: string) => {
  // Update map layer
}

const handleMapClick = (event: MouseEvent) => {
  if (!mapElement.value) return

  const rect = mapElement.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // Convert pixel coordinates to lat/lng (simplified)
  const lat = 40.7128 + (y - rect.height / 2) * 0.0001
  const lng = -74.006 + (x - rect.width / 2) * 0.0001

  currentCoordinates.value = { lat, lng }
  emit('map-click', { lat, lng })
}

const handleMouseMove = (event: MouseEvent) => {
  if (!mapElement.value) return

  const rect = mapElement.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // Update coordinates on mouse move
  const lat = 40.7128 + (y - rect.height / 2) * 0.0001
  const lng = -74.006 + (x - rect.width / 2) * 0.0001

  currentCoordinates.value = { lat, lng }
}

const getPolygonPoints = (coordinates: Array<{ lat: number; lng: number }>) => {
  return coordinates
    .map(coord => `${convertToMapX(coord.lng)},${convertToMapY(coord.lat)}`)
    .join(' ')
}

const getPolylinePoints = (coordinates: Array<{ lat: number; lng: number }>) => {
  return coordinates
    .map(coord => `${convertToMapX(coord.lng)},${convertToMapY(coord.lat)}`)
    .join(' ')
}

const getZoneCenter = (coordinates: Array<{ lat: number; lng: number }>) => {
  const avgLat = coordinates.reduce((sum, coord) => sum + coord.lat, 0) / coordinates.length
  const avgLng = coordinates.reduce((sum, coord) => sum + coord.lng, 0) / coordinates.length

  return {
    x: convertToMapX(avgLng),
    y: convertToMapY(avgLat)
  }
}

const convertToMapX = (lng: number) => {
  // Convert longitude to map X coordinate (simplified)
  if (!mapElement.value) return 0
  const rect = mapElement.value.getBoundingClientRect()
  return (lng + 74.006) * 10000 + rect.width / 2
}

const convertToMapY = (lat: number) => {
  // Convert latitude to map Y coordinate (simplified)
  if (!mapElement.value) return 0
  const rect = mapElement.value.getBoundingClientRect()
  return (40.7128 - lat) * 10000 + rect.height / 2
}

const getBoundaryColor = (type: string) => {
  switch (type) {
    case 'perimeter':
      return '#FF9800'
    case 'exclusion':
      return '#F44336'
    case 'guide':
      return '#2196F3'
    default:
      return '#9E9E9E'
  }
}

const getStationColor = (status: string) => {
  switch (status) {
    case 'active':
      return '#4CAF50'
    case 'inactive':
      return '#9E9E9E'
    case 'maintenance':
      return '#FF9800'
    default:
      return '#9E9E9E'
  }
}

const clearMeasurements = () => {
  measurementData.value = { distance: 0, area: 0 }
}

// Lifecycle
onMounted(() => {
  // Initialize map
})
</script>

<style lang="scss" scoped>
.yard-map {
  position: relative;
  height: 600px;
  background: var(--q-grey-1);
  border-radius: 8px;
  overflow: hidden;

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.yard-map__controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-dark);
    border-bottom-color: var(--q-grey-8);
  }
}

.yard-map__controls-left,
.yard-map__controls-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.yard-map__container {
  position: relative;
  height: calc(100% - 65px);
}

.yard-map__canvas {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: crosshair;
}

.yard-map__overlay {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  pointer-events: auto;
}

.yard-map__zone {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    fill-opacity: 0.5 !important;
    stroke-width: 3;
  }
}

.yard-map__zone-label {
  font-size: 12px;
  font-weight: 500;
  fill: var(--q-dark);
  pointer-events: none;

  .body--dark & {
    fill: var(--q-dark-page-text);
  }
}

.yard-map__boundary {
  cursor: pointer;
  transition: stroke-width 0.2s ease;

  &:hover {
    stroke-width: 4;
  }
}

.yard-map__obstacle {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
}

.yard-map__station-label {
  font-size: 10px;
  font-weight: 500;
  fill: var(--q-dark);

  .body--dark & {
    fill: var(--q-dark-page-text);
  }
}

.yard-map__placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 1;
}

.yard-map__layers-panel {
  position: absolute;
  top: 65px;
  right: 0;
  width: 250px;
  height: calc(100% - 65px);
  background: white;
  border-left: 1px solid var(--q-grey-3);
  z-index: 10;

  .body--dark & {
    background: var(--q-dark);
    border-left-color: var(--q-grey-8);
  }
}

.yard-map__layers-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
}

.yard-map__layers-content {
  padding: 16px;
  overflow-y: auto;
  height: calc(100% - 80px);
}

.yard-map__layer-group {
  margin-bottom: 20px;

  .q-checkbox {
    display: block;
    margin-bottom: 8px;
  }
}

.yard-map__measurement {
  position: absolute;
  top: 80px;
  left: 16px;
  z-index: 5;
}

.yard-map__measurement-card {
  min-width: 200px;
}

.yard-map__measurement-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 0.875rem;
}

.yard-map__info {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
  z-index: 5;
}

.yard-map__coordinates,
.yard-map__zoom {
  line-height: 1.2;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .yard-map__controls {
    flex-direction: column;
    gap: 12px;
  }

  .yard-map__controls-left,
  .yard-map__controls-right {
    width: 100%;
    justify-content: center;
  }

  .yard-map__layers-panel {
    width: 100%;
    top: 120px;
  }
}

@media (max-width: 599px) {
  .yard-map {
    height: 400px;
  }

  .yard-map__controls {
    padding: 12px;
  }

  .yard-map__info {
    font-size: 0.7rem;
    padding: 6px 8px;
  }
}
</style>
