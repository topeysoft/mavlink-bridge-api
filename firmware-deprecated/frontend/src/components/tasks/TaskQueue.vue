<template>
  <div class="task-queue">
    <!-- Queue Controls -->
    <div class="task-queue__controls">
      <div class="task-queue__filters">
        <q-select
          v-model="statusFilter"
          :options="statusOptions"
          label="Status"
          outlined
          dense
          style="min-width: 120px"
        />

        <q-select
          v-model="typeFilter"
          :options="typeOptions"
          label="Type"
          outlined
          dense
          style="min-width: 120px"
        />

        <q-select
          v-model="priorityFilter"
          :options="priorityOptions"
          label="Priority"
          outlined
          dense
          style="min-width: 120px"
        />

        <q-input v-model="searchQuery" placeholder="Search tasks..." outlined dense clearable>
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>

      <div class="task-queue__actions">
        <q-btn
          icon="play_arrow"
          label="Start All"
          color="positive"
          :disable="!canStartAll"
          outline
          @click="startAllTasks"
        />

        <q-btn
          icon="pause"
          label="Pause All"
          color="warning"
          :disable="!canPauseAll"
          outline
          @click="pauseAllTasks"
        />

        <q-btn icon="refresh" label="Refresh" color="primary" outline @click="$emit('refresh')" />
      </div>
    </div>

    <!-- Task List -->
    <div class="task-queue__list">
      <q-virtual-scroll v-slot="{ item: task, index }" :items="filteredTasks" separator>
        <q-item :key="task.id" class="task-queue__item" clickable @click="$emit('task-view', task)">
          <q-item-section avatar>
            <q-avatar
              :color="getTaskStatusColor(task.status)"
              text-color="white"
              :icon="getTaskTypeIcon(task.type)"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="task-queue__title">
              {{ task.title }}
            </q-item-label>

            <q-item-label caption class="task-queue__meta">
              <span class="task-queue__type">{{ formatTaskType(task.type) }}</span>
              <span class="task-queue__separator">•</span>
              <span class="task-queue__zones">{{ task.zones.join(', ') || 'No zones' }}</span>
              <span class="task-queue__separator">•</span>
              <span class="task-queue__duration">{{ task.estimatedDuration }}min</span>
            </q-item-label>

            <q-item-label caption class="task-queue__details">
              <span v-if="task.machineId" class="task-queue__machine">
                Machine: {{ task.machineId }}
              </span>
              <span v-if="task.scheduledFor" class="task-queue__scheduled">
                Scheduled: {{ formatDateTime(task.scheduledFor) }}
              </span>
            </q-item-label>

            <!-- Progress Bar -->
            <div
              v-if="task.status === 'running' && task.progress !== undefined"
              class="task-queue__progress"
            >
              <q-linear-progress
                :value="task.progress / 100"
                color="primary"
                size="4px"
                class="q-mt-sm"
              />
              <div class="text-caption text-grey-6 q-mt-xs">{{ task.progress }}% complete</div>
            </div>
          </q-item-section>

          <q-item-section side>
            <div class="task-queue__status">
              <q-chip
                :color="getTaskStatusColor(task.status)"
                text-color="white"
                :label="formatTaskStatus(task.status)"
                size="sm"
              />

              <q-chip
                :color="getPriorityColor(task.priority)"
                text-color="white"
                :label="task.priority.toUpperCase()"
                size="sm"
                outline
              />
            </div>
          </q-item-section>

          <q-item-section side>
            <div class="task-queue__controls-section">
              <!-- Task Control Buttons -->
              <div class="task-queue__task-controls">
                <q-btn
                  v-if="task.status === 'pending'"
                  icon="play_arrow"
                  color="positive"
                  size="sm"
                  round
                  dense
                  @click.stop="$emit('task-start', task)"
                >
                  <q-tooltip>Start Task</q-tooltip>
                </q-btn>

                <q-btn
                  v-if="task.status === 'running'"
                  icon="pause"
                  color="warning"
                  size="sm"
                  round
                  dense
                  @click.stop="$emit('task-pause', task)"
                >
                  <q-tooltip>Pause Task</q-tooltip>
                </q-btn>

                <q-btn
                  v-if="task.status === 'paused'"
                  icon="play_arrow"
                  color="positive"
                  size="sm"
                  round
                  dense
                  @click.stop="$emit('task-start', task)"
                >
                  <q-tooltip>Resume Task</q-tooltip>
                </q-btn>

                <q-btn
                  v-if="['running', 'paused'].includes(task.status)"
                  icon="stop"
                  color="negative"
                  size="sm"
                  round
                  dense
                  @click.stop="$emit('task-stop', task)"
                >
                  <q-tooltip>Stop Task</q-tooltip>
                </q-btn>
              </div>

              <!-- More Actions Menu -->
              <q-btn icon="more_vert" size="sm" round dense flat @click.stop>
                <q-menu>
                  <q-list>
                    <q-item v-close-popup clickable @click="$emit('task-edit', task)">
                      <q-item-section avatar>
                        <q-icon name="edit" />
                      </q-item-section>
                      <q-item-section>Edit</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="$emit('task-duplicate', task)">
                      <q-item-section avatar>
                        <q-icon name="content_copy" />
                      </q-item-section>
                      <q-item-section>Duplicate</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="showTaskDetails(task)">
                      <q-item-section avatar>
                        <q-icon name="info" />
                      </q-item-section>
                      <q-item-section>Details</q-item-section>
                    </q-item>

                    <q-separator />

                    <q-item
                      v-close-popup
                      clickable
                      class="text-negative"
                      @click="$emit('task-delete', task)"
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
      </q-virtual-scroll>

      <!-- Empty State -->
      <div v-if="filteredTasks.length === 0" class="task-queue__empty">
        <q-icon name="assignment" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-md">
          {{
            searchQuery || hasActiveFilters ? 'No tasks match your filters' : 'No tasks in queue'
          }}
        </div>
        <div class="text-body2 text-grey-5 q-mt-sm">
          {{
            searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Create a new task to get started'
          }}
        </div>
      </div>
    </div>

    <!-- Task Details Dialog -->
    <q-dialog v-model="showDetailsDialog" position="right">
      <q-card style="width: 400px; max-width: 90vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Task Details</div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-card-section v-if="selectedTaskDetails">
          <div class="task-queue__details-content">
            <div class="task-queue__detail-item">
              <div class="task-queue__detail-label">Title</div>
              <div class="task-queue__detail-value">{{ selectedTaskDetails.title }}</div>
            </div>

            <div class="task-queue__detail-item">
              <div class="task-queue__detail-label">Type</div>
              <div class="task-queue__detail-value">
                {{ formatTaskType(selectedTaskDetails.type) }}
              </div>
            </div>

            <div class="task-queue__detail-item">
              <div class="task-queue__detail-label">Status</div>
              <q-chip
                :color="getTaskStatusColor(selectedTaskDetails.status)"
                text-color="white"
                :label="formatTaskStatus(selectedTaskDetails.status)"
                size="sm"
              />
            </div>

            <div class="task-queue__detail-item">
              <div class="task-queue__detail-label">Priority</div>
              <q-chip
                :color="getPriorityColor(selectedTaskDetails.priority)"
                text-color="white"
                :label="selectedTaskDetails.priority.toUpperCase()"
                size="sm"
                outline
              />
            </div>

            <div v-if="selectedTaskDetails.machineId" class="task-queue__detail-item">
              <div class="task-queue__detail-label">Machine</div>
              <div class="task-queue__detail-value">{{ selectedTaskDetails.machineId }}</div>
            </div>

            <div class="task-queue__detail-item">
              <div class="task-queue__detail-label">Zones</div>
              <div class="task-queue__detail-value">
                {{ selectedTaskDetails.zones.join(', ') || 'No zones' }}
              </div>
            </div>

            <div class="task-queue__detail-item">
              <div class="task-queue__detail-label">Estimated Duration</div>
              <div class="task-queue__detail-value">
                {{ selectedTaskDetails.estimatedDuration }} minutes
              </div>
            </div>

            <div v-if="selectedTaskDetails.scheduledFor" class="task-queue__detail-item">
              <div class="task-queue__detail-label">Scheduled For</div>
              <div class="task-queue__detail-value">
                {{ formatDateTime(selectedTaskDetails.scheduledFor) }}
              </div>
            </div>

            <div class="task-queue__detail-item">
              <div class="task-queue__detail-label">Created</div>
              <div class="task-queue__detail-value">
                {{ formatDateTime(selectedTaskDetails.createdAt) }}
              </div>
            </div>

            <div class="task-queue__detail-item">
              <div class="task-queue__detail-label">Last Updated</div>
              <div class="task-queue__detail-value">
                {{ formatDateTime(selectedTaskDetails.updatedAt) }}
              </div>
            </div>

            <div v-if="selectedTaskDetails.progress !== undefined" class="task-queue__detail-item">
              <div class="task-queue__detail-label">Progress</div>
              <div class="task-queue__detail-value">{{ selectedTaskDetails.progress }}%</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { date } from 'quasar'

