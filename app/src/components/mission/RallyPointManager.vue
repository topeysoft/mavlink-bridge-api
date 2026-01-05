<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRallyStore } from '@/stores/rally'
import { useVehicleStore } from '@/stores/vehicle'
import { useNotifications } from '@/composables/useNotifications'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useDialog } from '@/composables/useDialog'
import type { RallyPoint, RallyPointPriority } from '@/types/rally'
import L from 'leaflet'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const rallyStore = useRallyStore()
const vehicleStore = useVehicleStore()
const { success, error: notifyError, warning } = useNotifications()
const dialog = useDialog()

// Map setup
const { map, initializeMap, addMarker, setView } = useLeafletMap('rally-map', {
  center: [40.7128, -74.006],
  zoom: 15
})

// UI State
const selectedRallyPoint = ref<RallyPoint | null>(null)
const showCreateDialog = ref(false)
const showReturnDialog = ref(false)
const placingRallyPoint = ref(false)

// Form state
const newRallyName = ref('')
const newRallyPriority = ref<RallyPointPriority>('secondary')
const newRallyPosition = ref<{ lat: number; lng: number; alt: number } | null>(null)
const newRallyLandImmediately = ref(false)
const newRallyLoiterRadius = ref(50)

// Return to rally state
const returnReason = ref<'manual' | 'low-battery' | 'geofence-breach' | 'emergency' | 'failsafe'>('manual')
const selectedReturnRallyId = ref<string>()

// Rendered rally point markers
const rallyMarkers = ref<Map<string, L.Marker>>(new Map())
let vehicleMarker: L.Marker | null = null
let tempMarker: L.Marker | null = null

// Computed
const canSaveRallyPoint = computed(() => {
  return newRallyName.value.trim() !== '' && newRallyPosition.value !== null
})

const stats = computed(() => rallyStore.stats)

const priorityOptions = [
  { value: 'primary', label: 'Primary', description: 'Default return location' },
  { value: 'secondary', label: 'Secondary', description: 'Backup location' },
  { value: 'tertiary', label: 'Tertiary', description: 'Additional option' }
]

const returnReasons = [
  { value: 'manual', label: 'Manual Return', icon: '🎮' },
  { value: 'low-battery', label: 'Low Battery', icon: '🔋' },
  { value: 'geofence-breach', label: 'Geofence Breach', icon: '⚠️' },
  { value: 'emergency', label: 'Emergency', icon: '🚨' },
  { value: 'failsafe', label: 'Failsafe', icon: '🛡️' }
]

onMounted(() => {
  initializeMap()
  renderAllRallyPoints()
  updateVehiclePosition()

  // Watch for vehicle position updates
  watch(
    () => [vehicleStore.vehicleState.latitude, vehicleStore.vehicleState.longitude],
    () => {
      updateVehiclePosition()
    }
  )

  // Listen for battery auto-return events
  window.addEventListener('battery-auto-return', handleBatteryAutoReturn)
})

// Handle battery auto-return
function handleBatteryAutoReturn(event: Event) {
  const customEvent = event as CustomEvent
  const { reason, batteryPercent, destination } = customEvent.detail

  // Trigger return to rally based on destination preference
  const usage = rallyStore.returnToRally({
    reason: 'low-battery'
  })

  if (usage) {
    const rallyPoint = rallyStore.rallyPoints.find(r => r.id === usage.rallyPointId)
    success(`Low battery (${batteryPercent}%)! Returning to ${rallyPoint?.name || 'rally point'}`)
    renderAllRallyPoints()

    // Zoom to rally point
    if (rallyPoint) {
      zoomToRallyPoint(rallyPoint)
    }
  } else {
    notifyError('No rally points available for auto-return')
  }
}

// Render all rally points on map
function renderAllRallyPoints() {
  // Clear existing markers
  rallyMarkers.value.forEach(marker => marker.remove())
  rallyMarkers.value.clear()

  // Render each rally point
  rallyStore.rallyPoints.forEach(rallyPoint => {
    renderRallyPoint(rallyPoint)
  })
}

