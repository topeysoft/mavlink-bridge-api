<template>
  <q-dialog
    v-model="isOpen"
    full-width
    full-height
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @hide="handleClose"
  >
    <q-card class="map-drawing-modal">
      <!-- Header -->
      <q-card-section class="modal-header row items-center q-pb-none">
        <div class="text-h6">{{ title }}</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup aria-label="Close map drawing" />
      </q-card-section>

      <!-- Main Content -->
      <q-card-section class="modal-body row no-wrap" style="height: calc(100vh - 140px)">
        <!-- Map Container -->
        <div class="col map-wrapper">
          <div id="drawingMap" class="drawing-map"></div>

          <!-- Real-time Area Tooltip -->
          <div v-if="currentDrawingArea > 0" class="area-tooltip" :style="tooltipStyle">
            {{ currentDrawingArea.toFixed(3) }} acres
          </div>
        </div>

        <!-- Sidebar -->
        <div class="sidebar-panel">
          <!-- Zone Metadata Form -->
          <q-card flat bordered class="metadata-card q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-md">Zone Information</div>

              <q-input
                v-model="zoneName"
                label="Zone Name *"
                outlined
                dense
                :rules="[val => !!val || 'Name is required']"
                class="q-mb-md"
              />

              <q-select
                v-model="zoneType"
                :options="zoneTypeOptions"
                label="Zone Type"
                outlined
                dense
                class="q-mb-md"
              />

              <q-input
                v-model="zoneDescription"
                label="Description"
                outlined
                dense
                type="textarea"
                rows="2"
                maxlength="200"
                counter
                class="q-mb-md"
              />

              <q-input
                v-model="zoneTags"
                label="Tags (comma-separated)"
                outlined
                dense
                class="q-mb-md"
              />

              <div class="row items-center q-mb-sm">
                <div class="col-auto text-caption">Zone Color</div>
                <q-space />
                <q-color
                  v-model="zoneColor"
                  default-value="#2C5F2D"
                  format-model="hex"
                  class="color-picker"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- Statistics -->
          <q-card flat bordered class="stats-card q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-md">Statistics</div>

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
            </q-card-section>
          </q-card>

          <!-- Zone List -->
          <q-card flat bordered class="zones-list-card">
            <q-card-section>
              <div class="text-subtitle2 q-mb-md">Drawn Zones</div>

              <div v-if="zones.length === 0" class="text-caption text-grey-6 text-center q-pa-md">
                No zones drawn yet. Use the tools on the map to draw coverage areas.
              </div>

              <q-list v-else separator>
                <q-item
                  v-for="zone in zones"
                  :key="zone.index"
                  dense
                  class="zone-item"
                >
                  <q-item-section>
                    <q-item-label>Zone {{ zone.index }} ({{ zone.type }})</q-item-label>
                    <q-item-label caption>
                      {{ zone.area > 0 ? zone.area.toFixed(3) + ' acres' : 'Path/Marker' }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn
                      icon="zoom_in"
                      flat
                      round
                      dense
                      size="sm"
                      @click="handleZoomToZone(zone.index)"
                      title="Zoom to zone"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="modal-actions">
        <q-btn
          label="Clear All"
          color="negative"
          outline
          @click="handleClearAll"
          :disable="zones.length === 0"
        />
        <q-space />
        <q-btn label="Cancel" outline @click="handleCancel" />
        <q-btn
          :label="saveButtonText"
          color="primary"
          @click="handleSave"
          :disable="zones.length === 0 || !zoneName"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useZoneDrawing } from '@/composables/useZoneDrawing'
import { formatArea, formatPerimeter } from '@/utils/geoCalculations'
import { useThemeStore } from '@/stores/theme'
import { useDialog } from '@/composables/useDialog'

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
const dialog = useDialog()

// Dialog state
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Form data
const zoneName = ref('')
const zoneType = ref('mowing')
const zoneDescription = ref('')
const zoneTags = ref('')
const zoneColor = ref('#2C5F2D')

const zoneTypeOptions = [
  { label: 'Mowing', value: 'mowing' },
  { label: 'Patrol', value: 'patrol' },
  { label: 'Exclusion', value: 'exclusion' },
  { label: 'Parking', value: 'parking' },
  { label: 'Garden', value: 'garden' },
  { label: 'Custom', value: 'custom' }
]

