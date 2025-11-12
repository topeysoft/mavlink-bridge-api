<template>
  <div class="dashboard-view">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="row items-center justify-between q-mb-lg">
        <div>
          <h1 class="dashboard-title">Dashboard</h1>
          <p class="dashboard-subtitle text-grey-7">
            Welcome back, {{ userName }}. Here's what's happening in your yard.
          </p>
        </div>

        <div class="dashboard-actions">
          <q-btn flat round icon="refresh" :loading="refreshing" @click="refreshDashboard">
            <q-tooltip>Refresh Dashboard</q-tooltip>
          </q-btn>

          <q-btn flat round icon="fullscreen" @click="toggleFullscreen">
            <q-tooltip>Toggle Fullscreen</q-tooltip>
          </q-btn>

          <q-btn
            unelevated
            color="primary"
            icon="add"
            label="Quick Action"
            @click="showQuickActions"
          />
        </div>
      </div>
    </div>

    <!-- Quick Stats Row -->
    <div class="dashboard-stats q-mb-lg">
      <div class="row q-gutter-md">
        <div class="col-12 col-sm-6 col-md-3">
          <StatsCard
            title="Active Machines"
            :value="dashboardData.activeMachines"
            :total="dashboardData.totalMachines"
            icon="precision_manufacturing"
            color="positive"
            :trend="machinesTrend"
            @click="navigateToMachines"
          />
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <StatsCard
            title="Running Tasks"
            :value="dashboardData.runningTasks"
            :total="dashboardData.totalTasks"
            icon="assignment"
            color="info"
            :trend="tasksTrend"
            @click="navigateToTasks"
          />
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <StatsCard
            title="Yard Coverage"
            :value="dashboardData.yardCoverage"
            suffix="%"
            icon="terrain"
            color="warning"
            :trend="coverageTrend"
            @click="navigateToYard"
          />
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <StatsCard
            title="System Health"
            :value="dashboardData.systemHealth"
            suffix="%"
            icon="health_and_safety"
            :color="systemHealthColor"
            :trend="healthTrend"
            @click="navigateToHealth"
          />
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="dashboard-content">
      <div class="row q-gutter-lg">
        <!-- Left Column -->
        <div class="col-12 col-lg-8">
          <!-- Machine Status Overview -->
          <div class="q-mb-lg">
            <MachineStatusOverview
              :machines="dashboardData.machines"
              @machine-select="handleMachineSelect"
              @emergency-stop="handleEmergencyStop"
            />
          </div>

          <!-- Task Queue -->
          <div class="q-mb-lg">
            <TaskQueueWidget
              :tasks="dashboardData.recentTasks"
              @task-select="handleTaskSelect"
              @task-action="handleTaskAction"
            />
          </div>

          <!-- Real-time Activity Feed -->
          <div class="q-mb-lg">
            <ActivityFeed :activities="dashboardData.recentActivities" :max-items="10" />
          </div>
        </div>

        <!-- Right Column -->
        <div class="col-12 col-lg-4">
          <!-- Weather Widget -->
          <div class="q-mb-lg">
            <WeatherWidget :weather="dashboardData.weather" :forecast="dashboardData.forecast" />
          </div>

          <!-- System Alerts -->
          <div class="q-mb-lg">
            <SystemAlertsWidget
              :alerts="dashboardData.alerts"
              @alert-action="handleAlertAction"
              @dismiss-alert="handleDismissAlert"
            />
          </div>

          <!-- Performance Charts -->
          <div class="q-mb-lg">
            <PerformanceChart
              :data="dashboardData.performanceData"
              :period="chartPeriod"
              @period-change="handlePeriodChange"
            />
          </div>

          <!-- Quick Actions -->
          <div class="q-mb-lg">
            <QuickActionsWidget :actions="quickActions" @action="handleQuickAction" />
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions Dialog -->
    <q-dialog v-model="showQuickActionsDialog" class="quick-actions-dialog">
      <QuickActionsDialog
        @close="showQuickActionsDialog = false"
        @action="handleQuickActionFromDialog"
      />
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { useWebSocketStore } from '@/stores/websocket'
import { useUIStore } from '@/stores/ui'

// Components
import StatsCard from './StatsCard.vue'
import MachineStatusOverview from './MachineStatusOverview.vue'
import TaskQueueWidget from './TaskQueueWidget.vue'
import ActivityFeed from './ActivityFeed.vue'
import WeatherWidget from './WeatherWidget.vue'
import SystemAlertsWidget from './SystemAlertsWidget.vue'
import PerformanceChart from './PerformanceChart.vue'
import QuickActionsWidget from './QuickActionsWidget.vue'
import QuickActionsDialog from './QuickActionsDialog.vue'

// Composables
const router = useRouter()
const $q = useQuasar()
const auth = useAuthStore()
const dashboard = useDashboardStore()
const websocket = useWebSocketStore()
const ui = useUIStore()

// Local state
const refreshing = ref(false)
const showQuickActionsDialog = ref(false)
const chartPeriod = ref<'1h' | '24h' | '7d' | '30d'>('24h')

// Computed properties
const userName = computed(() => {
  const user = auth.user
  if (user?.firstName) {
    return user.firstName
  }
  return user?.username || 'User'
})

const dashboardData = computed(() => dashboard.dashboardData)

const machinesTrend = computed(() => ({
  value: 12,
  direction: 'up' as const,
  color: 'positive'
}))

const tasksTrend = computed(() => ({
  value: 8,
  direction: 'up' as const,
  color: 'positive'
}))