function renderRallyPoint(rallyPoint: RallyPoint) {
  if (!map.value) return

  const icon = L.divIcon({
    className: 'rally-marker',
    html: `
      <div class="rally-marker-content" style="
        background: ${rallyPoint.color};
        opacity: ${rallyPoint.enabled ? '1' : '0.5'};
        border: 3px solid white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <span style="font-size: 20px;">
          ${rallyPoint.priority === 'primary' ? '⭐' : rallyPoint.priority === 'secondary' ? '🏁' : '📍'}
        </span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  })

  const marker = L.marker([rallyPoint.position.lat, rallyPoint.position.lng], { icon })
    .addTo(map.value)

  marker.bindPopup(`
    <div style="min-width: 200px;">
      <strong style="font-size: 1.1em;">${rallyPoint.name}</strong><br>
      <span style="color: ${rallyPoint.color}; font-weight: 600;">
        ${rallyPoint.priority.toUpperCase()}
      </span><br>
      Status: ${rallyPoint.status}<br>
      Alt: ${rallyPoint.position.alt}m<br>
      ${rallyPoint.stats ? `Used: ${rallyPoint.stats.timesUsed} times` : ''}
    </div>
  `)

  marker.on('click', () => {
    selectedRallyPoint.value = rallyPoint
  })

  rallyMarkers.value.set(rallyPoint.id, marker)
}

// Update vehicle position on map
function updateVehiclePosition() {
  if (!map.value) return

  const { latitude, longitude, altitude } = vehicleStore.vehicleState
  if (!latitude || !longitude) return

  // Remove old marker
  if (vehicleMarker) {
    vehicleMarker.remove()
  }

  // Add new marker
  const icon = L.divIcon({
    className: 'vehicle-marker',
    html: '<div class="vehicle-icon">🚜</div>',
    iconSize: [30, 30]
  })

  vehicleMarker = L.marker([latitude, longitude], { icon }).addTo(map.value)
  vehicleMarker.bindPopup('<strong>YardRover</strong><br>Current Position')

  // Update rally store
  rallyStore.updateCurrentPosition(latitude, longitude, altitude || 0)
}

// Create new rally point
function startCreatingRallyPoint() {
  showCreateDialog.value = true
  newRallyName.value = ''
  newRallyPriority.value = 'secondary'
  newRallyPosition.value = null
  newRallyLandImmediately.value = false
  newRallyLoiterRadius.value = 50
}

function startPlacingRallyPoint() {
  if (!map.value) return

  placingRallyPoint.value = true
  map.value.on('click', handleMapClick)
  map.value.getContainer().style.cursor = 'crosshair'
}

function handleMapClick(e: L.LeafletMouseEvent) {
  if (!map.value || !placingRallyPoint.value) return

  const { lat, lng } = e.latlng
  const alt = vehicleStore.vehicleState.altitude || 0

  newRallyPosition.value = { lat, lng, alt }

  // Remove temp marker if exists
  if (tempMarker) {
    tempMarker.remove()
  }

  // Add temporary marker
  const icon = L.divIcon({
    className: 'rally-marker-temp',
    html: `
      <div style="
        background: #3b82f6;
        border: 3px dashed white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <span style="font-size: 20px;">📍</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  })

  tempMarker = L.marker([lat, lng], { icon }).addTo(map.value)
  stopPlacingRallyPoint()
}

function stopPlacingRallyPoint() {
  if (!map.value) return

  placingRallyPoint.value = false
  map.value.off('click', handleMapClick)
  map.value.getContainer().style.cursor = ''
}

function saveRallyPoint() {
  if (!canSaveRallyPoint.value || !newRallyPosition.value) return

  const rallyPoint = rallyStore.createRallyPoint(
    newRallyName.value,
    newRallyPosition.value,
    newRallyPriority.value
  )

  // Update config
  rallyStore.updateRallyPoint(rallyPoint.id, {
    config: {
      landImmediately: newRallyLandImmediately.value,
      loiterRadius: newRallyLoiterRadius.value,
      loiterAltitude: newRallyPosition.value.alt + 10,
      approachAltitude: newRallyPosition.value.alt + 20
    }
  })

  renderRallyPoint(rallyPoint)

  // Remove temp marker
  if (tempMarker) {
    tempMarker.remove()
    tempMarker = null
  }

  showCreateDialog.value = false
  success(`Rally point "${newRallyName.value}" created`)
}

