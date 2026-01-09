<template>
  <div class="obstacle-management">
    <!-- Header Controls -->
    <div class="obstacle-management__header">
      <div class="obstacle-management__search">
        <q-input v-model="searchQuery" placeholder="Search obstacles..." outlined dense clearable>
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>

      <div class="obstacle-management__filters">
        <q-select
          v-model="typeFilter"
          :options="obstacleTypeOptions"
          label="Type"
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

        <q-select
          v-model="categoryFilter"
          :options="categoryOptions"
          label="Category"
          outlined
          dense
          style="min-width: 120px"
        />
      </div>

      <div class="obstacle-management__actions">
        <q-btn
          color="primary"
          icon="add"
          label="Add Obstacle"
          @click="$emit('obstacle-create', {})"
        />
      </div>
    </div>

    <!-- Obstacle List -->
    <div class="obstacle-management__list">
      <q-list separator>
        <q-item
          v-for="obstacle in filteredObstacles"
          :key="obstacle.id"
          class="obstacle-management__item"
        >
          <q-item-section avatar>
            <q-avatar
              :color="getObstacleColor(obstacle.type)"
              text-color="white"
              :icon="getObstacleIcon(obstacle.type)"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="obstacle-management__obstacle-name">
              {{ obstacle.name }}
            </q-item-label>

            <q-item-label caption>
              Type: {{ formatObstacleType(obstacle.type) }} • Size: {{ obstacle.width }}×{{
                obstacle.height
              }}m • Category: {{ formatCategory(obstacle.category) }}
            </q-item-label>

            <q-item-label caption>
              Position: {{ obstacle.position.lat.toFixed(6) }},
              {{ obstacle.position.lng.toFixed(6) }} • Action: {{ formatAction(obstacle.action) }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="obstacle-management__obstacle-status">
              <q-chip
                :color="getStatusColor(obstacle.status)"
                text-color="white"
                :label="formatStatus(obstacle.status)"
                size="sm"
              />
            </div>
          </q-item-section>

          <q-item-section side>
            <div class="obstacle-management__obstacle-controls">
              <q-btn
                :icon="obstacle.enabled ? 'pause' : 'play_arrow'"
                :color="obstacle.enabled ? 'warning' : 'positive'"
                size="sm"
                round
                dense
                @click="$emit('obstacle-toggle', obstacle)"
              >
                <q-tooltip>
                  {{ obstacle.enabled ? 'Disable Obstacle' : 'Enable Obstacle' }}
                </q-tooltip>
              </q-btn>

              <q-btn icon="more_vert" size="sm" round dense flat>
                <q-menu>
                  <q-list>
                    <q-item v-close-popup clickable @click="$emit('obstacle-edit', obstacle)">
                      <q-item-section avatar>
                        <q-icon name="edit" />
                      </q-item-section>
                      <q-item-section>Edit Obstacle</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="showObstacleDetails(obstacle)">
                      <q-item-section avatar>
                        <q-icon name="info" />
                      </q-item-section>
                      <q-item-section>Details</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="duplicateObstacle(obstacle)">
                      <q-item-section avatar>
                        <q-icon name="content_copy" />
                      </q-item-section>
                      <q-item-section>Duplicate</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="moveObstacle(obstacle)">
                      <q-item-section avatar>
                        <q-icon name="open_with" />
                      </q-item-section>
                      <q-item-section>Move</q-item-section>
                    </q-item>

                    <q-separator />

                    <q-item
                      v-close-popup
                      clickable
                      class="text-negative"
                      @click="$emit('obstacle-delete', obstacle)"
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
      <div v-if="filteredObstacles.length === 0" class="obstacle-management__empty">
        <q-icon name="warning" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-md">
          {{
            searchQuery || hasActiveFilters
              ? 'No obstacles match your filters'
              : 'No obstacles mapped'
          }}
        </div>
        <div class="text-body2 text-grey-5 q-mt-sm">
          {{
            searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Map obstacles to improve mowing efficiency and safety'
          }}
        </div>

        <q-btn
          v-if="!searchQuery && !hasActiveFilters"
          color="primary"
          label="Add First Obstacle"
          class="q-mt-md"
          @click="$emit('obstacle-create', {})"
        />
      </div>
    </div>

    <!-- Obstacle Details Dialog -->
    <q-dialog v-model="showDetailsDialog" position="right">
      <q-card style="width: 400px; max-width: 90vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Obstacle Details</div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-card-section v-if="selectedObstacleDetails">
          <div class="obstacle-management__details-content">
            <div class="obstacle-management__detail-header">
              <q-avatar
                :color="getObstacleColor(selectedObstacleDetails.type)"
                text-color="white"
                :icon="getObstacleIcon(selectedObstacleDetails.type)"
                size="48px"
              />
              <div class="obstacle-management__detail-title">
                <div class="text-h6">{{ selectedObstacleDetails.name }}</div>
                <div class="text-caption text-grey-6">
                  {{ formatObstacleType(selectedObstacleDetails.type) }}
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="obstacle-management__detail-grid">
              <div class="obstacle-management__detail-item">
                <div class="obstacle-management__detail-label">Category</div>
                <div class="obstacle-management__detail-value">
                  {{ formatCategory(selectedObstacleDetails.category) }}
                </div>
              </div>

              <div class="obstacle-management__detail-item">
                <div class="obstacle-management__detail-label">Status</div>
                <q-chip
                  :color="getStatusColor(selectedObstacleDetails.status)"
                  text-color="white"
                  :label="formatStatus(selectedObstacleDetails.status)"
                  size="sm"
                />
              </div>

              <div class="obstacle-management__detail-item">
                <div class="obstacle-management__detail-label">Width</div>
                <div class="obstacle-management__detail-value">
                  {{ selectedObstacleDetails.width }}m
                </div>
              </div>

              <div class="obstacle-management__detail-item">
                <div class="obstacle-management__detail-label">Height</div>
                <div class="obstacle-management__detail-value">
                  {{ selectedObstacleDetails.height }}m
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="text-subtitle2 q-mb-sm">Position & Behavior</div>
            <div class="obstacle-management__position-grid">
              <div class="obstacle-management__position-item">
                <div class="obstacle-management__position-label">Latitude</div>
                <div class="obstacle-management__position-value">
                  {{ selectedObstacleDetails.position.lat.toFixed(6) }}°
                </div>
              </div>

              <div class="obstacle-management__position-item">
                <div class="obstacle-management__position-label">Longitude</div>
                <div class="obstacle-management__position-value">
                  {{ selectedObstacleDetails.position.lng.toFixed(6) }}°
                </div>
              </div>

              <div class="obstacle-management__position-item">
                <div class="obstacle-management__position-label">Action</div>
                <div class="obstacle-management__position-value">
                  {{ formatAction(selectedObstacleDetails.action) }}
                </div>
              </div>

              <div class="obstacle-management__position-item">
                <div class="obstacle-management__position-label">Buffer Zone</div>
                <div class="obstacle-management__position-value">
                  {{ selectedObstacleDetails.bufferZone }}m
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div v-if="selectedObstacleDetails.description" class="text-subtitle2 q-mb-sm">
              Description
            </div>
            <div v-if="selectedObstacleDetails.description" class="text-body2 text-grey-7 q-mb-md">
              {{ selectedObstacleDetails.description }}
            </div>

            <div class="obstacle-management__timestamps">
              <div class="text-caption text-grey-6">
                Created: {{ formatDateTime(selectedObstacleDetails.createdAt) }}
              </div>
              <div class="text-caption text-grey-6">
                Updated: {{ formatDateTime(selectedObstacleDetails.updatedAt) }}
              </div>
              <div v-if="selectedObstacleDetails.lastDetected" class="text-caption text-grey-6">
                Last Detected: {{ formatDateTime(selectedObstacleDetails.lastDetected) }}
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Move Obstacle Dialog -->
    <q-dialog v-model="showMoveDialog">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Move Obstacle</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div v-if="moveObstacleItem" class="obstacle-management__move-content">
            <div class="obstacle-management__move-header">
              <q-avatar
                :color="getObstacleColor(moveObstacleItem.type)"
                text-color="white"
                :icon="getObstacleIcon(moveObstacleItem.type)"
              />
              <div class="q-ml-md">
                <div class="text-subtitle1">{{ moveObstacleItem.name }}</div>
                <div class="text-caption text-grey-6">
                  {{ formatObstacleType(moveObstacleItem.type) }}
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="obstacle-management__move-form">
              <div class="text-subtitle2 q-mb-sm">New Position</div>

              <q-input
                v-model.number="newPosition.lat"
                label="Latitude"
                type="number"
                step="0.000001"
                outlined
                dense
                class="q-mb-sm"
              />

              <q-input
                v-model.number="newPosition.lng"
                label="Longitude"
                type="number"
                step="0.000001"
                outlined
                dense
                class="q-mb-sm"
              />

              <div class="text-caption text-grey-6 q-mb-md">
                Current: {{ moveObstacleItem.position.lat.toFixed(6) }},
                {{ moveObstacleItem.position.lng.toFixed(6) }}
              </div>

              <q-btn
                flat
                color="primary"
                label="Use Map to Select Position"
                icon="place"
                class="q-mb-md"
                @click="selectPositionOnMap"
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Cancel" color="grey" />
          <q-btn label="Move Obstacle" color="primary" @click="confirmMoveObstacle" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar, date } from 'quasar'

