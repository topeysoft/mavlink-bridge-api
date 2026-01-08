<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useZonesStore } from '@/stores/zones'
import { useThemeStore } from '@/stores/theme'
import { useLocationStore } from '@/stores/location'
import { useNotifications } from '@/composables/useNotifications'
import { useDialog } from '@/composables/useDialog'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useZoneDrawing } from '@/composables/useZoneDrawing'
import { formatArea, formatPerimeter } from '@/utils/geoCalculations'
import { getCurrentPosition } from '@/utils/geocoding'
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import ValidatedInput from '@/components/common/ValidatedInput.vue'

const router = useRouter()
const route = useRoute()
const zonesStore = useZonesStore()
const themeStore = useThemeStore()
const locationStore = useLocationStore()
const { success, error } = useNotifications()
const dialog = useDialog()

// Get zone ID from route for editing
const zoneId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => !!zoneId.value)

// Breadcrumbs
const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Zones', to: '/zones' },
  { label: isEditMode.value ? 'Edit Zone' : 'Create Zone' }
])

// Form data
const zoneName = ref('')
const zoneType = ref('mowing')
const zoneDescription = ref('')
const zoneColor = ref('#2C5F2D')

// Map initial center
const mapCenter = ref<[number, number]>([40.7128, -74.006])

// Track changes for unsaved warning
const hasChanges = computed(() => {
  return zones.value.length > 0 || zoneName.value.trim() !== ''
})

// Form validation
const isFormValid = computed(() => {
  return zoneName.value.trim().length >= 3 &&
         zoneName.value.trim().length <= 50 &&
         zones.value.length > 0
})

// Map and drawing
const { map, initializeMap, updateTheme, invalidateSize } = useLeafletMap(
  'zoneEditorMap',
  {
    center: [40.7128, -74.006],
    zoom: 18,
    theme: themeStore.theme
  }
)

const {
  zones,
  totalArea,
  totalPerimeter,
  zoneCount,
  initializeDrawing,
  loadGeoJSON,
  getBoundsFromGeoJSON,
  exportGeoJSON,
  clearAll,
  zoomToZone
} = useZoneDrawing(map)

// Initialize map and load data
const initializeEditor = async () => {
  // Determine initial map center
  let initialCenter: [number, number] = [40.7128, -74.006]

  // If editing existing zone
  if (isEditMode.value) {
    const existingZone = zonesStore.getZoneById(zoneId.value!)
    if (existingZone && (existingZone as any).geometry) {
      const bounds = getBoundsFromGeoJSON((existingZone as any).geometry)
      if (bounds) {
        const center = bounds.getCenter()
        initialCenter = [center.lat, center.lng]
      }
    }
  }
  // Use home location if set
  else if (locationStore.hasHomeLocation && locationStore.homeCoordinates) {
    initialCenter = [locationStore.homeCoordinates.lat, locationStore.homeCoordinates.lng]
  }
  // Try current position
  else {
    try {
      const position = await getCurrentPosition({ timeout: 3000, maximumAge: 300000 })
      initialCenter = [position.lat, position.lng]
    } catch (err) {
      console.log('Could not get current position, using default center')
    }
  }

  mapCenter.value = initialCenter

  await nextTick()
  initializeMap(initialCenter)
  await nextTick()
  invalidateSize()
  initializeDrawing()

  // Load existing zone data if editing
  if (isEditMode.value) {
    const existingZone = zonesStore.getZoneById(zoneId.value!)
    if (existingZone) {
      zoneName.value = existingZone.name || ''
      zoneType.value = existingZone.type || 'mowing'
      zoneDescription.value = existingZone.description || ''
      zoneColor.value = existingZone.color || '#2C5F2D'

      // Load geometry
      if ((existingZone as any).geometry) {
        await nextTick()
        setTimeout(() => {
          loadGeoJSON((existingZone as any).geometry)
          const bounds = getBoundsFromGeoJSON((existingZone as any).geometry)
          if (bounds && map.value) {
            map.value.fitBounds(bounds, { padding: [50, 50] })
          }
        }, 300)
      }
    } else {
      error('Zone not found')
      router.push('/zones')
    }
  }
}