function cancelCreatingRallyPoint() {
  stopPlacingRallyPoint()
  if (tempMarker) {
    tempMarker.remove()
    tempMarker = null
  }
  showCreateDialog.value = false
  newRallyPosition.value = null
}

// Rally point actions
function toggleRallyPoint(id: string) {
  rallyStore.toggleRallyPoint(id)
  renderAllRallyPoints()
}

function setPrimary(id: string) {
  rallyStore.setPrimary(id)
  renderAllRallyPoints()
  success('Primary rally point updated')
}

async function deleteRallyPoint(id: string) {
  const rallyPoint = rallyStore.rallyPoints.find(r => r.id === id)
  if (!rallyPoint) return

  const confirmed = await dialog.confirm(
    `Are you sure you want to delete "${rallyPoint.name}"?`,
    'Delete Rally Point'
  )
  if (!confirmed) return

  const marker = rallyMarkers.value.get(id)
  if (marker) {
    marker.remove()
    rallyMarkers.value.delete(id)
  }

  rallyStore.deleteRallyPoint(id)
  selectedRallyPoint.value = null
  success('Rally point deleted')
}

function zoomToRallyPoint(rallyPoint: RallyPoint) {
  if (!map.value) return
  setView([rallyPoint.position.lat, rallyPoint.position.lng], 17)
}

// Return to Rally
function initiateReturnToRally() {
  showReturnDialog.value = true
  selectedReturnRallyId.value = rallyStore.primaryRallyPoint?.id
  returnReason.value = 'manual'
}

function confirmReturnToRally() {
  const usage = rallyStore.returnToRally({
    rallyPointId: selectedReturnRallyId.value,
    reason: returnReason.value
  })

  if (usage) {
    const rallyPoint = rallyStore.rallyPoints.find(r => r.id === usage.rallyPointId)
    success(`Returning to ${rallyPoint?.name || 'rally point'}`)
    renderAllRallyPoints()
    showReturnDialog.value = false

    // Zoom to rally point
    if (rallyPoint) {
      zoomToRallyPoint(rallyPoint)
    }
  } else {
    notifyError('Failed to initiate return to rally point')
  }
}

async function cancelActiveReturn() {
  if (!rallyStore.activeReturn) return

  const confirmed = await dialog.confirm(
    'Cancel active return to rally point?',
    'Cancel Return'
  )
  if (!confirmed) return

  rallyStore.cancelReturn(rallyStore.activeReturn.id)
  renderAllRallyPoints()
  success('Return cancelled')
}

function completeActiveReturn() {
  if (!rallyStore.activeReturn) return

  rallyStore.completeReturn(rallyStore.activeReturn.id)
  renderAllRallyPoints()
  success('Return completed')
}
</script>

