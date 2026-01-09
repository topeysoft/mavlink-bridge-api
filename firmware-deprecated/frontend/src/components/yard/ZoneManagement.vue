<template>
  <div class="zone-management">
    <!-- Header Controls -->
    <div class="zone-management__header">
      <div class="zone-management__search">
        <q-input v-model="searchQuery" placeholder="Search zones..." outlined dense clearable>
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>

      <div class="zone-management__filters">
        <q-select
          v-model="typeFilter"
          :options="zoneTypeOptions"
          label="Zone Type"
          outlined
          dense
          style="min-width: 120px"
        />

        <q-select
          v-model="statusFilter"
          :options="statusOptions"
          label="Status"
          outlined
          dense
          style="min-width: 100px"
        />
      </div>

      <div class="zone-management__actions">
        <q-btn color="primary" icon="add" label="Create Zone" @click="$emit('zone-create', {})" />
      </div>
    </div>

    <!-- Zone List -->
    <div class="zone-management__list">
      <q-list separator>
        <q-item v-for="zone in filteredZones" :key="zone.id" class="zone-management__item">
          <q-item-section avatar>
            <q-avatar
              :style="{ backgroundColor: zone.color }"
              text-color="white"
              :icon="getZoneTypeIcon(zone.type)"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="zone-management__zone-name">
              {{ zone.name }}
            </q-item-label>

            <q-item-label caption>
              Type: {{ formatZoneType(zone.type) }} • Area: {{ zone.area }}m² • Priority:
              {{ zone.priority }}
            </q-item-label>

            <q-item-label caption>
              Pattern: {{ formatMowingPattern(zone.settings.mowingPattern) }} • Height:
              {{ zone.settings.cuttingHeight }}mm • Frequency: {{ zone.settings.frequency }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="zone-management__zone-status">
              <q-chip
                :color="zone.enabled ? 'positive' : 'grey-5'"
                text-color="white"
                :label="zone.enabled ? 'Enabled' : 'Disabled'"
                size="sm"
              />
            </div>
          </q-item-section>

          <q-item-section side>
            <div class="zone-management__zone-controls">
              <q-btn
                :icon="zone.enabled ? 'pause' : 'play_arrow'"
                :color="zone.enabled ? 'warning' : 'positive'"
                size="sm"
                round
                dense
                @click="$emit('zone-toggle', zone)"
              >
                <q-tooltip>
                  {{ zone.enabled ? 'Disable Zone' : 'Enable Zone' }}
                </q-tooltip>
              </q-btn>

              <q-btn icon="more_vert" size="sm" round dense flat>
                <q-menu>
                  <q-list>
                    <q-item v-close-popup clickable @click="$emit('zone-edit', zone)">
                      <q-item-section avatar>
                        <q-icon name="edit" />
                      </q-item-section>
                      <q-item-section>Edit Zone</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="duplicateZone(zone)">
                      <q-item-section avatar>
                        <q-icon name="content_copy" />
                      </q-item-section>
                      <q-item-section>Duplicate</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="showZoneDetails(zone)">
                      <q-item-section avatar>
                        <q-icon name="info" />
                      </q-item-section>
                      <q-item-section>Details</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="exportZone(zone)">
                      <q-item-section avatar>
                        <q-icon name="download" />
                      </q-item-section>
                      <q-item-section>Export</q-item-section>
                    </q-item>

                    <q-separator />

                    <q-item
                      v-close-popup
                      class="text-negative"
                      clickable
                      @click="$emit('zone-delete', zone)"
                    >
                      <q-item-section avatar>
                        <q-icon name="delete" />
                      </q-item-section>
                      <q-item-section>Delete</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Empty State -->
      <div v-if="filteredZones.length === 0" class="zone-management__empty">
        <q-icon name="grid_on" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-md">
          {{
            searchQuery || hasActiveFilters ? 'No zones match your filters' : 'No zones configured'
          }}
        </div>
        <div class="text-body2 text-grey-5 q-mt-sm">
          {{
            searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Create zones to organize your yard management'
          }}
        </div>

        <q-btn
          v-if="!searchQuery && !hasActiveFilters"
          color="primary"
          label="Create First Zone"
          class="q-mt-md"
          @click="$emit('zone-create', {})"
        />
      </div>
    </div>

    <!-- Zone Details Dialog -->
    <q-dialog v-model="showDetailsDialog" position="right">
      <q-card style="width: 400px; max-width: 90vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Zone Details</div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-card-section v-if="selectedZoneDetails">
          <div class="zone-management__details-content">
            <div class="zone-management__detail-header">
              <q-avatar
                :style="{ backgroundColor: selectedZoneDetails.color }"
                text-color="white"
                :icon="getZoneTypeIcon(selectedZoneDetails.type)"
                size="48px"
              />
              <div class="zone-management__detail-title">
                <div class="text-h6">{{ selectedZoneDetails.name }}</div>
                <div class="text-caption text-grey-6">
                  {{ formatZoneType(selectedZoneDetails.type) }}
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="zone-management__detail-grid">
              <div class="zone-management__detail-item">
                <div class="zone-management__detail-label">Area</div>
                <div class="zone-management__detail-value">{{ selectedZoneDetails.area }}m²</div>
              </div>

              <div class="zone-management__detail-item">
                <div class="zone-management__detail-label">Priority</div>
                <div class="zone-management__detail-value">{{ selectedZoneDetails.priority }}</div>
              </div>

              <div class="zone-management__detail-item">
                <div class="zone-management__detail-label">Status</div>
                <q-chip
                  :color="selectedZoneDetails.enabled ? 'positive' : 'grey-5'"
                  text-color="white"
                  :label="selectedZoneDetails.enabled ? 'Enabled' : 'Disabled'"
                  size="sm"
                />
              </div>

              <div class="zone-management__detail-item">
                <div class="zone-management__detail-label">Coordinates</div>
                <div class="zone-management__detail-value">
                  {{ selectedZoneDetails.coordinates.length }} points
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="text-subtitle2 q-mb-sm">Mowing Settings</div>
            <div class="zone-management__settings-grid">
              <div class="zone-management__setting-item">
                <div class="zone-management__setting-label">Cutting Height</div>
                <div class="zone-management__setting-value">
                  {{ selectedZoneDetails.settings.cuttingHeight }}mm
                </div>
              </div>

              <div class="zone-management__setting-item">
                <div class="zone-management__setting-label">Pattern</div>
                <div class="zone-management__setting-value">
                  {{ formatMowingPattern(selectedZoneDetails.settings.mowingPattern) }}
                </div>
              </div>

              <div class="zone-management__setting-item">
                <div class="zone-management__setting-label">Frequency</div>
                <div class="zone-management__setting-value">
                  {{ selectedZoneDetails.settings.frequency }}
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="zone-management__timestamps">
              <div class="text-caption text-grey-6">
                Created: {{ formatDateTime(selectedZoneDetails.createdAt) }}
              </div>
              <div class="text-caption text-grey-6">
                Updated: {{ formatDateTime(selectedZoneDetails.updatedAt) }}
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar, date } from 'quasar'

