<template>
  <div class="advanced-rtcm-panel">
    <!-- Control Bar -->
    <div class="control-bar">
      <div class="control-group">
        <button
          v-if="!rtcmStore.isRunning"
          class="btn btn-success"
          @click="showConfigDialog = true"
          :disabled="!connectionStore.isConnected"
        >
          <span class="btn-icon">▶</span>
          Start RTCM
        </button>
        <button
          v-else
          class="btn btn-danger"
          @click="handleStop"
          :disabled="rtcmStore.isStopping"
        >
          <span class="btn-icon">■</span>
          Stop
        </button>

        <button class="btn btn-secondary" @click="rtcmStore.refreshStatus">
          <span class="btn-icon">↻</span>
          Refresh
        </button>
      </div>

      <div class="status-badge" :class="stateClass">
        {{ stateDisplay }}
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid-layout">
      <!-- Connection Info Card -->
      <Card class="connection-card">
        <template #header>
          <h3>Connection Information</h3>
        </template>

        <div v-if="rtcmStore.currentConfig" class="info-table">
          <div class="info-row">
            <span class="info-label">Type:</span>
            <span class="info-value">{{ connectionType }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Host:</span>
            <span class="info-value">{{ connectionHost }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Port:</span>
            <span class="info-value">{{ connectionPort }}</span>
          </div>
          <div v-if="mountpoint" class="info-row">
            <span class="info-label">Mountpoint:</span>
            <span class="info-value">{{ mountpoint }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Output Format:</span>
            <span class="info-value">{{ rtcmStore.currentConfig.outputFormat || 'raw' }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          No active connection
        </div>

        <div class="card-actions">
          <button
            v-if="rtcmStore.currentConfig"
            class="btn btn-sm btn-outline"
            @click="saveCurrentConfig"
          >
            Save Configuration
          </button>
          <button class="btn btn-sm btn-outline" @click="showSavedConfigs = !showSavedConfigs">
            Saved Configs ({{ rtcmStore.savedConfigs.length }})
          </button>
        </div>
      </Card>

      <!-- Statistics Card -->
      <Card class="statistics-card">
        <template #header>
          <h3>Statistics</h3>
        </template>

        <div v-if="statistics" class="stats-grid">
          <div class="stat-box">
            <div class="stat-label">Messages Received</div>
            <div class="stat-value">{{ statistics.messagesReceived.toLocaleString() }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Bytes Received</div>
            <div class="stat-value">{{ formatBytes(statistics.bytesReceived) }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Data Rate</div>
            <div class="stat-value">{{ formatDataRate(statistics.dataRate) }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">CRC Errors</div>
            <div class="stat-value" :class="{ 'text-danger': statistics.crcErrors > 0 }">
              {{ statistics.crcErrors }}
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Messages/sec</div>
            <div class="stat-value">{{ rtcmStore.messagesPerSecond.toFixed(1) }}</div>
          </div>
          <div v-if="statistics.connectionTime" class="stat-box">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">{{ formatUptime(statistics.connectionTime) }}</div>
          </div>
        </div>
        <div v-else class="empty-state">
          No statistics available
        </div>
      </Card>

      <!-- Message Types Card -->
      <Card class="message-types-card">
        <template #header>
          <h3>Message Types</h3>
        </template>

        <div v-if="statistics?.messageTypes && Object.keys(statistics.messageTypes).length > 0" class="message-list">
          <div
            v-for="(count, type) in statistics.messageTypes"
            :key="type"
            class="message-type-row"
          >
            <span class="message-type">{{ getMessageTypeName(type) }}</span>
            <span class="message-count">{{ count }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          No messages received yet
        </div>
      </Card>

      <!-- Recent Messages Card -->
      <Card class="recent-messages-card">
        <template #header>
          <h3>Recent Messages</h3>
          <button class="btn btn-sm btn-outline" @click="rtcmStore.recentMessages = []">
            Clear
          </button>
        </template>

        <div v-if="rtcmStore.recentMessages.length > 0" class="message-log">
          <div
            v-for="(msg, index) in rtcmStore.recentMessages.slice(0, 20)"
            :key="index"
            class="log-entry"
          >
            <span class="log-time">{{ formatTimestamp(Date.now()) }}</span>
            <span class="log-type">{{ msg.messageName || `Type ${msg.messageType}` }}</span>
            <span class="log-length">{{ msg.length }}B</span>
            <span v-if="msg.stationId" class="log-station">Station: {{ msg.stationId }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          No recent messages
        </div>
      </Card>
    </div>

    <!-- Saved Configurations Panel -->
    <div v-if="showSavedConfigs" class="saved-configs-panel">
      <Card>
        <template #header>
          <h3>Saved Configurations</h3>
          <button class="btn btn-sm btn-ghost" @click="showSavedConfigs = false">✕</button>
        </template>

        <div v-if="rtcmStore.savedConfigs.length > 0" class="saved-list">
          <div
            v-for="config in rtcmStore.savedConfigs"
            :key="config.id"
            class="saved-item"
          >
            <div class="saved-info">
              <h4>{{ config.name }}</h4>
              <p>{{ getConfigSummary(config.config) }}</p>
            </div>
            <div class="saved-actions">
              <button class="btn btn-sm btn-primary" @click="loadConfig(config.id)">
                Load
              </button>
              <button class="btn btn-sm btn-danger" @click="deleteConfig(config.id)">
                Delete
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          No saved configurations
        </div>
      </Card>
    </div>

    <!-- Configuration Dialog -->
    <Modal v-model="showConfigDialog">
      <template #header>
        <h2>RTCM Configuration</h2>
      </template>

      <div class="config-editor">
        <div class="form-group">
          <label>Source Type</label>
          <select v-model="configForm.sourceType" class="form-select">
            <option value="ntrip">NTRIP</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
          </select>
        </div>

        <!-- NTRIP Fields -->
        <template v-if="configForm.sourceType === 'ntrip'">
          <div class="form-group">
            <label>Host</label>
            <input v-model="configForm.ntrip.host" class="form-input" />
          </div>
          <div class="form-group">
            <label>Port</label>
            <input v-model.number="configForm.ntrip.port" type="number" class="form-input" />
          </div>
          <div class="form-group">
            <label>Mountpoint</label>
            <input v-model="configForm.ntrip.mountpoint" class="form-input" />
          </div>
          <div class="form-group">
            <label>Username (optional)</label>
            <input v-model="configForm.ntrip.username" class="form-input" />
          </div>
          <div class="form-group">
            <label>Password (optional)</label>
            <input v-model="configForm.ntrip.password" type="password" class="form-input" />
          </div>
          <div class="form-group">
            <label>
              <input v-model="configForm.ntrip.sendPosition" type="checkbox" />
              Send position to server
            </label>
          </div>
          <template v-if="configForm.ntrip.sendPosition">
            <div class="form-row">
              <div class="form-group">
                <label>Latitude</label>
                <input v-model.number="configForm.ntrip.latitude" type="number" step="0.000001" class="form-input" />
              </div>
              <div class="form-group">
                <label>Longitude</label>
                <input v-model.number="configForm.ntrip.longitude" type="number" step="0.000001" class="form-input" />
              </div>
            </div>
          </template>
        </template>

        <!-- TCP Fields -->
        <template v-else-if="configForm.sourceType === 'tcp'">
          <div class="form-group">
            <label>Host</label>
            <input v-model="configForm.tcp.host" class="form-input" />
          </div>
          <div class="form-group">
            <label>Port</label>
            <input v-model.number="configForm.tcp.port" type="number" class="form-input" />
          </div>
        </template>

        <!-- UDP Fields -->
        <template v-else-if="configForm.sourceType === 'udp'">
          <div class="form-group">
            <label>Local Port</label>
            <input v-model.number="configForm.udp.port" type="number" class="form-input" />
          </div>
          <div class="form-group">
            <label>Remote Host (optional)</label>
            <input v-model="configForm.udp.remoteHost" class="form-input" />
          </div>
          <div class="form-group">
            <label>Remote Port (optional)</label>
            <input v-model.number="configForm.udp.remotePort" type="number" class="form-input" />
          </div>
        </template>

        <div class="form-group">
          <label>Output Format</label>
          <select v-model="configForm.outputFormat" class="form-select">
            <option value="raw">Raw</option>
            <option value="mavlink">MAVLink</option>
          </select>
        </div>
      </div>

      <template #actions>
        <button class="btn btn-secondary" @click="showConfigDialog = false">Cancel</button>
        <button class="btn btn-primary" @click="handleStartFromDialog">Start</button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRTCMStore } from '@/stores/rtcm'
import { useConnectionStore } from '@/stores/connection'
import Card from '@/components/common/Card.vue'
import Modal from '@/components/common/Modal.vue'
import type { RTCMConfig } from "@mavlinkbridge/api-client/dist/rtcm/RTCMTypes"

const rtcmStore = useRTCMStore()
const connectionStore = useConnectionStore()

const showConfigDialog = ref(false)
const showSavedConfigs = ref(false)

const configForm = ref({
  sourceType: 'ntrip' as 'ntrip' | 'tcp' | 'udp',
  ntrip: {
    host: 'rtk2go.com',
    port: 2101,
    mountpoint: '',
    username: '',
    password: '',
    sendPosition: false,
    latitude: 0,
    longitude: 0
  },
  tcp: {
    host: '',
    port: 5015
  },
  udp: {
    port: 5015,
    remoteHost: '',
    remotePort: 5015
  },
  outputFormat: 'raw' as 'raw' | 'mavlink'
})

const statistics = computed(() => rtcmStore.statistics)

const stateClass = computed(() => {
  switch (rtcmStore.currentState) {
    case 'connected': return 'badge-success'
    case 'connecting': return 'badge-warning'
    case 'error': return 'badge-danger'
    default: return 'badge-secondary'
  }
})

const stateDisplay = computed(() => {
  return rtcmStore.currentState.toUpperCase()
})

const connectionType = computed(() => {
  return rtcmStore.currentConfig?.source.type.toUpperCase() || 'N/A'
})

const connectionHost = computed(() => {
  const source = rtcmStore.currentConfig?.source
  if (!source) return 'N/A'
  if ('host' in source) return source.host
  return 'N/A'
})

const connectionPort = computed(() => {
  const source = rtcmStore.currentConfig?.source
  if (!source) return 'N/A'
  return source.port || 'N/A'
})

const mountpoint = computed(() => {
  const source = rtcmStore.currentConfig?.source
  if (source && source.type === 'ntrip') {
    return source.mountpoint
  }
  return null
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDataRate(rate: number): string {
  if (rate < 1024) return `${rate.toFixed(0)} B/s`
  return `${(rate / 1024).toFixed(2)} KB/s`
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

function getMessageTypeName(type: string | number): string {
  const typeNum = typeof type === 'string' ? parseInt(type) : type
  const messageTypes: Record<number, string> = {
    1001: 'GPS L1',
    1002: 'GPS L1 Extended',
    1003: 'GPS L1/L2',
    1004: 'GPS L1/L2 Extended',
    1005: 'Station Coordinates',
    1006: 'Station Coordinates (Height)',
    1007: 'Antenna Descriptor',
    1008: 'Antenna Serial Number',
    1009: 'GLONASS L1',
    1010: 'GLONASS L1 Extended',
    1011: 'GLONASS L1/L2',
    1012: 'GLONASS L1/L2 Extended',
    1019: 'GPS Ephemeris',
    1020: 'GLONASS Ephemeris',
    1033: 'Receiver/Antenna Descriptor',
    1074: 'GPS MSM4',
    1075: 'GPS MSM5',
    1077: 'GPS MSM7',
    1084: 'GLONASS MSM4',
    1085: 'GLONASS MSM5',
    1087: 'GLONASS MSM7',
    1094: 'Galileo MSM4',
    1095: 'Galileo MSM5',
    1097: 'Galileo MSM7',
    1124: 'BeiDou MSM4',
    1125: 'BeiDou MSM5',
    1127: 'BeiDou MSM7'
  }

  return messageTypes[typeNum] || `Type ${typeNum}`
}

function getConfigSummary(config: RTCMConfig): string {
  const source = config.source
  if (source.type === 'ntrip') {
    return `NTRIP: ${source.host}:${source.port}/${source.mountpoint}`
  } else if (source.type === 'tcp') {
    return `TCP: ${source.host}:${source.port}`
  } else if (source.type === 'udp') {
    return `UDP: Port ${source.port}`
  }
  return 'Unknown'
}

async function handleStop() {
  await rtcmStore.stop()
}

async function handleStartFromDialog() {
  const form = configForm.value

  let config: any = {
    enabled: true,
    outputFormat: form.outputFormat
  }

  if (form.sourceType === 'ntrip') {
    config.source = {
      type: 'ntrip',
      host: form.ntrip.host,
      port: form.ntrip.port,
      mountpoint: form.ntrip.mountpoint,
      username: form.ntrip.username || undefined,
      password: form.ntrip.password || undefined,
      sendPosition: form.ntrip.sendPosition,
      position: form.ntrip.sendPosition ? {
        latitude: form.ntrip.latitude,
        longitude: form.ntrip.longitude,
        altitude: 0
      } : undefined
    }
  } else if (form.sourceType === 'tcp') {
    config.source = {
      type: 'tcp',
      host: form.tcp.host,
      port: form.tcp.port
    }
  } else if (form.sourceType === 'udp') {
    config.source = {
      type: 'udp',
      port: form.udp.port,
      remoteHost: form.udp.remoteHost || undefined,
      remotePort: form.udp.remotePort || undefined
    }
  }

  const success = await rtcmStore.start(config as RTCMConfig)
  if (success) {
    showConfigDialog.value = false
  }
}

function saveCurrentConfig() {
  const name = prompt('Enter configuration name:')
  if (name) {
    rtcmStore.saveConfig(name)
  }
}

async function loadConfig(configId: string) {
  await rtcmStore.loadConfig(configId)
  showSavedConfigs.value = false
}

function deleteConfig(configId: string) {
  if (confirm('Delete this configuration?')) {
    rtcmStore.deleteConfig(configId)
  }
}
</script>

<style scoped lang="scss">


.advanced-rtcm-panel {
  padding: 1rem;
}

.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-radius: 8px;
}

.control-group {
  display: flex;
  gap: 0.75rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-icon {
  font-size: 1.125rem;
}

.btn-success {
  background-color: var(--status-success);
  color: white;
  &:hover:not(:disabled) {
    background-color: #218838;
  }
}

.btn-danger {
  background-color: var(--status-danger);
  color: white;
  &:hover:not(:disabled) {
    background-color: #c82333;
  }
}

.btn-secondary {
  background-color: var(--sky-blue);
  color: white;
  &:hover:not(:disabled) {
    background-color: #70b8d6;
  }
}

.btn-primary {
  background-color: var(--primary-green);
  color: white;
  &:hover:not(:disabled) {
    background-color: #25522b;
  }
}

.btn-outline {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  &:hover:not(:disabled) {
    background-color: var(--bg-secondary);
  }
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.btn-ghost {
  background: none;
  border: none;
  color: var(--text-light);
  &:hover {
    color: var(--text-primary);
  }
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.875rem;
}

.badge-success {
  background-color: #d4edda;
  color: #1e7e34;
}

.badge-warning {
  background-color: #fff3cd;
  color: #d39e00;
}

.badge-danger {
  background-color: #f8d7da;
  color: #bd2130;
}

.badge-secondary {
  background-color: var(--bg-secondary);
  color: var(--text-light);
}

.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
}

.info-table {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-weight: 600;
  color: var(--text-light);
}

.info-value {
  font-family: 'Courier New', monospace;
  color: var(--text-primary);
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.stat-box {
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-radius: 4px;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-light);
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-green);

  &.text-danger {
    color: var(--status-danger);
  }
}

.message-list {
  max-height: 300px;
  overflow-y: auto;
}

.message-type-row {
  display: flex;
  justify-content: space-between;
  padding: 0.625rem;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }
}

.message-type {
  font-weight: 500;
  color: var(--text-primary);
}

.message-count {
  font-weight: 600;
  color: var(--primary-green);
}

.message-log {
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.log-entry {
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color);

  &:hover {
    background-color: var(--bg-secondary);
  }
}

.log-time {
  color: var(--text-light);
  flex-shrink: 0;
}

.log-type {
  color: var(--primary-green);
  font-weight: 600;
  flex: 1;
}

.log-length,
.log-station {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-light);
}

.saved-configs-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow-y: auto;
}

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.saved-item {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.saved-info {
  flex: 1;

  h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-light);
  }
}

.saved-actions {
  display: flex;
  gap: 0.5rem;
}

.config-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-weight: 600;
    color: var(--text-primary);
  }
}

.form-input,
.form-select {
  padding: 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: var(--primary-green);
    box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.1);
  }
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
</style>
