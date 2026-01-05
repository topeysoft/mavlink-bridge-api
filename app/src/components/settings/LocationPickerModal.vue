<template>
  <Modal v-model="isOpen" size="lg">
    <ModalHeader @close="handleClose">
      {{ title }}
    </ModalHeader>

    <ModalBody no-padding>
      <div class="location-picker-layout">
        <!-- Search and Controls -->
        <div class="controls-panel">
          <div class="search-section">
            <label for="addressSearch">Search Address</label>
            <div class="search-input-group">
              <input
                id="addressSearch"
                v-model="searchQuery"
                type="text"
                class="form-input"
                placeholder="Enter address..."
                @keyup.enter="handleSearch"
              />
              <button class="btn btn-primary" @click="handleSearch" :disabled="isSearching">
                {{ isSearching ? 'Searching...' : 'Search' }}
              </button>
            </div>

            <!-- Search Results -->
            <div v-if="searchResults.length > 0" class="search-results">
              <div class="results-label">Search Results:</div>
              <div
                v-for="(result, index) in searchResults"
                :key="index"
                class="result-item"
                @click="handleSelectResult(result)"
              >
                <div class="result-name">{{ result.name }}</div>
                <div class="result-address">{{ result.address }}</div>
              </div>
            </div>
          </div>

          <div class="divider">OR</div>

          <div class="current-location-section">
            <button
              class="btn btn-secondary btn-block"
              @click="handleUseCurrentLocation"
              :disabled="isGettingLocation"
            >
              <span class="btn-icon">📍</span>
              {{ isGettingLocation ? 'Getting Location...' : 'Use My Current Location' }}
            </button>
          </div>

          <div class="divider">OR</div>

          <div class="manual-input-section">
            <label>Click on Map to Select Location</label>
            <p class="help-text">Click anywhere on the map to set the home location</p>
          </div>

          <!-- Selected Location Info -->
          <div v-if="selectedLocation" class="selected-location-info">
            <h3>Selected Location</h3>
            <div class="info-row">
              <span class="info-label">Coordinates:</span>
              <span class="info-value">{{ formatCoords(selectedLocation.lat, selectedLocation.lng) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Address:</span>
              <span class="info-value">{{ selectedLocation.address || 'Loading...' }}</span>
            </div>
            <div v-if="selectedLocation.accuracy" class="info-row">
              <span class="info-label">Accuracy:</span>
              <span class="info-value">{{ selectedLocation.accuracy.toFixed(0) }}m</span>
            </div>
          </div>
        </div>

        <!-- Map Container -->
        <div class="map-wrapper">
          <div id="locationPickerMap" class="location-map"></div>
        </div>
      </div>
    </ModalBody>

    <ModalActions align="space-between">
      <button class="btn btn-secondary" @click="handleClose">
        Cancel
      </button>
      <button
        class="btn btn-primary"
        @click="handleSave"
        :disabled="!selectedLocation"
      >
        Set Home Location
      </button>
    </ModalActions>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Modal from '@/components/common/Modal.vue'
import ModalHeader from '@/components/common/ModalHeader.vue'
import ModalBody from '@/components/common/ModalBody.vue'
import ModalActions from '@/components/common/ModalActions.vue'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { geocodeAddress, reverseGeocode, getCurrentPosition, formatCoordinates } from '@/utils/geocoding'
import { useThemeStore } from '@/stores/theme'
import { useDialog } from '@/composables/useDialog'
import L from 'leaflet'

interface Props {
  modelValue: boolean
  title?: string
  initialLocation?: { lat: number; lng: number }
}

interface LocationData {
  lat: number
  lng: number
  address: string
  accuracy?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Set Home Location'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', location: LocationData): void
}>()

const themeStore = useThemeStore()
const dialog = useDialog()

// Dialog state
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Search state
const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref<Array<{ lat: number; lng: number; name: string; address: string }>>([])

// Location state
const isGettingLocation = ref(false)
const selectedLocation = ref<LocationData | null>(null)
let marker: L.Marker | null = null

// Map
const { map, initializeMap, updateTheme, invalidateSize } = useLeafletMap(
  'locationPickerMap',
  {
    center: props.initialLocation ? [props.initialLocation.lat, props.initialLocation.lng] : [40.7128, -74.006],
    zoom: props.initialLocation ? 16 : 13,
    theme: themeStore.theme
  }
)

// Watch for dialog open/close
watch(isOpen, async (newValue) => {
  if (newValue) {
    await nextTick()
    initializeMap()
    await nextTick()
    invalidateSize()
    setupMapClick()

    // If initial location provided, set it
    if (props.initialLocation) {
      await handleLocationSelected(props.initialLocation.lat, props.initialLocation.lng)
    }
  }
})

// Watch theme changes
watch(() => themeStore.theme, (newTheme) => {
  updateTheme(newTheme)
})

// Setup map click handler
const setupMapClick = () => {
  if (!map.value) return

  map.value.on('click', async (e: L.LeafletMouseEvent) => {
    await handleLocationSelected(e.latlng.lat, e.latlng.lng)
  })
}

// Handle location selected (from any source)
const handleLocationSelected = async (lat: number, lng: number, accuracy?: number) => {
  if (!map.value) return

  // Remove existing marker
  if (marker) {
    map.value.removeLayer(marker)
  }

  // Add new marker
  marker = L.marker([lat, lng], {
    draggable: true
  }).addTo(map.value)

  // Handle marker drag
  marker.on('dragend', async () => {
    if (!marker) return
    const pos = marker.getLatLng()
    await handleLocationSelected(pos.lat, pos.lng)
  })

  // Center map on location
  map.value.setView([lat, lng], 16)

  // Get address via reverse geocoding
  const address = await reverseGeocode(lat, lng)

  selectedLocation.value = {
    lat,
    lng,
    address,
    accuracy
  }
}

// Handle address search
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return

  isSearching.value = true
  searchResults.value = []

  try {
    const results = await geocodeAddress(searchQuery.value, 5)
    searchResults.value = results
  } catch (error) {
    console.error('Search error:', error)
  } finally {
    isSearching.value = false
  }
}

