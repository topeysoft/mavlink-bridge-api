<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useBatteryStore } from '@/stores/battery'
import { useConnectionStore } from '@/stores/connection'
import { useNotifications } from '@/composables/useNotifications'
import type { BatteryHealth, BatterySettings } from '@/types/battery'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const batteryStore = useBatteryStore()
const connectionStore = useConnectionStore()
const { success, error: notifyError, warning } = useNotifications()

// UI State
const showSettingsDialog = ref(false)
const settingsForm = ref<BatterySettings>({ ...batteryStore.settings })

// Computed
const batteryColor = computed(() => {
  const percent = batteryStore.batteryInfo.percent
  if (percent > 60) return '#10b981' // green
  if (percent > 30) return '#f59e0b' // amber
  if (percent > 15) return '#ef4444' // red
  return '#991b1b' // dark red
})

const healthColor = computed(() => {
  const health = batteryStore.batteryHealth
  if (health === 'excellent') return '#10b981'
  if (health === 'good') return '#84cc16'
  if (health === 'fair') return '#f59e0b'
  if (health === 'poor') return '#ef4444'
  return '#991b1b'
})

const temperatureColor = computed(() => {
  const temp = batteryStore.batteryInfo.temperature
  if (temp < 30) return '#3b82f6' // blue (cool)
  if (temp < 40) return '#10b981' // green (normal)
  if (temp < 50) return '#f59e0b' // amber (warm)
  if (temp < 60) return '#ef4444' // red (hot)
  return '#991b1b' // dark red (critical)
})

const chartData = computed(() => {
  const recent = batteryStore.history.slice(-60) // Last hour at 1 min intervals
  return {
    labels: recent.map(s => new Date(s.timestamp).toLocaleTimeString()),
    voltage: recent.map(s => s.voltage),
    percent: recent.map(s => s.percent),
    temperature: recent.map(s => s.temperature),
    power: recent.map(s => s.powerDraw)
  }
})

// Connection status
const isDataStale = computed(() => {
  if (!batteryStore.batteryInfo.lastUpdate) return true
  const lastUpdate = new Date(batteryStore.batteryInfo.lastUpdate).getTime()
  const now = Date.now()
  return (now - lastUpdate) > 5000 // Data is stale if older than 5 seconds
})

const connectionStatus = computed(() => {
  if (!connectionStore.isConnected) return 'disconnected'
  if (isDataStale.value) return 'stale'
  return 'connected'
})

onMounted(() => {
  // Battery monitoring is started automatically when connection is established
  // via the connection store's setupBatterySubscription function
  if (!batteryStore.isMonitoring && connectionStore.isConnected) {
    batteryStore.startMonitoring()
  }
})

onUnmounted(() => {
  // Keep monitoring running even when leaving the page
  // Data will continue to be collected for analytics
})

function openSettings() {
  settingsForm.value = { ...batteryStore.settings }
  showSettingsDialog.value = true
}

function saveSettings() {
  batteryStore.updateSettings(settingsForm.value)
  showSettingsDialog.value = false
  success('Battery settings updated')
}

function acknowledgeAlert(id: string) {
  batteryStore.acknowledgeAlert(id)
}

function clearAlerts() {
  batteryStore.clearAcknowledgedAlerts()
  success('Acknowledged alerts cleared')
}

