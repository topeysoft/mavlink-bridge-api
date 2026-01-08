<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRTCMStore } from '@/stores/rtcm'
import { useConnectionStore } from '@/stores/connection'
import Card from '@/components/common/Card.vue'

const rtcmStore = useRTCMStore()
const connectionStore = useConnectionStore()

// Wizard state
const currentStep = ref(0)
const baseStationIP = ref('')
const baseStationPort = ref(5015)
const isScanning = ref(false)
const discoveredStations = ref<Array<{ host: string; port: number; name: string }>>([])

// Steps
const steps = [
  { id: 'welcome', title: 'Welcome', icon: '🎯' },
  { id: 'detect', title: 'Find Base Station', icon: '🔍' },
  { id: 'connect', title: 'Connect', icon: '🔗' },
  { id: 'verify', title: 'Verify', icon: '✓' },
  { id: 'complete', title: 'Complete', icon: '🎉' }
]

const currentStepId = computed(() => steps[currentStep.value].id)
const progress = computed(() => ((currentStep.value + 1) / steps.length) * 100)

const canGoNext = computed(() => {
  if (currentStepId.value === 'detect') {
    return baseStationIP.value.length > 0
  }
  if (currentStepId.value === 'verify') {
    return rtcmStore.isConnected
  }
  return true
})

const canGoPrevious = computed(() => {
  return currentStep.value > 0 && !rtcmStore.isStarting
})

