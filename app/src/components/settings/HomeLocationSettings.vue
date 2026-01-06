<template>
  <div class="home-location-settings">
    <div class="settings-header">
      <h2>Home Location</h2>
      <p class="settings-description">
        Set the home location for your YardRover. This is where the rover will return when missions complete or battery is low.
      </p>
    </div>

    <!-- Current Location Display -->
    <div class="current-location-card">
      <div class="location-status">
        <div class="status-icon" :class="{ active: hasHomeLocation }">
          <svg v-if="hasHomeLocation" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div class="status-info">
          <div class="status-title">
            {{ hasHomeLocation ? 'Home Location Set' : 'No Home Location Set' }}
          </div>
          <div v-if="homeLocation" class="status-subtitle">
            Last updated {{ formatLastUpdated(homeLocation.lastUpdated) }}
          </div>
        </div>
      </div>

      <div v-if="homeLocation" class="location-details">
        <div class="detail-row">
          <span class="detail-label">Address:</span>
          <span class="detail-value">{{ formattedAddress }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Coordinates:</span>
          <span class="detail-value">{{ formattedCoordinates }}</span>
        </div>
        <div v-if="homeLocation.accuracy" class="detail-row">
          <span class="detail-label">Accuracy:</span>
          <span class="detail-value">{{ homeLocation.accuracy.toFixed(0) }} meters</span>
        </div>
      </div>

      <div v-else class="no-location-message">
        <p>No home location has been set yet. Set a home location to enable automatic return-to-home functionality.</p>
      </div>
    </div>

    <!-- Actions -->
    <div class="location-actions">
      <button class="btn btn-primary" @click="openLocationPicker">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        {{ hasHomeLocation ? 'Change Location' : 'Set Home Location' }}
      </button>

      <button
        v-if="hasHomeLocation"
        class="btn btn-danger-outline"
        @click="handleClearLocation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Clear Location
      </button>
    </div>

    <!-- Location Picker Modal -->
    <LocationPickerModal
      v-model="showLocationPicker"
      :initial-location="homeCoordinates || undefined"
      @save="handleSaveLocation"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLocationStore } from '@/stores/location'
import { useNotifications } from '@/composables/useNotifications'
import { useDialog } from '@/composables/useDialog'
import LocationPickerModal from './LocationPickerModal.vue'
import { formatDistance } from 'date-fns'

const locationStore = useLocationStore()
const { success, info } = useNotifications()
const dialog = useDialog()

const showLocationPicker = ref(false)

// Computed from store
const hasHomeLocation = computed(() => locationStore.hasHomeLocation)
const homeLocation = computed(() => locationStore.homeLocation)
const homeCoordinates = computed(() => locationStore.homeCoordinates)
const formattedAddress = computed(() => locationStore.formattedAddress)
const formattedCoordinates = computed(() => locationStore.formattedCoordinates)

const formatLastUpdated = (timestamp: string) => {
  try {
    return formatDistance(new Date(timestamp), new Date(), { addSuffix: true })
  } catch {
    return 'recently'
  }
}

const openLocationPicker = () => {
  showLocationPicker.value = true
}

const handleSaveLocation = (locationData: any) => {
  locationStore.setHomeLocation(locationData)
  success('Home location saved successfully')
}

const handleClearLocation = async () => {
  const confirmed = await dialog.confirm({
    title: 'Clear Home Location',
    message: 'Are you sure you want to clear the home location? The rover will not be able to return home automatically.',
    variant: 'warning'
  })

  if (confirmed) {
    locationStore.clearHomeLocation()
    info('Home location cleared')
  }
}
</script>

<style scoped lang="scss">
.home-location-settings {
  max-width: 800px;
}

.settings-header {
  margin-bottom: var(--spacing-xl);

  h2 {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
  }

  .settings-description {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }
}

.current-location-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.location-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.status-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  flex-shrink: 0;

  &.active {
    background: var(--primary-green);
    color: white;
  }

  svg {
    width: 24px;
    height: 24px;
  }
}

.status-info {
  flex: 1;
}

.status-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.status-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-top: 2px;
}

.location-details {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  font-size: var(--font-size-sm);

  .detail-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .detail-value {
    color: var(--text-primary);
    text-align: right;
  }
}

.no-location-message {
  padding: var(--spacing-lg);
  text-align: center;
  border-top: 1px solid var(--border-color);

  p {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }
}

.location-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--border-radius);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);

  svg {
    width: 18px;
    height: 18px;
  }

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
