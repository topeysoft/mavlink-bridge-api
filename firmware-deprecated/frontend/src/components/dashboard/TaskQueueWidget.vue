<template>
  <q-card flat bordered class="task-queue-widget">
    <q-card-section class="task-queue-widget__header">
      <div class="row items-center justify-between">
        <div>
          <h3 class="task-queue-widget__title">Task Queue</h3>
          <p class="task-queue-widget__subtitle">
            {{ activeTasks }} active, {{ pendingTasks }} pending
          </p>
        </div>

        <div class="task-queue-widget__actions">
          <q-btn flat round dense icon="add" @click="$emit('add-task')">
            <q-tooltip>Add Task</q-tooltip>
          </q-btn>

          <q-btn flat round dense icon="refresh" @click="$emit('refresh')">
            <q-tooltip>Refresh</q-tooltip>
          </q-btn>

          <q-btn flat round dense icon="fullscreen" @click="$emit('expand')">
            <q-tooltip>View All Tasks</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <!-- Task List -->
    <q-card-section class="task-queue-widget__content">
      <div v-if="tasks.length === 0" class="task-queue-widget__empty">
        <q-icon name="assignment" size="48px" class="text-grey-4" />
        <div class="text-grey-6 q-mt-md">No tasks in queue</div>
        <q-btn
          flat
          color="primary"
          label="Create Task"
          class="q-mt-md"
          @click="$emit('add-task')"
        />
      </div>

      <q-list v-else separator class="task-queue-widget__list">
        <TaskQueueItem
          v-for="task in displayTasks"
          :key="task.id"
          :task="task"
          @select="$emit('task-select', task.id)"
          @action="$emit('task-action', $event, task.id)"
        />

        <q-item
          v-if="hasMoreTasks"
          clickable
          class="task-queue-widget__more"
          @click="$emit('view-all')"
        >
          <q-item-section avatar>
            <q-icon name="more_horiz" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-primary"> View {{ remainingTasks }} more tasks </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="arrow_forward" color="primary" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <!-- Quick Actions Footer -->
    <q-separator />
    <q-card-section class="task-queue-widget__footer">
      <div class="row items-center q-gutter-sm">
        <q-btn
          flat
          size="sm"
          icon="play_arrow"
          label="Start Next"
          color="positive"
          :disable="!hasNextTask"
          @click="$emit('start-next')"
        />

        <q-btn
          flat
          size="sm"
          icon="pause"
          label="Pause All"
          color="warning"
          :disable="activeTasks === 0"
          @click="$emit('pause-all')"
        />

        <q-space />

        <q-btn flat size="sm" label="Schedule" color="primary" @click="$emit('schedule')" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Components
import TaskQueueItem from './TaskQueueItem.vue'

// Types
interface Task {
  id: string
  name: string
  type: 'mowing' | 'trimming' | 'cleaning' | 'maintenance'
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignedMachine?: string
  estimatedDuration: number // in minutes
  progress: number // 0-100
  scheduledTime?: string
  startedTime?: string
  area?: string
}

interface Props {
  tasks: Task[]
  maxDisplay?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxDisplay: 5
})

// Emits
defineEmits<{
  'task-select': [taskId: string]
  'task-action': [action: string, taskId: string]
  'add-task': []
  refresh: []
  expand: []
  'view-all': []
  'start-next': []
  'pause-all': []
  schedule: []
}>()

// Computed properties
const activeTasks = computed(() => props.tasks.filter(t => t.status === 'running').length)

const pendingTasks = computed(() => props.tasks.filter(t => t.status === 'pending').length)

const displayTasks = computed(() => props.tasks.slice(0, props.maxDisplay))

const hasMoreTasks = computed(() => props.tasks.length > props.maxDisplay)

const remainingTasks = computed(() => Math.max(0, props.tasks.length - props.maxDisplay))

const hasNextTask = computed(() => props.tasks.some(t => t.status === 'pending'))
</script>

<style lang="scss" scoped>
.task-queue-widget {
  border-radius: 12px;
}

.task-queue-widget__header {
  padding: 20px 24px 16px;
}

.task-queue-widget__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.task-queue-widget__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-7);
  margin: 0;
}

.task-queue-widget__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-queue-widget__content {
  padding: 0;
  min-height: 200px;
}

.task-queue-widget__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  text-align: center;
  padding: 24px;
}

.task-queue-widget__list {
  .q-item {
    padding: 0;
  }
}

.task-queue-widget__more {
  padding: 16px 24px;
  background-color: rgba(var(--q-primary-rgb), 0.05);

  &:hover {
    background-color: rgba(var(--q-primary-rgb), 0.1);
  }
}

.task-queue-widget__footer {
  padding: 16px 24px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .task-queue-widget__header {
    padding: 16px 20px 12px;

    .row {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .task-queue-widget__actions {
      justify-content: center;
    }
  }

  .task-queue-widget__footer {
    padding: 12px 20px;

    .row {
      flex-direction: column;
      gap: 8px;
    }
  }
}

@media (max-width: 599px) {
  .task-queue-widget__header {
    padding: 12px 16px;
  }

  .task-queue-widget__footer {
    padding: 12px 16px;
  }

  .task-queue-widget__empty {
    padding: 20px 16px;
  }
}
</style>
