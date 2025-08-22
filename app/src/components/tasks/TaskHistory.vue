<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-h6">Task History</div>
          <div class="text-caption text-grey-7">
            {{ filteredTasks.length }} tasks completed
          </div>
        </div>
        <div class="col-auto q-gutter-x-sm">
          <q-btn
            flat
            round
            dense
            icon="mdi-filter"
            @click="showFilters = !showFilters"
          >
            <q-badge v-if="activeFilters > 0" color="primary" floating>
              {{ activeFilters }}
            </q-badge>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="mdi-chart-line"
            @click="showAnalytics = !showAnalytics"
          />
          <q-btn
            flat
            round
            dense
            icon="mdi-download"
            @click="exportHistory"
          />
        </div>
      </div>

      <!-- Filters -->
      <q-slide-transition>
        <div v-show="showFilters" class="q-mb-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-3">
              <q-select
                v-model="filters.type"
                :options="taskTypeOptions"
                label="Task Type"
                clearable
                dense
              />
            </div>
            <div class="col-12 col-sm-3">
              <q-select
                v-model="filters.status"
                :options="statusOptions"
                label="Status"
                clearable
                dense
              />
            </div>
            <div class="col-12 col-sm-3">
              <q-input
                v-model="filters.dateFrom"
                label="From Date"
                type="date"
                dense
              />
            </div>
            <div class="col-12 col-sm-3">
              <q-input
                v-model="filters.dateTo"
                label="To Date"
                type="date"
                dense
              />
            </div>
          </div>
        </div>
      </q-slide-transition>

      <!-- Analytics Panel -->
      <q-slide-transition>
        <div v-show="showAnalytics" class="analytics-panel q-mb-md">
          <div class="row q-col-gutter-md">
            <div class="col-6 col-sm-3">
              <div class="stat-card">
                <div class="stat-value">{{ analytics.totalTasks }}</div>
                <div class="stat-label">Total Tasks</div>
              </div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="stat-card">
                <div class="stat-value">{{ analytics.successRate }}%</div>
                <div class="stat-label">Success Rate</div>
              </div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="stat-card">
                <div class="stat-value">{{ analytics.avgDuration }}min</div>
                <div class="stat-label">Avg Duration</div>
              </div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="stat-card">
                <div class="stat-value">{{ analytics.totalArea }}m²</div>
                <div class="stat-label">Total Area</div>
              </div>
            </div>
          </div>
        </div>
      </q-slide-transition>

      <!-- Task History Table -->
      <q-table
        :rows="filteredTasks"
        :columns="columns"
        row-key="id"
        :rows-per-page-options="[10, 25, 50]"
        binary-state-sort
      >
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-chip
              :color="getStatusColor(props.value)"
              text-color="white"
              size="sm"
              dense
            >
              {{ props.value }}
            </q-chip>
          </q-td>
        </template>

        <template v-slot:body-cell-duration="props">
          <q-td :props="props">
            {{ formatDuration(props.value) }}
          </q-td>
        </template>

        <template v-slot:body-cell-efficiency="props">
          <q-td :props="props">
            <q-linear-progress
              :value="props.value / 100"
              :color="getEfficiencyColor(props.value)"
              size="20px"
              rounded
            >
              <div class="absolute-full flex flex-center">
                <q-badge
                  color="white"
                  text-color="black"
                  :label="`${props.value}%`"
                />
              </div>
            </q-linear-progress>
          </q-td>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="mdi-eye"
              @click="viewTaskDetails(props.row)"
            >
              <q-tooltip>View details</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="mdi-repeat"
              @click="repeatTask(props.row)"
            >
              <q-tooltip>Repeat task</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="mdi-delete"
              @click="deleteTask(props.row.id)"
            >
              <q-tooltip>Delete from history</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card-section>

    <!-- Task Details Dialog -->
    <q-dialog v-model="showDetailsDialog" maximized>
      <TaskDetailsDialog
        v-if="selectedTask"
        :task="selectedTask"
        @close="showDetailsDialog = false"
      />
    </q-dialog>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useTaskStore } from '../../stores/tasks'
import type { TaskMetadata } from '../../stores/tasks'
import TaskDetailsDialog from './TaskDetailsDialog.vue'

const $q = useQuasar()
const taskStore = useTaskStore()

const showFilters = ref(false)
const showAnalytics = ref(false)
const showDetailsDialog = ref(false)
const selectedTask = ref<TaskMetadata | null>(null)

const filters = ref({
  type: null,
  status: null,
  dateFrom: '',
  dateTo: ''
})

const taskTypeOptions = [
  { label: 'Mowing', value: 'mowing' },
  { label: 'Survey', value: 'survey' },
  { label: 'Maintenance', value: 'maintenance' }
]

const statusOptions = [
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' }
]