// Props
interface Obstacle {
  id: string
  name: string
  type: 'tree' | 'rock' | 'garden_bed' | 'structure' | 'sprinkler' | 'temporary' | 'unknown'
  category: 'permanent' | 'seasonal' | 'temporary' | 'mobile'
  position: { lat: number; lng: number }
  width: number
  height: number
  enabled: boolean
  status: 'active' | 'inactive' | 'detected' | 'warning'
  action: 'avoid' | 'navigate_around' | 'stop' | 'alert'
  bufferZone: number
  description?: string
  createdAt: string
  updatedAt: string
  lastDetected?: string
}

const props = defineProps<{
  obstacles: Obstacle[]
}>()

// Emits
const emit = defineEmits<{
  'obstacle-create': [obstacle: Partial<Obstacle>]
  'obstacle-edit': [obstacle: Obstacle]
  'obstacle-delete': [obstacle: Obstacle]
  'obstacle-toggle': [obstacle: Obstacle]
  'obstacle-move': [obstacle: Obstacle, newPosition: { lat: number; lng: number }]
}>()

// Composables
const $q = useQuasar()

// Local state
const searchQuery = ref('')
const typeFilter = ref('all')
const statusFilter = ref('all')
const categoryFilter = ref('all')
const showDetailsDialog = ref(false)
const selectedObstacleDetails = ref<Obstacle | null>(null)
const showMoveDialog = ref(false)
const moveObstacleItem = ref<Obstacle | null>(null)
const newPosition = ref({ lat: 0, lng: 0 })

