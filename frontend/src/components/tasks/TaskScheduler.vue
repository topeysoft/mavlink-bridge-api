<template>
  <div class="task-scheduler">
    <!-- Header Controls -->
    <div class="task-scheduler__header">
      <div class="task-scheduler__title">
        <h3>Scheduled Tasks</h3>
        <div class="text-caption text-grey-6">Automated task scheduling and management</div>
      </div>

      <div class="task-scheduler__actions">
        <q-btn color="primary" icon="add" label="New Schedule" @click="showCreateDialog = true" />
      </div>
    </div>

    <!-- Schedule Overview -->
    <div class="task-scheduler__overview">
      <div class="row q-gutter-md">
        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-scheduler__stat-card">
            <q-card-section>
              <div class="task-scheduler__stat">
                <q-icon name="schedule" color="primary" size="24px" />
                <div>
                  <div class="text-h5 text-weight-bold">{{ scheduleStats.total }}</div>
                  <div class="text-caption text-grey-6">Total Schedules</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-scheduler__stat-card">
            <q-card-section>
              <div class="task-scheduler__stat">
                <q-icon name="play_circle" color="positive" size="24px" />
                <div>
                  <div class="text-h5 text-weight-bold">{{ scheduleStats.active }}</div>
                  <div class="text-caption text-grey-6">Active</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-scheduler__stat-card">
            <q-card-section>
              <div class="task-scheduler__stat">
                <q-icon name="access_time" color="warning" size="24px" />
                <div>
                  <div class="text-h5 text-weight-bold">{{ scheduleStats.upcoming }}</div>
                  <div class="text-caption text-grey-6">Due Today</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-scheduler__stat-card">
            <q-card-section>
              <div class="task-scheduler__stat">
                <q-icon name="pause_circle" color="grey-6" size="24px" />
                <div>
                  <div class="text-h5 text-weight-bold">{{ scheduleStats.paused }}</div>
                  <div class="text-caption text-grey-6">Paused</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Schedule List -->
    <div class="task-scheduler__content">
      <q-card>
        <q-card-section>
          <div class="task-scheduler__filters">
            <q-input
              v-model="searchQuery"
              placeholder="Search schedules..."
              outlined
              dense
              clearable
            >
              <template #prepend>
                <q-icon name="search" />
              </template>
            </q-input>

            <q-select
              v-model="statusFilter"
              :options="statusFilterOptions"
              label="Status"
              outlined
              dense
              style="min-width: 120px"
            />
          </div>
        </q-card-section>

        <q-separator />

        <q-list separator>
          <q-item
            v-for="schedule in filteredSchedules"
            :key="schedule.id"
            class="task-scheduler__item"
          >
            <q-item-section avatar>
              <q-avatar
                :color="schedule.enabled ? 'positive' : 'grey-5'"
                text-color="white"
                icon="schedule"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label class="task-scheduler__schedule-name">
                {{ schedule.name }}
              </q-item-label>

              <q-item-label caption> Template: {{ schedule.template }} </q-item-label>

              <q-item-label caption>
                Schedule: {{ formatCronSchedule(schedule.schedule) }}
              </q-item-label>

              <q-item-label caption class="task-scheduler__schedule-timing">
                <span v-if="schedule.lastRun">
                  Last run: {{ formatDateTime(schedule.lastRun) }}
                </span>
                <span> Next run: {{ formatDateTime(schedule.nextRun) }} </span>
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="task-scheduler__schedule-status">
                <q-chip
                  :color="schedule.enabled ? 'positive' : 'grey-5'"
                  text-color="white"
                  :label="schedule.enabled ? 'Active' : 'Paused'"
                  size="sm"
                />
              </div>
            </q-item-section>

            <q-item-section side>
              <div class="task-scheduler__schedule-controls">
                <q-btn
                  :icon="schedule.enabled ? 'pause' : 'play_arrow'"
                  :color="schedule.enabled ? 'warning' : 'positive'"
                  size="sm"
                  round
                  dense
                  @click="$emit('schedule-toggle', schedule)"
                >
                  <q-tooltip>
                    {{ schedule.enabled ? 'Pause Schedule' : 'Enable Schedule' }}
                  </q-tooltip>
                </q-btn>

                <q-btn icon="more_vert" size="sm" round dense flat>
                  <q-menu>
                    <q-list>
                      <q-item v-close-popup clickable @click="editSchedule(schedule)">
                        <q-item-section avatar>
                          <q-icon name="edit" />
                        </q-item-section>
                        <q-item-section>Edit</q-item-section>
                      </q-item>

                      <q-item v-close-popup clickable @click="duplicateSchedule(schedule)">
                        <q-item-section avatar>
                          <q-icon name="content_copy" />
                        </q-item-section>
                        <q-item-section>Duplicate</q-item-section>
                      </q-item>

                      <q-item v-close-popup clickable @click="runScheduleNow(schedule)">
                        <q-item-section avatar>
                          <q-icon name="play_arrow" />
                        </q-item-section>
                        <q-item-section>Run Now</q-item-section>
                      </q-item>

                      <q-separator />

                      <q-item
                        v-close-popup
                        class="text-negative"
                        clickable
                        @click="$emit('schedule-delete', schedule)"
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
        <div v-if="filteredSchedules.length === 0" class="task-scheduler__empty">
          <q-icon name="schedule" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">
            {{
              searchQuery || statusFilter !== 'all'
                ? 'No schedules match your filters'
                : 'No schedules configured'
            }}
          </div>
          <div class="text-body2 text-grey-5 q-mt-sm">
            {{
              searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create automated schedules to run tasks automatically'
            }}
          </div>

          <q-btn
            v-if="!searchQuery && statusFilter === 'all'"
            color="primary"
            label="Create Schedule"
            class="q-mt-md"
            @click="showCreateDialog = true"
          />
        </div>
      </q-card>
    </div>

    <!-- Create Schedule Dialog -->
    <q-dialog v-model="showCreateDialog" position="right" full-height>
      <q-card style="width: 500px; max-width: 90vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Create Schedule</div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-card-section>
          <q-form @submit="handleCreateSchedule">
            <div class="q-gutter-md">
              <q-input v-model="newSchedule.name" label="Schedule Name" required outlined />

              <q-select
                v-model="newSchedule.template"
                :options="availableTemplates"
                label="Task Template"
                required
                outlined
              />

              <!-- Quick Schedule Options -->
              <div class="text-subtitle2">Quick Schedule</div>
              <div class="row q-gutter-sm">
                <q-btn label="Daily" size="sm" outline @click="setQuickSchedule('daily')" />
                <q-btn label="Weekly" size="sm" outline @click="setQuickSchedule('weekly')" />
                <q-btn label="Monthly" size="sm" outline @click="setQuickSchedule('monthly')" />
              </div>

              <!-- Custom Schedule -->
              <div class="text-subtitle2 q-mt-md">Custom Schedule</div>

              <q-select
                v-model="scheduleBuilder.frequency"
                :options="frequencyOptions"
                label="Frequency"
                outlined
              />

              <div v-if="scheduleBuilder.frequency === 'daily'">
                <q-input v-model="scheduleBuilder.time" label="Time" type="time" outlined />
              </div>

              <div v-if="scheduleBuilder.frequency === 'weekly'">
                <q-select
                  v-model="scheduleBuilder.weekdays"
                  :options="weekdayOptions"
                  label="Days of Week"
                  multiple
                  outlined
                />
                <q-input v-model="scheduleBuilder.time" label="Time" type="time" outlined />
              </div>

              <div v-if="scheduleBuilder.frequency === 'monthly'">
                <q-input
                  v-model.number="scheduleBuilder.dayOfMonth"
                  label="Day of Month"
                  type="number"
                  min="1"
                  max="31"
                  outlined
                />
                <q-input v-model="scheduleBuilder.time" label="Time" type="time" outlined />
              </div>

              <!-- Advanced: Direct Cron Input -->
              <q-expansion-item label="Advanced: Direct Cron Expression" icon="settings">
                <q-input
                  v-model="newSchedule.schedule"
                  label="Cron Expression"
                  placeholder="0 8 * * *"
                  outlined
                  hint="Format: minute hour day month weekday"
                />
              </q-expansion-item>

              <!-- Preview -->
              <div class="task-scheduler__schedule-preview">
                <div class="text-caption text-grey-6 q-mb-sm">Schedule Preview</div>
                <div class="text-body2">
                  {{ getSchedulePreview() }}
                </div>
              </div>
            </div>
          </q-form>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup label="Cancel" color="grey" outline />
          <q-btn label="Create Schedule" color="primary" @click="handleCreateSchedule" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { date, useQuasar } from 'quasar'