function exportData() {
  const data = batteryStore.exportData()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yardrover-battery-${new Date().toISOString()}.json`
  a.click()
  URL.revokeObjectURL(url)
  success('Battery data exported')
}

function getBatteryIcon(percent: number): string {
  if (percent > 90) return '🔋'
  if (percent > 60) return '🔋'
  if (percent > 30) return '🪫'
  if (percent > 10) return '🪫'
  return '⚠️'
}

function formatDuration(minutes?: number): string {
  if (!minutes) return 'N/A'
  const hours = Math.floor(minutes / 60)
  const mins = Math.floor(minutes % 60)
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}
</script>

<template>
  <div class="battery-view">
    <div class="view-header">
      <div>
        <h1 class="view-title">Battery Management</h1>
        <p class="view-subtitle">Monitor battery health, charging, and optimize for autonomous operation</p>
        <div class="connection-status" :class="`status-${connectionStatus}`">
          <span class="status-dot"></span>
          <span v-if="connectionStatus === 'connected'">Live data</span>
          <span v-else-if="connectionStatus === 'stale'">⚠️ Data may be stale</span>
          <span v-else>Not connected</span>
        </div>
      </div>

      <div class="header-actions">
        <Button variant="secondary" @click="exportData">
          <span class="icon">📊</span>
          Export Data
        </Button>
        <Button variant="secondary" @click="openSettings">
          <span class="icon">⚙️</span>
          Settings
        </Button>
      </div>
    </div>

    <!-- Alerts -->
    <div v-if="batteryStore.unacknowledgedAlerts.length > 0" class="alerts-section">
      <Card
        v-for="alert in batteryStore.unacknowledgedAlerts"
        :key="alert.id"
        class="alert-card"
        :class="`alert-${alert.type}`"
      >
        <div class="alert-content">
          <div class="alert-icon">
            {{ alert.type === 'critical' ? '🚨' : alert.type === 'temperature' ? '🌡️' : '⚠️' }}
          </div>
          <div class="alert-info">
            <strong>{{ alert.message }}</strong>
            <div class="alert-time">{{ new Date(alert.timestamp).toLocaleString() }}</div>
          </div>
          <Button variant="secondary" size="small" @click="acknowledgeAlert(alert.id)">
            Acknowledge
          </Button>
        </div>
      </Card>
    </div>

    <!-- Main Stats -->
    <div class="stats-grid">
      <Card class="battery-main-card">
        <div class="battery-display">
          <div class="battery-icon-large">
            {{ getBatteryIcon(batteryStore.batteryInfo.percent) }}
          </div>
          <div class="battery-percent" :style="{ color: batteryColor }">
            {{ batteryStore.batteryInfo.percent.toFixed(1) }}%
          </div>
          <div class="battery-status">
            {{ batteryStore.batteryInfo.status }}
          </div>
          <div class="battery-voltage">
            {{ batteryStore.batteryInfo.voltage.toFixed(2) }}V
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-label">Health</div>
          <div class="stat-value" :style="{ color: healthColor }">
            {{ batteryStore.batteryHealth }}
          </div>
          <div class="stat-detail">
            {{ batteryStore.batteryInfo.healthPercent.toFixed(0) }}% capacity remaining
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-label">Temperature</div>
          <div class="stat-value" :style="{ color: temperatureColor }">
            {{ batteryStore.batteryInfo.temperature.toFixed(1) }}°C
          </div>
          <div class="stat-detail">
            {{ batteryStore.isHighTemperature ? '⚠️ High' : batteryStore.isCriticalTemperature ? '🚨 Critical' : '✅ Normal' }}
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-label">Power Draw</div>
          <div class="stat-value">
            {{ batteryStore.batteryInfo.powerDraw.toFixed(1) }}W
          </div>
          <div class="stat-detail">
            {{ batteryStore.batteryInfo.current.toFixed(2) }}A
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-label">Cycle Count</div>
          <div class="stat-value">{{ batteryStore.stats.totalCycles }}</div>
          <div class="stat-detail">
            ~{{ batteryStore.stats.estimatedRemainingLife }} cycles left
          </div>
        </div>
      </Card>

      <Card>
        <div class="stat-card">
          <div class="stat-label">Estimated Runtime</div>
          <div class="stat-value">
            {{ formatDuration(batteryStore.stats.estimatedRuntime) }}
          </div>
          <div class="stat-detail">
            At current load
          </div>
        </div>
      </Card>
    </div>

    <!-- Detailed Information -->
    <div class="content-grid">
      <!-- Battery Information -->
      <Card>
        <div class="card-header">
          <h2>Battery Information</h2>
        </div>
        <div class="info-table">
          <div class="info-row">
            <span class="info-label">Chemistry</span>
            <span class="info-value">{{ batteryStore.batteryInfo.chemistry }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Cell Count</span>
            <span class="info-value">{{ batteryStore.batteryInfo.cellCount }}S</span>
          </div>
          <div class="info-row">
            <span class="info-label">Design Voltage</span>
            <span class="info-value">{{ batteryStore.batteryInfo.designVoltage }}V</span>
          </div>
          <div class="info-row">
            <span class="info-label">Capacity</span>
            <span class="info-value">{{ batteryStore.batteryInfo.capacity }}Ah</span>
          </div>
          <div class="info-row">
            <span class="info-label">Current Capacity</span>
            <span class="info-value">
              {{ (batteryStore.batteryInfo.capacityFull / 1000).toFixed(2) }}Ah
              ({{ ((batteryStore.batteryInfo.capacityFull / batteryStore.batteryInfo.capacityDesign) * 100).toFixed(0) }}%)
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Remaining Energy</span>
            <span class="info-value">
              {{ (batteryStore.batteryInfo.capacityRemaining / 1000).toFixed(2) }}Ah
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Charging State</span>
            <span class="info-value">{{ batteryStore.batteryInfo.chargingState }}</span>
          </div>
        </div>
      </Card>

      <!-- Recent Events -->
      <Card>
        <div class="card-header">
          <h2>Recent Events</h2>
        </div>
        <div class="events-list">
          <div
            v-for="event in batteryStore.recentEvents"
            :key="event.id"
            class="event-item"
            :class="`severity-${event.severity}`"
          >
            <div class="event-icon">
              {{ event.severity === 'critical' ? '🚨' : event.severity === 'warning' ? '⚠️' : 'ℹ️' }}
            </div>
            <div class="event-info">
              <div class="event-message">{{ event.message }}</div>
              <div class="event-time">{{ new Date(event.timestamp).toLocaleString() }}</div>
            </div>
          </div>
          <div v-if="batteryStore.recentEvents.length === 0" class="empty-state">
            <p>No recent events</p>
          </div>
        </div>
      </Card>
    </div>

    <!-- Charge Sessions -->
    <Card v-if="batteryStore.chargeSessions.length > 0">
      <div class="card-header">
        <h2>Recent Charge Sessions</h2>
      </div>
      <div class="sessions-grid">
        <div
          v-for="session in batteryStore.chargeSessions.slice(-5).reverse()"
          :key="session.id"
          class="session-card"
        >
          <div class="session-header">
            <strong>{{ new Date(session.startTime).toLocaleDateString() }}</strong>
            <span :class="{ interrupted: session.interrupted }">
              {{ session.interrupted ? 'Interrupted' : 'Complete' }}
            </span>
          </div>
          <div class="session-details">
            <div class="session-row">
              <span>Duration:</span>
              <span>{{ formatDuration(session.duration) }}</span>
            </div>
            <div class="session-row">
              <span>Charge Added:</span>
              <span>{{ session.startPercent }}% → {{ session.endPercent }}%</span>
            </div>
            <div class="session-row">
              <span>Energy:</span>
              <span>{{ session.energyAdded?.toFixed(1) }}Wh</span>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Settings Dialog -->
    <div v-if="showSettingsDialog" class="dialog-overlay" @click.self="showSettingsDialog = false">
      <Card class="dialog">
        <div class="dialog-header">
          <h2>Battery Settings</h2>
          <button class="close-btn" @click="showSettingsDialog = false">×</button>
        </div>

        <div class="dialog-content">
          <div class="settings-section">
            <h3>Battery Thresholds</h3>

            <div class="form-group">
              <label>Low Battery Warning (%)</label>
              <input
                v-model.number="settingsForm.lowBatteryPercent"
                type="number"
                min="10"
                max="50"
                class="input"
              />
            </div>

            <div class="form-group">
              <label>Critical Battery (%)</label>
              <input
                v-model.number="settingsForm.criticalBatteryPercent"
                type="number"
                min="5"
                max="30"
                class="input"
              />
            </div>

            <div class="form-group">
              <label>High Temperature (°C)</label>
              <input
                v-model.number="settingsForm.highTemperatureC"
                type="number"
                min="30"
                max="60"
                class="input"
              />
            </div>

            <div class="form-group">
              <label>Critical Temperature (°C)</label>
              <input
                v-model.number="settingsForm.criticalTemperatureC"
                type="number"
                min="50"
                max="80"
                class="input"
              />
            </div>
          </div>

          <div class="settings-section">
            <h3>Auto-Return Settings</h3>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="settingsForm.autoReturnEnabled" />
                <span>Enable automatic return on low battery</span>
              </label>
            </div>

            <div class="form-group">
              <label>Auto-Return Threshold (%)</label>
              <input
                v-model.number="settingsForm.autoReturnThreshold"
                type="number"
                min="10"
                max="50"
                class="input"
                :disabled="!settingsForm.autoReturnEnabled"
              />
            </div>

            <div class="form-group">
              <label>Return Destination</label>
              <select v-model="settingsForm.autoReturnDestination" class="select" :disabled="!settingsForm.autoReturnEnabled">
                <option value="home">Home Position</option>
                <option value="rally">Rally Point</option>
                <option value="nearest-charger">Nearest Charger</option>
              </select>
            </div>
          </div>

          <div class="settings-section">
            <h3>Charging Settings</h3>

            <div class="form-group">
              <label>Charge To (%)</label>
              <input
                v-model.number="settingsForm.chargeToPercent"
                type="number"
                min="80"
                max="100"
                class="input"
              />
            </div>

            <div class="form-group">
              <label>Maintain Minimum (%)</label>
              <input
                v-model.number="settingsForm.maintainMinPercent"
                type="number"
                min="5"
                max="20"
                class="input"
              />
            </div>
          </div>

          <div class="settings-section">
            <h3>Notifications</h3>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="settingsForm.notifyLowBattery" />
                <span>Notify on low battery</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="settingsForm.notifyCriticalBattery" />
                <span>Notify on critical battery</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="settingsForm.notifyChargingComplete" />
                <span>Notify when charging complete</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="settingsForm.notifyTemperatureWarning" />
                <span>Notify on temperature warnings</span>
              </label>
            </div>
          </div>

          <div class="dialog-actions">
            <Button variant="secondary" @click="showSettingsDialog = false">Cancel</Button>
            <Button variant="primary" @click="saveSettings">Save Settings</Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.battery-view {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
}

.view-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.view-subtitle {
  color: var(--text-secondary);
  margin: 0 0 0.5rem 0;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  width: fit-content;

  &.status-connected {
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);

    .status-dot {
      background: #10b981;
      animation: pulse 2s ease-in-out infinite;
    }
  }

  &.status-stale {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);

    .status-dot {
      background: #f59e0b;
    }
  }

  &.status-disconnected {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);

    .status-dot {
      background: #ef4444;
    }
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.header-actions {
  display: flex;
  gap: 0.75rem;

  @media (max-width: 768px) {
    width: 100%;
    button {
      flex: 1;
    }
  }
}

.alerts-section {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.alert-card {
  border-left: 4px solid;

  &.alert-critical {
    border-left-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  &.alert-low {
    border-left-color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
  }

  &.alert-temperature {
    border-left-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
}

.alert-content {
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.alert-icon {
  font-size: 1.5rem;
}

.alert-info {
  flex: 1;

  strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
}

.alert-time {
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.battery-main-card {
  grid-column: span 2;

  @media (max-width: 768px) {
    grid-column: span 1;
  }
}

.battery-display {
  padding: 2rem;
  text-align: center;
}

.battery-icon-large {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.battery-percent {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.battery-status {
  font-size: 1.125rem;
  color: var(--text-secondary);
  text-transform: capitalize;
  margin-bottom: 0.5rem;
}

.battery-voltage {
  font-size: 1rem;
  color: var(--text-tertiary);
}

.stat-card {
  padding: 1rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  text-transform: capitalize;
}

.stat-detail {
  font-size: 0.813rem;
  color: var(--text-tertiary);
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);

  h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
}

.info-table {
  padding: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  color: var(--text-secondary);
}

.info-value {
  color: var(--text-primary);
  font-weight: 500;
}

.events-list {
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  border-left: 3px solid;

  &.severity-info {
    border-left-color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }

  &.severity-warning {
    border-left-color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
  }

  &.severity-critical {
    border-left-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
}

.event-icon {
  font-size: 1.25rem;
}

.event-info {
  flex: 1;
}

.event-message {
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.event-time {
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.sessions-grid {
  padding: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.session-card {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);

  .interrupted {
    color: #f59e0b;
    font-size: 0.813rem;
  }
}

.session-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.session-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;

  span:first-child {
    color: var(--text-secondary);
  }

  span:last-child {
    color: var(--text-primary);
    font-weight: 500;
  }
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.dialog {
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border-color);

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.dialog-content {
  padding: 1.25rem;
}

.settings-section {
  margin-bottom: 2rem;

  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
}

.form-group {
  margin-bottom: 1rem;

  label {
    display: block;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
}

.input,
.select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.938rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: $primary;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  span {
    font-weight: normal;
  }
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.icon {
  margin-right: 0.5rem;
}
</style>
