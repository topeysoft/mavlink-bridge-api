<template>
  <q-item
    class="task-queue-item"
    :class="{
      'task-queue-item--high-priority': task.priority === 'high',
      'task-queue-item--selected': selected
    }"
    clickable
    @click="$emit('click', task)"
  >
    <q-item-section avatar>
      <q-icon :name="getTaskIcon(task.type)" :color="getTaskColor(task.status)" size="20px" />
    </q-item-section>

    <q-item-section>
      <q-item-label class="task-queue-item__title">
        {{ task.title }}
      </q-item-label>

      <q-item-label caption class="task-queue-item__details">
        <span class="task-queue-item__machine">
          {{ task.machineId }}
        </span>
        <span class="task-queue-item__separator">•</span>
        <span class="task-queue-item__time">
          {{ formatDuration(task.estimatedDuration) }}
        </span>
        <span v-if="task.scheduledFor" class="task-queue-item__separator">•</span>
        <span v-if="task.scheduledFor" class="task-queue-item__scheduled">
          {{ formatScheduled(task.scheduledFor) }}
        </span>
      </q-item-label>
    </q-item-section>

    <q-item-section side>
      <div class="task-queue-item__actions">
        <!-- Priority badge -->
        <q-badge
          v-if="task.priority === 'high'"
          color="negative"
          text-color="white"
          class="task-queue-item__priority-badge"
        >
          High
        </q-badge>

        <!-- Status badge -->
        <q-badge
          :color="getStatusColor(task.status)"
          :text-color="task.status === 'pending' ? 'dark' : 'white'"
          class="task-queue-item__status-badge"
        >
          {{ task.status }}
        </q-badge>

        <!-- Action menu -->
        <q-btn flat round dense size="sm" icon="more_vert" @click.stop="showMenu = !showMenu">
          <q-menu v-model="showMenu" auto-close>
            <q-list dense>
              <q-item v-if="task.status === 'pending'" clickable @click="$emit('start', task)">
                <q-item-section avatar>
                  <q-icon name="play_arrow" color="positive" />
                </q-item-section>
                <q-item-section>Start Now</q-item-section>
              </q-item>

              <q-item v-if="task.status === 'running'" clickable @click="$emit('pause', task)">
                <q-item-section avatar>
                  <q-icon name="pause" color="warning" />
                </q-item-section>
                <q-item-section>Pause</q-item-section>
              </q-item>

              <q-item clickable @click="$emit('edit', task)">
                <q-item-section avatar>
                  <q-icon name="edit" />
                </q-item-section>
                <q-item-section>Edit</q-item-section>
              </q-item>

              <q-item clickable @click="$emit('duplicate', task)">
                <q-item-section avatar>
                  <q-icon name="content_copy" />
                </q-item-section>
                <q-item-section>Duplicate</q-item-section>
              </q-item>

              <q-separator />

              <q-item clickable @click="$emit('delete', task)">
                <q-item-section avatar>
                  <q-icon name="delete" color="negative" />
                </q-item-section>
                <q-item-section>Delete</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
    </q-item-section>

    <!-- Selection checkbox -->
    <q-item-section v-if="selectable" side>
      <q-checkbox
        :model-value="selected"
        @update:model-value="$emit('select', task, $event)"
        @click.stop
      />
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Types
interface Task {
  id: string
  title: string
  type: 'mowing' | 'trimming' | 'maintenance' | 'charging' | 'navigation'
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  priority: 'low' | 'medium' | 'high'
  machineId: string
  estimatedDuration: number // in minutes
  scheduledFor?: string // ISO date string
  progress?: number // 0-100
}

// Props
defineProps<{
  task: Task
  selected?: boolean
  selectable?: boolean
}>()

// Emits
defineEmits<{
  click: [task: Task]
  select: [task: Task, selected: boolean]
  start: [task: Task]
  pause: [task: Task]
  edit: [task: Task]
  duplicate: [task: Task]
  delete: [task: Task]
}>()

// Local state
const showMenu = ref(false)

// Methods
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
    pending: 'grey-6',
    running: 'positive',
    paused: 'warning',
    completed: 'positive',
    failed: 'negative'
  }
  return colors[status as keyof typeof colors] || 'grey-6'
}

const getStatusColor = (status: string) => {
  const colors = {
    pending: 'grey-4',
    running: 'positive',
    paused: 'warning',
    completed: 'positive',
    failed: 'negative'
  }
  return colors[status as keyof typeof colors] || 'grey-4'
}

const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

const formatScheduled = (scheduledFor: string) => {
  const date = new Date(scheduledFor)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 0) {
    return 'Overdue'
  } else if (diffMins < 60) {
    return `in ${diffMins}m`
  } else if (diffMins < 1440) {
    // 24 hours
    const hours = Math.floor(diffMins / 60)
    return `in ${hours}h`
  } else {
    return date.toLocaleDateString()
  }
}
</script>

<style lang="scss" scoped>
.task-queue-item {
  border-radius: 8px;
  margin-bottom: 2px;

  &:hover {
    background-color: rgba(var(--q-primary-rgb), 0.05);
  }

  &--high-priority {
    border-left: 3px solid var(--q-negative);
    padding-left: 13px;
  }

  &--selected {
    background-color: rgba(var(--q-primary-rgb), 0.1);
  }
}

.task-queue-item__title {
  font-weight: 500;
  font-size: 0.875rem;
}

.task-queue-item__details {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
}

.task-queue-item__machine {
  color: var(--q-primary);
  font-weight: 500;
}

.task-queue-item__separator {
  color: var(--q-grey-5);
}

.task-queue-item__time {
  color: var(--q-grey-7);
}

.task-queue-item__scheduled {
  color: var(--q-grey-7);
}

.task-queue-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-queue-item__priority-badge {
  font-size: 0.65rem;
  font-weight: 600;
}

.task-queue-item__status-badge {
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: capitalize;
}

// Responsive adjustments
@media (max-width: 479px) {
  .task-queue-item__title {
    font-size: 0.8rem;
  }

  .task-queue-item__details {
    font-size: 0.7rem;
  }

  .task-queue-item__priority-badge,
  .task-queue-item__status-badge {
    font-size: 0.6rem;
  }
}
</style>