<template>
  <div class="rally-manager">
    <!-- Header Actions -->
    <div class="manager-header">
      <div class="header-actions">
        <Button
          v-if="rallyStore.activeRallyPoints.length > 0"
          variant="primary"
          @click="initiateReturnToRally"
          :disabled="!!rallyStore.activeReturn"
        >
          <span class="icon">🏁</span>
          Return to Rally
        </Button>
        <Button variant="primary" @click="startCreatingRallyPoint">
          <span class="icon">+</span>
          New Rally Point
        </Button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <Card>
        <div class="stat-card">
          <div class="stat-icon">📍</div>
          <div class="stat-content">
            <div class="stat-label">Total Rally Points</div>
            <div class="stat-value">{{ stats.totalRallyPoints }}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-label">Active Rally Points</div>
            <div class="stat-value">{{ stats.activeRallyPoints }}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-content">
            <div class="stat-label">Primary Rally Point</div>
            <div class="stat-value stat-small">
              {{ stats.primaryRallyPoint?.name || 'None Set' }}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-icon">🔄</div>
          <div class="stat-content">
            <div class="stat-label">Total Returns</div>
            <div class="stat-value">{{ stats.totalUsages }}</div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Active Return Alert -->
    <Card v-if="rallyStore.activeReturn" class="active-return-alert">
      <div class="alert-content">
        <div class="alert-icon">🏁</div>
        <div class="alert-info">
          <strong>Returning to Rally Point</strong>
          <div class="alert-details">
            Target: {{ rallyStore.activeReturn.rallyPointName }} •
            Reason: {{ rallyStore.activeReturn.reason }}
          </div>
        </div>
        <div class="alert-actions">
          <Button variant="secondary" size="sm" @click="completeActiveReturn">
            Complete
          </Button>
          <Button variant="danger" size="sm" @click="cancelActiveReturn">
            Cancel
          </Button>
        </div>
      </div>
    </Card>

    <!-- Main Content -->
    <div class="content-grid">
      <!-- Map -->
      <Card class="map-card">
        <div class="card-header">
          <h2>Rally Points Map</h2>
        </div>
        <div id="rally-map" class="rally-map"></div>
      </Card>

      <!-- Rally Point List -->
      <Card class="list-card">
        <div class="card-header">
          <h2>Rally Points</h2>
        </div>

        <div class="rally-list">
          <div
            v-for="rallyPoint in rallyStore.sortedRallyPoints"
            :key="rallyPoint.id"
            class="rally-item"
            :class="{
              selected: selectedRallyPoint?.id === rallyPoint.id,
              'in-use': rallyPoint.status === 'in-use',
              primary: rallyPoint.priority === 'primary'
            }"
            @click="selectedRallyPoint = rallyPoint"
          >
            <div class="rally-icon" :style="{ background: rallyPoint.color }">
              {{ rallyPoint.priority === 'primary' ? '⭐' : rallyPoint.priority === 'secondary' ? '🏁' : '📍' }}
            </div>
            <div class="rally-info">
              <div class="rally-name">{{ rallyPoint.name }}</div>
              <div class="rally-meta">
                {{ rallyPoint.priority }}
                <span class="status-badge" :class="rallyPoint.status">
                  {{ rallyPoint.status }}
                </span>
              </div>
              <div v-if="rallyPoint.stats && rallyPoint.stats.timesUsed > 0" class="rally-stats">
                Used {{ rallyPoint.stats.timesUsed }} times
              </div>
            </div>
            <div class="rally-actions">
              <button
                v-if="rallyPoint.priority !== 'primary'"
                class="action-btn"
                @click.stop="setPrimary(rallyPoint.id)"
                title="Set as primary"
              >
                ⭐
              </button>
              <button
                class="action-btn"
                :class="{ active: rallyPoint.enabled }"
                @click.stop="toggleRallyPoint(rallyPoint.id)"
                :title="rallyPoint.enabled ? 'Disable' : 'Enable'"
              >
                {{ rallyPoint.enabled ? '✓' : '○' }}
              </button>
              <button
                class="action-btn"
                @click.stop="zoomToRallyPoint(rallyPoint)"
                title="Zoom to rally point"
              >
                🔍
              </button>
              <button
                class="action-btn danger"
                @click.stop="deleteRallyPoint(rallyPoint.id)"
                title="Delete"
              >
                ×
              </button>
            </div>
          </div>

          <div v-if="rallyStore.rallyPoints.length === 0" class="empty-state">
            <p>No rally points created yet</p>
            <Button variant="primary" size="sm" @click="startCreatingRallyPoint">
              Create First Rally Point
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Create Rally Point Dialog -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="cancelCreatingRallyPoint">
      <Card class="dialog">
        <div class="dialog-header">
          <h2>Create New Rally Point</h2>
          <button class="close-btn" @click="cancelCreatingRallyPoint">×</button>
        </div>

        <div class="dialog-content">
          <div class="form-group">
            <label>Rally Point Name</label>
            <input
              v-model="newRallyName"
              type="text"
              placeholder="e.g., Home Base, Charging Station"
              class="input"
            />
          </div>

          <div class="form-group">
            <label>Priority</label>
            <select v-model="newRallyPriority" class="select">
              <option
                v-for="option in priorityOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }} - {{ option.description }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Position</label>
            <div v-if="!newRallyPosition" class="position-placeholder">
              <Button variant="secondary" @click="startPlacingRallyPoint" :disabled="placingRallyPoint">
                {{ placingRallyPoint ? 'Click on map...' : 'Place on Map' }}
              </Button>
            </div>
            <div v-else class="position-display">
              <div>
                Lat: {{ newRallyPosition.lat.toFixed(6) }},
                Lng: {{ newRallyPosition.lng.toFixed(6) }},
                Alt: {{ newRallyPosition.alt }}m
              </div>
              <button class="text-btn" @click="newRallyPosition = null">Change</button>
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="newRallyLandImmediately" />
              <span>Land immediately upon arrival</span>
            </label>
          </div>

          <div v-if="!newRallyLandImmediately" class="form-group">
            <label>Loiter Radius (meters)</label>
            <input
              v-model.number="newRallyLoiterRadius"
              type="number"
              min="10"
              step="5"
              class="input"
            />
          </div>

          <div class="dialog-actions">
            <Button variant="secondary" @click="cancelCreatingRallyPoint">Cancel</Button>
            <Button variant="primary" :disabled="!canSaveRallyPoint" @click="saveRallyPoint">
              Save Rally Point
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Return to Rally Dialog -->
    <div v-if="showReturnDialog" class="dialog-overlay" @click.self="showReturnDialog = false">
      <Card class="dialog">
        <div class="dialog-header">
          <h2>Return to Rally Point</h2>
          <button class="close-btn" @click="showReturnDialog = false">×</button>
        </div>

        <div class="dialog-content">
          <div class="form-group">
            <label>Select Rally Point</label>
            <select v-model="selectedReturnRallyId" class="select">
              <option :value="undefined">Auto-select nearest</option>
              <option
                v-for="rallyPoint in rallyStore.activeRallyPoints"
                :key="rallyPoint.id"
                :value="rallyPoint.id"
              >
                {{ rallyPoint.name }} ({{ rallyPoint.priority }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Reason for Return</label>
            <div class="reason-grid">
              <button
                v-for="reason in returnReasons"
                :key="reason.value"
                class="reason-btn"
                :class="{ active: returnReason === reason.value }"
                @click="returnReason = reason.value as any"
              >
                <span class="reason-icon">{{ reason.icon }}</span>
                <span class="reason-label">{{ reason.label }}</span>
              </button>
            </div>
          </div>

          <div class="dialog-actions">
            <Button variant="secondary" @click="showReturnDialog = false">Cancel</Button>
            <Button variant="primary" @click="confirmReturnToRally">
              Initiate Return
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.rally-manager {
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
}

.active-return-alert {
  background: rgba(59, 130, 246, 0.1);
  border-left: 4px solid #3b82f6;
}

.alert-content {
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.alert-icon {
  font-size: 2rem;
}

.alert-info {
  flex: 1;

  strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
}

.alert-details {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.alert-actions {
  display: flex;
  gap: 0.5rem;
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

.rally-map {
  width: 100%;
  height: 500px;
  background: var(--bg-secondary);
}

.rally-list {
  max-height: 500px;
  overflow-y: auto;
}

.rally-item {
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

  &.primary {
    border-left: 3px solid #10b981;
  }

  &.in-use {
    background: rgba(59, 130, 246, 0.1);
  }
}

.rally-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: white;
}

.rally-info {
  flex: 1;
  min-width: 0;
}

.rally-name {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.rally-meta {
  font-size: 0.813rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: capitalize;
}

.rally-stats {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
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

  &.in-use {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }
}

.rally-actions {
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
}

.position-placeholder {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 6px;
  text-align: center;
}

.position-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.875rem;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 0.875rem;
}

.text-btn {
  background: none;
  border: none;
  color: $primary;
  cursor: pointer;
  font-size: 0.875rem;

  &:hover {
    text-decoration: underline;
  }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
}

.reason-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.reason-btn {
  padding: 0.875rem;
  border: 2px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    border-color: $primary;
    background: var(--bg-hover);
  }

  &.active {
    border-color: $primary;
    background: rgba(44, 95, 45, 0.1);
  }
}

.reason-icon {
  font-size: 1.5rem;
}

.reason-label {
  font-size: 0.813rem;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.icon {
  margin-right: 0.5rem;
}

:deep(.rally-marker),
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
