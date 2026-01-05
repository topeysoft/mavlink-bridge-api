<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useGeofenceStore } from '@/stores/geofence'
import { useRallyStore } from '@/stores/rally'
import { useVehicleStore } from '@/stores/vehicle'
import { useNotifications } from '@/composables/useNotifications'
import { useDialog } from '@/composables/useDialog'
import { useLeafletMap } from '@/composables/useLeafletMap'
import type { Geofence, GeofenceType, GeofenceShape } from '@/types/geofence'
import L from 'leaflet'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const geofenceStore = useGeofenceStore()
const rallyStore = useRallyStore()
const vehicleStore = useVehicleStore()
const { success, error: notifyError, warning } = useNotifications()
const dialog = useDialog()

// Map setup
const { map, initializeMap, addMarker, addCircle, addPolygon, removeLayer, setView } =
  useLeafletMap('geofence-map', {
    center: [40.7128, -74.006],
    zoom: 15
  })

// UI State
const selectedGeofence = ref<Geofence | null>(null)
const showCreateDialog = ref(false)
const drawingMode = ref<'polygon' | 'circle' | null>(null)

// Drawing state
const drawingPoints = ref<Array<{ lat: number; lng: number }>>([])
const drawingCircleCenter = ref<{ lat: number; lng: number } | null>(null)
const drawingCircleRadius = ref(100) // meters
const drawingMarkers = ref<L.Marker[]>([])
const drawingLayers = ref<L.Layer[]>([])

// Form state
const newGeofenceName = ref('')
const newGeofenceType = ref<GeofenceType>('inclusion')
const newGeofenceShape = ref<GeofenceShape>('polygon')

// Rendered geofence layers
const geofenceLayers = ref<Map<string, L.Layer>>(new Map())

// Vehicle position marker
let vehicleMarker: L.Marker | null = null

// Computed
const canSaveGeofence = computed(() => {
  if (!newGeofenceName.value.trim()) return false
  if (newGeofenceShape.value === 'polygon') {
    return drawingPoints.value.length >= 3
  }
  if (newGeofenceShape.value === 'circle') {
    return drawingCircleCenter.value !== null && drawingCircleRadius.value > 0
  }
  return false
})

const stats = computed(() => geofenceStore.stats)

onMounted(() => {
  initializeMap()
  renderAllGeofences()
  updateVehiclePosition()

  // Watch for vehicle position updates
  watch(
    () => [vehicleStore.vehicleState.latitude, vehicleStore.vehicleState.longitude],
    () => {
      updateVehiclePosition()
      if (geofenceStore.isMonitoring) {
        checkGeofenceViolations()
      }
    }
  )

  // Listen for geofence breach rally return events
  window.addEventListener('geofence-breach-return-to-rally', handleGeofenceBreachRallyReturn)
})

// Handle geofence breach return to rally
function handleGeofenceBreachRallyReturn(event: Event) {
  const customEvent = event as CustomEvent
  const { geofenceId, violation } = customEvent.detail

  // Trigger return to rally
  const usage = rallyStore.returnToRally({
    reason: 'geofence-breach'
  })

  if (usage) {
    const rallyPoint = rallyStore.rallyPoints.find(r => r.id === usage.rallyPointId)
    warning(`Geofence breached! Returning to ${rallyPoint?.name || 'rally point'}`)
  }
}

// Render all geofences on map
function renderAllGeofences() {
  // Clear existing layers
  geofenceLayers.value.forEach(layer => removeLayer(layer))
  geofenceLayers.value.clear()

  // Render each geofence
  geofenceStore.geofences.forEach(geofence => {
    renderGeofence(geofence)
  })
}

