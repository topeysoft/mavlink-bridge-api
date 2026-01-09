<template>
  <q-card class="task-details-dialog" style="width: 500px; max-width: 90vw">
    <q-card-section class="task-details-dialog__header">
      <div class="task-details-dialog__title-section">
        <q-icon :name="getTaskIcon(task.type)" size="32px" color="primary" class="q-mr-md" />
        <div>
          <div class="text-h6">Task Details</div>
          <div class="text-subtitle2 text-grey-6">
            {{ task.title }}
          </div>
        </div>
      </div>

      <q-btn flat round icon="close" @click="closeDialog" />
    </q-card-section>

    <q-separator />

    <q-card-section class="task-details-dialog__content">
      <div class="task-details-dialog__info">
        <!-- Task Status -->
        <div class="task-details-dialog__section">
          <h6 class="q-mb-md">Status Information</h6>
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <q-chip
                :color="getStatusColor(task.status)"
                text-color="white"
                :icon="getStatusIcon(task.status)"
              >
                {{ task.status.charAt(0).toUpperCase() + task.status.slice(1) }}
              </q-chip>
            </div>
            <div class="col-6">
              <q-chip
                :color="getTypeColor(task.type)"
                text-color="white"
                :icon="getTaskIcon(task.type)"
              >
                {{ task.type.charAt(0).toUpperCase() + task.type.slice(1) }}
              </q-chip>
            </div>
          </div>
        </div>

        <!-- Timing Information -->
        <div class="task-details-dialog__section">
          <h6 class="q-mb-md">Timing</h6>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input
                :model-value="formatDateTime(task.startTime)"
                label="Start Time"
                readonly
                outlined
                dense
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                :model-value="task.endTime ? formatDateTime(task.endTime) : 'N/A'"
                label="End Time"
                readonly
                outlined
                dense
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                :model-value="formatDuration(task.duration)"
                label="Duration"
                readonly
                outlined
                dense
              />
            </div>
          </div>
        </div>

        <!-- Performance Metrics -->
        <div v-if="task.areaCovered || task.efficiency" class="task-details-dialog__section">
          <h6 class="q-mb-md">Performance</h6>
          <div class="row q-col-gutter-md">
            <div v-if="task.areaCovered" class="col-12 col-md-6">
              <q-input
                :model-value="`${task.areaCovered} m²`"
                label="Area Covered"
                readonly
                outlined
                dense
              />
            </div>
            <div v-if="task.efficiency" class="col-12 col-md-6">
              <q-input
                :model-value="`${task.efficiency}%`"
                label="Efficiency"
                readonly
                outlined
                dense
              />
            </div>
          </div>
        </div>

        <!-- Notes and Errors -->
        <div
          v-if="task.notes || (task.errors && task.errors.length > 0)"
          class="task-details-dialog__section"
        >
          <h6 class="q-mb-md">Additional Information</h6>

          <div v-if="task.notes" class="q-mb-md">
            <q-input
              :model-value="task.notes"
              label="Notes"
              type="textarea"
              readonly
              outlined
              rows="3"
            />
          </div>

          <div v-if="task.errors && task.errors.length > 0" class="task-details-dialog__errors">
            <q-list bordered>
              <q-item-label header class="text-negative">
                <q-icon name="error" class="q-mr-sm" />
                Errors Encountered
              </q-item-label>
              <q-item v-for="(error, index) in task.errors" :key="index" class="text-negative">
                <q-item-section avatar>
                  <q-icon name="warning" color="negative" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ error }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-actions align="right" class="q-pa-md">
      <q-btn flat label="Close" color="grey" @click="closeDialog" />
      <q-btn
        v-if="canRepeatTask"
        unelevated
        label="Repeat Task"
        color="primary"
        icon="replay"
        @click="emitRepeat"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props
interface HistoryItem {
  id: string
  title: string
  type: 'mowing' | 'trimming' | 'maintenance' | 'charging' | 'navigation'
  status: 'completed' | 'failed' | 'cancelled' | 'paused'
  startTime: string
  endTime?: string
  duration: number
  areaCovered?: number
  efficiency?: number
  notes?: string
  errors?: string[]
}

interface Props {
  task: HistoryItem
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
  repeat: [task: HistoryItem]
}>()

// Computed
const canRepeatTask = computed(() => {
  return (
    ['mowing', 'trimming', 'navigation'].includes(props.task.type) && props.task.status !== 'paused'
  )
})

// Methods
const getTaskIcon = (type: string) => {
  const icons: Record<string, string> = {
    mowing: 'grass',
    trimming: 'content_cut',
    maintenance: 'build',
    charging: 'battery_charging_full',
    navigation: 'explore'
  }
  return icons[type] || 'task'
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    completed: 'green',
    failed: 'red',
    cancelled: 'orange',
    paused: 'blue'
  }
  return colors[status] || 'grey'
}

const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    completed: 'check_circle',
    failed: 'error',
    cancelled: 'cancel',
    paused: 'pause_circle'
  }
  return icons[status] || 'help'
}

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    mowing: 'green',
    trimming: 'teal',
    maintenance: 'orange',
    charging: 'blue',
    navigation: 'purple'
  }
  return colors[type] || 'grey'
}

const formatDateTime = (dateTimeString: string) => {
  try {
    const date = new Date(dateTimeString)
    return date.toLocaleString()
  } catch {
    return dateTimeString
  }
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) {
    return `${mins} min`
  } else if (mins === 0) {
    return `${hours} hr`
  } else {
    return `${hours} hr ${mins} min`
  }
}

const closeDialog = () => {
  emit('close')
}

const emitRepeat = () => {
  emit('repeat', props.task)
}
</script>

<style scoped lang="scss">
.task-details-dialog {
  &__header {
    background-color: var(--q-primary);
    color: white;

    .task-details-dialog__title-section {
      display: flex;
      align-items: center;
    }
  }

  &__content {
    max-height: 70vh;
    overflow-y: auto;
  }

  &__section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    h6 {
      margin-top: 0;
      color: var(--q-primary);
      font-weight: 600;
    }
  }

  &__errors {
    .q-list {
      border-radius: 8px;
    }
  }
}
</style>