const columns = [
  {
    name: 'name',
    label: 'Task Name',
    field: 'name',
    align: 'left' as const,
    sortable: true
  },
  {
    name: 'type',
    label: 'Type',
    field: 'type',
    align: 'left' as const,
    sortable: true
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    align: 'center' as const,
    sortable: true
  },
  {
    name: 'startTime',
    label: 'Started',
    field: 'startTime',
    align: 'left' as const,
    sortable: true,
    format: (val: number) => new Date(val).toLocaleString()
  },
  {
    name: 'duration',
    label: 'Duration',
    field: 'duration',
    align: 'right' as const,
    sortable: true
  },
  {
    name: 'area',
    label: 'Area (m²)',
    field: 'area',
    align: 'right' as const,
    sortable: true
  },
  {
    name: 'efficiency',
    label: 'Efficiency',
    field: 'efficiency',
    align: 'center' as const,
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    field: 'actions',
    align: 'center' as const
  }
]

// Mock history data since the store doesn't have this yet
const taskHistory = computed(() => [
  {
    id: '1',
    name: 'Front Yard Mowing',
    type: 'mowing',
    status: 'completed',
    startTime: Date.now() - 3600000,
    duration: 1800, // 30 minutes in seconds
    area: 400,
    efficiency: 92
  },
  {
    id: '2',
    name: 'Perimeter Survey',
    type: 'survey',
    status: 'completed',
    startTime: Date.now() - 7200000,
    duration: 1200, // 20 minutes in seconds
    area: 200,
    efficiency: 88
  },
  {
    id: '3',
    name: 'Battery Check',
    type: 'maintenance',
    status: 'failed',
    startTime: Date.now() - 10800000,
    duration: 300, // 5 minutes in seconds
    area: 0,
    efficiency: 0
  }
])

const filteredTasks = computed(() => {
  let tasks = [...taskHistory.value]
  
  if (filters.value.type) {
    tasks = tasks.filter(t => t.type === filters.value.type)
  }
  
  if (filters.value.status) {
    tasks = tasks.filter(t => t.status === filters.value.status)
  }
  
  if (filters.value.dateFrom) {
    const fromDate = new Date(filters.value.dateFrom).getTime()
    tasks = tasks.filter(t => t.startTime >= fromDate)
  }
  
  if (filters.value.dateTo) {
    const toDate = new Date(filters.value.dateTo).getTime() + 86400000 // End of day
    tasks = tasks.filter(t => t.startTime <= toDate)
  }
  
  return tasks
})

const activeFilters = computed(() => {
  let count = 0
  if (filters.value.type) count++
  if (filters.value.status) count++
  if (filters.value.dateFrom) count++
  if (filters.value.dateTo) count++
  return count
})

const analytics = computed(() => {
  const tasks = filteredTasks.value
  const completed = tasks.filter(t => t.status === 'completed')
  
  return {
    totalTasks: tasks.length,
    successRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,
    avgDuration: completed.length > 0 ? 
      Math.round(completed.reduce((sum, t) => sum + t.duration, 0) / completed.length / 60) : 0,
    totalArea: Math.round(completed.reduce((sum, t) => sum + (t.area || 0), 0))
  }
})

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'completed': 'positive',
    'failed': 'negative',
    'cancelled': 'warning'
  }
  return colors[status] || 'grey'
}

function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 80) return 'positive'
  if (efficiency >= 60) return 'warning'
  return 'negative'
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function viewTaskDetails(task: TaskMetadata) {
  selectedTask.value = task
  showDetailsDialog.value = true
}

function repeatTask(task: TaskMetadata) {
  $q.dialog({
    title: 'Repeat Task',
    message: `Create a new task based on "${task.name}"?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    try {
      taskStore.createTaskFromTemplate?.(task)
      
      $q.notify({
        type: 'positive',
        message: 'Task repeated successfully',
        position: 'top'
      })
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: 'Failed to repeat task',
        caption: error instanceof Error ? error.message : String(error),
        position: 'top'
      })
    }
  })
}

function deleteTask(taskId: string) {
  $q.dialog({
    title: 'Delete Task',
    message: 'Remove this task from history? This cannot be undone.',
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(() => {
    try {
      taskStore.deleteFromHistory?.(taskId)
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: 'Failed to delete task',
        caption: error instanceof Error ? error.message : String(error),
        position: 'top'
      })
    }
  })
}

function exportHistory() {
  try {
    const data = JSON.stringify(filteredTasks.value, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `task-history-${Date.now()}.json`
    a.click()
    
    URL.revokeObjectURL(url)
    
    $q.notify({
      type: 'positive',
      message: 'History exported successfully',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to export history',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}
</script>

<style lang="scss" scoped>
.analytics-panel {
  background: $blue-1;
  padding: 16px;
  border-radius: 8px;
  
  .body--dark & {
    background: $blue-10;
  }
}

.stat-card {
  text-align: center;
  padding: 12px;
  background: white;
  border-radius: 8px;
  
  .body--dark & {
    background: $grey-8;
  }
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: $primary;
}

.stat-label {
  font-size: 12px;
  color: $grey-7;
  margin-top: 4px;
}
</style>