function renderGeofence(geofence: Geofence) {
  if (!map.value) return

  const color = geofence.status === 'breached' ? '#ef4444' : geofence.color
  const opacity = geofence.enabled ? 0.4 : 0.15

  let layer: L.Layer | null = null

  if (geofence.shape === 'circle' && geofence.circle) {
    layer = L.circle([geofence.circle.center.lat, geofence.circle.center.lng], {
      radius: geofence.circle.radius,
      color,
      fillColor: color,
      fillOpacity: opacity,
      weight: 2
    }).addTo(map.value)

    layer.bindPopup(`
      <strong>${geofence.name}</strong><br>
      Type: ${geofence.type}<br>
      Status: ${geofence.status}<br>
      Radius: ${geofence.circle.radius}m
    `)
  }

  if (geofence.shape === 'polygon' && geofence.polygon) {
    const latLngs = geofence.polygon.coordinates.map(c => [c.lat, c.lng] as [number, number])
    layer = L.polygon(latLngs, {
      color,
      fillColor: color,
      fillOpacity: opacity,
      weight: 2
    }).addTo(map.value)

    layer.bindPopup(`
      <strong>${geofence.name}</strong><br>
      Type: ${geofence.type}<br>
      Status: ${geofence.status}<br>
      Vertices: ${geofence.polygon.coordinates.length}
    `)
  }

  if (layer) {
    geofenceLayers.value.set(geofence.id, layer)

    // Click to select
    layer.on('click', () => {
      selectedGeofence.value = geofence
    })
  }
}

// Update vehicle position on map
function updateVehiclePosition() {
  if (!map.value) return

  const { latitude, longitude } = vehicleStore.vehicleState
  if (!latitude || !longitude) return

  // Remove old marker
  if (vehicleMarker) {
    removeLayer(vehicleMarker)
  }

  // Add new marker
  vehicleMarker = addMarker([latitude, longitude], {
    icon: L.divIcon({
      className: 'vehicle-marker',
      html: '<div class="vehicle-icon">🚜</div>',
      iconSize: [30, 30]
    })
  })

  vehicleMarker?.bindPopup('<strong>YardRover</strong><br>Current Position')

  // Update geofence store
  geofenceStore.updateCurrentPosition(latitude, longitude)
}

// Check for geofence violations
function checkGeofenceViolations() {
  const { latitude, longitude } = vehicleStore.vehicleState
  if (latitude && longitude) {
    geofenceStore.checkViolations({ lat: latitude, lng: longitude })
  }
}

// Create new geofence
function startCreatingGeofence() {
  showCreateDialog.value = true
  newGeofenceName.value = ''
  newGeofenceType.value = 'inclusion'
  newGeofenceShape.value = 'polygon'
  drawingPoints.value = []
  drawingCircleCenter.value = null
  drawingCircleRadius.value = 100
}

function startDrawing() {
  if (!map.value) return

  drawingMode.value = newGeofenceShape.value
  drawingPoints.value = []
  drawingCircleCenter.value = null
  clearDrawingLayers()

  if (newGeofenceShape.value === 'polygon') {
    map.value.on('click', handleMapClickPolygon)
  } else if (newGeofenceShape.value === 'circle') {
    map.value.on('click', handleMapClickCircle)
  }
}

function handleMapClickPolygon(e: L.LeafletMouseEvent) {
  const { lat, lng } = e.latlng

  drawingPoints.value.push({ lat, lng })

  // Add marker
  const marker = addMarker([lat, lng])
  if (marker) {
    drawingMarkers.value.push(marker)
  }

  // Draw polygon preview
  if (drawingPoints.value.length >= 2) {
    clearPolygonPreview()
    const latLngs = drawingPoints.value.map(p => [p.lat, p.lng] as [number, number])
    const polygon = addPolygon(latLngs, {
      color: newGeofenceType.value === 'inclusion' ? '#10b981' : '#ef4444',
      fillOpacity: 0.3
    })
    if (polygon) {
      drawingLayers.value.push(polygon)
    }
  }
}

function handleMapClickCircle(e: L.LeafletMouseEvent) {
  if (!map.value) return

  const { lat, lng } = e.latlng
  drawingCircleCenter.value = { lat, lng }

  clearDrawingLayers()

  // Add center marker
  const marker = addMarker([lat, lng])
  if (marker) {
    drawingMarkers.value.push(marker)
  }

  // Draw circle
  const circle = addCircle([lat, lng], drawingCircleRadius.value, {
    color: newGeofenceType.value === 'inclusion' ? '#10b981' : '#ef4444',
    fillOpacity: 0.3
  })
  if (circle) {
    drawingLayers.value.push(circle)
  }

  stopDrawing()
}