// Props
interface ScheduledTask {
  id: string
  name: string
  template: string
  schedule: string
  enabled: boolean
  lastRun?: string
  nextRun: string
}

const props = defineProps<{
  scheduledTasks: ScheduledTask[]
}>()

// Emits
const emit = defineEmits<{
  'schedule-create': [schedule: Partial<ScheduledTask>]
  'schedule-edit': [schedule: ScheduledTask]
  'schedule-delete': [schedule: ScheduledTask]
  'schedule-toggle': [schedule: ScheduledTask]
}>()

// Composables
const $q = useQuasar()

// Local state
const searchQuery = ref('')
const statusFilter = ref('all')
const showCreateDialog = ref(false)

const newSchedule = ref({
  name: '',
  template: '',
  schedule: '0 8 * * *'
})

const scheduleBuilder = ref({
  frequency: 'daily',
  time: '08:00',
  weekdays: [],
  dayOfMonth: 1
})

// Schedule stats
const scheduleStats = ref({
  total: 8,
  active: 5,
  upcoming: 3,
  paused: 3
})

// Options
const statusFilterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' }
]

const frequencyOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' }
]

const weekdayOptions = [
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
  { label: 'Sunday', value: '0' }
]

const availableTemplates = [
  { label: 'Standard Mowing', value: 'standard-mowing' },
  { label: 'Edge Trimming', value: 'edge-trimming' },
  { label: 'Maintenance Check', value: 'maintenance-check' }
]

