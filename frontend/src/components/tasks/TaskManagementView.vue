<template>
  <div class="task-management-view">
    <!-- Header -->
    <div class="task-management-view__header">
      <div class="task-management-view__title-section">
        <h1 class="task-management-view__title">Task Management</h1>
        <div class="task-management-view__subtitle">
          Create, schedule, and monitor automated tasks
        </div>
      </div>

      <div class="task-management-view__actions">
        <q-btn color="positive" icon="add" label="New Task" @click="showCreateDialog = true" />

        <q-btn
          color="secondary"
          icon="schedule"
          label="Scheduler"
          outline
          @click="showSchedulerDialog = true"
        />

        <q-btn
          color="info"
          icon="template"
          label="Templates"
          outline
          @click="showTemplatesDialog = true"
        />
      </div>
    </div>

    <!-- Task Overview Cards -->
    <div class="task-management-view__overview">
      <div class="row q-gutter-md">
        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-management-view__overview-card">
            <q-card-section>
              <div class="task-management-view__overview-content">
                <q-icon name="assignment" color="primary" size="32px" />
                <div>
                  <div class="text-h4 text-weight-bold">{{ taskStats.total }}</div>
                  <div class="text-caption text-grey-6">Total Tasks</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-management-view__overview-card">
            <q-card-section>
              <div class="task-management-view__overview-content">
                <q-icon name="play_circle" color="positive" size="32px" />
                <div>
                  <div class="text-h4 text-weight-bold">{{ taskStats.active }}</div>
                  <div class="text-caption text-grey-6">Active Tasks</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-management-view__overview-card">
            <q-card-section>
              <div class="task-management-view__overview-content">
                <q-icon name="schedule" color="warning" size="32px" />
                <div>
                  <div class="text-h4 text-weight-bold">{{ taskStats.scheduled }}</div>
                  <div class="text-caption text-grey-6">Scheduled</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-management-view__overview-card">
            <q-card-section>
              <div class="task-management-view__overview-content">
                <q-icon name="check_circle" color="positive" size="32px" />
                <div>
                  <div class="text-h4 text-weight-bold">{{ taskStats.completed }}</div>
                  <div class="text-caption text-grey-6">Completed Today</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="task-management-view__content">
      <q-tabs v-model="activeTab" class="text-primary" indicator-color="primary" align="left">
        <q-tab name="queue" icon="queue" label="Task Queue" />
        <q-tab name="templates" icon="library_books" label="Templates" />
        <q-tab name="scheduler" icon="event" label="Scheduler" />
        <q-tab name="analytics" icon="analytics" label="Analytics" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- Task Queue Panel -->
        <q-tab-panel name="queue" class="q-pa-none">
          <TaskQueue
            :tasks="tasks"
            @task-start="handleTaskStart"
            @task-pause="handleTaskPause"
            @task-stop="handleTaskStop"
            @task-edit="handleTaskEdit"
            @task-delete="handleTaskDelete"
            @task-duplicate="handleTaskDuplicate"
          />
        </q-tab-panel>

        <!-- Templates Panel -->
        <q-tab-panel name="templates" class="q-pa-none">
          <TaskTemplates
            :templates="taskTemplates"
            @template-create="handleTemplateCreate"
            @template-edit="handleTemplateEdit"
            @template-delete="handleTemplateDelete"
            @template-use="handleTemplateUse"
          />
        </q-tab-panel>

        <!-- Scheduler Panel -->
        <q-tab-panel name="scheduler" class="q-pa-none">
          <TaskScheduler
            :scheduled-tasks="scheduledTasks"
            @schedule-create="handleScheduleCreate"
            @schedule-edit="handleScheduleEdit"
            @schedule-delete="handleScheduleDelete"
            @schedule-toggle="handleScheduleToggle"
          />
        </q-tab-panel>

        <!-- Analytics Panel -->
        <q-tab-panel name="analytics" class="q-pa-none">
          <TaskAnalytics
            :analytics-data="analyticsData"
            @export-data="handleExportData"
            @refresh="loadAnalytics"
          />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <!-- Create Task Dialog -->
    <q-dialog v-model="showCreateDialog" position="right" full-height>
      <TaskCreateDialog @save="handleTaskCreate" @close="showCreateDialog = false" />
    </q-dialog>

    <!-- Edit Task Dialog -->
    <q-dialog v-model="showEditDialog" position="right" full-height>
      <TaskEditDialog
        v-if="selectedTask"
        :task="selectedTask"
        @save="handleTaskUpdate"
        @close="showEditDialog = false"
      />
    </q-dialog>

    <!-- Scheduler Dialog -->
    <q-dialog v-model="showSchedulerDialog" maximized>
      <TaskScheduler
        @close="showSchedulerDialog = false"
        @schedule-created="loadScheduledTasks"
      />
    </q-dialog>

    <!-- Templates Dialog -->
    <q-dialog v-model="showTemplatesDialog" maximized>
      <TaskTemplates @close="showTemplatesDialog = false" @template-created="loadTemplates" />
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'