// Props
interface Task {
  id: string
  title: string
  type: 'mowing' | 'trimming' | 'maintenance' | 'custom'
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  priority: 'low' | 'medium' | 'high'
  machineId?: string
  zones: string[]
  scheduledFor?: string
  estimatedDuration: number
  progress?: number
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  tasks: Task[]
}>()

// Emits
const emit = defineEmits<{
  'task-start': [task: Task]
  'task-pause': [task: Task]
  'task-stop': [task: Task]
  'task-edit': [task: Task]
  'task-delete': [task: Task]
  'task-duplicate': [task: Task]
  'task-view': [task: Task]
  refresh: []
}>()

// Local state
const statusFilter = ref('all')
const typeFilter = ref('all')
const priorityFilter = ref('all')
const searchQuery = ref('')
const showDetailsDialog = ref(false)
const selectedTaskDetails = ref<Task | null>(null)

// Filter options
const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Running', value: 'running' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' }
]

const typeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Mowing', value: 'mowing' },
  { label: 'Trimming', value: 'trimming' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Custom', value: 'custom' }
]

const priorityOptions = [
  { label: 'All Priorities', value: 'all' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
]

// Computed
const filteredTasks = computed(() => {
  let filtered = [...props.tasks]

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(task => task.status === statusFilter.value)
  }

  // Apply type filter
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(task => task.type === typeFilter.value)
  }

  // Apply priority filter
  if (priorityFilter.value !== 'all') {
    filtered = filtered.filter(task => task.priority === priorityFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      task =>
        task.title.toLowerCase().includes(query) ||
        task.type.toLowerCase().includes(query) ||
        task.zones.some(zone => zone.toLowerCase().includes(query)) ||
        (task.machineId && task.machineId.toLowerCase().includes(query))
    )
  }

  return filtered
})

