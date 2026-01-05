<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Waypoint, WaypointTemplate } from '@/types/waypoint'
import { WAYPOINT_TEMPLATES, MAV_CMD, MAV_FRAME } from '@/types/waypoint'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

interface Props {
  waypoints: Waypoint[]
  homePosition?: { latitude: number; longitude: number; altitude: number }
}

interface Emits {
  (e: 'update:waypoints', waypoints: Waypoint[]): void
  (e: 'update:homePosition', position: { latitude: number; longitude: number; altitude: number }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const mapContainer = ref<HTMLElement | null>(null)
const map = ref<L.Map | null>(null)
const markers = ref<Map<string, L.Marker>>(new Map())
const polyline = ref<L.Polyline | null>(null)
const selectedWaypointId = ref<string | null>(null)
const isAddingWaypoint = ref(false)
const selectedTemplate = ref<WaypointTemplate>(WAYPOINT_TEMPLATES[0])

// Waypoint editing
const editingWaypoint = ref<Waypoint | null>(null)

const selectedWaypoint = computed(() => {
  if (!selectedWaypointId.value) return null
  return props.waypoints.find(w => w.id === selectedWaypointId.value) || null
})

const waypointPath = computed(() => {
  return props.waypoints
    .filter(w => isNavigationCommand(w.command))
    .map(w => [w.latitude, w.longitude] as [number, number])
})

function isNavigationCommand(command: MAV_CMD): boolean {
  return [
    MAV_CMD.NAV_WAYPOINT,
    MAV_CMD.NAV_LOITER_UNLIM,
    MAV_CMD.NAV_LOITER_TIME,
    MAV_CMD.NAV_RETURN_TO_LAUNCH,
    MAV_CMD.NAV_LAND,
  ].includes(command)
}

function initializeMap() {
  if (!mapContainer.value) return

  const defaultCenter: [number, number] = props.homePosition
    ? [props.homePosition.latitude, props.homePosition.longitude]
    : [40.7128, -74.006] // Default to NYC

  map.value = L.map(mapContainer.value).setView(defaultCenter, 18)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 22,
  }).addTo(map.value)

  // Add home marker if available
  if (props.homePosition) {
    const homeIcon = L.divIcon({
      className: 'home-marker',
      html: `<div class="marker-icon home"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    })

    L.marker([props.homePosition.latitude, props.homePosition.longitude], { icon: homeIcon })
      .addTo(map.value!)
      .bindPopup('Home Position')
  }

  // Click handler for adding waypoints
  map.value.on('click', handleMapClick)

  // Render existing waypoints
  renderWaypoints()
}

function handleMapClick(e: L.LeafletMouseEvent) {
  if (!isAddingWaypoint.value) return

  const newWaypoint: Waypoint = {
    id: `wp_${Date.now()}`,
    seq: props.waypoints.length,
    command: selectedTemplate.value.command,
    frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    current: props.waypoints.length === 0,
    autocontinue: true,
    latitude: e.latlng.lat,
    longitude: e.latlng.lng,
    altitude: 0,
    param1: selectedTemplate.value.defaultParams.param1 || 0,
    param2: selectedTemplate.value.defaultParams.param2 || 0,
    param3: selectedTemplate.value.defaultParams.param3 || 0,
    param4: selectedTemplate.value.defaultParams.param4 || 0,
  }

  const updated = [...props.waypoints, newWaypoint]
  emit('update:waypoints', updated)
}

function renderWaypoints() {
  if (!map.value) return

  // Clear existing markers
  markers.value.forEach(marker => marker.remove())
  markers.value.clear()

  // Add waypoint markers
  props.waypoints.forEach((waypoint, index) => {
    const markerIcon = L.divIcon({
      className: 'waypoint-marker',
      html: `<div class="marker-icon waypoint ${selectedWaypointId.value === waypoint.id ? 'selected' : ''}">
        <span class="marker-number">${index + 1}</span>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    })

    const marker = L.marker([waypoint.latitude, waypoint.longitude], { icon: markerIcon, draggable: true })
      .addTo(map.value!)
      .on('click', () => selectWaypoint(waypoint.id))
      .on('dragend', (e: L.DragEndEvent) => {
        const pos = e.target.getLatLng()
        updateWaypointPosition(waypoint.id, pos.lat, pos.lng)
      })

    marker.bindPopup(`Waypoint ${index + 1}: ${getCommandName(waypoint.command)}`)
    markers.value.set(waypoint.id, marker)
  })

  // Draw path
  if (polyline.value) {
    polyline.value.remove()
  }

  if (waypointPath.value.length > 1) {
    polyline.value = L.polyline(waypointPath.value, {
      color: '#2C5F2D',
      weight: 3,
      opacity: 0.7,
      dashArray: '10, 5',
    }).addTo(map.value!)
  }
}

function getCommandName(command: MAV_CMD): string {
  const template = WAYPOINT_TEMPLATES.find(t => t.command === command)
  return template?.name || `Command ${command}`
}

function selectWaypoint(id: string) {
  selectedWaypointId.value = id
  renderWaypoints() // Re-render to update selected state
}

function updateWaypointPosition(id: string, lat: number, lng: number) {
  const updated = props.waypoints.map(w =>
    w.id === id ? { ...w, latitude: lat, longitude: lng } : w
  )
  emit('update:waypoints', updated)
}

function deleteWaypoint(id: string) {
  const updated = props.waypoints.filter(w => w.id !== id).map((w, i) => ({ ...w, seq: i }))
  emit('update:waypoints', updated)
  selectedWaypointId.value = null
}

function moveWaypointUp(id: string) {
  const index = props.waypoints.findIndex(w => w.id === id)
  if (index <= 0) return

  const updated = [...props.waypoints]
  ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
  updated.forEach((w, i) => (w.seq = i))

  emit('update:waypoints', updated)
}

