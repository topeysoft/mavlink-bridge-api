<template>
  <div class="machine-diagnostics">
    <!-- System Health Overview -->
    <div class="machine-diagnostics__section">
      <h6 class="machine-diagnostics__section-title">System Health</h6>

      <div class="row q-gutter-md">
        <div class="col-12 col-md-6">
          <q-card class="machine-diagnostics__health-card">
            <q-card-section>
              <div class="machine-diagnostics__health-grid">
                <!-- Overall Health -->
                <div class="machine-diagnostics__health-item">
                  <q-circular-progress
                    :value="diagnostics.overall.score"
                    size="60px"
                    :thickness="0.15"
                    :color="getHealthColor(diagnostics.overall.score)"
                    track-color="grey-3"
                    class="q-mr-md"
                  >
                    <div class="text-subtitle2 text-weight-bold">
                      {{ diagnostics.overall.score }}%
                    </div>
                  </q-circular-progress>
                  <div>
                    <div class="text-subtitle1 text-weight-medium">Overall Health</div>
                    <div class="text-caption text-grey-6">
                      {{ diagnostics.overall.status }}
                    </div>
                  </div>
                </div>

                <!-- Temperature -->
                <div class="machine-diagnostics__health-item">
                  <q-icon
                    name="thermostat"
                    :color="getTempColor(diagnostics.temperature.value)"
                    size="32px"
                    class="q-mr-md"
                  />
                  <div>
                    <div class="text-subtitle1 text-weight-medium">
                      {{ diagnostics.temperature.value }}°C
                    </div>
                    <div class="text-caption text-grey-6">Engine Temperature</div>
                  </div>
                </div>

                <!-- Runtime -->
                <div class="machine-diagnostics__health-item">
                  <q-icon name="schedule" color="primary" size="32px" class="q-mr-md" />
                  <div>
                    <div class="text-subtitle1 text-weight-medium">
                      {{ formatRuntime(diagnostics.runtime.hours) }}
                    </div>
                    <div class="text-caption text-grey-6">Total Runtime</div>
                  </div>
                </div>

                <!-- Last Service -->
                <div class="machine-diagnostics__health-item">
                  <q-icon
                    name="build"
                    :color="getServiceColor(diagnostics.lastService.daysAgo)"
                    size="32px"
                    class="q-mr-md"
                  />
                  <div>
                    <div class="text-subtitle1 text-weight-medium">
                      {{ diagnostics.lastService.daysAgo }} days ago
                    </div>
                    <div class="text-caption text-grey-6">Last Service</div>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card class="machine-diagnostics__sensors-card">
            <q-card-section>
              <h6 class="q-mt-none q-mb-md">Sensor Status</h6>

              <div class="machine-diagnostics__sensors">
                <div
                  v-for="sensor in diagnostics.sensors"
                  :key="sensor.name"
                  class="machine-diagnostics__sensor"
                >
                  <q-icon
                    :name="sensor.icon"
                    :color="
                      sensor.status === 'ok'
                        ? 'positive'
                        : sensor.status === 'warning'
                          ? 'warning'
                          : 'negative'
                    "
                    size="20px"
                  />
                  <div class="machine-diagnostics__sensor-info">
                    <div class="text-body2 text-weight-medium">
                      {{ sensor.name }}
                    </div>
                    <div class="text-caption text-grey-6">{{ sensor.value }} {{ sensor.unit }}</div>
                  </div>
                  <q-badge
                    :color="
                      sensor.status === 'ok'
                        ? 'positive'
                        : sensor.status === 'warning'
                          ? 'warning'
                          : 'negative'
                    "
                    :label="sensor.status.toUpperCase()"
                    class="machine-diagnostics__sensor-badge"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Alerts and Warnings -->
    <div v-if="diagnostics.alerts.length > 0" class="machine-diagnostics__section">
      <h6 class="machine-diagnostics__section-title">Active Alerts</h6>

      <q-card class="machine-diagnostics__alerts-card">
        <q-list>
          <q-item
            v-for="alert in diagnostics.alerts"
            :key="alert.id"
            class="machine-diagnostics__alert"
            :class="`machine-diagnostics__alert--${alert.severity}`"
          >
            <q-item-section avatar>
              <q-icon
                :name="getAlertIcon(alert.severity)"
                :color="getAlertColor(alert.severity)"
                size="24px"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label class="text-weight-medium">
                {{ alert.title }}
              </q-item-label>
              <q-item-label caption>
                {{ alert.message }}
              </q-item-label>
              <q-item-label caption class="text-grey-5">
                {{ formatTime(alert.timestamp) }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-btn flat round dense icon="close" size="sm" @click="dismissAlert(alert.id)" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>

    <!-- Performance Metrics -->
    <div class="machine-diagnostics__section">
      <h6 class="machine-diagnostics__section-title">Performance Metrics</h6>

      <div class="row q-gutter-md">
        <div class="col-12 col-lg-8">
          <q-card class="machine-diagnostics__metrics-card">
            <q-card-section>
              <div class="machine-diagnostics__chart-container">
                <canvas ref="metricsChart" class="machine-diagnostics__chart" />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-lg-4">
          <q-card class="machine-diagnostics__stats-card">
            <q-card-section>
              <h6 class="q-mt-none q-mb-md">Key Statistics</h6>

              <div class="machine-diagnostics__stats">
                <div class="machine-diagnostics__stat">
                  <div class="text-h5 text-weight-bold text-positive">
                    {{ diagnostics.stats.efficiency }}%
                  </div>
                  <div class="text-caption text-grey-6">Efficiency Rating</div>
                </div>

                <div class="machine-diagnostics__stat">
                  <div class="text-h5 text-weight-bold text-primary">
                    {{ diagnostics.stats.uptime }}%
                  </div>
                  <div class="text-caption text-grey-6">Uptime (30 days)</div>
                </div>

                <div class="machine-diagnostics__stat">
                  <div class="text-h5 text-weight-bold text-info">
                    {{ diagnostics.stats.avgSpeed }} km/h
                  </div>
                  <div class="text-caption text-grey-6">Average Speed</div>
                </div>

                <div class="machine-diagnostics__stat">
                  <div class="text-h5 text-weight-bold text-secondary">
                    {{ diagnostics.stats.coverage }} m²
                  </div>
                  <div class="text-caption text-grey-6">Area Covered Today</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Diagnostic Tools -->
    <div class="machine-diagnostics__section">
      <h6 class="machine-diagnostics__section-title">Diagnostic Tools</h6>

      <q-card class="machine-diagnostics__tools-card">
        <q-card-section>
          <div class="machine-diagnostics__tools">
            <q-btn
              color="primary"
              icon="refresh"
              label="Run System Check"
              :loading="loading.systemCheck"
              class="q-mr-md q-mb-sm"
              @click="runSystemCheck"
            />

            <q-btn
              color="info"
              icon="download"
              label="Export Logs"
              :loading="loading.exportLogs"
              outline
              class="q-mr-md q-mb-sm"
              @click="exportLogs"
            />

            <q-btn
              color="warning"
              icon="bug_report"
              label="Generate Report"
              :loading="loading.generateReport"
              outline
              class="q-mr-md q-mb-sm"
              @click="generateReport"
            />

            <q-btn
              color="secondary"
              icon="settings_backup_restore"
              label="Reset Diagnostics"
              :loading="loading.resetDiagnostics"
              outline
              class="q-mb-sm"
              @click="resetDiagnostics"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'

// Types
interface Machine {
  id: string
  name: string
  model: string
  status: string
}

interface DiagnosticData {
  overall: {
    score: number
    status: string
  }
  temperature: {
    value: number
    unit: string
  }
  runtime: {
    hours: number
  }
  lastService: {
    daysAgo: number
  }
  sensors: Array<{
    name: string
    icon: string
    value: number
    unit: string
    status: 'ok' | 'warning' | 'error'
  }>
  alerts: Array<{
    id: string
    title: string
    message: string
    severity: 'info' | 'warning' | 'error'
    timestamp: string
  }>
  stats: {
    efficiency: number
    uptime: number
    avgSpeed: number
    coverage: number
  }
}

// Props
defineProps<{
  machine: Machine
}>()

// Emits
const emit = defineEmits<{
  refresh: []
}>()

// Composables
const $q = useQuasar()

// Local state
const metricsChart = ref<HTMLCanvasElement>()
const loading = ref({
  systemCheck: false,
  exportLogs: false,
  generateReport: false,
  resetDiagnostics: false
})

// Mock diagnostic data
const diagnostics = ref<DiagnosticData>({
  overall: {
    score: 87,
    status: 'Good'
  },
  temperature: {
    value: 45,
    unit: '°C'
  },
  runtime: {
    hours: 1245
  },
  lastService: {
    daysAgo: 15
  },
  sensors: [
    {
      name: 'GPS Module',
      icon: 'gps_fixed',
      value: 98,
      unit: '%',
      status: 'ok'
    },
    {
      name: 'Blade Motor',
      icon: 'settings',
      value: 2850,
      unit: 'RPM',
      status: 'ok'
    },
    {
      name: 'Gyroscope',
      icon: 'rotate_right',
      value: 0.02,
      unit: '°/s',
      status: 'warning'
    },
    {
      name: 'Obstacle Sensor',
      icon: 'sensors',
      value: 15,
      unit: 'cm',
      status: 'ok'
    }
  ],
  alerts: [
    {
      id: '1',
      title: 'Blade Dulling Detected',
      message: 'Cutting efficiency has decreased. Consider blade maintenance.',
      severity: 'warning',
      timestamp: new Date(Date.now() - 120000).toISOString()
    },
    {
      id: '2',
      title: 'Low Signal Strength',
      message: 'GPS signal weak in current location.',
      severity: 'info',
      timestamp: new Date(Date.now() - 300000).toISOString()
    }
  ],
  stats: {
    efficiency: 87,
    uptime: 94,
    avgSpeed: 0.8,
    coverage: 450
  }
})

// Methods
const getHealthColor = (score: number) => {
  if (score >= 80) return 'positive'
  if (score >= 60) return 'warning'
  return 'negative'
}

const getTempColor = (temp: number) => {
  if (temp > 60) return 'negative'
  if (temp > 45) return 'warning'
  return 'positive'
}

const getServiceColor = (daysAgo: number) => {
  if (daysAgo > 30) return 'negative'
  if (daysAgo > 14) return 'warning'
  return 'positive'
}

const getAlertIcon = (severity: string) => {
  const icons = {
    info: 'info',
    warning: 'warning',
    error: 'error'
  }
  return icons[severity as keyof typeof icons] || 'info'
}

const getAlertColor = (severity: string) => {
  const colors = {
    info: 'info',
    warning: 'warning',
    error: 'negative'
  }
  return colors[severity as keyof typeof colors] || 'info'
}

const formatRuntime = (hours: number) => {
  if (hours < 24) {
    return `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 60) {
    return `${diffMins}m ago`
  }
  const diffHours = Math.floor(diffMins / 60)
  return `${diffHours}h ago`
}

const dismissAlert = (alertId: string) => {
  const index = diagnostics.value.alerts.findIndex(a => a.id === alertId)
  if (index !== -1) {
    diagnostics.value.alerts.splice(index, 1)
  }
}

const runSystemCheck = async () => {
  loading.value.systemCheck = true
  try {
    // Simulate system check
    await new Promise(resolve => globalThis.setTimeout(resolve, 2000))
    $q.notify({
      type: 'positive',
      message: 'System check completed successfully'
    })
    emit('refresh')
  } catch {
    $q.notify({
      type: 'negative',
      message: 'System check failed'
    })
  } finally {
    loading.value.systemCheck = false
  }
}

const exportLogs = async () => {
  loading.value.exportLogs = true
  try {
    // Simulate log export
    await new Promise(resolve => globalThis.setTimeout(resolve, 1500))
    $q.notify({
      type: 'positive',
      message: 'Diagnostic logs exported successfully'
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to export logs'
    })
  } finally {
    loading.value.exportLogs = false
  }
}

const generateReport = async () => {
  loading.value.generateReport = true
  try {
    // Simulate report generation
    await new Promise(resolve => globalThis.setTimeout(resolve, 3000))
    $q.notify({
      type: 'positive',
      message: 'Diagnostic report generated'
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to generate report'
    })
  } finally {
    loading.value.generateReport = false
  }
}

const resetDiagnostics = async () => {
  const confirmed = await $q
    .dialog({
      title: 'Reset Diagnostics',
      message: 'This will clear all diagnostic data. Are you sure?',
      cancel: true,
      persistent: true
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (!confirmed) return

  loading.value.resetDiagnostics = true
  try {
    // Simulate reset
    await new Promise(resolve => globalThis.setTimeout(resolve, 1000))
    $q.notify({
      type: 'info',
      message: 'Diagnostics reset successfully'
    })
    emit('refresh')
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to reset diagnostics'
    })
  } finally {
    loading.value.resetDiagnostics = false
  }
}

const initChart = () => {
  if (!metricsChart.value) return

  const ctx = metricsChart.value.getContext('2d')
  if (!ctx) return

  // Simple chart placeholder
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, metricsChart.value.width, metricsChart.value.height)

  ctx.fillStyle = '#1976d2'
  ctx.font = '16px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Performance Chart', metricsChart.value.width / 2, metricsChart.value.height / 2)
  ctx.fillText(
    '(Chart.js integration placeholder)',
    metricsChart.value.width / 2,
    metricsChart.value.height / 2 + 25
  )
}

// Lifecycle
onMounted(() => {
  initChart()
})

onUnmounted(() => {
  // Cleanup if needed
})
</script>

<style lang="scss" scoped>
.machine-diagnostics {
  padding: 24px;
  background-color: var(--q-grey-1);
  min-height: 100vh;

  .body--dark & {
    background-color: var(--q-dark-page);
  }
}

.machine-diagnostics__section {
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }
}

.machine-diagnostics__section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.machine-diagnostics__health-card,
.machine-diagnostics__sensors-card {
  height: 100%;
}

.machine-diagnostics__health-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.machine-diagnostics__health-item {
  display: flex;
  align-items: center;
}

.machine-diagnostics__sensors {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.machine-diagnostics__sensor {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.machine-diagnostics__sensor-info {
  flex: 1;
}

.machine-diagnostics__sensor-badge {
  font-size: 0.65rem;
  font-weight: 600;
}

.machine-diagnostics__alerts-card {
  .q-list {
    padding: 0;
  }
}

.machine-diagnostics__alert {
  border-left: 3px solid transparent;

  &--info {
    border-left-color: var(--q-info);
  }

  &--warning {
    border-left-color: var(--q-warning);
  }

  &--error {
    border-left-color: var(--q-negative);
  }
}

.machine-diagnostics__chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}

.machine-diagnostics__chart {
  width: 100%;
  height: 100%;
  border-radius: 8px;
}

.machine-diagnostics__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.machine-diagnostics__stat {
  text-align: center;
  padding: 16px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.machine-diagnostics__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .machine-diagnostics__health-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .machine-diagnostics__stats {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 599px) {
  .machine-diagnostics {
    padding: 16px;
  }

  .machine-diagnostics__section {
    margin-bottom: 24px;
  }

  .machine-diagnostics__section-title {
    font-size: 1.1rem;
  }

  .machine-diagnostics__tools {
    .q-btn {
      flex: 1;
      min-width: 140px;
    }
  }
}
</style>
