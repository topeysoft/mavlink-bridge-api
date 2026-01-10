<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RecordedWaypoint } from '@/types/recording'

interface Props {
  waypoints: RecordedWaypoint[]
  isRecording: boolean
  showPreview?: boolean
}

const props = defineProps<Props>()

const mapContainer = ref<HTMLDivElement>()
let map: L.Map | null = null
let pathPolyline: L.Polyline | null = null
let currentMarker: L.CircleMarker | null = null

onMounted(() => {
  initMap()

  // Invalidate size after a short delay to ensure container is properly sized
  setTimeout(() => {
    if (map) {
      map.invalidateSize()
    }
  }, 100)
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

function initMap() {
  if (!mapContainer.value) return

  // Initialize map
  map = L.map(mapContainer.value, {
    zoomControl: true,
    attributionControl: false
  }).setView([0, 0], 2)

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map)

  // Initialize path polyline
  pathPolyline = L.polyline([], {
    color: props.showPreview ? '#2C5F2D' : '#87CEEB',
    weight: 3,
    opacity: 0.8
  }).addTo(map)

  // Initialize current position marker
  currentMarker = L.circleMarker([0, 0], {
    color: '#2C5F2D',
    fillColor: '#7CB342',
    fillOpacity: 0.8,
    radius: 8,
    weight: 2
  })

  if (props.isRecording) {
    currentMarker.addTo(map)
  }

  // Watch for waypoint updates
  watch(() => props.waypoints, updatePath, { deep: true })
  watch(() => props.isRecording, (recording) => {
    if (recording && currentMarker && map) {
      currentMarker.addTo(map)
    } else if (!recording && currentMarker) {
      currentMarker.remove()
    }
  })
}

function updatePath() {
  if (!map || !pathPolyline) return

  const latLngs = props.waypoints.map(w => [w.lat, w.lon] as [number, number])

  // Update polyline
  pathPolyline.setLatLngs(latLngs)

  // Update current position marker
  if (currentMarker && latLngs.length > 0) {
    const lastPoint = latLngs[latLngs.length - 1]
    currentMarker.setLatLng(lastPoint)
  }

  // Auto-fit bounds
  if (latLngs.length > 0) {
    const bounds = L.latLngBounds(latLngs)
    map.fitBounds(bounds, { padding: [50, 50] })
  }
}
</script>

<template>
  <div class="recording-map">
    <div ref="mapContainer" class="map-container"></div>

    <div v-if="waypoints.length === 0" class="no-data-overlay">
      <p>{{ isRecording ? 'Waiting for GPS signal...' : 'No waypoints recorded' }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.recording-map {
  position: relative;
  width: 100%;
  height: 400px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-primary);
}

.map-container {
  width: 100%;
  height: 100%;
}

.no-data-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: var(--font-size-md);
  pointer-events: none;
}
</style>