// Computed
const filteredSchedules = computed(() => {
  let filtered = [...props.scheduledTasks]

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(schedule => {
      if (statusFilter.value === 'active') return schedule.enabled
      if (statusFilter.value === 'paused') return !schedule.enabled
      return true
    })
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      schedule =>
        schedule.name.toLowerCase().includes(query) ||
        schedule.template.toLowerCase().includes(query)
    )
  }

  return filtered
})

// Methods
const formatCronSchedule = (cronExpression: string) => {
  const parts = cronExpression.split(' ')
  if (parts.length !== 5) return cronExpression

  const [minute, hour, day, month, weekday] = parts

  // Simple patterns
  if (cronExpression === '0 8 * * *') return 'Daily at 8:00 AM'
  if (cronExpression === '0 8 * * 1') return 'Every Monday at 8:00 AM'
  if (cronExpression === '0 8 1 * *') return 'First day of every month at 8:00 AM'

  // More complex patterns
  if (minute === '0' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
    return `Daily at ${hour}:00`
  }

  return cronExpression
}

const formatDateTime = (dateString: string) => {
  return date.formatDate(new Date(dateString), 'MMM D, YYYY h:mm A')
}

const setQuickSchedule = (type: string) => {
  switch (type) {
    case 'daily':
      newSchedule.value.schedule = '0 8 * * *'
      scheduleBuilder.value.frequency = 'daily'
      scheduleBuilder.value.time = '08:00'
      break
    case 'weekly':
      newSchedule.value.schedule = '0 8 * * 1'
      scheduleBuilder.value.frequency = 'weekly'
      scheduleBuilder.value.weekdays = ['1']
      scheduleBuilder.value.time = '08:00'
      break
    case 'monthly':
      newSchedule.value.schedule = '0 8 1 * *'
      scheduleBuilder.value.frequency = 'monthly'
      scheduleBuilder.value.dayOfMonth = 1
      scheduleBuilder.value.time = '08:00'
      break
  }
}