// Real-time drawing feedback
const currentDrawingArea = ref(0)
const tooltipStyle = ref({})

// Map and drawing
const { map, initializeMap, updateTheme, invalidateSize, setView } = useLeafletMap(
  'drawingMap',
  {
    center: [40.7128, -74.006],
    zoom: 18,
    theme: themeStore.currentTheme
  }
)

const {
  zones,
  totalArea,
  totalPerimeter,
  zoneCount,
  initializeDrawing,
  loadGeoJSON,
  exportGeoJSON,
  clearAll,
  zoomToZone,
  destroy: destroyDrawing
} = useZoneDrawing(map)

// Watch for dialog open/close
watch(isOpen, async (newValue) => {
  if (newValue) {
    await nextTick()
    initializeMap()
    await nextTick()
    invalidateSize()
    initializeDrawing()

    // Load editing zone if provided
    if (props.editingZone) {
      loadZoneForEditing()
    }
  }
})

// Watch theme changes
watch(() => themeStore.currentTheme, (newTheme) => {
  updateTheme(newTheme)
})

// Load zone for editing
const loadZoneForEditing = () => {
  if (!props.editingZone) return

  zoneName.value = props.editingZone.name || ''
  zoneType.value = props.editingZone.type || 'mowing'
  zoneDescription.value = props.editingZone.description || ''
  zoneTags.value = props.editingZone.tags?.join(', ') || ''
  zoneColor.value = props.editingZone.color || '#2C5F2D'

  if (props.editingZone.geometry) {
    loadGeoJSON(props.editingZone.geometry)
  }
}

// Handlers
const handleZoomToZone = (index: number) => {
  zoomToZone(index)
}

const handleClearAll = () => {
  clearAll()
}

const handleCancel = async () => {
  if (zones.value.length > 0) {
    const confirmed = await dialog.confirm(
      'Discard changes to coverage area?',
      'Cancel Zone Creation'
    )
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

const handleSave = () => {
  if (zones.value.length === 0) {
    return
  }

  if (!zoneName.value.trim()) {
    return
  }

  const geometry = exportGeoJSON()
  const tags = zoneTags.value
    .split(',')
    .map(t => t.trim())
    .filter(t => t)

  const zoneData = {
    name: zoneName.value.trim(),
    type: zoneType.value,
    description: zoneDescription.value.trim(),
    tags,
    geometry,
    area: totalArea.value,
    perimeter: totalPerimeter.value,
    color: zoneColor.value
  }

  emit('save', zoneData)
  resetForm()
  isOpen.value = false
}

const handleClose = () => {
  resetForm()
}

const resetForm = () => {
  zoneName.value = ''
  zoneType.value = 'mowing'
  zoneDescription.value = ''
  zoneTags.value = ''
  zoneColor.value = '#2C5F2D'
  clearAll()
}
</script>

<style scoped lang="scss">
.map-drawing-modal {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  border-bottom: 1px solid var(--q-separator-color);
  padding: 16px 24px;
}

.modal-body {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.map-wrapper {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.drawing-map {
  width: 100%;
  height: 100%;
  background: var(--q-dark-page);
}

.area-tooltip {
  position: fixed;
  background: var(--primary-green, #2C5F2D);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
  z-index: 10000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.sidebar-panel {
  width: 320px;
  padding: 16px;
  background: var(--q-card-background);
  border-left: 1px solid var(--q-separator-color);
  overflow-y: auto;
}

.metadata-card,
.stats-card,
.zones-list-card {
  :deep(.q-card__section) {
    padding: 12px;
  }
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;

  .stat-label {
    font-size: 13px;
    color: var(--q-text-secondary);
  }

  .stat-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--q-primary);
  }
}

.zone-item {
  border-radius: 4px;
  margin-bottom: 4px;

  &:hover {
    background: var(--q-hover-background);
  }
}

.modal-actions {
  border-top: 1px solid var(--q-separator-color);
  padding: 12px 24px;
}

.color-picker {
  width: 80px;
  height: 32px;
}

// Leaflet overrides
:deep(.leaflet-control-container) {
  .leaflet-top,
  .leaflet-bottom {
    z-index: 1000;
  }
}

:deep(.leaflet-draw-toolbar) {
  a {
    background-color: var(--q-card-background);
    border: 1px solid var(--q-separator-color);

    &:hover {
      background-color: var(--q-hover-background);
    }
  }
}
</style>
