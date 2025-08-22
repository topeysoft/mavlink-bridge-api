<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Task Scheduler</div>
      
      <!-- Calendar View -->
      <div class="calendar-section q-mb-md">
        <q-date
          v-model="selectedDate"
          mask="YYYY-MM-DD"
          :events="eventDates"
          event-color="primary"
          class="full-width"
        />
      </div>

      <!-- Scheduled Tasks for Selected Date -->
      <div class="scheduled-tasks">
        <div class="text-subtitle1 q-mb-md">
          Scheduled Tasks for {{ formatDate(selectedDate || '') }}
        </div>
        
        <q-list v-if="tasksForDate.length > 0" separator>
          <q-item
            v-for="task in tasksForDate"
            :key="task.id"
            clickable
            @click="editScheduledTask(task)"
          >
            <q-item-section avatar>
              <q-avatar :color="getTaskTypeColor(task.type)" text-color="white" size="sm">
                <q-icon :name="getTaskTypeIcon(task.type)" />
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ task.name }}</q-item-label>
              <q-item-label caption>
                {{ task.time }} • {{ task.type }} • {{ task.frequency }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-toggle
                  v-model="task.enabled"
                  @update:model-value="updateTaskStatus(task)"
                  :color="task.enabled ? 'positive' : 'grey'"
                />
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="delete"
                  @click.stop="deleteScheduledTask(task.id)"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center text-grey-6 q-py-md">
          <q-icon name="mdi-calendar-blank" size="32px" />
          <div>No tasks scheduled for this date</div>
        </div>
      </div>

      <!-- Add Schedule Button -->
      <div class="text-center q-mt-md">
        <q-btn
          color="primary"
          icon="add"
          label="Schedule New Task"
          @click="showScheduleDialog = true"
        />
      </div>
    </q-card-section>

    <!-- Schedule Task Dialog -->
    <q-dialog v-model="showScheduleDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Schedule Task</div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-select
            v-model="scheduleForm.taskId"
            :options="availableTasks"
            label="Select Task"
            option-value="id"
            option-label="name"
            emit-value
            map-options
          />

          <q-input
            v-model="scheduleForm.date"
            label="Date"
            type="date"
          />

          <q-time
            v-model="scheduleForm.time"
            format24h
          />

          <q-select
            v-model="scheduleForm.frequency"
            :options="frequencyOptions"
            label="Frequency"
            emit-value
            map-options
          />

          <q-toggle
            v-model="scheduleForm.enabled"
            label="Enable schedule"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Schedule"
            @click="scheduleTask"
            :disable="!scheduleForm.taskId"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import type { ScheduledTask } from '../../stores/types'

const $q = useQuasar()
// const taskStore = useTaskStore() // Commented out as it's not used

const selectedDate = ref(new Date().toISOString().split('T')[0])
const showScheduleDialog = ref(false)

const scheduleForm = ref({
  taskId: '',
  date: '',
  time: '09:00',
  frequency: 'once',
  enabled: true
})

// Mock scheduled tasks data
const scheduledTasks = ref<ScheduledTask[]>([
  {
    id: '1',
    taskId: '1',
    name: 'Front Yard Mowing',
    type: 'mowing',
    date: '2024-01-15',
    time: '09:00',
    frequency: 'weekly' as const,
    enabled: true,
    status: 'scheduled'
  },
  {
    id: '2',
    taskId: '2',
    name: 'Perimeter Survey',
    type: 'survey',
    date: '2024-01-15',
    time: '14:00',
    frequency: 'monthly' as const,
    enabled: true,
    status: 'scheduled'
  }
])

const frequencyOptions = [
  { label: 'Once', value: 'once' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' }
]

const availableTasks = computed(() => [
  { id: '1', name: 'Front Yard Mowing' },
  { id: '2', name: 'Back Yard Mowing' },
  { id: '3', name: 'Perimeter Survey' },
  { id: '4', name: 'Battery Check' }
])

const eventDates = computed(() => {
  const dates = scheduledTasks.value.map(task => task.date)
  return [...new Set(dates)] // Remove duplicates
})

const tasksForDate = computed(() => {
  return scheduledTasks.value.filter(task => task.date === selectedDate.value)
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function getTaskTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'mowing': 'green',
    'survey': 'blue',
    'maintenance': 'orange'
  }
  return colors[type] || 'grey'
}

function getTaskTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'mowing': 'mdi-grass',
    'survey': 'mdi-map',
    'maintenance': 'mdi-tools'
  }
  return icons[type] || 'mdi-cog'
}

function editScheduledTask(task: ScheduledTask) {
  scheduleForm.value = {
    taskId: task.taskId,
    date: task.date,
    time: task.time,
    frequency: task.frequency,
    enabled: task.enabled
  }
  showScheduleDialog.value = true
}

function updateTaskStatus(task: ScheduledTask) {
  $q.notify({
    type: 'info',
    message: `Task ${task.enabled ? 'enabled' : 'disabled'}`,
    position: 'top'
  })
}

function deleteScheduledTask(taskId: string) {
  $q.dialog({
    title: 'Delete Schedule',
    message: 'Remove this scheduled task?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    const index = scheduledTasks.value.findIndex(t => t.id === taskId)
    if (index > -1) {
      scheduledTasks.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: 'Schedule deleted',
        position: 'top'
      })
    }
  })
}

function scheduleTask() {
  const selectedTask = availableTasks.value.find(t => t.id === scheduleForm.value.taskId)
  if (!selectedTask) return

  const newSchedule: ScheduledTask = {
    id: Date.now().toString(),
    taskId: scheduleForm.value.taskId,
    name: selectedTask.name,
    type: 'mowing', // Would be retrieved from actual task
    date: scheduleForm.value.date,
    time: scheduleForm.value.time,
    frequency: scheduleForm.value.frequency as 'once' | 'daily' | 'weekly' | 'monthly',
    enabled: scheduleForm.value.enabled,
    status: 'pending'
  }

  scheduledTasks.value.push(newSchedule)
  showScheduleDialog.value = false
  
  $q.notify({
    type: 'positive',
    message: 'Task scheduled successfully',
    position: 'top'
  })

  // Reset form
  scheduleForm.value = {
    taskId: '',
    date: '',
    time: '09:00',
    frequency: 'once',
    enabled: true
  }
}
</script>

<style lang="scss" scoped>
.calendar-section {
  .q-date {
    box-shadow: none;
    border: 1px solid $grey-4;
    
    .body--dark & {
      border-color: $grey-7;
    }
  }
}
</style>