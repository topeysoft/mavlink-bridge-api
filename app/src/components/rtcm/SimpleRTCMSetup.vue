<template>
  <div class="simple-rtcm-setup">
    <!-- Connection Status Card -->
    <Card v-if="rtcmStore.isRunning" class="status-card">
      <template #header>
        <div class="status-header">
          <div class="status-indicator-group">
            <div class="status-indicator" :class="statusClass">
              <span class="status-dot"></span>
              <span class="status-text">{{ statusText }}</span>
            </div>
            <div v-if="rtcmStore.connectionDescription" class="connection-badge" :class="connectionBadgeClass">
              {{ rtcmStore.connectionDescription }}
            </div>
          </div>
          <button class="btn btn-danger btn-sm" @click="handleStop" :disabled="rtcmStore.isStopping">
            <span v-if="rtcmStore.isStopping">Stopping...</span>
            <span v-else>Stop RTK</span>
          </button>
        </div>
      </template>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">Accuracy</div>
          <div class="stat-value">{{ accuracyDisplay }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Messages</div>
          <div class="stat-value">{{ (statistics?.messagesReceived || statistics?.messages_received || 0).toLocaleString() }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Data Rate</div>
          <div class="stat-value">{{ dataRateDisplay }}</div>
        </div>
      </div>

      <div v-if="rtcmStore.hasError" class="alert alert-warning">
        {{ rtcmStore.lastError }}
      </div>
    </Card>

    <!-- Setup Card (when not running) -->
    <Card v-else class="setup-card">
      <template #header>
        <h3>RTK Positioning Setup</h3>
        <p class="subtitle">Get centimeter-level GPS accuracy for precise navigation</p>
      </template>

      <!-- Info Banner -->
      <div class="info-banner">
        <div class="info-icon">ℹ️</div>
        <div class="info-content">
          <strong>What is RTK?</strong>
          <p>Real-Time Kinematic (RTK) positioning provides centimeter-level GPS accuracy by receiving correction data from a nearby base station or NTRIP service.</p>
        </div>
      </div>

      <!-- Preset Selection -->
      <div class="form-section">
        <label class="form-label">Choose Your RTK Service</label>
        <div class="preset-grid">
          <div
            v-for="preset in NTRIP_PRESETS"
            :key="preset.id"
            class="preset-card"
            :class="{ selected: selectedPreset?.id === preset.id }"
            @click="selectPreset(preset)"
          >
            <div class="preset-header">
              <h4>{{ preset.name }}</h4>
              <div v-if="selectedPreset?.id === preset.id" class="check-icon">✓</div>
            </div>
            <p>{{ preset.description }}</p>
          </div>
        </div>
      </div>

      <!-- Configuration Form -->
      <div v-if="selectedPreset" class="form-section">
        <div class="form-divider"></div>

        <!-- NTRIP Configuration -->
        <div v-if="selectedPreset.type === 'ntrip'" class="config-form">
          <h4 class="config-title">Connection Details</h4>

          <div v-if="selectedPreset.id !== 'custom-ntrip'" class="info-note">
            <strong>{{ selectedPreset.name }} Settings</strong>
            <p>Host: {{ ntripConfig.host }}</p>
          </div>

          <div v-if="selectedPreset.id === 'custom-ntrip'" class="form-group">
            <label>NTRIP Server</label>
            <input
              v-model="ntripConfig.host"
              type="text"
              class="form-input"
              placeholder="e.g., rtk2go.com"
            />
          </div>

          <div v-if="selectedPreset.id === 'custom-ntrip'" class="form-group">
            <label>Port</label>
            <input
              v-model.number="ntripConfig.port"
              type="number"
              class="form-input"
              placeholder="2101"
            />
          </div>

          <div class="form-group">
            <label>Mountpoint <span class="required">*</span></label>
            <input
              v-model="ntripConfig.mountpoint"
              type="text"
              class="form-input"
              placeholder="e.g., NEAREST_STATION"
            />
            <small class="form-hint">Check your NTRIP provider's mountpoint list</small>
          </div>

          <div class="form-group">
            <label>Username</label>
            <input
              v-model="ntripConfig.username"
              type="text"
              class="form-input"
              placeholder="Optional"
            />
          </div>

          <div class="form-group">
            <label>Password</label>
            <input
              v-model="ntripConfig.password"
              type="password"
              class="form-input"
              placeholder="Optional"
            />
          </div>

          <!-- Position Sending (Optional) -->
          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="sendPosition" type="checkbox" />
              <span>Send my position to NTRIP server</span>
            </label>
            <small class="form-hint">Some NTRIP services require your approximate position</small>
          </div>

          <div v-if="sendPosition" class="position-inputs">
            <div class="form-row">
              <div class="form-group">
                <label>Latitude</label>
                <input
                  v-model.number="position.latitude"
                  type="number"
                  step="0.000001"
                  class="form-input"
                  placeholder="e.g., 37.7749"
                />
              </div>
              <div class="form-group">
                <label>Longitude</label>
                <input
                  v-model.number="position.longitude"
                  type="number"
                  step="0.000001"
                  class="form-input"
                  placeholder="e.g., -122.4194"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- TCP Configuration -->
        <div v-else-if="selectedPreset.type === 'tcp'" class="config-form">
          <h4 class="config-title">TCP Server Details</h4>

          <!-- Auto-discovery for docking station -->
          <div v-if="selectedPreset.id === 'docking-station'" class="discovery-section">
            <button
              class="btn btn-secondary"
              @click="scanForBaseStations"
              :disabled="isScanning"
            >
              <span v-if="!isScanning">🔍 Scan for Base Stations</span>
              <span v-else class="scanning-text">
                <span class="spinner"></span>
                Scanning...
              </span>
            </button>

            <div v-if="discoveredStations.length > 0" class="discovered-stations">
              <h5>Discovered Base Stations</h5>
              <div class="stations-list">
                <div
                  v-for="station in discoveredStations"
                  :key="`${station.host}:${station.port}`"
                  class="station-card"
                  :class="{ selected: tcpConfig.host === station.host }"
                  @click="selectStation(station)"
                >
                  <div class="station-icon">📡</div>
                  <div class="station-info">
                    <strong>{{ station.name }}</strong>
                    <small>
                      {{ station.host }}:{{ station.port }}
                      <span v-if="station.protocol" class="protocol-badge" :class="`protocol-${station.protocol}`">
                        {{ station.protocol.toUpperCase() }}
                      </span>
                    </small>
                  </div>
                  <div v-if="tcpConfig.host === station.host" class="check-icon">✓</div>
                </div>
              </div>
            </div>

            <div class="divider">
              <span>Or enter manually</span>
            </div>
          </div>

          <div class="form-group">
            <label>Server Address <span class="required">*</span></label>
            <input
              v-model="tcpConfig.host"
              type="text"
              class="form-input"
              placeholder="e.g., 192.168.1.100"
            />
          </div>

          <div class="form-group">
            <label>Port <span class="required">*</span></label>
            <input
              v-model.number="tcpConfig.port"
              type="number"
              class="form-input"
              placeholder="5015"
            />
          </div>
        </div>

        <!-- UDP Configuration -->
        <div v-else-if="selectedPreset.type === 'udp'" class="config-form">
          <h4 class="config-title">UDP Connection Details</h4>

          <div class="form-group">
            <label>Local Port <span class="required">*</span></label>
            <input
              v-model.number="udpConfig.port"
              type="number"
              class="form-input"
              placeholder="5015"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="useRemoteUDP" type="checkbox" />
              <span>Send to remote host</span>
            </label>
          </div>

          <div v-if="useRemoteUDP" class="form-row">
            <div class="form-group">
              <label>Remote Host</label>
              <input
                v-model="udpConfig.remoteHost"
                type="text"
                class="form-input"
                placeholder="e.g., 192.168.1.100"
              />
            </div>
            <div class="form-group">
              <label>Remote Port</label>
              <input
                v-model.number="udpConfig.remotePort"
                type="number"
                class="form-input"
                placeholder="5015"
              />
            </div>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="rtcmStore.lastError" class="alert alert-danger">
          {{ rtcmStore.lastError }}
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button
            class="btn btn-primary btn-lg"
            @click="handleStart"
            :disabled="!canStart || rtcmStore.isStarting"
          >
            <span v-if="rtcmStore.isStarting">Starting...</span>
            <span v-else>Start RTK</span>
          </button>
        </div>
      </div>
    </Card>

    <!-- Help Section -->
    <Card class="help-card">
      <template #header>
        <h4>Need Help?</h4>
      </template>

      <div class="help-content">
        <div class="help-item">
          <strong>Don't have an RTK service?</strong>
          <p>Try RTK2GO - it's free! Visit <a href="http://rtk2go.com" target="_blank">rtk2go.com</a> to find a mountpoint near you.</p>
        </div>

        <div class="help-item">
          <strong>How do I know if it's working?</strong>
          <p>Once connected, you should see messages being received. Your GPS accuracy will improve to centimeter-level within 1-5 minutes.</p>
        </div>

        <div class="help-item">
          <strong>Connection issues?</strong>
          <ul>
            <li>Verify your mountpoint name is correct</li>
            <li>Check your internet connection</li>
            <li>Ensure your NTRIP credentials are valid</li>
            <li>Make sure you're within range of the base station (typically 10-30km)</li>
          </ul>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRTCMStore, NTRIP_PRESETS, type RTCMPreset } from '@/stores/rtcm'
import { useConnectionStore } from '@/stores/connection'
import { useGpsStore } from '@/stores/gps'
import Card from '@/components/common/Card.vue'

const rtcmStore = useRTCMStore()
const connectionStore = useConnectionStore()
const gpsStore = useGpsStore()

// Initialize RTCM store on mount (fetch status and setup event listeners)
onMounted(async () => {
  await rtcmStore.initialize()
})

// Preset selection
const selectedPreset = ref<RTCMPreset | null>(null)

// Base station discovery
const isScanning = ref(false)
const discoveredStations = ref<Array<{ host: string; port: number; name: string; protocol?: string }>>([])

// NTRIP configuration
const ntripConfig = ref({
  host: '',
  port: 2101,
  mountpoint: '',
  username: '',
  password: ''
})

const sendPosition = ref(false)
const position = ref({
  latitude: 0,
  longitude: 0,
  altitude: 0
})

// TCP configuration
const tcpConfig = ref({
  host: '',
  port: 5015
})

// UDP configuration
const udpConfig = ref({
  port: 5015,
  remoteHost: '',
  remotePort: 5015
})
const useRemoteUDP = ref(false)

// Computed
const statistics = computed(() => rtcmStore.statistics)

const statusClass = computed(() => {
  switch (rtcmStore.currentState) {
    case 'connected':
      return 'status-connected'
    case 'connecting':
      return 'status-connecting'
    case 'error':
      return 'status-error'
    default:
      return 'status-disconnected'
  }
})

const statusText = computed(() => {
  switch (rtcmStore.currentState) {
    case 'connected':
      return 'RTK Active'
    case 'connecting':
      return 'Connecting...'
    case 'error':
      return 'Connection Error'
    default:
      return 'Disconnected'
  }
})

const accuracyDisplay = computed(() => {
  // Hybrid approach: Show actual GPS accuracy based on fix type
  const isRTKFix = gpsStore.gpsInfo.fixType >= 5

  if (rtcmStore.isConnected && isRTKFix) {
    // RTCM active AND GPS has achieved RTK fix
    // Use actual accuracy if available from MAVLink hAcc field
    if (gpsStore.gpsInfo.accuracy !== null && gpsStore.gpsInfo.accuracy < 1) {
      const accCm = gpsStore.gpsInfo.accuracy * 100
      return `~${accCm.toFixed(0)}cm`
    }
    // Fallback to fix type
    return gpsStore.gpsInfo.fixType === 6 ? '~2cm' : '~25cm'
  } else if (rtcmStore.isConnected) {
    // RTCM corrections flowing but GPS hasn't achieved RTK fix yet
    return 'Acquiring RTK...'
  } else if (gpsStore.gpsInfo.hasLock) {
    // No RTCM, but GPS has standard fix
    return '~3m'
  } else {
    // No GPS fix
    return 'N/A'
  }
})

const dataRateDisplay = computed(() => {
  const rate = rtcmStore.dataRate
  if (rate < 1024) {
    return `${rate.toFixed(0)} B/s`
  } else {
    return `${(rate / 1024).toFixed(1)} KB/s`
  }
})

const canStart = computed(() => {
  if (!selectedPreset.value) return false

  switch (selectedPreset.value.type) {
    case 'ntrip':
      return !!ntripConfig.value.host && !!ntripConfig.value.mountpoint
    case 'tcp':
      return !!tcpConfig.value.host && !!tcpConfig.value.port
    case 'udp':
      return !!udpConfig.value.port
    default:
      return false
  }
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

// Methods
async function scanForBaseStations() {
  isScanning.value = true
  discoveredStations.value = []

  try {
    if (!connectionStore.isConnected) {
      console.warn('Not connected to device, cannot scan for RTCM servers')
      return
    }

    // Use the device's mDNS discovery to find RTCM base stations on the network
    const client = connectionStore.getClient()
    const rtcmServers = await client.mdns.discoverRTCMServers()

    // Convert RTCMServerInfo to our station format
    discoveredStations.value = rtcmServers.map(server => ({
      host: server.ip,
      port: server.port,
      name: server.friendlyName || server.hostname,
      protocol: server.protocol
    }))

    console.log(`Found ${discoveredStations.value.length} RTCM base stations`)

  } catch (error) {
    console.error('Failed to scan for base stations:', error)

    // Fallback: if mDNS fails, suggest common local addresses
    discoveredStations.value = [
      { host: '192.168.4.1', port: 5015, name: 'Docking Station (common)' },
      { host: '192.168.1.100', port: 5015, name: 'Local Network (common)' }
    ]
  } finally {
    isScanning.value = false
  }
}

function selectStation(station: { host: string; port: number; name: string }) {
  tcpConfig.value.host = station.host
  tcpConfig.value.port = station.port
}

function selectPreset(preset: RTCMPreset) {
  selectedPreset.value = preset

  // Pre-fill configuration from preset
  if (preset.config.source) {
    const source = preset.config.source
    if (source.type === 'ntrip') {
      ntripConfig.value = {
        host: source.host || '',
        port: source.port || 2101,
        mountpoint: source.mountpoint || '',
        username: source.username || '',
        password: source.password || ''
      }
    } else if (source.type === 'tcp') {
      tcpConfig.value = {
        host: source.host || '',
        port: source.port || 5015
      }

      // Auto-scan for docking station preset
      if (preset.id === 'docking-station') {
        scanForBaseStations()
      }
    } else if (source.type === 'udp') {
      udpConfig.value = {
        port: source.port || 5015,
        remoteHost: source.remoteHost || '',
        remotePort: source.remotePort || 5015
      }
    }
  }
}

async function handleStart() {
  if (!selectedPreset.value) return

  let success = false

  switch (selectedPreset.value.type) {
    case 'ntrip':
      success = await rtcmStore.startNTRIP({
        host: ntripConfig.value.host,
        port: ntripConfig.value.port,
        mountpoint: ntripConfig.value.mountpoint,
        username: ntripConfig.value.username || undefined,
        password: ntripConfig.value.password || undefined,
        latitude: sendPosition.value ? position.value.latitude : undefined,
        longitude: sendPosition.value ? position.value.longitude : undefined,
        altitude: sendPosition.value ? position.value.altitude : undefined
      })
      break

    case 'tcp':
      success = await rtcmStore.startTCP(tcpConfig.value.host, tcpConfig.value.port)
      break

    case 'udp':
      success = await rtcmStore.startUDP(
        udpConfig.value.port,
        useRemoteUDP.value ? udpConfig.value.remoteHost : undefined,
        useRemoteUDP.value ? udpConfig.value.remotePort : undefined
      )
      break
  }

  if (success) {
    console.log('RTK started successfully')
  }
}

async function handleStop() {
  await rtcmStore.stop()
}
</script>

<style scoped lang="scss">


.simple-rtcm-setup {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.status-card {
  margin-bottom: 2rem;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.status-indicator-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 1.125rem;
}

.connection-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: monospace;
  align-self: flex-start;

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

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.status-connected .status-dot {
  background-color: var(--status-success);
}

.status-connecting .status-dot {
  background-color: var(--status-warning);
}

.status-error .status-dot {
  background-color: var(--status-danger);
}

.status-disconnected .status-dot {
  background-color: var(--text-light);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-light);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-green);
}

.subtitle {
  color: var(--text-light);
  margin-top: 0.5rem;
}

.info-banner {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background-color: #d1ecf1;
  border-left: 4px solid var(--status-info);
  border-radius: 4px;
  margin-bottom: 2rem;
}

.info-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.info-content {
  flex: 1;

  strong {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
}

.form-section {
  margin-bottom: 2rem;
}

.form-label {
  display: block;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.preset-card {
  padding: 1rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--primary-green);
    box-shadow: 0 2px 8px rgba(44, 95, 45, 0.1);
  }

  &.selected {
    border-color: var(--primary-green);
    background-color: #e8f5e9;
  }

  h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-light);
  }
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.check-icon {
  width: 24px;
  height: 24px;
  background-color: var(--primary-green);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.form-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 2rem 0;
}

.config-form {
  animation: fadeIn 0.3s ease;
}

.config-title {
  margin: 0 0 1.5rem 0;
  color: var(--text-primary);
}

.info-note {
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  margin-bottom: 1.5rem;

  strong {
    display: block;
    margin-bottom: 0.5rem;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-light);
  }
}

