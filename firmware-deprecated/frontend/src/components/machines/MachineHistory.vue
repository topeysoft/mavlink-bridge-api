<template>
  <div class="machine-history">
    <!-- Filters and Controls -->
    <div class="machine-history__controls">
      <div class="machine-history__filters">
        <q-select
          v-model="filters.timeRange"
          :options="timeRangeOptions"
          label="Time Range"
          outlined
          dense
          class="machine-history__filter"
          @update:model-value="loadHistory"
        />

        <q-select
          v-model="filters.taskType"
          :options="taskTypeOptions"
          label="Task Type"
          outlined
          dense
          class="machine-history__filter"
          @update:model-value="loadHistory"
        />

        <q-select
          v-model="filters.status"
          :options="statusOptions"
          label="Status"
          outlined
          dense
          class="machine-history__filter"
          @update:model-value="loadHistory"
        />
      </div>

      <div class="machine-history__actions">
        <q-btn
          color="primary"
          icon="refresh"
          label="Refresh"
          :loading="loading"
          outline
          @click="loadHistory"
        />

        <q-btn color="secondary" icon="download" label="Export" outline @click="exportHistory" />
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="machine-history__summary">
      <q-card class="machine-history__summary-card">
        <q-card-section>
          <div class="machine-history__summary-grid">
            <div class="machine-history__summary-item">
              <q-icon name="assignment_turned_in" color="positive" size="24px" />
              <div>
                <div class="text-h6 text-weight-bold">{{ summary.completed }}</div>
                <div class="text-caption text-grey-6">Completed Tasks</div>
              </div>
            </div>

            <div class="machine-history__summary-item">
              <q-icon name="schedule" color="primary" size="24px" />
              <div>
                <div class="text-h6 text-weight-bold">
                  {{ formatDuration(summary.totalRuntime) }}
                </div>
                <div class="text-caption text-grey-6">Total Runtime</div>
              </div>
            </div>

            <div class="machine-history__summary-item">
              <q-icon name="crop_landscape" color="info" size="24px" />
              <div>
                <div class="text-h6 text-weight-bold">{{ summary.areaCovered }} m²</div>
                <div class="text-caption text-grey-6">Area Covered</div>
              </div>
            </div>

            <div class="machine-history__summary-item">
              <q-icon name="trending_up" color="secondary" size="24px" />
              <div>
                <div class="text-h6 text-weight-bold">{{ summary.efficiency }}%</div>
                <div class="text-caption text-grey-6">Avg Efficiency</div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- History Timeline -->
    <div class="machine-history__timeline">
      <q-card class="machine-history__timeline-card">
        <q-card-section>
          <h6 class="q-mt-none q-mb-md">Task History</h6>

          <div v-if="loading" class="machine-history__loading">
            <q-spinner-dots size="50px" color="primary" />
            <div class="text-grey-6 q-mt-sm">Loading history...</div>
          </div>

          <div v-else-if="historyItems.length === 0" class="machine-history__empty">
            <q-icon name="history" size="64px" class="text-grey-4" />
            <div class="text-grey-6 q-mt-md">No history found for the selected filters</div>
          </div>

          <q-timeline v-else color="primary" class="machine-history__timeline-list">
            <q-timeline-entry
              v-for="item in historyItems"
              :key="item.id"
              :color="getTaskColor(item.status)"
              :icon="getTaskIcon(item.type)"
              :subtitle="formatTaskDate(item.startTime)"
            >
              <template #title>
                <div class="machine-history__task-title">
                  {{ item.title }}
                  <q-badge
                    :color="getStatusColor(item.status)"
                    :label="item.status"
                    class="q-ml-sm"
                  />
                </div>
              </template>

              <div class="machine-history__task-content">
                <div class="machine-history__task-details">
                  <div class="machine-history__task-info">
                    <div class="text-body2">
                      <strong>Duration:</strong> {{ formatDuration(item.duration) }}
                    </div>
                    <div v-if="item.areaCovered" class="text-body2">
                      <strong>Area:</strong> {{ item.areaCovered }} m²
                    </div>
                    <div v-if="item.efficiency" class="text-body2">
                      <strong>Efficiency:</strong> {{ item.efficiency }}%
                    </div>
                  </div>

                  <div v-if="item.notes" class="machine-history__task-notes">
                    <div class="text-caption text-grey-6">Notes:</div>
                    <div class="text-body2">{{ item.notes }}</div>
                  </div>

                  <div
                    v-if="item.errors && item.errors.length > 0"
                    class="machine-history__task-errors"
                  >
                    <div class="text-caption text-grey-6">Errors:</div>
                    <div v-for="error in item.errors" :key="error" class="text-body2 text-negative">
                      • {{ error }}
                    </div>
                  </div>
                </div>

                <div class="machine-history__task-actions">
                  <q-btn
                    dense
                    flat
                    color="primary"
                    icon="info"
                    label="Details"
                    @click="showTaskDetails(item)"
                  />

                  <q-btn
                    v-if="item.status === 'completed'"
                    dense
                    flat
                    color="secondary"
                    icon="replay"
                    label="Repeat"
                    @click="repeatTask(item)"
                  />

                  <q-btn
                    dense
                    flat
                    color="info"
                    icon="map"
                    label="View Path"
                    @click="showTaskPath(item)"
                  />
                </div>
              </div>
            </q-timeline-entry>
          </q-timeline>

          <!-- Load More Button -->
          <div v-if="hasMore && !loading" class="machine-history__load-more">
            <q-btn
              color="primary"
              label="Load More"
              :loading="loadingMore"
              outline
              @click="loadMore"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Task Details Dialog -->
    <q-dialog v-model="showDetailsDialog" position="right" full-height>
      <TaskDetailsDialog
        v-if="selectedTask"
        :task="selectedTask"
        @close="showDetailsDialog = false"
        @repeat="repeatTask"
      />
    </q-dialog>

    <!-- Task Path Dialog -->
    <q-dialog v-model="showPathDialog" maximized>
      <TaskPathDialog v-if="selectedTask" :task="selectedTask" @close="showPathDialog = false" />
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'