function moveWaypointDown(id: string) {
  const index = props.waypoints.findIndex(w => w.id === id)
  if (index < 0 || index >= props.waypoints.length - 1) return

  const updated = [...props.waypoints]
  ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
  updated.forEach((w, i) => (w.seq = i))

  emit('update:waypoints', updated)
}

function clearWaypoints() {
  if (confirm('Are you sure you want to clear all waypoints?')) {
    emit('update:waypoints', [])
    selectedWaypointId.value = null
  }
}

function toggleAddMode() {
  isAddingWaypoint.value = !isAddingWaypoint.value
}

// Watch for waypoint changes
watch(() => props.waypoints, renderWaypoints, { deep: true })

onMounted(() => {
  initializeMap()
})

onUnmounted(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})
</script>

<template>
  <div class="waypoint-editor">
    <div class="editor-toolbar">
      <div class="toolbar-section">
        <select v-model="selectedTemplate" class="template-select">
          <option v-for="template in WAYPOINT_TEMPLATES" :key="template.id" :value="template">
            {{ template.name }}
          </option>
        </select>

        <Button
          :variant="isAddingWaypoint ? 'success' : 'primary'"
          @click="toggleAddMode"
          :class="{ active: isAddingWaypoint }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          {{ isAddingWaypoint ? 'Click map to add' : 'Add Waypoint' }}
        </Button>

        <Button variant="outline" @click="clearWaypoints" :disabled="waypoints.length === 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Clear All
        </Button>
      </div>

      <div class="toolbar-info">
        <span class="info-badge">{{ waypoints.length }} waypoints</span>
      </div>
    </div>

    <div class="editor-content">
      <div class="map-container" ref="mapContainer"></div>

      <div class="waypoint-list-panel">
        <Card>
          <template #header>
            <div class="panel-header">
              <div class="card-title">Waypoints</div>
              <div class="card-subtitle">{{ waypoints.length }} items</div>
            </div>
          </template>

          <div v-if="waypoints.length === 0" class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <p>No waypoints yet</p>
            <p class="hint">Click "Add Waypoint" and then click on the map</p>
          </div>

          <div v-else class="waypoint-list">
            <div
              v-for="(waypoint, index) in waypoints"
              :key="waypoint.id"
              class="waypoint-item"
              :class="{ selected: selectedWaypointId === waypoint.id }"
              @click="selectWaypoint(waypoint.id)"
            >
              <div class="waypoint-number">{{ index + 1 }}</div>
              <div class="waypoint-info">
                <div class="waypoint-name">{{ getCommandName(waypoint.command) }}</div>
                <div class="waypoint-coords">
                  {{ waypoint.latitude.toFixed(6) }}, {{ waypoint.longitude.toFixed(6) }}
                </div>
              </div>
              <div class="waypoint-actions">
                <button
                  class="action-btn"
                  @click.stop="moveWaypointUp(waypoint.id)"
                  :disabled="index === 0"
                  title="Move up"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
                <button
                  class="action-btn"
                  @click.stop="moveWaypointDown(waypoint.id)"
                  :disabled="index === waypoints.length - 1"
                  title="Move down"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <button class="action-btn delete" @click.stop="deleteWaypoint(waypoint.id)" title="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.waypoint-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--spacing-lg);
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.toolbar-section {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.template-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  min-width: 200px;

  &:focus {
    outline: none;
    border-color: var(--primary-green);
  }
}

.toolbar-info {
  display: flex;
  gap: var(--spacing-sm);
}

.info-badge {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--primary-green);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.editor-content {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: var(--spacing-lg);
  flex: 1;
  min-height: 600px;
}

.map-container {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 2px solid var(--border-color);
  height: 100%;
  min-height: 600px;

  :deep(.leaflet-container) {
    height: 100%;
    background: var(--bg-primary);
  }
}

.waypoint-list-panel {
  display: flex;
  flex-direction: column;
  max-height: 600px;
}

.panel-header {
  padding: var(--spacing-lg);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  color: var(--text-secondary);

  svg {
    width: 48px;
    height: 48px;
    margin-bottom: var(--spacing-md);
    opacity: 0.3;
  }

  p {
    margin: var(--spacing-xs) 0;
    text-align: center;
  }

  .hint {
    font-size: var(--font-size-sm);
    opacity: 0.7;
  }
}

.waypoint-list {
  max-height: 500px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.waypoint-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-green);
  }

  &.selected {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.1);
  }
}

.waypoint-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--primary-green);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.waypoint-info {
  flex: 1;
  min-width: 0;
}

.waypoint-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  margin-bottom: 2px;
}

.waypoint-coords {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  font-family: 'Monaco', 'Courier New', monospace;
}

.waypoint-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.action-btn {
  padding: var(--spacing-xs);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover:not(:disabled) {
    background: var(--bg-primary);
    border-color: var(--primary-green);
    color: var(--primary-green);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &.delete:hover:not(:disabled) {
    border-color: var(--status-error);
    color: var(--status-error);
  }
}

// Custom marker styles
:deep(.home-marker),
:deep(.waypoint-marker) {
  .marker-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    border: 3px solid white;

    &.home {
      background: #ef4444;
      color: white;

      svg {
        width: 20px;
        height: 20px;
      }
    }

    &.waypoint {
      background: var(--primary-green);
      color: white;

      &.selected {
        background: #10b981;
        transform: scale(1.2);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
    }

    .marker-number {
      font-weight: 700;
      font-size: 14px;
    }
  }
}

@media (max-width: 1024px) {
  .editor-content {
    grid-template-columns: 1fr;
  }

  .waypoint-list-panel {
    max-height: 400px;
  }
}
</style>