.form-group {
  margin-bottom: 1.25rem;

  label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: var(--text-primary);

    .required {
      color: var(--status-danger);
    }
  }
}

.form-input {
  width: 100%;
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

.form-hint {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-light);
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
    font-weight: 500;
  }
}

.position-inputs {
  margin-top: 1rem;
  padding-left: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.btn {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background-color: var(--primary-green);
  color: white;

  &:hover:not(:disabled) {
    background-color: #25522b;
  }
}

.btn-danger {
  background-color: var(--status-danger);
  color: white;

  &:hover:not(:disabled) {
    background-color: #c82333;
  }
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.btn-lg {
  padding: 0.75rem 2rem;
  font-size: 1.125rem;
}

.alert {
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.alert-warning {
  background-color: #fff3cd;
  border-left: 4px solid var(--status-warning);
  color: #d39e00;
}

.alert-danger {
  background-color: #f8d7da;
  border-left: 4px solid var(--status-danger);
  color: #bd2130;
}

.help-card {
  margin-top: 2rem;
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.help-item {
  strong {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }

  p, ul {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  ul {
    margin-top: 0.5rem;
    padding-left: 1.5rem;

    li {
      margin-bottom: 0.25rem;
    }
  }

  a {
    color: var(--primary-green);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

// Discovery section
.discovery-section {
  margin-bottom: 1.5rem;
}

.btn-secondary {
  background-color: var(--sky-blue);
  color: white;

  &:hover:not(:disabled) {
    background-color: #70b8d6;
  }
}

.scanning-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.discovered-stations {
  margin-top: 1.5rem;
  animation: fadeIn 0.3s ease;

  h5 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1rem;
  }
}

.stations-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.station-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: white;

  &:hover {
    border-color: var(--primary-green);
    box-shadow: 0 2px 8px rgba(44, 95, 45, 0.1);
  }

  &.selected {
    border-color: var(--primary-green);
    background-color: #e8f5e9;
  }
}

.station-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.station-info {
  flex: 1;

  strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  small {
    color: var(--text-secondary);
    font-family: monospace;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

.protocol-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.05em;

  &.protocol-tcp {
    background-color: rgba(44, 95, 45, 0.1);
    color: var(--primary-green);
  }

  &.protocol-udp {
    background-color: rgba(135, 206, 235, 0.15);
    color: #0284c7;
  }
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: var(--border-color);
  }

  span {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