// Components
import TaskDetailsDialog from './TaskDetailsDialog.vue'
import TaskPathDialog from './TaskPathDialog.vue'

// Types
interface HistoryItem {
  id: string
  title: string
  type: 'mowing' | 'trimming' | 'maintenance' | 'charging' | 'navigation'
  status: 'completed' | 'failed' | 'cancelled' | 'paused'
  startTime: string
  endTime?: string
  duration: number // minutes
  areaCovered?: number
  efficiency?: number
  notes?: string
  errors?: string[]
}

interface Summary {
  completed: number
  totalRuntime: number
  areaCovered: number
  efficiency: number
}

// Props
defineProps<{
  machineId: string
}>()

// Emits
const emit = defineEmits<{
  'task-selected': [taskId: string]
}>()

// Composables
const $q = useQuasar()

// Local state
const loading = ref(false)
const loadingMore = ref(false)
const showDetailsDialog = ref(false)
const showPathDialog = ref(false)
const selectedTask = ref<HistoryItem | null>(null)
const hasMore = ref(true)
const currentPage = ref(1)

const filters = ref({
  timeRange: 'last_week',
  taskType: 'all',
  status: 'all'
})

// Options
const timeRangeOptions = [
  { label: 'Last 24 Hours', value: 'last_day' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'last_quarter' },
  { label: 'All Time', value: 'all_time' }
]

const taskTypeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Mowing', value: 'mowing' },
  { label: 'Trimming', value: 'trimming' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Charging', value: 'charging' },
  { label: 'Navigation', value: 'navigation' }
]

const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Paused', value: 'paused' }
]

// Mock data
const summary = ref<Summary>({
  completed: 28,
  totalRuntime: 2640, // minutes
  areaCovered: 1420,
  efficiency: 89
})

const historyItems = ref<HistoryItem[]>([
  {
    id: '1',
    title: 'Front Yard Mowing',
    type: 'mowing',
    status: 'completed',
    startTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    duration: 45,
    areaCovered: 150,
    efficiency: 92,
    notes: 'Completed successfully with optimal cutting pattern'
  },
  {
    id: '2',
    title: 'Edge Trimming',
    type: 'trimming',
    status: 'completed',
    startTime: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
    duration: 20,
    areaCovered: 25,
    efficiency: 88
  },
  {
    id: '3',
    title: 'Back Yard Mowing',
    type: 'mowing',
    status: 'failed',
    startTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    duration: 15,
    areaCovered: 30,
    efficiency: 45,
    errors: ['Battery depleted', 'Obstacle detection triggered'],
    notes: 'Task interrupted due to low battery'
  },
  {
    id: '4',
    title: 'Scheduled Maintenance',
    type: 'maintenance',
    status: 'completed',
    startTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    duration: 60,
    notes: 'Blade sharpening and general cleaning completed'
  }
])