// Computed stats
const statistics = computed(() => rtcmStore.statistics)
const accuracyDisplay = computed(() => {
  if (rtcmStore.isConnected) {
    return '~2cm (Excellent)'
  } else if (rtcmStore.currentState === 'connecting') {
    return 'Acquiring...'
  } else {
    return 'Not Connected'
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

// Methods
function next() {
  if (canGoNext.value && currentStep.value < steps.length - 1) {
    currentStep.value++

    // Auto-actions on certain steps
    if (currentStepId.value === 'verify') {
      handleConnect()
    }
  }
}

function previous() {
  if (canGoPrevious.value) {
    currentStep.value--
  }
}

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
      name: server.friendlyName || server.hostname
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
  baseStationIP.value = station.host
  baseStationPort.value = station.port
}

async function handleConnect() {
  if (!baseStationIP.value) return

  const success = await rtcmStore.startTCP(baseStationIP.value, baseStationPort.value)

  if (success) {
    // Auto-advance to complete after connection is verified
    setTimeout(() => {
      if (rtcmStore.isConnected && currentStepId.value === 'verify') {
        next()
      }
    }, 3000)
  }
}

async function finish() {
  // Optionally save the base station configuration
  if (rtcmStore.currentConfig) {
    rtcmStore.saveConfig('My Docking Station')
  }
}

// Auto-scan on mount if on detect step
onMounted(() => {
  if (currentStepId.value === 'detect') {
    scanForBaseStations()
  }
})
</script>

<template>
  <div class="rtcm-wizard">
    <!-- Wizard Header -->
    <div class="wizard-header">
      <h2>GPS Boost Setup</h2>
      <p class="subtitle">Get pinpoint accuracy for your YardRover</p>

      <!-- Progress Bar -->
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <p class="progress-label">Step {{ currentStep + 1 }} of {{ steps.length }}</p>
      </div>
    </div>

    <!-- Step Indicators -->
    <div class="step-indicators">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="step-indicator"
        :class="{
          active: index === currentStep,
          complete: index < currentStep
        }"
      >
        <div class="step-icon">
          <span v-if="index < currentStep">✓</span>
          <span v-else>{{ step.icon }}</span>
        </div>
        <span class="step-title">{{ step.title }}</span>
      </div>
    </div>

    <!-- Wizard Content -->
    <Card class="wizard-content">
      <!-- Step 1: Welcome -->
      <div v-if="currentStepId === 'welcome'" class="step-content">
        <div class="welcome-content">
          <div class="welcome-icon">🎯</div>
          <h3>Welcome to GPS Boost!</h3>
          <p class="lead">
            GPS Boost gives your YardRover centimeter-level positioning accuracy, perfect for precise mowing patterns and automated navigation.
          </p>

          <div class="comparison-box">
            <div class="comparison-item">
              <div class="comparison-label">Standard GPS</div>
              <div class="comparison-value bad">±3-5 meters</div>
              <small>May drift and overlap</small>
            </div>
            <div class="arrow">→</div>
            <div class="comparison-item">
              <div class="comparison-label">GPS Boost</div>
              <div class="comparison-value good">±2 cm</div>
              <small>Pinpoint accuracy</small>
            </div>
          </div>

          <div class="info-banner">
            <svg viewBox="0 0 24 24" fill="currentColor" class="info-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <div>
              <strong>Your docking station includes a GPS base station</strong>
              <p>We'll help you connect to it in just a few steps.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Detect Base Station -->
      <div v-else-if="currentStepId === 'detect'" class="step-content">
        <h3>Find Your Base Station</h3>
        <p>We'll scan your local network to find your docking station's base station.</p>

        <div class="scan-section">
          <button
            class="btn btn-primary btn-lg"
            @click="scanForBaseStations"
            :disabled="isScanning"
          >
            <svg v-if="!isScanning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="M21 21l-4.35-4.35"></path>
            </svg>
            <span v-if="isScanning" class="spinner"></span>
            {{ isScanning ? 'Scanning...' : 'Scan for Base Stations' }}
          </button>
        </div>

        <div v-if="discoveredStations.length > 0" class="discovered-stations">
          <h4>Discovered Base Stations</h4>
          <div class="stations-list">
            <div
              v-for="station in discoveredStations"
              :key="station.host"
              class="station-card"
              :class="{ selected: baseStationIP === station.host }"
              @click="selectStation(station)"
            >
              <div class="station-icon">📡</div>
              <div class="station-info">
                <strong>{{ station.name }}</strong>
                <small>{{ station.host }}:{{ station.port }}</small>
              </div>
              <div v-if="baseStationIP === station.host" class="check-icon">✓</div>
            </div>
          </div>
        </div>

        <div class="manual-entry">
          <div class="divider">
            <span>Or enter manually</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>IP Address</label>
              <input
                v-model="baseStationIP"
                type="text"
                class="form-input"
                placeholder="e.g., 192.168.1.100"
              />
            </div>
            <div class="form-group">
              <label>Port</label>
              <input
                v-model.number="baseStationPort"
                type="number"
                class="form-input"
                placeholder="5015"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Connect -->
      <div v-else-if="currentStepId === 'connect'" class="step-content">
        <h3>Ready to Connect</h3>
        <p>We'll connect to your base station and start receiving GPS corrections.</p>

        <div class="connection-summary">
          <div class="summary-item">
            <span class="summary-label">Base Station:</span>
            <span class="summary-value">{{ baseStationIP }}:{{ baseStationPort }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Connection Type:</span>
            <span class="summary-value">TCP</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Expected Accuracy:</span>
            <span class="summary-value">±2 cm</span>
          </div>
        </div>

        <div class="info-banner">
          <svg viewBox="0 0 24 24" fill="currentColor" class="info-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          <div>
            <p>Make sure your YardRover is within range of the base station (typically 10-30km for best results).</p>
          </div>
        </div>
      </div>

      <!-- Step 4: Verify -->
      <div v-else-if="currentStepId === 'verify'" class="step-content">
        <h3>Verifying Connection</h3>
        <p>Please wait while we verify the GPS boost connection...</p>

        <div class="verification-status">
          <div class="status-circle" :class="{
            connecting: rtcmStore.currentState === 'connecting',
            connected: rtcmStore.isConnected,
            error: rtcmStore.hasError
          }">
            <svg v-if="rtcmStore.isConnected" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <svg v-else-if="rtcmStore.hasError" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            <span v-else class="spinner"></span>
          </div>

          <h4 class="status-text">
            {{ rtcmStore.isConnected ? 'Connected!' : rtcmStore.hasError ? 'Connection Error' : 'Connecting...' }}
          </h4>
        </div>

        <div v-if="rtcmStore.isConnected" class="connection-stats">
          <div class="stat-box">
            <div class="stat-label">Accuracy</div>
            <div class="stat-value">{{ accuracyDisplay }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Messages</div>
            <div class="stat-value">{{ statistics?.messagesReceived || 0 }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Data Rate</div>
            <div class="stat-value">{{ dataRateDisplay }}</div>
          </div>
        </div>

        <div v-if="rtcmStore.hasError" class="error-message">
          <p>{{ rtcmStore.lastError }}</p>
          <button class="btn btn-secondary" @click="handleConnect">
            Try Again
          </button>
        </div>
      </div>

      <!-- Step 5: Complete -->
      <div v-else-if="currentStepId === 'complete'" class="step-content">
        <div class="success-content">
          <div class="success-icon">🎉</div>
          <h3>GPS Boost is Active!</h3>
          <p class="lead">
            Your YardRover is now receiving GPS corrections with centimeter-level accuracy.
          </p>

          <div class="final-stats">
            <div class="final-stat">
              <div class="final-stat-icon">📍</div>
              <div>
                <div class="final-stat-label">Current Accuracy</div>
                <div class="final-stat-value">{{ accuracyDisplay }}</div>
              </div>
            </div>
            <div class="final-stat">
              <div class="final-stat-icon">📡</div>
              <div>
                <div class="final-stat-label">Base Station</div>
                <div class="final-stat-value">{{ baseStationIP }}</div>
              </div>
            </div>
            <div class="final-stat">
              <div class="final-stat-icon">✓</div>
              <div>
                <div class="final-stat-label">Status</div>
                <div class="final-stat-value">Active</div>
              </div>
            </div>
          </div>

          <div class="success-actions">
            <button class="btn btn-primary btn-lg" @click="finish">
              Start Using GPS Boost
            </button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Wizard Navigation -->
    <div class="wizard-nav">
      <button
        class="btn btn-secondary"
        @click="previous"
        :disabled="!canGoPrevious"
        v-if="currentStepId !== 'complete'"
      >
        ← Previous
      </button>
      <div class="nav-spacer"></div>
      <button
        class="btn btn-primary"
        @click="next"
        :disabled="!canGoNext"
        v-if="currentStepId !== 'complete'"
      >
        Next →
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rtcm-wizard {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.wizard-header {
  text-align: center;
  margin-bottom: 3rem;

  h2 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 2rem;
    font-weight: 700;
  }

  .subtitle {
    margin: 0 0 2rem 0;
    color: var(--text-secondary);
    font-size: 1.125rem;
  }
}

.progress-container {
  max-width: 600px;
  margin: 0 auto;
}

.progress-bar {
  height: 8px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-green), var(--sky-blue));
  transition: width 0.3s ease;
}

.progress-label {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-align: center;
}

.step-indicators {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;

  @media (max-width: 768px) {
    overflow-x: auto;
    justify-content: flex-start;
  }
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 80px;
  opacity: 0.4;
  transition: opacity 0.3s;

  &.active,
  &.complete {
    opacity: 1;
  }

  &.complete .step-icon {
    background-color: var(--primary-green);
    color: white;
  }

  &.active .step-icon {
    background-color: var(--sky-blue);
    color: white;
    transform: scale(1.1);
  }
}

.step-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: all 0.3s;
}

