<template>
  <q-dialog :model-value="true" position="right" full-height @update:model-value="$emit('close')">
    <q-card style="width: 500px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Edit Task</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="$emit('close')" />
      </q-card-section>

      <q-card-section>
        <q-form @submit="handleSubmit">
          <div class="q-gutter-md">
            <!-- Basic Information -->
            <div class="text-subtitle2">Basic Information</div>

            <q-input v-model="taskData.title" label="Task Title" required outlined />

            <q-select
              v-model="taskData.type"
              :options="taskTypeOptions"
              label="Task Type"
              outlined
              disable
            />

            <q-input
              v-model="taskData.description"
              label="Description"
              type="textarea"
              rows="3"
              outlined
            />

            <q-select
              v-model="taskData.priority"
              :options="priorityOptions"
              label="Priority"
              outlined
            />

            <!-- Status Information -->
            <div class="text-subtitle2 q-mt-md">Current Status</div>

            <q-chip
              :color="getStatusColor(taskData.status)"
              text-color="white"
              :label="formatStatus(taskData.status)"
              size="md"
            />

            <div v-if="taskData.progress !== undefined" class="q-mt-sm">
              <div class="text-caption q-mb-xs">Progress: {{ taskData.progress }}%</div>
              <q-linear-progress :value="taskData.progress / 100" color="primary" size="8px" />
            </div>

            <!-- Machine Assignment -->
            <div class="text-subtitle2 q-mt-md">Machine Assignment</div>

            <q-select
              v-model="taskData.machineId"
              :options="availableMachines"
              label="Assigned Machine"
              outlined
              clearable
            />

            <!-- Zone Selection -->
            <div class="text-subtitle2 q-mt-md">Zone Configuration</div>

            <q-select
              v-model="taskData.zones"
              :options="availableZones"
              label="Work Zones"
              multiple
              outlined
            />

            <!-- Scheduling -->
            <div class="text-subtitle2 q-mt-md">Scheduling</div>

            <q-input
              v-model="taskData.scheduledFor"
              label="Scheduled For"
              type="datetime-local"
              outlined
              clearable
            />

            <q-input
              v-model.number="taskData.estimatedDuration"
              label="Estimated Duration (minutes)"
              type="number"
              min="1"
              max="480"
              outlined
            />

            <!-- Task Actions -->
            <div class="text-subtitle2 q-mt-md">Task Actions</div>

            <div class="row q-gutter-sm">
              <q-btn
                v-if="taskData.status === 'pending'"
                label="Start Task"
                color="positive"
                icon="play_arrow"
                outline
                @click="updateTaskStatus('running')"
              />

              <q-btn
                v-if="taskData.status === 'running'"
                label="Pause Task"
                color="warning"
                icon="pause"
                outline
                @click="updateTaskStatus('paused')"
              />

              <q-btn
                v-if="taskData.status === 'paused'"
                label="Resume Task"
                color="positive"
                icon="play_arrow"
                outline
                @click="updateTaskStatus('running')"
              />

              <q-btn
                v-if="['running', 'paused'].includes(taskData.status)"
                label="Stop Task"
                color="negative"
                icon="stop"
                outline
                @click="updateTaskStatus('pending')"
              />
            </div>

            <!-- Task History -->
            <div class="text-subtitle2 q-mt-md">Task Information</div>

            <div class="task-edit__info-grid">
              <div class="task-edit__info-item">
                <div class="task-edit__info-label">Created</div>
                <div class="task-edit__info-value">{{ formatDateTime(taskData.createdAt) }}</div>
              </div>

              <div class="task-edit__info-item">
                <div class="task-edit__info-label">Last Updated</div>
                <div class="task-edit__info-value">{{ formatDateTime(taskData.updatedAt) }}</div>
              </div>

              <div class="task-edit__info-item">
                <div class="task-edit__info-label">Task ID</div>
                <div class="task-edit__info-value">{{ taskData.id }}</div>
              </div>
            </div>
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn label="Cancel" color="grey" outline @click="$emit('close')" />
        <q-btn label="Save Changes" color="primary" :loading="saving" @click="handleSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar, date } from 'quasar'

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
  description?: string
}

const props = defineProps<{
  task: Task
}>()

// Emits
const emit = defineEmits<{
  save: [task: Task]
  close: []
}>()

// Composables
const $q = useQuasar()

// Local state
const saving = ref(false)
const taskData = ref<Task>({ ...props.task })

// Options
const taskTypeOptions = [
  { label: 'Mowing', value: 'mowing' },
  { label: 'Trimming', value: 'trimming' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Custom', value: 'custom' }
]

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
]

const availableMachines = [
  { label: 'Mower-01 (Available)', value: 'mower-01' },
  { label: 'Mower-02 (Busy)', value: 'mower-02', disable: true },
  { label: 'Trimmer-01 (Available)', value: 'trimmer-01' },
  { label: 'Maintenance Bot (Available)', value: 'maintenance-01' }
]

const availableZones = [
  { label: 'Front Yard', value: 'front-yard' },
  { label: 'Back Yard', value: 'back-yard' },
  { label: 'Side Garden', value: 'side-garden' },
  { label: 'Perimeter', value: 'perimeter' },
  { label: 'Pool Area', value: 'pool-area' },
  { label: 'Entrance', value: 'entrance' }
]

// Methods
const getStatusColor = (status: string) => {
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

const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatDateTime = (dateString: string) => {
  return date.formatDate(new Date(dateString), 'MMM D, YYYY h:mm A')
}

const updateTaskStatus = (newStatus: string) => {
  taskData.value.status = newStatus as Task['status']
  taskData.value.updatedAt = new Date().toISOString()

  $q.notify({
    type: 'positive',
    message: `Task status updated to ${formatStatus(newStatus)}`
  })
}

const validateForm = () => {
  if (!taskData.value.title.trim()) {
    $q.notify({
      type: 'negative',
      message: 'Task title is required'
    })
    return false
  }

  if (taskData.value.zones.length === 0) {
    $q.notify({
      type: 'negative',
      message: 'At least one zone must be selected'
    })
    return false
  }

  return true
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  saving.value = true

  try {
    // Update timestamp
    taskData.value.updatedAt = new Date().toISOString()

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800))

    emit('save', taskData.value)

    $q.notify({
      type: 'positive',
      message: 'Task updated successfully'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to update task'
    })
  } finally {
    saving.value = false
  }
}

// Lifecycle
onMounted(() => {
  // Initialize with current task data
  taskData.value = { ...props.task }
})
</script>

<style lang="scss" scoped>
.q-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.q-card-section {
  &:nth-child(2) {
    flex: 1;
    overflow-y: auto;
  }
}

.task-edit__info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  background: var(--q-grey-1);
  border-radius: 8px;
  padding: 16px;

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.task-edit__info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-edit__info-label {
  font-weight: 500;
  color: var(--q-grey-7);
  font-size: 0.875rem;
}

.task-edit__info-value {
  font-size: 0.875rem;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

// Responsive adjustments
@media (max-width: 599px) {
  .q-card {
    width: 100vw !important;
    max-width: 100vw !important;
  }

  .task-edit__info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