// Methods
const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

const formatTaskDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays === 0) {
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `${diffMins} minutes ago`
    }
    return `${diffHours} hours ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

const getTaskIcon = (type: string) => {
  const icons = {
    mowing: 'grass',
    trimming: 'content_cut',
    maintenance: 'build',
    charging: 'battery_charging_full',
    navigation: 'navigation'
  }
  return icons[type as keyof typeof icons] || 'task'
}

const getTaskColor = (status: string) => {
  const colors = {
    completed: 'positive',
    failed: 'negative',
    cancelled: 'warning',
    paused: 'info'
  }
  return colors[status as keyof typeof colors] || 'grey'
}

const getStatusColor = (status: string) => {
  const colors = {
    completed: 'positive',
    failed: 'negative',
    cancelled: 'warning',
    paused: 'info'
  }
  return colors[status as keyof typeof colors] || 'grey'
}

const loadHistory = async () => {
  loading.value = true
  currentPage.value = 1

  try {
    // Simulate API call
    await new Promise(resolve => globalThis.setTimeout(resolve, 1000))

    // Filter mock data based on filters
    // In real app, this would be done by the API

    hasMore.value = true
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to load history'
    })
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  loadingMore.value = true

  try {
    // Simulate loading more data
    await new Promise(resolve => globalThis.setTimeout(resolve, 1000))

    currentPage.value++

    // Simulate end of data
    if (currentPage.value >= 3) {
      hasMore.value = false
    }
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to load more history'
    })
  } finally {
    loadingMore.value = false
  }
}

const exportHistory = async () => {
  try {
    $q.notify({
      type: 'positive',
      message: 'History export started'
    })

    // Simulate export
    await new Promise(resolve => globalThis.setTimeout(resolve, 2000))

    $q.notify({
      type: 'positive',
      message: 'History exported successfully'
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to export history'
    })
  }
}

const showTaskDetails = (task: HistoryItem) => {
  selectedTask.value = task
  showDetailsDialog.value = true
  emit('task-selected', task.id)
}

const showTaskPath = (task: HistoryItem) => {
  selectedTask.value = task
  showPathDialog.value = true
}

const repeatTask = (task: HistoryItem) => {
  $q.dialog({
    title: 'Repeat Task',
    message: `Do you want to repeat "${task.title}"?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    $q.notify({
      type: 'positive',
      message: `Task "${task.title}" added to queue`
    })
  })
}

// Lifecycle
onMounted(() => {
  loadHistory()
})
</script>

<style lang="scss" scoped>
.machine-history {
  padding: 24px;
  background-color: var(--q-grey-1);

  .body--dark & {
    background-color: var(--q-dark-page);
  }
}

.machine-history__controls {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  gap: 16px;
}

.machine-history__filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.machine-history__filter {
  min-width: 150px;
}

.machine-history__actions {
  display: flex;
  gap: 8px;
}

.machine-history__summary {
  margin-bottom: 24px;
}

.machine-history__summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.machine-history__summary-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.machine-history__timeline-card {
  min-height: 400px;
}

.machine-history__loading,
.machine-history__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.machine-history__task-title {
  display: flex;
  align-items: center;
  font-weight: 600;
}

.machine-history__task-content {
  margin-top: 8px;
}

.machine-history__task-details {
  margin-bottom: 16px;
}

.machine-history__task-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.machine-history__task-notes,
.machine-history__task-errors {
  margin-top: 8px;
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.machine-history__task-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.machine-history__load-more {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .machine-history__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .machine-history__filters {
    justify-content: space-between;
  }

  .machine-history__actions {
    justify-content: center;
  }

  .machine-history__summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 599px) {
  .machine-history {
    padding: 16px;
  }

  .machine-history__filters {
    flex-direction: column;
    gap: 12px;
  }

  .machine-history__filter {
    min-width: unset;
  }

  .machine-history__summary-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .machine-history__task-info {
    grid-template-columns: 1fr;
  }

  .machine-history__task-actions {
    flex-direction: column;

    .q-btn {
      justify-content: flex-start;
    }
  }
}
</style>
