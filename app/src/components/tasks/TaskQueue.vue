<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-h6">Task Queue</div>
          <div class="text-caption text-grey-7">
            {{ queuedTasks.length }} tasks queued
          </div>
        </div>
        <div class="col-auto">
          <q-btn-group>
            <q-btn
              :color="queueRunning ? 'negative' : 'positive'"
              :icon="queueRunning ? 'stop' : 'play_arrow'"
              :label="queueRunning ? 'Stop Queue' : 'Start Queue'"
              @click="toggleQueue"
            />
            <q-btn
              flat
              icon="add"
              @click="$emit('add-task')"
            >
              <q-tooltip>Add task to queue</q-tooltip>
            </q-btn>
          </q-btn-group>
        </div>
      </div>

      <!-- Queue Status -->
      <q-banner
        v-if="currentTask"
        class="bg-primary text-white q-mb-md"
        rounded
      >
        <template v-slot:avatar>
          <q-icon name="mdi-play-circle" />
        </template>
        Currently executing: {{ currentTask.name }}
        <div class="text-caption">
          {{ Math.round((currentTask as any).progress || 0) }}% complete • 
          {{ formatTime((currentTask as any).timeRemaining || 0) }} remaining
        </div>
      </q-banner>

      <!-- Queue List -->
      <q-list separator v-if="queuedTasks.length > 0">
        <draggable
          v-model="queuedTasksCopy"
          item-key="id"
          @end="reorderQueue"
          :disabled="queueRunning"
        >
          <template #item="{ element: task }">
            <q-item
              :class="{ 'bg-blue-1': task.id === currentTask?.id }"
            >
              <q-item-section avatar>
                <q-avatar
                  :color="getTaskStatusColor(task.status)"
                  text-color="white"
                  size="sm"
                >
                  <q-icon :name="getTaskStatusIcon(task.status)" />
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label>{{ task.name }}</q-item-label>
                <q-item-label caption>
                  {{ task.type }} • Est. {{ task.estimatedDuration }}min
                </q-item-label>
                <q-item-label caption v-if="task.scheduledFor">
                  Scheduled: {{ formatDateTime(task.scheduledFor) }}
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-chip
                    :color="getPriorityColor(task.priority)"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ task.priority }}
                  </q-chip>
                  
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="edit"
                    @click="editTask(task)"
                    :disable="queueRunning && task.status === 'running'"
                  />
                  
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="delete"
                    @click="removeFromQueue(task.id)"
                    :disable="queueRunning && task.status === 'running'"
                  />
                </div>
              </q-item-section>
            </q-item>
          </template>
        </draggable>
      </q-list>

      <div v-else class="text-center text-grey-6 q-py-xl">
        <q-icon name="mdi-format-list-checks" size="48px" />
        <div class="q-mt-md">No tasks in queue</div>
        <div class="text-caption">Add tasks to start automation</div>
      </div>
    </q-card-section>

    <!-- Queue Settings -->
    <q-separator />
    <q-card-section>
      <q-expansion-item
        icon="settings"
        label="Queue Settings"
        dense
      >
        <div class="q-pt-md q-gutter-md">
          <q-toggle
            v-model="queueSettings.autoStart"
            label="Auto-start queue when tasks are added"
          />
          
          <q-toggle
            v-model="queueSettings.continueOnError"
            label="Continue queue if a task fails"
          />
          
          <q-input
            v-model.number="queueSettings.delayBetweenTasks"
            label="Delay between tasks (seconds)"
            type="number"
            min="0"
            max="300"
          />
          
          <q-select
            v-model="queueSettings.batteryThreshold"
            :options="batteryThresholdOptions"
            label="Minimum battery to start task"
            emit-value
            map-options
          />
        </div>
      </q-expansion-item>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useTaskStore } from '../../stores/tasks'
import type { TaskMetadata } from '../../stores/tasks'
import draggable from 'vuedraggable'

const emit = defineEmits<{
  'add-task': []
  'edit-task': [task: TaskMetadata]
}>()

const $q = useQuasar()
const taskStore = useTaskStore()

const queueSettings = ref({
  autoStart: false,
  continueOnError: true,
  delayBetweenTasks: 30,
  batteryThreshold: 30
})

const batteryThresholdOptions = [
  { label: '20%', value: 20 },
  { label: '30%', value: 30 },
  { label: '40%', value: 40 },
  { label: '50%', value: 50 }
]

const queueRunning = computed(() => taskStore.queueRunning || false)
const queuedTasks = computed(() => taskStore.pendingTasks)
const currentTask = computed(() => taskStore.currentTask)

const queuedTasksCopy = computed({
  get: () => queuedTasks.value,
  set: () => {
    // Handle reordering - functionality would be implemented here
  }
})

function getTaskStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'pending': 'grey',
    'running': 'primary',
    'completed': 'positive',
    'failed': 'negative',
    'paused': 'warning'
  }
  return colors[status] || 'grey'
}

function getTaskStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    'pending': 'mdi-clock-outline',
    'running': 'mdi-play',
    'completed': 'mdi-check',
    'failed': 'mdi-alert',
    'paused': 'mdi-pause'
  }
  return icons[status] || 'mdi-help'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    'high': 'negative',
    'medium': 'warning',
    'low': 'info'
  }
  return colors[priority] || 'grey'
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function toggleQueue() {
  try {
    if (queueRunning.value) {
      taskStore.stopQueue?.()
    } else {
      taskStore.startQueue?.()
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to toggle queue',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

function editTask(task: TaskMetadata) {
  emit('edit-task', task)
}

function removeFromQueue(taskId: string) {
  $q.dialog({
    title: 'Remove Task',
    message: 'Remove this task from the queue?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    try {
      taskStore.removeFromQueue?.(taskId)
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: 'Failed to remove task',
        caption: error instanceof Error ? error.message : String(error),
        position: 'top'
      })
    }
  })
}

function reorderQueue(event: { oldIndex: number; newIndex: number }) {
  if (event.oldIndex !== event.newIndex && !queueRunning.value) {
    taskStore.reorderQueue?.(event.oldIndex, event.newIndex)
  }
}
</script>

<style lang="scss" scoped>
.q-item {
  .body--dark & {
    &.bg-blue-1 {
      background: $blue-10;
    }
  }
}
</style>