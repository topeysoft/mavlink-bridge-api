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

      <div class="status-badges">
        <div v-if="rtcmStore.connectionDescription" class="connection-type-badge" :class="connectionBadgeClass">
          {{ rtcmStore.connectionDescription }}
        </div>
        <div class="status-badge" :class="stateClass">
          {{ stateDisplay }}
        </div>
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

      <!-- Health Status Card -->
      <Card v-if="rtcmStore.isRunning" class="health-card">
        <template #header>
          <h3>Connection Health</h3>
        </template>

        <div class="health-status">
          <div class="health-indicator" :class="`health-${healthStatus}`">
            <span class="health-icon">
              {{ healthStatus === 'healthy' ? '✅' : healthStatus === 'warning' ? '⚠️' : healthStatus === 'error' ? '❌' : '⏳' }}
            </span>
            <span class="health-text">{{ healthMessage }}</span>
          </div>

          <button
            v-if="hasDiagnosticIssues"
            class="btn btn-sm btn-secondary"
            @click="showDiagnostics = !showDiagnostics"
          >
            {{ showDiagnostics ? 'Hide' : 'Show' }} Diagnostics
          </button>
        </div>

        <!-- Diagnostics Section (expandable) -->
        <div v-if="showDiagnostics && statistics" class="diagnostics-section">
          <h4>Parser Diagnostics</h4>
          <div class="diagnostics-grid">
            <div class="diagnostic-item">
              <span class="diagnostic-label">Raw Data Received:</span>
              <span class="diagnostic-value">{{ formatBytes(statistics.bytesReceived || 0) }}</span>
            </div>
            <div class="diagnostic-item">
              <span class="diagnostic-label">Valid RTCM Messages:</span>
              <span class="diagnostic-value">{{ (statistics.messagesReceived || 0).toLocaleString() }}</span>
            </div>
            <div class="diagnostic-item">
              <span class="diagnostic-label">Parser Buffer Size:</span>
              <span class="diagnostic-value">
                {{ (statistics.parser_buffer_size || statistics.parserBufferSize || 0) }} bytes
              </span>
            </div>
            <div class="diagnostic-item" :class="{ 'diagnostic-issue': (statistics.frames_with_no_preamble || statistics.framesWithNoPreamble || 0) > 0 }">
              <span class="diagnostic-label">❌ No RTCM Frames Found:</span>
              <span class="diagnostic-value">
                {{ (statistics.frames_with_no_preamble || statistics.framesWithNoPreamble || 0).toLocaleString() }} chunks
              </span>
            </div>
            <div class="diagnostic-item" :class="{ 'diagnostic-issue': (statistics.frames_with_invalid_crc || statistics.framesWithInvalidCrc || 0) > 0 }">
              <span class="diagnostic-label">CRC Validation Failures:</span>
              <span class="diagnostic-value">
                {{ (statistics.frames_with_invalid_crc || statistics.framesWithInvalidCrc || 0).toLocaleString() }}
              </span>
            </div>
            <div class="diagnostic-item" :class="{ 'diagnostic-issue': (statistics.frames_with_invalid_length || statistics.framesWithInvalidLength || 0) > 0 }">
              <span class="diagnostic-label">Invalid Length Fields:</span>
              <span class="diagnostic-value">
                {{ (statistics.frames_with_invalid_length || statistics.framesWithInvalidLength || 0).toLocaleString() }}
              </span>
            </div>
          </div>

          <div v-if="(statistics.frames_with_no_preamble || statistics.framesWithNoPreamble || 0) > 0" class="diagnostic-suggestion">
            💡 <strong>Suggestion:</strong> Data source may not be sending RTCM3 format.
            Verify that your TCP server is configured to send RTCM correction data.
          </div>
          <div v-else-if="(statistics.frames_with_invalid_crc || statistics.framesWithInvalidCrc || 0) > 0" class="diagnostic-suggestion">
            💡 <strong>Suggestion:</strong> High CRC failure rate indicates data corruption.
            Check network connection quality or cable integrity.
          </div>
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
            <div class="stat-value">{{ (statistics.messagesReceived || statistics.messages_received || 0).toLocaleString() }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Bytes Received</div>
            <div class="stat-value">{{ formatBytes(statistics.bytesReceived || statistics.bytes_received || 0) }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Data Rate</div>
            <div class="stat-value">{{ formatDataRate((statistics.dataRate || statistics.data_rate || 0) * 1024) }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">CRC Errors</div>
            <div class="stat-value" :class="{ 'text-danger': (statistics.crc_errors || statistics.crcErrors || 0) > 0 }">
              {{ statistics.crc_errors || statistics.crcErrors || 0 }}
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Messages/sec</div>
            <div class="stat-value">{{ rtcmStore.messagesPerSecond.toFixed(1) }}</div>
          </div>
          <div v-if="statistics.connectionTime || statistics.connection_time" class="stat-box">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">{{ formatUptime(statistics.connectionTime || statistics.connection_time) }}</div>
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

        <div v-if="messageTypeCounts && Object.keys(messageTypeCounts).length > 0" class="message-list">
          <div
            v-for="(count, type) in messageTypeCounts"
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

      <!-- Output Routing Card -->
      <Card v-if="rtcmStore.isRunning && outputTargets && outputTargets.length > 0" class="output-routing-card">
        <template #header>
          <h3>Output Routing</h3>
          <span class="output-status-badge">
            {{ activeTargetsCount }} / {{ outputTargets.length }} Active
          </span>
        </template>

        <div class="output-targets-list">
          <div
            v-for="target in outputTargets"
            :key="target.name"
            class="output-target-row"
            :class="{ 'target-active': isTargetActive(target) }"
          >
            <div class="target-header">
              <div class="target-name-group">
                <span class="target-indicator" :class="isTargetActive(target) ? 'active' : 'inactive'">●</span>
                <span class="target-name">{{ target.name }}</span>
              </div>
              <span class="target-status">
                {{ isTargetActive(target) ? 'Active' : 'Idle' }}
              </span>
            </div>
            <div class="target-stats">
              <div class="target-stat">
                <span class="target-stat-label">Messages:</span>
                <span class="target-stat-value">{{ getTargetMessagesSent(target).toLocaleString() }}</span>
              </div>
              <div class="target-stat">
                <span class="target-stat-label">Bytes:</span>
                <span class="target-stat-value">{{ formatBytes(getTargetBytesSent(target)) }}</span>
              </div>
              <div v-if="getTargetSendErrors(target) > 0" class="target-stat target-stat-error">
                <span class="target-stat-label">Errors:</span>
                <span class="target-stat-value text-danger">{{ getTargetSendErrors(target) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="output-summary">
          <div class="summary-stat">
            <span class="summary-label">Total Forwarded:</span>
            <span class="summary-value">{{ formatBytes(totalBytesSent) }}</span>
          </div>
          <div v-if="totalRoutingErrors > 0" class="summary-stat">
            <span class="summary-label">Routing Errors:</span>
            <span class="summary-value text-danger">{{ totalRoutingErrors }}</span>
          </div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRTCMStore } from '@/stores/rtcm'
import { useConnectionStore } from '@/stores/connection'
import Card from '@/components/common/Card.vue'
import Modal from '@/components/common/Modal.vue'
import type { RTCMConfig } from "@mavlinkbridge/api-client/dist/rtcm/RTCMTypes"

const rtcmStore = useRTCMStore()
const connectionStore = useConnectionStore()

// Initialize RTCM store on mount (fetch status and setup event listeners)
onMounted(async () => {
  await rtcmStore.initialize()
})

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

const connectionBadgeClass = computed(() => {
  switch (rtcmStore.currentClientType) {
    case 'NTRIP':
      return 'badge-ntrip'
    case 'TCP':
      return 'badge-tcp'
    case 'UDP':
      return 'badge-udp'
    default:
      return 'badge-default'
  }
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

// Health status based on statistics
const healthStatus = computed(() => {
  const stats = statistics.value
  if (!stats || !rtcmStore.isRunning) return 'unknown'

  // Error state
  if (rtcmStore.currentState === 'error') return 'error'

  // Healthy: messages flowing, low error rate
  if (stats.messagesReceived > 0) {
    const crcErrors = stats.crc_errors || stats.crcErrors || 0
    const errorRate = crcErrors / Math.max(stats.messagesReceived, 1)
    return errorRate < 0.05 ? 'healthy' : 'warning'
  }

  // Warning: bytes received but no valid messages
  if (stats.bytesReceived > 0) return 'warning'

  // Connecting/waiting
  return 'unknown'
})

const healthMessage = computed(() => {
  const stats = statistics.value
  switch (healthStatus.value) {
    case 'healthy':
      return 'RTCM data flowing normally'
    case 'warning':
      if (stats && stats.bytesReceived > 0 && stats.messagesReceived === 0) {
        const noPreamble = stats.frames_with_no_preamble || stats.framesWithNoPreamble || 0
        const invalidCrc = stats.frames_with_invalid_crc || stats.framesWithInvalidCrc || 0
        if (noPreamble > 0) {
          return 'Data source is not sending RTCM3 format'
        } else if (invalidCrc > 0) {
          return 'RTCM data corrupt - check connection quality'
        }
        return 'Waiting for valid RTCM messages'
      }
      return 'High error rate detected'
    case 'error':
      return 'Connection error'
    default:
      return 'Connecting...'
  }
})

const showDiagnostics = ref(false)

const hasDiagnosticIssues = computed(() => {
  const stats = statistics.value
  if (!stats) return false
  const noPreamble = stats.frames_with_no_preamble || stats.framesWithNoPreamble || 0
  const invalidCrc = stats.frames_with_invalid_crc || stats.framesWithInvalidCrc || 0
  const invalidLength = stats.frames_with_invalid_length || stats.framesWithInvalidLength || 0
  return noPreamble > 0 || invalidCrc > 0 || invalidLength > 0
})

// Handle both snake_case (backend) and camelCase (frontend) for message type counts
const messageTypeCounts = computed(() => {
  const stats = statistics.value
  if (!stats) return {}
  return stats.message_type_counts || stats.messageTypes || {}
})

// Output routing statistics
const outputTargets = computed(() => {
  const stats = statistics.value
  if (!stats) return []
  return stats.output_targets || stats.outputTargets || []
})

// Diagnostic watcher to debug reactive updates
watch([() => statistics.value, outputTargets, () => rtcmStore.isRunning], ([newStats, newTargets, isRunning]) => {
  console.log('[AdvancedRTCMPanel] Stats/targets changed:', {
    hasStats: !!newStats,
    hasOutputTargets: !!(newStats?.output_targets || (newStats as any)?.outputTargets),
    outputTargetsCount: newTargets?.length || 0,
    targets: newTargets,
    isRunning: isRunning,
    cardShouldShow: isRunning && newTargets && newTargets.length > 0
  })
}, { deep: true, immediate: true })

const activeTargetsCount = computed(() => {
  return outputTargets.value.filter(target => isTargetActive(target)).length
})

const totalBytesSent = computed(() => {
  const stats = statistics.value
  if (!stats) return 0
  return stats.bytes_sent || stats.bytesSent || 0
})

const totalRoutingErrors = computed(() => {
  const stats = statistics.value
  if (!stats) return 0
  return stats.routing_errors || stats.routingErrors || 0
})

function isTargetActive(target: any): boolean {
  return target.is_active || target.isActive || false
}

function getTargetMessagesSent(target: any): number {
  return target.messages_sent || target.messagesSent || 0
}

function getTargetBytesSent(target: any): number {
  return target.bytes_sent || target.bytesSent || 0
}

function getTargetSendErrors(target: any): number {
  return target.send_errors || target.sendErrors || 0
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDataRate(rate: number): string {
  if (rate < 1024) return `${rate.toFixed(0)} B/s`
  return `${(rate / 1024).toFixed(1)} KB/s`
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

.status-badges {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
}

.connection-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.875rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: monospace;

  &.badge-ntrip {
    background-color: rgba(135, 206, 235, 0.15);
    color: #0284c7;
    border: 1px solid rgba(135, 206, 235, 0.3);
  }

  &.badge-tcp {
    background-color: rgba(44, 95, 45, 0.1);
    color: var(--primary-green);
    border: 1px solid rgba(44, 95, 45, 0.2);
  }

  &.badge-udp {
    background-color: rgba(147, 51, 234, 0.1);
    color: #7c3aed;
    border: 1px solid rgba(147, 51, 234, 0.2);
  }

  &.badge-default {
    background-color: rgba(107, 114, 128, 0.1);
    color: #4b5563;
    border: 1px solid rgba(107, 114, 128, 0.2);
  }
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

// Output routing card styles
.output-routing-card {
  .output-status-badge {
    font-size: 0.875rem;
    padding: 0.25rem 0.75rem;
    background-color: var(--bg-secondary);
    border-radius: 12px;
    color: var(--text-secondary);
    font-weight: 500;
  }
}

.output-targets-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.output-target-row {
  padding: 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-card);
  transition: all 0.2s ease;

  &.target-active {
    border-color: var(--primary-green);
    background-color: rgba(44, 95, 45, 0.02);
  }
}

.target-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.625rem;
}

.target-name-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.target-indicator {
  font-size: 0.75rem;

  &.active {
    color: var(--primary-green);
    animation: pulse 2s ease-in-out infinite;
  }

  &.inactive {
    color: var(--text-light);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.target-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.target-status {
  font-size: 0.8125rem;
  padding: 0.2rem 0.625rem;
  border-radius: 10px;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  font-weight: 500;
}

.target-stats {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.target-stat {
  display: flex;
  gap: 0.375rem;
  font-size: 0.875rem;
}

.target-stat-label {
  color: var(--text-secondary);
}

.target-stat-value {
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
}

.target-stat-error {
  .target-stat-value {
    color: var(--negative);
  }
}

.output-summary {
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.summary-stat {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.summary-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
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

// Health Status Card
.health-card {
  margin-bottom: 1.5rem;
}

.health-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  font-size: 1rem;

  &.health-healthy {
    color: var(--status-success);
  }

  &.health-warning {
    color: var(--status-warning);
  }

  &.health-error {
    color: var(--status-danger);
  }

  &.health-unknown {
    color: var(--text-secondary);
  }
}

.health-icon {
  font-size: 1.5rem;
}

.health-text {
  flex: 1;
}

.diagnostics-section {
  margin-top: 1rem;
  padding: 1rem;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);

  h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: var(--text-primary);
  }
}

.diagnostics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.diagnostic-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: var(--bg-secondary);
  border-radius: 4px;

  &.diagnostic-issue {
    background-color: rgba(255, 193, 7, 0.1);
    border: 1px solid var(--status-warning);

    .diagnostic-label {
      color: var(--status-warning);
      font-weight: 600;
    }
  }
}

.diagnostic-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.diagnostic-value {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.diagnostic-suggestion {
  padding: 0.75rem;
  background-color: rgba(23, 162, 184, 0.1);
  border-left: 3px solid var(--status-info);
  border-radius: 4px;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-primary);
}
</style>