// Props
interface Zone {
  id: string
  name: string
  type: 'lawn' | 'garden' | 'path' | 'restricted'
  coordinates: Array<{ lat: number; lng: number }>
  area: number
  priority: number
  enabled: boolean
  settings: {
    cuttingHeight: number
    mowingPattern: string
    frequency: string
  }
  color: string
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  zones: Zone[]
}>()

// Emits
const emit = defineEmits<{
  'zone-create': [zone: Partial<Zone>]
  'zone-edit': [zone: Zone]
  'zone-delete': [zone: Zone]
  'zone-toggle': [zone: Zone]
}>()

// Composables
const $q = useQuasar()

// Local state
const searchQuery = ref('')
const typeFilter = ref('all')
const statusFilter = ref('all')
const showDetailsDialog = ref(false)
const selectedZoneDetails = ref<Zone | null>(null)

// Filter options
const zoneTypeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Lawn', value: 'lawn' },
  { label: 'Garden', value: 'garden' },
  { label: 'Path', value: 'path' },
  { label: 'Restricted', value: 'restricted' }
]

const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' }
]

// Computed
const filteredZones = computed(() => {
  let filtered = [...props.zones]

  // Apply type filter
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(zone => zone.type === typeFilter.value)
  }

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(zone => {
      if (statusFilter.value === 'enabled') return zone.enabled
      if (statusFilter.value === 'disabled') return !zone.enabled
      return true
    })
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      zone => zone.name.toLowerCase().includes(query) || zone.type.toLowerCase().includes(query)
    )
  }

  return filtered
})