const getSchedulePreview = () => {
  return formatCronSchedule(newSchedule.value.schedule)
}

const editSchedule = (schedule: ScheduledTask) => {
  emit('schedule-edit', schedule)
}

const duplicateSchedule = (schedule: ScheduledTask) => {
  const duplicated = {
    ...schedule,
    name: `${schedule.name} (Copy)`,
    id: Date.now().toString()
  }

  emit('schedule-create', duplicated)

  $q.notify({
    type: 'positive',
    message: 'Schedule duplicated successfully'
  })
}

const runScheduleNow = (schedule: ScheduledTask) => {
  $q.notify({
    type: 'positive',
    message: `Running "${schedule.name}" now`
  })
}

const handleCreateSchedule = () => {
  if (!newSchedule.value.name.trim()) {
    $q.notify({
      type: 'negative',
      message: 'Schedule name is required'
    })
    return
  }

  if (!newSchedule.value.template) {
    $q.notify({
      type: 'negative',
      message: 'Template is required'
    })
    return
  }

  // Build cron expression from builder if not manually set
  if (scheduleBuilder.value.frequency !== 'custom') {
    buildCronExpression()
  }

  const scheduleData = {
    ...newSchedule.value,
    enabled: true,
    nextRun: new Date(Date.now() + 86400000).toISOString() // Tomorrow
  }

  emit('schedule-create', scheduleData)

  // Reset form
  newSchedule.value = {
    name: '',
    template: '',
    schedule: '0 8 * * *'
  }

  scheduleBuilder.value = {
    frequency: 'daily',
    time: '08:00',
    weekdays: [],
    dayOfMonth: 1
  }

  showCreateDialog.value = false
}

const buildCronExpression = () => {
  const [hour, minute] = scheduleBuilder.value.time.split(':')

  switch (scheduleBuilder.value.frequency) {
    case 'daily':
      newSchedule.value.schedule = `${minute} ${hour} * * *`
      break
    case 'weekly':
      const weekdays = scheduleBuilder.value.weekdays.join(',')
      newSchedule.value.schedule = `${minute} ${hour} * * ${weekdays}`
      break
    case 'monthly':
      newSchedule.value.schedule = `${minute} ${hour} ${scheduleBuilder.value.dayOfMonth} * *`
      break
  }
}
</script>

<style lang="scss" scoped>
.task-scheduler {
  min-height: 400px;
}

.task-scheduler__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: white;
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-dark);
    border-bottom-color: var(--q-grey-8);
  }
}

.task-scheduler__title {
  h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--q-dark);

    .body--dark & {
      color: var(--q-dark-page-text);
    }
  }
}

.task-scheduler__overview {
  padding: 24px;
  background: var(--q-grey-1);

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.task-scheduler__stat-card {
  height: 100%;
}

.task-scheduler__stat {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-scheduler__content {
  padding: 24px;
}

.task-scheduler__filters {
  display: flex;
  gap: 16px;
  align-items: center;
}

.task-scheduler__item {
  padding: 16px;
}

.task-scheduler__schedule-name {
  font-weight: 500;
  font-size: 1rem;
  margin-bottom: 4px;
}

.task-scheduler__schedule-timing {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.task-scheduler__schedule-status {
  margin-bottom: 8px;
}

.task-scheduler__schedule-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.task-scheduler__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.task-scheduler__schedule-preview {
  background: var(--q-grey-1);
  border-radius: 8px;
  padding: 12px;

  .body--dark & {
    background: var(--q-grey-9);
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .task-scheduler__header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .task-scheduler__filters {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
}

@media (max-width: 599px) {
  .task-scheduler__header,
  .task-scheduler__overview,
  .task-scheduler__content {
    padding: 16px;
  }

  .task-scheduler__item {
    padding: 12px;
  }

  .task-scheduler__schedule-timing {
    span {
      font-size: 0.8rem;
    }
  }
}
</style>