function updateCircleRadius() {
  if (!drawingCircleCenter.value || !map.value) return

  clearDrawingLayers()

  const circle = addCircle(
    [drawingCircleCenter.value.lat, drawingCircleCenter.value.lng],
    drawingCircleRadius.value,
    {
      color: newGeofenceType.value === 'inclusion' ? '#10b981' : '#ef4444',
      fillOpacity: 0.3
    }
  )
  if (circle) {
    drawingLayers.value.push(circle)
  }
}

function clearPolygonPreview() {
  drawingLayers.value.forEach(layer => removeLayer(layer))
  drawingLayers.value = []
}

function clearDrawingLayers() {
  drawingMarkers.value.forEach(marker => removeLayer(marker))
  drawingMarkers.value = []
  drawingLayers.value.forEach(layer => removeLayer(layer))
  drawingLayers.value = []
}

function stopDrawing() {
  if (!map.value) return

  map.value.off('click', handleMapClickPolygon)
  map.value.off('click', handleMapClickCircle)
  drawingMode.value = null
}

function undoLastPoint() {
  if (drawingPoints.value.length === 0) return

  drawingPoints.value.pop()

  // Remove last marker
  const lastMarker = drawingMarkers.value.pop()
  if (lastMarker) {
    removeLayer(lastMarker)
  }

  // Redraw polygon
  clearPolygonPreview()
  if (drawingPoints.value.length >= 2) {
    const latLngs = drawingPoints.value.map(p => [p.lat, p.lng] as [number, number])
    const polygon = addPolygon(latLngs, {
      color: newGeofenceType.value === 'inclusion' ? '#10b981' : '#ef4444',
      fillOpacity: 0.3
    })
    if (polygon) {
      drawingLayers.value.push(polygon)
    }
  }
}

function saveGeofence() {
  if (!canSaveGeofence.value) return

  stopDrawing()

  let shapeData: any = null

  if (newGeofenceShape.value === 'polygon') {
    shapeData = { coordinates: drawingPoints.value }
  } else if (newGeofenceShape.value === 'circle') {
    shapeData = {
      center: drawingCircleCenter.value,
      radius: drawingCircleRadius.value
    }
  }

  const geofence = geofenceStore.createGeofence(
    newGeofenceName.value,
    newGeofenceType.value,
    newGeofenceShape.value,
    shapeData
  )

  renderGeofence(geofence)
  clearDrawingLayers()
  showCreateDialog.value = false

  success(`Geofence "${newGeofenceName.value}" created`)
}

function cancelDrawing() {
  stopDrawing()
  clearDrawingLayers()
  showCreateDialog.value = false
  drawingPoints.value = []
  drawingCircleCenter.value = null
}

// Geofence actions
function toggleGeofence(id: string) {
  geofenceStore.toggleGeofence(id)
  renderAllGeofences()
}

async function deleteGeofence(id: string) {
  const confirmed = await dialog.confirm(
    'Are you sure you want to delete this geofence?',
    'Delete Geofence'
  )

  if (!confirmed) return

  const layer = geofenceLayers.value.get(id)
  if (layer) {
    removeLayer(layer)
    geofenceLayers.value.delete(id)
  }

  geofenceStore.deleteGeofence(id)
  selectedGeofence.value = null
  success('Geofence deleted')
}

// Monitoring
function toggleMonitoring() {
  if (geofenceStore.isMonitoring) {
    geofenceStore.stopMonitoring()
    success('Geofence monitoring stopped')
  } else {
    geofenceStore.startMonitoring()
    checkGeofenceViolations()
    success('Geofence monitoring started')
  }
}

function zoomToGeofence(geofence: Geofence) {
  if (!map.value) return

  if (geofence.shape === 'circle' && geofence.circle) {
    setView([geofence.circle.center.lat, geofence.circle.center.lng], 16)
  } else if (geofence.shape === 'polygon' && geofence.polygon && geofence.polygon.coordinates.length > 0) {
    const latLngs = geofence.polygon.coordinates.map(c => L.latLng(c.lat, c.lng))
    const bounds = L.latLngBounds(latLngs)
    map.value.fitBounds(bounds)
  }
}
</script>