// Handle search result selection
const handleSelectResult = async (result: { lat: number; lng: number; address: string }) => {
  searchResults.value = []
  searchQuery.value = ''
  await handleLocationSelected(result.lat, result.lng)
}

// Handle use current location
const handleUseCurrentLocation = async () => {
  isGettingLocation.value = true

  try {
    const position = await getCurrentPosition()
    await handleLocationSelected(position.lat, position.lng, position.accuracy)
  } catch (error) {
    await dialog.alert(
      (error as Error).message || 'Unable to get your location',
      'Location Error',
      { variant: 'error' }
    )
  } finally {
    isGettingLocation.value = false
  }
}

// Format coordinates
const formatCoords = (lat: number, lng: number) => {
  return formatCoordinates(lat, lng)
}

// Handlers
const handleClose = () => {
  selectedLocation.value = null
  searchResults.value = []
  searchQuery.value = ''
  if (marker && map.value) {
    map.value.removeLayer(marker)
    marker = null
  }
  isOpen.value = false
}

const handleSave = () => {
  if (!selectedLocation.value) return

  emit('save', selectedLocation.value)
  handleClose()
}
</script>

<style scoped lang="scss">
.location-picker-layout {
  display: flex;
  height: 600px;
}

.controls-panel {
  width: 350px;
  padding: var(--spacing-lg);
  overflow-y: auto;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.search-section {
  label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: 500;
    margin-bottom: var(--spacing-xs);
    color: var(--text-secondary);
  }
}

.search-input-group {
  display: flex;
  gap: var(--spacing-xs);
}

.form-input {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);

  &:focus {
    outline: 2px solid var(--primary-green);
    outline-offset: 0;
  }
}

.search-results {
  margin-top: var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  max-height: 200px;
  overflow-y: auto;
}

.results-label {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.result-item {
  padding: var(--spacing-sm);
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }

  &:last-child {
    border-bottom: none;
  }
}

.result-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.result-address {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-top: 2px;
}

.divider {
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  position: relative;
  margin: var(--spacing-sm) 0;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background: var(--border-color);
  }

  &::before {
    left: 0;
  }

  &::after {
    right: 0;
  }
}

.help-text {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-top: var(--spacing-xs);
}

.selected-location-info {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);

  h3 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    margin-bottom: var(--spacing-sm);
  }
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);

  .info-label {
    color: var(--text-secondary);
  }

  .info-value {
    color: var(--text-primary);
    font-weight: 500;
  }
}

.map-wrapper {
  flex: 1;
  position: relative;
}

.location-map {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
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

  &.btn-block {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
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

.btn-icon {
  font-size: 18px;
}
</style>
