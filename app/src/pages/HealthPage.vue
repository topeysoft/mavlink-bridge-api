<template>
  <BasePage
    title="System Health"
    subtitle="Monitor device performance and status"
    :loading="deviceStore.health.loading"
    :error="deviceStore.health.error"
    @retry="loadHealthData"
  >
    <template #actions>
      <q-btn
        round
        flat
        icon="refresh"
        @click="loadHealthData"
        :loading="deviceStore.health.loading"
      >
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </template>

    <!-- Overall Status Banner -->
    <q-banner
      :class="`bg-${overallStatus.color} text-white q-mb-lg`"
      rounded
    >
      <template v-slot:avatar>
        <q-icon :name="overallStatus.icon" size="32px" />
      </template>
      <div class="text-h6">System Status: {{ overallStatus.text }}</div>
      <div class="text-caption">
        {{ overallStatus.description }}
      </div>
    </q-banner>

    <!-- Metrics Grid -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6 col-md-3">
        <HealthMetricCard
          label="CPU Usage"
          :value="cpuUsage"
          unit="%"
          icon="mdi-cpu-64-bit"
          :max="100"
          :threshold="80"
          :trend="cpuTrend"
          show-progress
        />
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <HealthMetricCard
          label="Memory Usage"
          :value="memoryUsage"
          unit="%"
          icon="mdi-memory"
          :max="100"
          :threshold="85"
          :trend="memoryTrend"
          show-progress
        />
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <HealthMetricCard
          label="Temperature"
          :value="temperature"
          unit="°C"
          icon="mdi-thermometer"
          :threshold="70"
          :format="(v: number) => v.toFixed(1)"
        />
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <HealthMetricCard
          label="Uptime"
          :value="uptimeHours"
          unit="hours"
          icon="mdi-clock-outline"
          :format="formatUptime"
        />
      </div>
    </div>

    <!-- Component Status -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12">
        <ComponentStatusGrid
          :components="components"
        />
      </div>
    </div>

    <!-- Charts Row -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-md-6">
        <RealtimeChart
          title="CPU Usage"
          :data="cpuHistory"
          unit="%"
          color="#2196f3"
          :y-min="0"
          :y-max="100"
        />
      </div>
      <div class="col-12 col-md-6">
        <RealtimeChart
          title="Memory Usage"
          :data="memoryHistory"
          unit="KB"
          color="#4caf50"
          :y-min="0"
          :y-max="maxMemory"
        />
      </div>
    </div>

    <!-- System Logs -->
    <div class="row q-col-gutter-md">
      <div class="col-12">
        <LogViewer :logs="systemLogs" @clear-logs="clearSystemLogs" />
      </div>
    </div>
  </BasePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '../stores/device'
import BasePage from '@components/layout/BasePage.vue'
import HealthMetricCard from '@components/health/HealthMetricCard.vue'
import ComponentStatusGrid from '@components/health/ComponentStatusGrid.vue'
import RealtimeChart from '@components/health/RealtimeChart.vue'
import LogViewer from '@components/health/LogViewer.vue'

const deviceStore = useDeviceStore()

// Metric history for charts
const cpuHistory = ref<Array<{ timestamp: number; value: number }>>([])
const memoryHistory = ref<Array<{ timestamp: number; value: number }>>([])
const systemLogs = ref<Array<{
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  details?: string
}>>([])

// Trends
const cpuTrend = ref(0)
const memoryTrend = ref(0)

let updateInterval: number | null = null

const overallStatus = computed(() => {
  if (!deviceStore.health.data) {
    return {
      color: 'grey',
      icon: 'mdi-help-circle',
      text: 'Unknown',
      description: 'No health data available'
    }
  }
  
  const isHealthy = deviceStore.isHealthy
  const hasWarnings = deviceStore.systemMetrics?.lowMemoryWarning
  
  if (!isHealthy) {
    return {
      color: 'negative',
      icon: 'mdi-alert-circle',
      text: 'Unhealthy',
      description: 'System is experiencing issues'
    }
  }
  
  if (hasWarnings) {
    return {
      color: 'warning',
      icon: 'mdi-alert',
      text: 'Warning',
      description: 'System is operational with warnings'
    }
  }
  
  return {
    color: 'positive',
    icon: 'mdi-check-circle',
    text: 'Healthy',
    description: 'All systems operational'
  }
})

const cpuUsage = computed(() => 
  deviceStore.systemMetrics?.cpuUsage || 0
)

const memoryUsage = computed(() => {
  const free = deviceStore.freeHeap
  const total = deviceStore.health.data?.system?.minFreeHeap || free
  if (total === 0) return 0
  return ((total - free) / total) * 100
})

const temperature = computed(() => 
  deviceStore.systemMetrics?.temperature || 0
)

const uptimeHours = computed(() => 
  (deviceStore.uptime || 0) / 3600000
)

const components = computed(() => 
  deviceStore.health.data?.system?.components || []
)

const maxMemory = computed(() => 
  Math.max(...memoryHistory.value.map(d => d.value), 100000)
)

function formatUptime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

async function loadHealthData() {
  try {
    await deviceStore.fetchHealth()
    updateMetrics()
  } catch (error) {
    console.error('Failed to load health data:', error)
  }
}

function updateMetrics() {
  const now = Date.now()
  
  // Add CPU history
  cpuHistory.value.push({
    timestamp: now,
    value: cpuUsage.value
  })
  
  // Add memory history
  memoryHistory.value.push({
    timestamp: now,
    value: deviceStore.freeHeap / 1024
  })
  
  // Keep only last 15 minutes of data
  const cutoff = now - 15 * 60 * 1000
  cpuHistory.value = cpuHistory.value.filter(d => d.timestamp > cutoff)
  memoryHistory.value = memoryHistory.value.filter(d => d.timestamp > cutoff)
  
  // Calculate trends (compare to 5 minutes ago)
  const trendCutoff = now - 5 * 60 * 1000
  const oldCpu = cpuHistory.value.find(d => d.timestamp > trendCutoff)
  const oldMemory = memoryHistory.value.find(d => d.timestamp > trendCutoff)
  
  if (oldCpu) {
    cpuTrend.value = cpuUsage.value - oldCpu.value
  }
  
  if (oldMemory) {
    const oldUsage = ((maxMemory.value - oldMemory.value) / maxMemory.value) * 100
    memoryTrend.value = memoryUsage.value - oldUsage
  }
}

// WebSocket log handler
function handleLogMessage(event: CustomEvent) {
  const log = event.detail
  systemLogs.value.unshift({
    timestamp: Date.now(),
    level: log.level || 'info',
    message: log.message,
    details: log.details
  })
  
  // Keep only last 1000 logs
  if (systemLogs.value.length > 1000) {
    systemLogs.value = systemLogs.value.slice(0, 1000)
  }
}

function clearSystemLogs() {
  systemLogs.value = []
}

onMounted(() => {
  void loadHealthData()
  
  // Set up periodic updates
  updateInterval = window.setInterval(() => {
    updateMetrics()
  }, 5000)
  
  // Subscribe to log events
  window.addEventListener('system-log', handleLogMessage as EventListener)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
  
  window.removeEventListener('system-log', handleLogMessage as EventListener)
})
</script>