<template>
  <div class="geofence-manager">
    <!-- Header Actions -->
    <div class="manager-header">
      <div class="header-actions">
        <Button variant="secondary" @click="toggleMonitoring">
          <span class="icon">{{ geofenceStore.isMonitoring ? '⏸' : '▶' }}</span>
          {{ geofenceStore.isMonitoring ? 'Stop Monitoring' : 'Start Monitoring' }}
        </Button>
        <Button variant="primary" @click="startCreatingGeofence">
          <span class="icon">+</span>
          New Geofence
        </Button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <Card>
        <div class="stat-card">
          <div class="stat-icon">📍</div>
          <div class="stat-content">
            <div class="stat-label">Total Geofences</div>
            <div class="stat-value">{{ stats.totalGeofences }}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-label">Active Geofences</div>
            <div class="stat-value">{{ stats.activeGeofences }}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-content">
            <div class="stat-label">Active Violations</div>
            <div class="stat-value" :class="{ 'stat-warning': stats.violations > 0 }">
              {{ stats.violations }}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-icon">{{ geofenceStore.isMonitoring ? '👁' : '⏸' }}</div>
          <div class="stat-content">
            <div class="stat-label">Monitoring Status</div>
            <div class="stat-value stat-small">
              {{ geofenceStore.isMonitoring ? 'Active' : 'Inactive' }}
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Main Content -->
    <div class="content-grid">
      <!-- Map -->
      <Card class="map-card">
        <div class="card-header">
          <h2>Geofence Map</h2>
        </div>
        <div id="geofence-map" class="geofence-map"></div>
      </Card>

      <!-- Geofence List -->
      <Card class="list-card">
        <div class="card-header">
          <h2>Geofences</h2>
        </div>

        <div class="geofence-list">
          <div
            v-for="geofence in geofenceStore.geofences"
            :key="geofence.id"
            class="geofence-item"
            :class="{
              selected: selectedGeofence?.id === geofence.id,
              breached: geofence.status === 'breached'
            }"
            @click="selectedGeofence = geofence"
          >
            <div class="geofence-indicator" :style="{ background: geofence.color }"></div>
            <div class="geofence-info">
              <div class="geofence-name">{{ geofence.name }}</div>
              <div class="geofence-meta">
                {{ geofence.type }} · {{ geofence.shape }}
                <span
                  class="status-badge"
                  :class="geofence.status"
                >{{ geofence.status }}</span>
              </div>
            </div>
            <div class="geofence-actions">
              <button
                class="action-btn"
                :class="{ active: geofence.enabled }"
                @click.stop="toggleGeofence(geofence.id)"
                :title="geofence.enabled ? 'Disable' : 'Enable'"
              >
                {{ geofence.enabled ? '✓' : '○' }}
              </button>
              <button
                class="action-btn"
                @click.stop="zoomToGeofence(geofence)"
                title="Zoom to geofence"
              >
                🔍
              </button>
              <button
                class="action-btn danger"
                @click.stop="deleteGeofence(geofence.id)"
                title="Delete"
              >
                ×
              </button>
            </div>
          </div>

          <div v-if="geofenceStore.geofences.length === 0" class="empty-state">
            <p>No geofences created yet</p>
            <Button variant="primary" size="sm" @click="startCreatingGeofence">
              Create First Geofence
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Violations Panel -->
    <Card v-if="geofenceStore.unresolvedViolations.length > 0" class="violations-card">
      <div class="card-header">
        <h2>⚠️ Active Violations</h2>
      </div>
      <div class="violations-list">
        <div
          v-for="violation in geofenceStore.unresolvedViolations"
          :key="violation.id"
          class="violation-item"
        >
          <div class="violation-info">
            <strong>{{ violation.geofenceName }}</strong>
            <div class="violation-time">{{ new Date(violation.timestamp).toLocaleString() }}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            @click="geofenceStore.resolveViolation(violation.id)"
          >
            Resolve
          </Button>
        </div>
      </div>
    </Card>

    <!-- Create Geofence Dialog -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="cancelDrawing">
      <Card class="dialog">
        <div class="dialog-header">
          <h2>Create New Geofence</h2>
          <button class="close-btn" @click="cancelDrawing">×</button>
        </div>

        <div class="dialog-content">
          <div class="form-group">
            <label>Geofence Name</label>
            <input
              v-model="newGeofenceName"
              type="text"
              placeholder="e.g., Front Yard Safety Zone"
              class="input"
            />
          </div>

          <div class="form-group">
            <label>Type</label>
            <select v-model="newGeofenceType" class="select">
              <option value="inclusion">Inclusion (Stay Inside)</option>
              <option value="exclusion">Exclusion (Stay Outside)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Shape</label>
            <select v-model="newGeofenceShape" class="select" :disabled="drawingMode !== null">
              <option value="polygon">Polygon</option>
              <option value="circle">Circle</option>
            </select>
          </div>

          <div v-if="newGeofenceShape === 'circle'" class="form-group">
            <label>Radius (meters)</label>
            <input
              v-model.number="drawingCircleRadius"
              type="number"
              min="10"
              step="10"
              class="input"
              @input="updateCircleRadius"
            />
          </div>

          <div v-if="!drawingMode" class="dialog-actions">
            <Button variant="secondary" @click="cancelDrawing">Cancel</Button>
            <Button variant="primary" @click="startDrawing">Start Drawing</Button>
          </div>

          <div v-else class="drawing-controls">
            <div class="drawing-status">
              <span v-if="newGeofenceShape === 'polygon'">
                {{ drawingPoints.length }} points drawn (minimum 3 required)
              </span>
              <span v-else-if="newGeofenceShape === 'circle'">
                Click on the map to place the center
              </span>
            </div>

            <div class="dialog-actions">
              <Button
                v-if="newGeofenceShape === 'polygon' && drawingPoints.length > 0"
                variant="secondary"
                size="sm"
                @click="undoLastPoint"
              >
                Undo Last Point
              </Button>
              <Button variant="secondary" @click="cancelDrawing">Cancel</Button>
              <Button
                variant="primary"
                :disabled="!canSaveGeofence"
                @click="saveGeofence"
              >
                Save Geofence
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.geofence-manager {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.manager-header {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);

  &.stat-small {
    font-size: 1.125rem;
  }

  &.stat-warning {
    color: #ef4444;
  }
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.map-card {
  min-height: 500px;
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);

  h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
}