// Filter options
const obstacleTypeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Tree', value: 'tree' },
  { label: 'Rock', value: 'rock' },
  { label: 'Garden Bed', value: 'garden_bed' },
  { label: 'Structure', value: 'structure' },
  { label: 'Sprinkler', value: 'sprinkler' },
  { label: 'Temporary', value: 'temporary' },
  { label: 'Unknown', value: 'unknown' }
]

const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Detected', value: 'detected' },
  { label: 'Warning', value: 'warning' }
]

const categoryOptions = [
  { label: 'All Categories', value: 'all' },
  { label: 'Permanent', value: 'permanent' },
  { label: 'Seasonal', value: 'seasonal' },
  { label: 'Temporary', value: 'temporary' },
  { label: 'Mobile', value: 'mobile' }
]

// Computed
const filteredObstacles = computed(() => {
  let filtered = [...props.obstacles]

  // Apply type filter
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(obstacle => obstacle.type === typeFilter.value)
  }

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(obstacle => obstacle.status === statusFilter.value)
  }

  // Apply category filter
  if (categoryFilter.value !== 'all') {
    filtered = filtered.filter(obstacle => obstacle.category === categoryFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      obstacle =>
        obstacle.name.toLowerCase().includes(query) ||
        obstacle.type.toLowerCase().includes(query) ||
        obstacle.category.toLowerCase().includes(query)
    )
  }

  return filtered
})

const hasActiveFilters = computed(() => {
  return (
    typeFilter.value !== 'all' || statusFilter.value !== 'all' || categoryFilter.value !== 'all'
  )
})

// Methods
const getObstacleIcon = (type: string) => {
  switch (type) {
    case 'tree':
      return 'park'
    case 'rock':
      return 'landscape'
    case 'garden_bed':
      return 'local_florist'
    case 'structure':
      return 'home'
    case 'sprinkler':
      return 'water_drop'
    case 'temporary':
      return 'schedule'
    case 'unknown':
      return 'help_outline'
    default:
      return 'warning'
  }
}

const getObstacleColor = (type: string) => {
  switch (type) {
    case 'tree':
      return 'green-7'
    case 'rock':
      return 'grey-6'
    case 'garden_bed':
      return 'purple-5'
    case 'structure':
      return 'blue-6'
    case 'sprinkler':
      return 'cyan-5'
    case 'temporary':
      return 'orange-6'
    case 'unknown':
      return 'grey-5'
    default:
      return 'red-5'
  }
}