const coverageTrend = computed(() => ({
  value: 3,
  direction: 'down' as const,
  color: 'negative'
}))

const healthTrend = computed(() => ({
  value: 2,
  direction: 'up' as const,
  color: 'positive'
}))

const systemHealthColor = computed(() => {
  const health = dashboardData.value.systemHealth
  if (health >= 90) return 'positive'
  if (health >= 70) return 'warning'
  return 'negative'
})

const quickActions = computed(() => [
  {
    id: 'emergency-stop',
    label: 'Emergency Stop',
    icon: 'stop',
    color: 'negative',
    urgent: true
  },
  {
    id: 'start-mowing',
    label: 'Start Mowing',
    icon: 'play_arrow',
    color: 'positive'
  },
  {
    id: 'schedule-task',
    label: 'Schedule Task',
    icon: 'schedule',
    color: 'primary'
  },
  {
    id: 'view-cameras',
    label: 'View Cameras',
    icon: 'videocam',
    color: 'info'
  }
])

// Lifecycle
onMounted(async () => {
  await loadDashboardData()

  // Set up real-time updates
  if (websocket.isConnected) {
    setupRealtimeUpdates()
  }
})

// Watch for WebSocket connection changes
watch(
  () => websocket.isConnected,
  connected => {
    if (connected) {
      setupRealtimeUpdates()
    }
  }
)

// Methods
const loadDashboardData = async () => {
  try {
    await dashboard.loadDashboardData()
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load dashboard data',
      actions: [
        {
          label: 'Retry',
          color: 'white',
          handler: loadDashboardData
        }
      ]
    })
  }
}

const refreshDashboard = async () => {
  refreshing.value = true
  try {
    await dashboard.refreshAll()
    $q.notify({
      type: 'positive',
      message: 'Dashboard refreshed successfully'
    })
  } catch (error) {
    console.error('Failed to refresh dashboard:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to refresh dashboard'
    })
  } finally {
    refreshing.value = false
  }
}

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}

const showQuickActions = () => {
  showQuickActionsDialog.value = true
}

const setupRealtimeUpdates = () => {
  // Subscribe to real-time dashboard updates
  websocket.subscribe('dashboard:update', data => {
    dashboard.updateDashboardData(data)
  })

  websocket.subscribe('machine:status', data => {
    dashboard.updateMachineStatus(data)
  })

  websocket.subscribe('task:update', data => {
    dashboard.updateTaskStatus(data)
  })
}

// Navigation methods
const navigateToMachines = () => {
  router.push({ name: 'machines' })
}

const navigateToTasks = () => {
  router.push({ name: 'tasks' })
}

const navigateToYard = () => {
  router.push({ name: 'yard-overview' })
}

const navigateToHealth = () => {
  router.push({ name: 'system-health' })
}

// Event handlers
const handleMachineSelect = (machineId: string) => {
  router.push({ name: 'machine-detail', params: { id: machineId } })
}

const handleEmergencyStop = () => {
  ui.showEmergencyDialog('Emergency stop activated from dashboard')
}

const handleTaskSelect = (taskId: string) => {
  router.push({ name: 'task-detail', params: { id: taskId } })
}

const handleTaskAction = (action: string, taskId: string) => {
  dashboard.performTaskAction(action, taskId)
}

const handleAlertAction = (action: string, alertId: string) => {
  dashboard.performAlertAction(action, alertId)
}

const handleDismissAlert = (alertId: string) => {
  dashboard.dismissAlert(alertId)
}

const handlePeriodChange = (period: '1h' | '24h' | '7d' | '30d') => {
  chartPeriod.value = period
}

const handleQuickAction = (actionId: string) => {
  handleQuickActionFromDialog(actionId)
}

const handleQuickActionFromDialog = (actionId: string) => {
  showQuickActionsDialog.value = false

  switch (actionId) {
    case 'emergency-stop':
      handleEmergencyStop()
      break
    case 'start-mowing':
      router.push({ name: 'machine-control', query: { action: 'start-mowing' } })
      break
    case 'schedule-task':
      router.push({ name: 'task-scheduler' })
      break
    case 'view-cameras':
      router.push({ name: 'cameras' })
      break
    default:
      console.warn('Unknown quick action:', actionId)
  }
}
</script>

<style lang="scss" scoped>
.dashboard-view {
  padding: 24px;
  min-height: 100vh;
  background-color: var(--q-page-background);
}

.dashboard-header {
  margin-bottom: 24px;
}

.dashboard-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.dashboard-subtitle {
  font-size: 1rem;
  margin: 0;
  line-height: 1.4;
}

.dashboard-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard-stats {
  .q-gutter-md > * {
    margin-bottom: 16px;
  }
}

.dashboard-content {
  .row {
    margin: 0;
  }

  .col-12,
  .col-lg-8,
  .col-lg-4 {
    padding: 0;
  }

  .q-gutter-lg > * {
    margin-right: 24px;
    margin-bottom: 24px;

    &:last-child {
      margin-right: 0;
    }
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .dashboard-view {
    padding: 16px;
  }

  .dashboard-header {
    .row {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
    }

    .dashboard-actions {
      justify-content: center;
    }
  }

  .dashboard-content {
    .q-gutter-lg > * {
      margin-right: 0;
    }
  }
}

@media (max-width: 599px) {
  .dashboard-view {
    padding: 12px;
  }

  .dashboard-title {
    font-size: 1.5rem;
  }

  .dashboard-actions {
    flex-wrap: wrap;
    justify-content: center;
  }
}

// Focus styles
.dashboard-actions .q-btn:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
</style>