const hasActiveFilters = computed(() => {
  return (
    statusFilter.value !== 'all' || typeFilter.value !== 'all' || priorityFilter.value !== 'all'
  )
})

const canStartAll = computed(() => {
  return filteredTasks.value.some(task => task.status === 'pending' || task.status === 'paused')
})

const canPauseAll = computed(() => {
  return filteredTasks.value.some(task => task.status === 'running')
})

// Methods
const getTaskStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'grey-6'
    case 'running':
      return 'positive'
    case 'paused':
      return 'warning'
    case 'completed':
      return 'positive'
    case 'failed':
      return 'negative'
    default:
      return 'grey-6'
  }
}

const getTaskTypeIcon = (type: string) => {
  switch (type) {
    case 'mowing':
      return 'grass'
    case 'trimming':
      return 'content_cut'
    case 'maintenance':
      return 'build'
    case 'custom':
      return 'tune'
    default:
      return 'assignment'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'red-6'
    case 'medium':
      return 'orange-6'
    case 'low':
      return 'blue-6'
    default:
      return 'grey-6'
  }
}

const formatTaskType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const formatTaskStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatDateTime = (dateString: string) => {
  return date.formatDate(new Date(dateString), 'MMM D, YYYY h:mm A')
}

const showTaskDetails = (task: Task) => {
  selectedTaskDetails.value = task
  showDetailsDialog.value = true
}

const startAllTasks = () => {
  filteredTasks.value
    .filter(task => task.status === 'pending' || task.status === 'paused')
    .forEach(task => emit('task-start', task))
}

const pauseAllTasks = () => {
  filteredTasks.value
    .filter(task => task.status === 'running')
    .forEach(task => emit('task-pause', task))
}
</script>

<style lang="scss" scoped>
.task-queue {
  min-height: 400px;
}

.task-queue__controls {
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

.task-queue__filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
}

.task-queue__actions {
  display: flex;
  gap: 8px;
}

.task-queue__list {
  background: white;
  min-height: 300px;

  .body--dark & {
    background: var(--q-dark);
  }
}

.task-queue__item {
  padding: 16px 24px;
  border-bottom: 1px solid var(--q-grey-2);
  transition: background-color 0.2s ease;

  .body--dark & {
    border-bottom-color: var(--q-grey-8);
  }

  &:hover {
    background-color: var(--q-grey-1);

    .body--dark & {
      background-color: var(--q-grey-9);
    }
  }
}

.task-queue__title {
  font-weight: 500;
  font-size: 1rem;
}

.task-queue__meta {
  margin-top: 4px;
  display: flex;
  align-items: center;
}

.task-queue__separator {
  margin: 0 8px;
  color: var(--q-grey-5);
}

.task-queue__details {
  margin-top: 4px;
}

.task-queue__progress {
  margin-top: 8px;
}

.task-queue__status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.task-queue__controls-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.task-queue__task-controls {
  display: flex;
  gap: 4px;
}

.task-queue__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.task-queue__details-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-queue__detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-queue__detail-label {
  font-weight: 500;
  color: var(--q-grey-7);
  font-size: 0.875rem;
}

.task-queue__detail-value {
  font-size: 0.9rem;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .task-queue__controls {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .task-queue__filters {
    flex-wrap: wrap;
    gap: 8px;
  }

  .task-queue__actions {
    justify-content: flex-end;
  }
}

@media (max-width: 599px) {
  .task-queue__controls {
    padding: 12px 16px;
  }

  .task-queue__item {
    padding: 12px 16px;
  }

  .task-queue__controls-section {
    flex-direction: row;
    align-items: center;
  }

  .task-queue__status {
    flex-direction: row;
    gap: 8px;
  }

  .task-queue__filters {
    .q-select,
    .q-input {
      min-width: 100px;
      flex: 1;
    }
  }
}
</style>