const formatObstacleType = (type: string) => {
  switch (type) {
    case 'garden_bed':
      return 'Garden Bed'
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

const formatCategory = (category: string) => {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'positive'
    case 'inactive':
      return 'grey-5'
    case 'detected':
      return 'info'
    case 'warning':
      return 'warning'
    default:
      return 'grey-5'
  }
}

const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatAction = (action: string) => {
  switch (action) {
    case 'navigate_around':
      return 'Navigate Around'
    default:
      return action.charAt(0).toUpperCase() + action.slice(1)
  }
}

const formatDateTime = (dateString: string) => {
  return date.formatDate(new Date(dateString), 'MMM D, YYYY h:mm A')
}

const showObstacleDetails = (obstacle: Obstacle) => {
  selectedObstacleDetails.value = obstacle
  showDetailsDialog.value = true
}

const duplicateObstacle = (obstacle: Obstacle) => {
  const duplicated = {
    ...obstacle,
    name: `${obstacle.name} (Copy)`,
    id: Date.now().toString(),
    position: {
      lat: obstacle.position.lat + 0.0001,
      lng: obstacle.position.lng + 0.0001
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  emit('obstacle-create', duplicated)

  $q.notify({
    type: 'positive',
    message: 'Obstacle duplicated successfully'
  })
}

const moveObstacle = (obstacle: Obstacle) => {
  moveObstacleItem.value = obstacle
  newPosition.value = { ...obstacle.position }
  showMoveDialog.value = true
}

const selectPositionOnMap = () => {
  $q.notify({
    type: 'info',
    message: 'Map position selector would open here',
    timeout: 2000
  })
}

const confirmMoveObstacle = () => {
  if (moveObstacleItem.value) {
    emit('obstacle-move', moveObstacleItem.value, newPosition.value)
    showMoveDialog.value = false

    $q.notify({
      type: 'positive',
      message: `${moveObstacleItem.value.name} moved successfully`
    })
  }
}
</script>

<style lang="scss" scoped>
.obstacle-management {
  min-height: 400px;
}

.obstacle-management__header {
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

.obstacle-management__search {
  flex: 1;
  max-width: 300px;
}

.obstacle-management__filters {
  display: flex;
  gap: 12px;
  margin: 0 16px;
}

.obstacle-management__actions {
  flex-shrink: 0;
}

.obstacle-management__list {
  background: white;
  min-height: 300px;

  .body--dark & {
    background: var(--q-dark);
  }
}

.obstacle-management__item {
  padding: 16px 24px;
  border-bottom: 1px solid var(--q-grey-2);

  .body--dark & {
    border-bottom-color: var(--q-grey-8);
  }
}

.obstacle-management__obstacle-name {
  font-weight: 500;
  font-size: 1rem;
}

.obstacle-management__obstacle-status {
  margin-bottom: 8px;
}

.obstacle-management__obstacle-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.obstacle-management__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.obstacle-management__details-content {
  display: flex;
  flex-direction: column;
}

.obstacle-management__detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.obstacle-management__detail-title {
  flex: 1;
}

.obstacle-management__detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.obstacle-management__detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.obstacle-management__detail-label {
  font-weight: 500;
  color: var(--q-grey-7);
  font-size: 0.875rem;
}

.obstacle-management__detail-value {
  font-size: 0.9rem;
}

.obstacle-management__position-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.obstacle-management__position-item {
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

.obstacle-management__position-label {
  font-weight: 500;
  color: var(--q-grey-7);
  font-size: 0.875rem;
}

.obstacle-management__position-value {
  font-size: 0.875rem;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.obstacle-management__timestamps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.obstacle-management__move-content {
  display: flex;
  flex-direction: column;
}

.obstacle-management__move-header {
  display: flex;
  align-items: center;
}

.obstacle-management__move-form {
  display: flex;
  flex-direction: column;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .obstacle-management__header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .obstacle-management__search {
    max-width: none;
  }

  .obstacle-management__filters {
    margin: 0;
    justify-content: center;
  }
}

@media (max-width: 599px) {
  .obstacle-management__header {
    padding: 12px 16px;
  }

  .obstacle-management__item {
    padding: 12px 16px;
  }

  .obstacle-management__filters {
    flex-direction: column;
    gap: 8px;
  }

  .obstacle-management__detail-grid,
  .obstacle-management__position-grid {
    grid-template-columns: 1fr;
  }
}
</style>
