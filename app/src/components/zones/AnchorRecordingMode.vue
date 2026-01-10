<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AnchorPoint } from '@/types/recording'

interface Props {
  anchors: AnchorPoint[]
  polygon?: [number, number][]  // Interpolated boundary from backend
  isRecording: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  mapClick: [lat: number, lon: number]
  anchorDrag: [index: number, lat: number, lon: number]
  anchorDelete: [index: number]
}>()

const mapContainer = ref<HTMLDivElement>()
let map: L.Map | null = null
let anchorMarkers: L.Marker[] = []
let polygonLayer: L.Polygon | null = null

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

  // Add click handler for placing anchors
  map.on('click', (e: L.LeafletMouseEvent) => {
    if (props.isRecording) {
      emit('mapClick', e.latlng.lat, e.latlng.lng)
    }
  })

  // Watch for anchor and polygon updates
  watch(() => props.anchors, updateAnchors, { deep: true })
  watch(() => props.polygon, updatePolygon, { deep: true })
}

function updateAnchors() {
  if (!map) return

  // Remove existing markers
  anchorMarkers.forEach(marker => marker.remove())
  anchorMarkers = []

  // Add new markers
  props.anchors.forEach((anchor, index) => {
    const marker = createAnchorMarker(anchor, index)
    anchorMarkers.push(marker)
  })

  // Auto-fit bounds if we have anchors
  if (props.anchors.length > 0) {
    const latLngs = props.anchors.map(a => [a.lat, a.lon] as [number, number])
    const bounds = L.latLngBounds(latLngs)
    map!.fitBounds(bounds, { padding: [50, 50] })
  }
}

function createAnchorMarker(anchor: AnchorPoint, index: number): L.Marker {
  // Create custom icon with number
  const icon = L.divIcon({
    className: 'anchor-marker-icon',
    html: `
      <div class="anchor-marker">
        <div class="anchor-number">${index + 1}</div>
        <button class="anchor-delete" onclick="event.stopPropagation()">×</button>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  })

  const marker = L.marker([anchor.lat, anchor.lon], {
    icon,
    draggable: props.isRecording
  })

  // Handle drag
  marker.on('dragend', (e: L.DragEndEvent) => {
    const latlng = e.target.getLatLng()
    emit('anchorDrag', index, latlng.lat, latlng.lng)
  })

  // Handle delete button click
  marker.on('click', (e: L.LeafletMouseEvent) => {
    const target = e.originalEvent.target as HTMLElement
    if (target.classList.contains('anchor-delete')) {
      emit('anchorDelete', index)
    }
  })

  marker.addTo(map!)
  return marker
}

function updatePolygon() {
  if (!map) return

  // Remove existing polygon
  if (polygonLayer) {
    polygonLayer.remove()
    polygonLayer = null
  }

  // Add new polygon if we have coordinates
  if (props.polygon && props.polygon.length >= 3) {
    polygonLayer = L.polygon(props.polygon, {
      color: '#2C5F2D',
      fillColor: '#7CB342',
      fillOpacity: 0.2,
      weight: 2
    }).addTo(map)
  }
}
</script>

<template>
  <div class="anchor-recording-mode">
    <div ref="mapContainer" class="map-container"></div>

    <div v-if="anchors.length === 0" class="instruction-overlay">
      <div class="instruction-content">
        <h3>📍 Mark the Corners</h3>
        <p>Click on the map to place anchor points at each corner of your zone.</p>
        <ul>
          <li>Minimum 3 corners required</li>
          <li>Drag markers to adjust position</li>
          <li>Click × to remove an anchor</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.anchor-recording-mode {
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

.instruction-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  pointer-events: none;
}

.instruction-content {
  text-align: center;
  padding: var(--spacing-xl);
  max-width: 400px;

  h3 {
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-md);
  }

  p {
    font-size: var(--font-size-md);
    margin-bottom: var(--spacing-lg);
  }

  ul {
    text-align: left;
    font-size: var(--font-size-sm);
    opacity: 0.9;
  }
}

// Global styles for anchor markers (not scoped)
:deep(.anchor-marker-icon) {
  background: transparent;
  border: none;
}

:deep(.anchor-marker) {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2C5F2D;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: move;

  &:hover {
    background: #7CB342;
  }
}

:deep(.anchor-number) {
  color: white;
  font-weight: bold;
  font-size: 16px;
}

:deep(.anchor-delete) {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background: #dc3545;
  color: white;
  border: 2px solid white;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: none;
  padding: 0;

  &:hover {
    background: #c82333;
  }
}

:deep(.anchor-marker:hover .anchor-delete) {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