const hasActiveFilters = computed(() => {
  return typeFilter.value !== 'all' || statusFilter.value !== 'all'
})

// Methods
const getZoneTypeIcon = (type: string) => {
  switch (type) {
    case 'lawn':
      return 'grass'
    case 'garden':
      return 'local_florist'
    case 'path':
      return 'timeline'
    case 'restricted':
      return 'block'
    default:
      return 'grid_on'
  }
}

const formatZoneType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const formatMowingPattern = (pattern: string) => {
  switch (pattern) {
    case 'parallel':
      return 'Parallel Lines'
    case 'random':
      return 'Random'
    case 'spiral':
      return 'Spiral'
    case 'checkerboard':
      return 'Checkerboard'
    default:
      return pattern
  }
}

const formatDateTime = (dateString: string) => {
  return date.formatDate(new Date(dateString), 'MMM D, YYYY h:mm A')
}

const duplicateZone = (zone: Zone) => {
  const duplicated = {
    ...zone,
    name: `${zone.name} (Copy)`,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  emit('zone-create', duplicated)

  $q.notify({
    type: 'positive',
    message: 'Zone duplicated successfully'
  })
}

const showZoneDetails = (zone: Zone) => {
  selectedZoneDetails.value = zone
  showDetailsDialog.value = true
}

const exportZone = (zone: Zone) => {
  const dataStr = JSON.stringify(zone, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${zone.name.replace(/\s+/g, '_')}_zone.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  $q.notify({
    type: 'positive',
    message: 'Zone exported successfully'
  })
}
</script>

<style lang="scss" scoped>
.zone-management {
  min-height: 400px;
}

.zone-management__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--q-grey-1);
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-grey-9);
    border-bottom-color: var(--q-grey-7);
  }
}

.zone-management__search {
  flex: 1;
  max-width: 300px;
}

.zone-management__filters {
  display: flex;
  gap: 12px;
  margin: 0 16px;
}

.zone-management__actions {
  flex-shrink: 0;
}

.zone-management__list {
  background: white;
  min-height: 300px;

  .body--dark & {
    background: var(--q-dark);
  }
}

.zone-management__item {
  padding: 16px 24px;
  border-bottom: 1px solid var(--q-grey-2);

  .body--dark & {
    border-bottom-color: var(--q-grey-8);
  }
}

.zone-management__zone-name {
  font-weight: 500;
  font-size: 1rem;
}

.zone-management__zone-status {
  margin-bottom: 8px;
}

.zone-management__zone-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.zone-management__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.zone-management__details-content {
  display: flex;
  flex-direction: column;
}

.zone-management__detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.zone-management__detail-title {
  flex: 1;
}

.zone-management__detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.zone-management__detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.zone-management__detail-label {
  font-weight: 500;
  color: var(--q-grey-7);
  font-size: 0.875rem;
}

.zone-management__detail-value {
  font-size: 0.9rem;
}

.zone-management__settings-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zone-management__setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--q-grey-1);
  border-radius: 4px;

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.zone-management__setting-label {
  font-weight: 500;
  color: var(--q-grey-7);
  font-size: 0.875rem;
}

.zone-management__setting-value {
  font-size: 0.875rem;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.zone-management__timestamps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .zone-management__header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .zone-management__search {
    max-width: none;
  }

  .zone-management__filters {
    margin: 0;
    justify-content: center;
  }
}

@media (max-width: 599px) {
  .zone-management__header {
    padding: 12px 16px;
  }

  .zone-management__item {
    padding: 12px 16px;
  }

  .zone-management__filters {
    flex-direction: column;
    gap: 8px;
  }

  .zone-management__detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