.step-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
}

.wizard-content {
  margin-bottom: 2rem;
  min-height: 400px;
}

.step-content {
  padding: 2rem;

  h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }

  p {
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }

  .lead {
    font-size: 1.125rem;
    line-height: 1.6;
  }
}

// Welcome content
.welcome-content {
  text-align: center;
}

.welcome-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.comparison-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin: 2rem 0;
  padding: 2rem;
  background-color: var(--bg-secondary);
  border-radius: 8px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
}

.comparison-item {
  text-align: center;
}

.comparison-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.comparison-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;

  &.bad {
    color: var(--status-warning);
  }

  &.good {
    color: var(--status-success);
  }
}

.arrow {
  font-size: 2rem;
  color: var(--primary-green);

  @media (max-width: 768px) {
    transform: rotate(90deg);
  }
}

// Scan section
.scan-section {
  text-align: center;
  margin: 2rem 0;
}

.discovered-stations {
  margin: 2rem 0;

  h4 {
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
}

.stations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  }
}

.check-icon {
  width: 32px;
  height: 32px;
  background-color: var(--primary-green);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.25rem;
}

.manual-entry {
  margin-top: 2rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 2rem 0;

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

.form-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.form-group {
  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: var(--primary-green);
    box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.1);
  }
}

// Connection summary
.connection-summary {
  background-color: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }
}

.summary-label {
  font-weight: 600;
  color: var(--text-secondary);
}

.summary-value {
  font-family: monospace;
  color: var(--text-primary);
}

// Verification
.verification-status {
  text-align: center;
  margin: 3rem 0;
}

.status-circle {
  width: 120px;
  height: 120px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;

  &.connecting {
    background-color: #fff3cd;
    border: 4px solid var(--status-warning);
  }

  &.connected {
    background-color: #d4edda;
    border: 4px solid var(--status-success);
  }

  &.error {
    background-color: #f8d7da;
    border: 4px solid var(--status-danger);
  }

  svg {
    width: 60px;
    height: 60px;
  }
}

.status-text {
  font-size: 1.5rem;
  color: var(--text-primary);
  margin: 0;
}

.connection-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.stat-box {
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  text-align: center;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary-green);
}

.error-message {
  text-align: center;
  margin-top: 2rem;
  padding: 1rem;
  background-color: #f8d7da;
  border-radius: 4px;
  color: var(--status-danger);
}

// Success content
.success-content {
  text-align: center;
}

.success-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.final-stats {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 2rem 0;
}

.final-stat {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-radius: 8px;
}

.final-stat-icon {
  font-size: 2rem;
}

.final-stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.final-stat-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.success-actions {
  margin-top: 2rem;
}

// Info banner
.info-banner {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background-color: #d1ecf1;
  border-left: 4px solid var(--status-info);
  border-radius: 4px;
  margin: 2rem 0;
  text-align: left;

  .info-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: var(--status-info);
  }

  strong {
    display: block;
    margin-bottom: 0.25rem;
    color: var(--text-primary);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
}

// Wizard navigation
.wizard-nav {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.nav-spacer {
  flex: 1;
}

// Buttons
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;

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

.btn-secondary {
  background-color: var(--sky-blue);
  color: white;

  &:hover:not(:disabled) {
    background-color: #70b8d6;
  }
}

.btn-lg {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

.btn-icon {
  width: 20px;
  height: 20px;
}

// Spinner
.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
