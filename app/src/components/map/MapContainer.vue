<template>
  <div ref="mapContainer" class="map-container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
  center?: [number, number]
  zoom?: number
  waypoints?: Array<{ lat: number; lng: number; alt?: number }>
  vehiclePosition?: { lat: number; lng: number; heading?: number }
  showTrail?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  center: () => [40.7128, -74.0060],
  zoom: 15,
  waypoints: () => [],
  showTrail: false
})

const emit = defineEmits<{
  mapClick: [event: { lat: number; lng: number }]
  waypointMove: [index: number, position: { lat: number; lng: number }]
  waypointClick: [index: number]
}>()

const mapContainer = ref<HTMLElement>()
let map: L.Map | null = null
let waypointMarkers: L.Marker[] = []
let waypointPolyline: L.Polyline | null = null
let vehicleMarker: L.Marker | null = null
let trailPolyline: L.Polyline | null = null
const trailPoints: [number, number][] = []

onMounted(() => {
  initializeMap()
})

onUnmounted(() => {
  if (map) {
    map.remove()
  }
})

// Watch for waypoint changes
watch(() => props.waypoints, updateWaypoints, { deep: true })
watch(() => props.vehiclePosition, updateVehiclePosition, { deep: true })

function initializeMap() {
  if (!mapContainer.value) return

  // Initialize map
  map = L.map(mapContainer.value, {
    center: props.center,
    zoom: props.zoom,
    zoomControl: true
  })

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  // Handle map clicks
  map.on('click', (e) => {
    emit('mapClick', {
      lat: e.latlng.lat,
      lng: e.latlng.lng
    })
  })

  // Initial setup
  updateWaypoints()
  updateVehiclePosition()
}

function updateWaypoints() {
  if (!map) return

  // Clear existing waypoint markers and lines
  waypointMarkers.forEach(marker => map!.removeLayer(marker))
  waypointMarkers = []
  
  if (waypointPolyline) {
    map.removeLayer(waypointPolyline)
  }

  // Add waypoint markers
  props.waypoints.forEach((waypoint, index) => {
    const marker = L.marker([waypoint.lat, waypoint.lng], {
      draggable: true,
      icon: createWaypointIcon(index)
    })

    marker.on('dragend', (e) => {
      const position = e.target.getLatLng()
      emit('waypointMove', index, {
        lat: position.lat,
        lng: position.lng
      })
    })

    marker.on('click', () => {
      emit('waypointClick', index)
    })

    marker.addTo(map!)
    waypointMarkers.push(marker)
  })

  // Add waypoint line
  if (props.waypoints.length > 1) {
    const latlngs = props.waypoints.map(wp => [wp.lat, wp.lng] as [number, number])
    waypointPolyline = L.polyline(latlngs, {
      color: '#2196f3',
      weight: 3,
      opacity: 0.7
    }).addTo(map)
  }
}

function updateVehiclePosition() {
  if (!map || !props.vehiclePosition) return

  if (vehicleMarker) {
    map.removeLayer(vehicleMarker)
  }

  // Create vehicle marker
  vehicleMarker = L.marker(
    [props.vehiclePosition.lat, props.vehiclePosition.lng],
    {
      icon: createVehicleIcon(props.vehiclePosition.heading || 0)
    }
  ).addTo(map)

  // Update trail
  if (props.showTrail) {
    trailPoints.push([props.vehiclePosition.lat, props.vehiclePosition.lng])
    
    if (trailPolyline) {
      map.removeLayer(trailPolyline)
    }
    
    trailPolyline = L.polyline(trailPoints, {
      color: '#ff9800',
      weight: 2,
      opacity: 0.6
    }).addTo(map)
  }
}

function createWaypointIcon(index: number): L.DivIcon {
  return L.divIcon({
    html: `<div class="waypoint-marker">
      <div class="waypoint-number">${index + 1}</div>
    </div>`,
    className: 'waypoint-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  })
}

function createVehicleIcon(heading: number): L.DivIcon {
  return L.divIcon({
    html: `<div class="vehicle-marker" style="transform: rotate(${heading}deg)">
      <svg width="20" height="20" viewBox="0 0 20 20">
        <polygon points="10,2 18,18 10,14 2,18" fill="#f44336" stroke="white" stroke-width="1"/>
      </svg>
    </div>`,
    className: 'vehicle-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
}

// Expose map instance for parent component
defineExpose({
  getMap: () => map,
  fitBounds: (bounds: [[number, number], [number, number]]) => {
    if (map) map.fitBounds(bounds)
  },
  setView: (center: [number, number], zoom: number) => {
    if (map) map.setView(center, zoom)
  }
})
</script>

<style lang="scss" scoped>
.map-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
}

:deep(.waypoint-marker) {
  width: 30px;
  height: 30px;
  background: #2196f3;
  border: 2px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

:deep(.waypoint-number) {
  color: white;
  font-weight: bold;
  font-size: 12px;
}

:deep(.vehicle-marker) {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>