// Watch theme changes
watch(() => themeStore.theme, (newTheme) => {
  updateTheme(newTheme)
})

// Handlers
const handleZoomToZone = (index: number) => {
  zoomToZone(index)
}

const handleClearAll = async () => {
  const confirmed = await dialog.confirm({
    title: 'Clear All Zones',
    message: 'Clear all drawn zones?',
    confirmText: 'Clear All',
    cancelText: 'Cancel'
  })

  if (confirmed) {
    clearAll()
  }
}

const handleCancel = async () => {
  if (hasChanges.value) {
    const confirmed = await dialog.confirm({
      title: 'Discard Changes',
      message: 'Discard changes to coverage area?',
      confirmText: 'Discard',
      cancelText: 'Keep Editing'
    })

    if (confirmed) {
      router.push('/zones')
    }
  } else {
    router.push('/zones')
  }
}

const handleSave = async () => {
  if (!isFormValid.value) {
    error('Please fill in all required fields and draw at least one zone')
    return
  }

  const geometry = exportGeoJSON()

  const zoneData = {
    name: zoneName.value.trim(),
    type: zoneType.value,
    description: zoneDescription.value.trim(),
    geometry,
    area: totalArea.value,
    perimeter: totalPerimeter.value,
    color: zoneColor.value
  }

  try {
    if (isEditMode.value) {
      await zonesStore.updateZone(zoneId.value!, zoneData)
      success(`Zone "${zoneData.name}" updated successfully`)
    } else {
      const newZone = {
        ...zoneData,
        id: `zone_${Date.now()}`,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
      await zonesStore.addZone(newZone as any)
      success(`Zone "${zoneData.name}" created successfully`)
    }
    router.push('/zones')
  } catch (err) {
    error(`Failed to ${isEditMode.value ? 'update' : 'create'} zone`)
  }
}

onMounted(() => {
  initializeEditor()
})
</script>

<template>
  <div class="zone-editor-view">
    <Breadcrumb :items="breadcrumbItems" />

    <div class="zone-editor-container">
      <!-- Header -->
      <div class="zone-editor-header">
        <h1 class="editor-title">{{ isEditMode ? 'Edit Zone' : 'Create Zone' }}</h1>
        <div class="editor-actions">
          <button class="btn btn-secondary" @click="handleCancel">
            Cancel
          </button>
          <button
            class="btn btn-primary"
            @click="handleSave"
            :disabled="!isFormValid"
            :title="!isFormValid ? 'Please fill in all required fields and draw at least one zone' : ''"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            {{ isEditMode ? 'Update Zone' : 'Save Zone' }}
          </button>
        </div>
      </div>

      <!-- Editor Content -->
      <div class="zone-editor-content">
        <!-- Map -->
        <div class="map-section">
          <div id="zoneEditorMap" class="editor-map"></div>
        </div>

        <!-- Sidebar -->
        <div class="sidebar-section">
          <!-- Zone Info Form -->
          <div class="form-section">
            <h3>Zone Information</h3>

            <div class="form-group">
              <ValidatedInput
                v-model="zoneName"
                label="Zone Name"
                placeholder="Enter zone name"
                :required="true"
                :min-length="3"
                :max-length="50"
                :validate-on-input="true"
                helper-text="Must be 3-50 characters"
              />
            </div>

            <div class="form-group">
              <label for="zoneType">Zone Type</label>
              <select id="zoneType" v-model="zoneType" class="form-input">
                <option value="mowing">Mowing</option>
                <option value="patrol">Patrol</option>
                <option value="exclusion">Exclusion</option>
                <option value="parking">Parking</option>
                <option value="garden">Garden</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div class="form-group">
              <label for="zoneDescription">Description</label>
              <textarea
                id="zoneDescription"
                v-model="zoneDescription"
                class="form-input"
                rows="3"
                maxlength="200"
                placeholder="Optional description..."
              ></textarea>
            </div>

            <div class="form-group">
              <label for="zoneColor">Zone Color</label>
              <input
                id="zoneColor"
                v-model="zoneColor"
                type="color"
                class="form-input color-input"
              />
            </div>
          </div>

          <!-- Statistics -->
          <div class="stats-section">
            <h3>Statistics</h3>
            <div class="stat-row">
              <span class="stat-label">Total Area:</span>
              <span class="stat-value">{{ formatArea(totalArea) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Perimeter:</span>
              <span class="stat-value">{{ formatPerimeter(totalPerimeter) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Zones:</span>
              <span class="stat-value">{{ zoneCount }}</span>
            </div>
          </div>

          <!-- Zone List -->
          <div class="zones-list-section">
            <h3>Drawn Zones</h3>
            <div v-if="zones.length === 0" class="empty-state">
              <p>No zones drawn yet. Use the tools on the map to draw coverage areas.</p>
            </div>
            <div v-else class="zone-list">
              <div
                v-for="zone in zones"
                :key="zone.index"
                class="zone-item"
              >
                <div class="zone-info">
                  <div class="zone-title">Zone {{ zone.index }} ({{ zone.type }})</div>
                  <div class="zone-meta">
                    {{ zone.area > 0 ? zone.area.toFixed(3) + ' acres' : 'Path/Marker' }}
                  </div>
                </div>
                <button
                  class="btn-icon-small"
                  @click="handleZoomToZone(zone.index)"
                  title="Zoom to zone"
                >
                  🔍
                </button>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="sidebar-actions">
            <button
              class="btn btn-danger-outline btn-block"
              @click="handleClearAll"
              :disabled="zones.length === 0"
            >
              Clear All Zones
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.zone-editor-view {
  min-height: 100vh;
  padding: var(--spacing-xl);
  background: var(--bg-primary);
}

.zone-editor-container {
  max-width: 1600px;
  margin: 0 auto;
}

.zone-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);

  .editor-title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--text-primary);
  }

  .editor-actions {
    display: flex;
    gap: var(--spacing-md);
  }

  .btn svg {
    width: 18px;
    height: 18px;
    margin-right: 8px;
  }
}

.zone-editor-content {
  display: flex;
  gap: var(--spacing-lg);
  height: calc(100vh - 200px);
}

.map-section {
  flex: 1;
  min-width: 0;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
}

.editor-map {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
}

.sidebar-section {
  width: 380px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-section,
.stats-section,
.zones-list-section {
  h3 {
    font-size: var(--font-size-md);
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    color: var(--text-primary);
  }
}

.form-group {
  margin-bottom: var(--spacing-md);

  label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: 500;
    margin-bottom: var(--spacing-xs);
    color: var(--text-secondary);
  }
}

.form-input {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family);

  &:focus {
    outline: 2px solid var(--primary-green);
    outline-offset: 0;
  }

  &.color-input {
    height: 40px;
    padding: 4px;
    cursor: pointer;
  }
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);

  .stat-label {
    color: var(--text-secondary);
  }

  .stat-value {
    font-weight: 600;
    color: var(--primary-green);
  }
}

.empty-state {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.zone-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.zone-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.zone-info {
  flex: 1;
}

.zone-title {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.zone-meta {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-top: 2px;
}

.btn-icon-small {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--radius-md);
  font-size: 16px;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.sidebar-actions {
  margin-top: auto;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-block {
  width: 100%;
}

.btn-primary {
  background: var(--primary-green);
  color: white;

  &:hover:not(:disabled) {
    background: var(--primary-green-dark, #245a25);
  }
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: var(--bg-primary);
  }
}

.btn-danger-outline {
  background: transparent;
  color: var(--status-danger);
  border: 2px solid var(--status-danger);

  &:hover:not(:disabled) {
    background: var(--status-danger);
    color: white;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

// Responsive
@media (max-width: 1024px) {
  .zone-editor-content {
    flex-direction: column;
    height: auto;
  }

  .map-section {
    height: 500px;
  }

  .sidebar-section {
    width: 100%;
  }
}
</style>
