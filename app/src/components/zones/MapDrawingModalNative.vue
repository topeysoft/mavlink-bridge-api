<template>
  <Modal
    v-model="isOpen"
    size="fullscreen"
    :persistent="hasChanges"
  >
    <ModalHeader @close="handleClose">
      {{ title }}
    </ModalHeader>

    <ModalBody no-padding>
      <div class="map-drawing-layout">
        <!-- Map Container -->
        <div class="map-wrapper">
          <div id="drawingMap" class="drawing-map"></div>
        </div>

        <!-- Sidebar -->
        <div class="sidebar-panel">
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
        </div>
      </div>
    </ModalBody>

    <ModalActions align="space-between">
      <button
        class="btn btn-danger-outline"
        @click="handleClearAll"
        :disabled="zones.length === 0"
      >
        Clear All
      </button>
      <div class="action-group">
        <button class="btn btn-secondary" @click="handleCancel">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="handleSave"
          :disabled="!isFormValid"
          :title="!isFormValid ? 'Please fill in all required fields and draw at least one zone' : ''"
        >
          {{ saveButtonText }}
        </button>
      </div>
    </ModalActions>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Modal from '@/components/common/Modal.vue'
import ModalHeader from '@/components/common/ModalHeader.vue'
import ModalBody from '@/components/common/ModalBody.vue'
import ModalActions from '@/components/common/ModalActions.vue'
import ValidatedInput from '@/components/common/ValidatedInput.vue'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useZoneDrawing } from '@/composables/useZoneDrawing'
import { formatArea, formatPerimeter } from '@/utils/geoCalculations'
import { useThemeStore } from '@/stores/theme'
import { useLocationStore } from '@/stores/location'
import { useDialog } from '@/composables/useDialog'
import { getCurrentPosition } from '@/utils/geocoding'

interface Props {
  modelValue: boolean
  title?: string
  saveButtonText?: string
  editingZone?: any
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Create New Zone',
  saveButtonText: 'Save Zone'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', data: any): void
  (e: 'cancel'): void
}>()

const themeStore = useThemeStore()
const locationStore = useLocationStore()
const dialog = useDialog()

// Dialog state
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Map initial center
const mapCenter = ref<[number, number]>([40.7128, -74.006])

// Form data
const zoneName = ref('')
const zoneType = ref('mowing')
const zoneDescription = ref('')
const zoneColor = ref('#2C5F2D')

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
  'drawingMap',
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

// Watch for dialog open/close
watch(isOpen, async (newValue) => {
  if (newValue) {
    // Determine initial map center based on priority:
    // 1. If editing zone with geometry - will fit bounds after loading
    // 2. Saved home location
    // 3. Current user position
    // 4. Default fallback
    let initialCenter: [number, number] = [40.7128, -74.006]

    // Check if editing zone (we'll fit bounds after load, but try to get a good initial center)
    if (props.editingZone?.geometry) {
      const bounds = getBoundsFromGeoJSON(props.editingZone.geometry)
      if (bounds) {
        const center = bounds.getCenter()
        initialCenter = [center.lat, center.lng]
      }
    }
    // Otherwise use home location if set
    else if (locationStore.hasHomeLocation && locationStore.homeCoordinates) {
      initialCenter = [locationStore.homeCoordinates.lat, locationStore.homeCoordinates.lng]
    }
    // Try current position
    else {
      try {
        const position = await getCurrentPosition({ timeout: 3000, maximumAge: 300000 })
        initialCenter = [position.lat, position.lng]
      } catch (error) {
        // Silently fall back to default - user may have denied permission
        console.log('Could not get current position, using default center')
      }
    }

    mapCenter.value = initialCenter

    await nextTick()
    initializeMap(initialCenter)
    await nextTick()
    invalidateSize()
    initializeDrawing()

    // Load editing zone if provided
    if (props.editingZone) {
      zoneName.value = props.editingZone.name || ''
      zoneType.value = props.editingZone.type || 'mowing'
      zoneDescription.value = props.editingZone.description || ''
      zoneColor.value = props.editingZone.color || '#2C5F2D'

      // Wait for map to fully render before loading geometry
      if (props.editingZone.geometry) {
        await nextTick()
        // Additional delay to ensure map tiles are loaded
        setTimeout(() => {
          loadGeoJSON(props.editingZone.geometry)
          // Fit bounds to show the entire zone
          const bounds = getBoundsFromGeoJSON(props.editingZone.geometry)
          if (bounds && map.value) {
            map.value.fitBounds(bounds, { padding: [50, 50] })
          }
        }, 300)
      }
    }
  }
})

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
      resetForm()
      isOpen.value = false
      emit('cancel')
    }
  } else {
    resetForm()
    isOpen.value = false
    emit('cancel')
  }
}

const handleClose = () => {
  handleCancel()
}

const handleSave = () => {
  if (zones.value.length === 0 || !zoneName.value.trim()) {
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

  emit('save', zoneData)
  resetForm()
  isOpen.value = false
}

const resetForm = () => {
  zoneName.value = ''
  zoneType.value = 'mowing'
  zoneDescription.value = ''
  zoneColor.value = '#2C5F2D'
  clearAll()
}
</script>

<style scoped lang="scss">
.map-drawing-layout {
  display: flex;
  height: calc(100vh - 140px);
  overflow: hidden;
}

.map-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.drawing-map {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
}

.sidebar-panel {
  width: 350px;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
  padding: var(--spacing-lg);
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
  border-radius: var(--border-radius);
  background: var(--bg-secondary);
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
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
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
  border-radius: var(--border-radius);
  font-size: 16px;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.action-group {
  display: flex;
  gap: var(--spacing-sm);
}

.btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--border-radius);
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
    background: var(--bg-secondary);
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
</style>