// Components
import TaskQueue from './TaskQueue.vue'
import TaskTemplates from './TaskTemplates.vue'
import TaskScheduler from './TaskScheduler.vue'
import TaskAnalytics from './TaskAnalytics.vue'
import TaskCreateDialog from './TaskCreateDialog.vue'
import TaskEditDialog from './TaskEditDialog.vue'

// Types
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

interface TaskTemplate {
  id: string
  name: string
  description: string
  type: string
  settings: Record<string, any>
  createdAt: string
}

interface ScheduledTask {
  id: string
  name: string
  template: string
  schedule: string
  enabled: boolean
  lastRun?: string
  nextRun: string
}

interface AnalyticsData {
  completionRate: number
  averageDuration: number
  efficiencyTrend: number[]
  tasksByType: Record<string, number>
  performanceMetrics: Record<string, number>
}

// Composables
const $q = useQuasar()

// Local state
const activeTab = ref('queue')
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showSchedulerDialog = ref(false)
const showTemplatesDialog = ref(false)
const selectedTask = ref<Task | null>(null)

// Task stats
const taskStats = ref({
  total: 24,
  active: 3,
  scheduled: 8,
  completed: 12
})

// Mock data
const tasks = ref<Task[]>([
  {
    id: '1',
    title: 'Front Lawn Mowing',
    type: 'mowing',
    status: 'running',
    priority: 'medium',
    machineId: 'mower-01',
    zones: ['front-yard'],
    estimatedDuration: 45,
    progress: 35,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Weekly Edge Trimming',
    type: 'trimming',
    status: 'pending',
    priority: 'low',
    zones: ['perimeter'],
    scheduledFor: new Date(Date.now() + 3600000).toISOString(),
    estimatedDuration: 30,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  }
])

const taskTemplates = ref<TaskTemplate[]>([
  {
    id: '1',
    name: 'Standard Mowing',
    description: 'Regular lawn mowing with standard settings',
    type: 'mowing',
    settings: {
      cuttingHeight: 40,
      pattern: 'random',
      speed: 60
    },
    createdAt: new Date().toISOString()
  }
])

const scheduledTasks = ref<ScheduledTask[]>([
  {
    id: '1',
    name: 'Daily Morning Mow',
    template: 'Standard Mowing',
    schedule: '0 8 * * *',
    enabled: true,
    nextRun: new Date(Date.now() + 86400000).toISOString()
  }
])

const analyticsData = ref<AnalyticsData>({
  completionRate: 94.5,
  averageDuration: 42,
  efficiencyTrend: [85, 87, 92, 89, 94, 91, 96],
  tasksByType: {
    mowing: 15,
    trimming: 6,
    maintenance: 3
  },
  performanceMetrics: {
    reliability: 96,
    efficiency: 94,
    coverage: 98
  }
})

// Methods
const handleTaskStart = (task: Task) => {
  task.status = 'running'
  $q.notify({
    type: 'positive',
    message: `Task "${task.title}" started`
  })
}

const handleTaskPause = (task: Task) => {
  task.status = 'paused'
  $q.notify({
    type: 'info',
    message: `Task "${task.title}" paused`
  })
}

const handleTaskStop = (task: Task) => {
  task.status = 'pending'
  $q.notify({
    type: 'warning',
    message: `Task "${task.title}" stopped`
  })
}

const handleTaskEdit = (task: Task) => {
  selectedTask.value = task
  showEditDialog.value = true
}

const handleTaskDelete = async (task: Task) => {
  const confirmed = await $q
    .dialog({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${task.title}"?`,
      cancel: true,
      persistent: true,
      color: 'negative'
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    const index = tasks.value.findIndex(t => t.id === task.id)
    if (index !== -1) {
      tasks.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: 'Task deleted successfully'
      })
    }
  }
}