.geofence-map {
  width: 100%;
  height: 500px;
  background: var(--bg-secondary);
}

.geofence-list {
  max-height: 500px;
  overflow-y: auto;
}

.geofence-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--bg-hover);
  }

  &.selected {
    background: var(--bg-hover);
    border-left: 3px solid $primary;
  }

  &.breached {
    background: rgba(239, 68, 68, 0.1);
  }
}

.geofence-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.geofence-info {
  flex: 1;
  min-width: 0;
}

.geofence-name {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.geofence-meta {
  font-size: 0.813rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;

  &.active {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  &.inactive {
    background: rgba(156, 163, 175, 0.2);
    color: #9ca3af;
  }

  &.breached {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
}

.geofence-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;

  &:hover {
    background: var(--bg-hover);
    border-color: $primary;
  }

  &.active {
    background: $primary;
    color: white;
    border-color: $primary;
  }

  &.danger:hover {
    background: #ef4444;
    color: white;
    border-color: #ef4444;
  }
}

.empty-state {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-secondary);

  p {
    margin-bottom: 1rem;
  }
}

.violations-card {
  margin-top: 1.5rem;
}

.violations-list {
  padding: 1rem;
}

.violation-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
  border-radius: 6px;
  margin-bottom: 0.75rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.violation-info {
  flex: 1;

  strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
}

.violation-time {
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.dialog {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border-color);

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.dialog-content {
  padding: 1.25rem;
}

.form-group {
  margin-bottom: 1.25rem;

  label {
    display: block;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
}

.input,
.select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.938rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: $primary;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.drawing-controls {
  margin-top: 1.5rem;
}

.drawing-status {
  padding: 0.875rem;
  background: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 1rem;
  text-align: center;
  font-size: 0.938rem;
  color: var(--text-secondary);
}

.icon {
  margin-right: 0.5rem;
}

:deep(.vehicle-marker) {
  background: none;
  border: none;
}

:deep(.vehicle-icon) {
  font-size: 24px;
  text-align: center;
  line-height: 30px;
}
</style>