const handleTaskDuplicate = (task: Task) => {
  const newTask: Task = {
    ...task,
    id: Date.now().toString(),
    title: `${task.title} (Copy)`,
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  tasks.value.push(newTask)

  $q.notify({
    type: 'positive',
    message: 'Task duplicated successfully'
  })
}

const handleTaskCreate = (taskData: Partial<Task>) => {
  const newTask: Task = {
    id: Date.now().toString(),
    title: taskData.title || 'New Task',
    type: taskData.type || 'mowing',
    status: 'pending',
    priority: taskData.priority || 'medium',
    zones: taskData.zones || [],
    estimatedDuration: taskData.estimatedDuration || 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  tasks.value.push(newTask)
  showCreateDialog.value = false

  $q.notify({
    type: 'positive',
    message: 'Task created successfully'
  })
}

const handleTaskUpdate = (taskData: Partial<Task>) => {
  if (selectedTask.value) {
    Object.assign(selectedTask.value, {
      ...taskData,
      updatedAt: new Date().toISOString()
    })

    showEditDialog.value = false
    selectedTask.value = null

    $q.notify({
      type: 'positive',
      message: 'Task updated successfully'
    })
  }
}

const handleTemplateCreate = (templateData: Partial<TaskTemplate>) => {
  const newTemplate: TaskTemplate = {
    id: Date.now().toString(),
    name: templateData.name || 'New Template',
    description: templateData.description || '',
    type: templateData.type || 'mowing',
    settings: templateData.settings || {},
    createdAt: new Date().toISOString()
  }

  taskTemplates.value.push(newTemplate)

  $q.notify({
    type: 'positive',
    message: 'Template created successfully'
  })
}

const handleTemplateEdit = (template: TaskTemplate) => {
  $q.notify({
    type: 'info',
    message: `Edit template: ${template.name}`
  })
}

const handleTemplateDelete = async (template: TaskTemplate) => {
  const confirmed = await $q
    .dialog({
      title: 'Delete Template',
      message: `Are you sure you want to delete "${template.name}"?`,
      cancel: true,
      persistent: true,
      color: 'negative'
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    const index = taskTemplates.value.findIndex(t => t.id === template.id)
    if (index !== -1) {
      taskTemplates.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: 'Template deleted successfully'
      })
    }
  }
}

const handleTemplateUse = (template: TaskTemplate) => {
  const newTask: Task = {
    id: Date.now().toString(),
    title: `Task from ${template.name}`,
    type: template.type as Task['type'],
    status: 'pending',
    priority: 'medium',
    zones: [],
    estimatedDuration: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  tasks.value.push(newTask)

  $q.notify({
    type: 'positive',
    message: `Task created from template "${template.name}"`
  })
}

const handleScheduleCreate = (scheduleData: Partial<ScheduledTask>) => {
  const newSchedule: ScheduledTask = {
    id: Date.now().toString(),
    name: scheduleData.name || 'New Schedule',
    template: scheduleData.template || '',
    schedule: scheduleData.schedule || '0 8 * * *',
    enabled: true,
    nextRun: new Date(Date.now() + 86400000).toISOString()
  }

  scheduledTasks.value.push(newSchedule)

  $q.notify({
    type: 'positive',
    message: 'Schedule created successfully'
  })
}

const handleScheduleEdit = (schedule: ScheduledTask) => {
  $q.notify({
    type: 'info',
    message: `Edit schedule: ${schedule.name}`
  })
}

const handleScheduleDelete = async (schedule: ScheduledTask) => {
  const confirmed = await $q
    .dialog({
      title: 'Delete Schedule',
      message: `Are you sure you want to delete "${schedule.name}"?`,
      cancel: true,
      persistent: true,
      color: 'negative'
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    const index = scheduledTasks.value.findIndex(s => s.id === schedule.id)
    if (index !== -1) {
      scheduledTasks.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: 'Schedule deleted successfully'
      })
    }
  }
}

const handleScheduleToggle = (schedule: ScheduledTask) => {
  schedule.enabled = !schedule.enabled
  $q.notify({
    type: schedule.enabled ? 'positive' : 'warning',
    message: `Schedule ${schedule.enabled ? 'enabled' : 'disabled'}`
  })
}

const handleExportData = () => {
  $q.notify({
    type: 'positive',
    message: 'Analytics data exported successfully'
  })
}

const loadAnalytics = () => {
  $q.notify({
    type: 'info',
    message: 'Analytics data refreshed'
  })
}

const loadScheduledTasks = () => {
  // Reload scheduled tasks
}

const loadTemplates = () => {
  // Reload templates
}

// Lifecycle
onMounted(() => {
  // Load initial data
})
</script>

<style lang="scss" scoped>
.task-management-view {
  min-height: 100vh;
  background-color: var(--q-grey-1);

  .body--dark & {
    background-color: var(--q-dark-page);
  }
}

.task-management-view__header {
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

.task-management-view__title-section {
  display: flex;
  flex-direction: column;
}

.task-management-view__title {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.task-management-view__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-6);
  margin-top: 4px;
}

.task-management-view__actions {
  display: flex;
  gap: 8px;
}

.task-management-view__overview {
  padding: 24px;
}

.task-management-view__overview-card {
  height: 100%;
}

.task-management-view__overview-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.task-management-view__content {
  background: white;
  min-height: 600px;

  .body--dark & {
    background: var(--q-dark);
  }

  .q-tabs {
    padding: 0 24px;
  }

  .q-tab-panels {
    background: transparent;
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .task-management-view__header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .task-management-view__actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 599px) {
  .task-management-view__header {
    padding: 16px;
  }

  .task-management-view__overview {
    padding: 16px;
  }

  .task-management-view__actions {
    flex-wrap: wrap;
    gap: 8px;

    .q-btn {
      flex: 1;
      min-width: 120px;
    }
  }

  .task-management-view__title {
    font-size: 1.5rem;
  }
}
</style>
