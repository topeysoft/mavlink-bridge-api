<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConnectionStore, type SavedDevice } from '@/stores/connection'
import { useConnectionOrchestrator } from '@/stores/connectionOrchestrator'
import type { MAVLinkBridgeDevice } from '../../../../client/dist/index'

interface Props {
  mode?: 'onboarding' | 'standalone' | 'reconnect'
  previousConnection?: SavedDevice | null
  showHeader?: boolean
  autoStart?: boolean
  userMode?: 'consumer' | 'technical'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'standalone',
  showHeader: true,
  autoStart: false,
  userMode: 'technical'
})

const emit = defineEmits<{
  'connected': [device: { name: string | null; url: string | null }]
  'cancelled': []
}>()

const connectionStore = useConnectionStore()
const orchestrator = useConnectionOrchestrator()

// State
const currentView = ref<'recent' | 'discover' | 'manual' | 'connecting' | 'connected'>('recent')
const discoveredDevices = ref<MAVLinkBridgeDevice[]>([])
const isScanning = ref(false)
const manualAddress = ref('')
const connectionError = ref<string | null>(null)
const selectedDevice = ref<MAVLinkBridgeDevice | null>(null)

// Computed
const isConsumerMode = computed(() => props.userMode === 'consumer')
const hasRecentDevices = computed(() => connectionStore.savedDevices.length > 0)
const recentDevices = computed(() => {
  return [...connectionStore.savedDevices]
    .sort((a, b) => {
      const timeA = a.lastConnected ? new Date(a.lastConnected).getTime() : 0
      const timeB = b.lastConnected ? new Date(b.lastConnected).getTime() : 0
      return timeB - timeA
    })
    .slice(0, 5) // Show top 5 recent devices
})

const headerTitle = computed(() => {
  if (props.mode === 'reconnect') {
    return isConsumerMode.value ? 'Reconnect to Your YardRover' : 'Reconnect to Device'
  }
  if (props.mode === 'onboarding') {
    return isConsumerMode.value ? 'Let\'s Connect Your YardRover' : 'Connect to Device'
  }
  return isConsumerMode.value ? 'Connect Your YardRover' : 'Device Connection'
})

const headerDescription = computed(() => {
  if (props.previousConnection) {
    return isConsumerMode.value
      ? `Couldn't reconnect to "${props.previousConnection.name}". Let's try again.`
      : `Failed to auto-reconnect to ${props.previousConnection.name}. Please reconnect manually.`
  }
  if (props.mode === 'onboarding') {
    return isConsumerMode.value
      ? 'We\'ll search for your YardRover on the network'
      : 'Discovering YardRover devices on your local network'
  }
  return isConsumerMode.value
    ? 'Choose a recent device or discover new ones'
    : 'Select a saved device or discover new devices on the network'
})

// Auto-start discovery if enabled
onMounted(async () => {
  if (props.autoStart && !hasRecentDevices.value) {
    await startDiscovery()
  }
})

// Actions
async function reconnectToPrevious() {
  if (!props.previousConnection) return

  currentView.value = 'connecting'
  connectionError.value = null

  const result = await orchestrator.connectToDevice(
    props.previousConnection.url,
    props.previousConnection.name
  )

  if (result.success) {
    currentView.value = 'connected'
    setTimeout(() => {
      emit('connected', result.device!)
    }, 1500)
  } else {
    currentView.value = 'recent'
    connectionError.value = orchestrator.getErrorMessage(result, isConsumerMode.value)
  }
}

async function connectToRecent(device: SavedDevice) {
  currentView.value = 'connecting'
  connectionError.value = null

  const result = await orchestrator.connectToDevice(device.url, device.name)

  if (result.success) {
    currentView.value = 'connected'
    setTimeout(() => {
      emit('connected', result.device!)
    }, 1500)
  } else {
    currentView.value = 'recent'
    connectionError.value = orchestrator.getErrorMessage(result, isConsumerMode.value)
  }
}

async function startDiscovery() {
  currentView.value = 'discover'
  isScanning.value = true
  connectionError.value = null

  try {
    const devices = await connectionStore.discoverLocalDevices()
    discoveredDevices.value = devices
  } catch (error) {
    console.error('Discovery failed:', error)
    connectionError.value = isConsumerMode.value
      ? 'We couldn\'t find any devices. Make sure your YardRover is powered on and on the same WiFi network.'
      : 'Device discovery failed. Verify network configuration and device status.'
  } finally {
    isScanning.value = false
  }
}

async function connectToDiscovered(device: MAVLinkBridgeDevice) {
  selectedDevice.value = device
  currentView.value = 'connecting'
  connectionError.value = null

  const port = device.port
  const deviceUrl = port === 80 ? `http://${device.ip}` : `http://${device.ip}:${port}`

  const result = await orchestrator.connectToDevice(deviceUrl, device.name)

  if (result.success) {
    currentView.value = 'connected'
    setTimeout(() => {
      emit('connected', result.device!)
    }, 1500)
  } else {
    currentView.value = 'discover'
    selectedDevice.value = null
    connectionError.value = orchestrator.getErrorMessage(result, isConsumerMode.value)
  }
}

async function connectManually() {
  if (!manualAddress.value.trim()) return

  currentView.value = 'connecting'
  connectionError.value = null

  const url = manualAddress.value.startsWith('http')
    ? manualAddress.value
    : `http://${manualAddress.value}`

  const result = await orchestrator.connectToDevice(url)

  if (result.success) {
    currentView.value = 'connected'
    setTimeout(() => {
      emit('connected', result.device!)
    }, 1500)
  } else {
    currentView.value = 'manual'
    connectionError.value = orchestrator.getErrorMessage(result, isConsumerMode.value)
  }
}

function getDeviceIcon(device: MAVLinkBridgeDevice): string {
  if (device.network.ap.enabled) return '📡'
  if (device.isProvisioned) return '✅'
  return '🔌'
}

function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return 'Unknown'

  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
</script>

<template>
  <div class="unified-connection-flow" :class="`mode-${mode}`">
    <!-- Header -->
    <div v-if="showHeader" class="flow-header">
      <h2>{{ headerTitle }}</h2>
      <p class="description">{{ headerDescription }}</p>
    </div>

    <!-- Error Message (Global) -->
    <div v-if="connectionError" class="error-banner">
      <span class="error-icon">⚠️</span>
      <span>{{ connectionError }}</span>
      <button class="btn-close" @click="connectionError = null">×</button>
    </div>

    <!-- Previous Connection Quick Reconnect -->
    <div v-if="previousConnection && currentView === 'recent'" class="quick-reconnect">
      <div class="reconnect-card">
        <div class="card-icon">🔌</div>
        <div class="card-content">
          <h3>{{ isConsumerMode ? 'Reconnect to Your Device' : 'Previous Connection' }}</h3>
          <div class="device-info">
            <strong>{{ previousConnection.name }}</strong>
            <span class="last-seen">Last connected {{ formatRelativeTime(previousConnection.lastConnected) }}</span>
          </div>
        </div>
      </div>
      <button class="btn btn-primary btn-large" @click="reconnectToPrevious">
        <span class="btn-icon">🔄</span>
        {{ isConsumerMode ? 'Reconnect' : 'Reconnect to Device' }}
      </button>
      <div class="divider">
        <span>{{ isConsumerMode ? 'or' : 'or find another device' }}</span>
      </div>
    </div>

    <!-- Recent Devices -->
    <div v-if="hasRecentDevices && currentView === 'recent'" class="recent-devices-section">
      <h3>{{ isConsumerMode ? 'Your Devices' : 'Recent Devices' }}</h3>
      <div class="devices-list">
        <button
          v-for="device in recentDevices"
          :key="device.id"
          class="device-card"
          @click="connectToRecent(device)"
        >
          <span class="device-icon">🚜</span>
          <div class="device-details">
            <div class="device-name">{{ device.name }}</div>
            <div class="device-meta">
              <span class="last-connected">{{ formatRelativeTime(device.lastConnected) }}</span>
            </div>
          </div>
          <span class="device-arrow">→</span>
        </button>
      </div>
    </div>

    <!-- Action Buttons (Recent View) -->
    <div v-if="currentView === 'recent'" class="action-buttons">
      <button class="btn btn-primary btn-large" @click="startDiscovery">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        {{ isConsumerMode ? 'Find My YardRover' : 'Discover Devices' }}
      </button>
      <button class="btn btn-outline" @click="currentView = 'manual'">
        {{ isConsumerMode ? 'I Know the Address' : 'Connect Manually' }}
      </button>
    </div>

    <!-- Discovery View -->
    <div v-if="currentView === 'discover'" class="discovery-view">
      <!-- Scanning -->
      <div v-if="isScanning" class="scanning-state">
        <div class="scanning-animation">
          <div class="radar-wave"></div>
          <div class="radar-wave"></div>
          <div class="radar-wave"></div>
          <div class="radar-center">🚜</div>
        </div>
        <h3>{{ isConsumerMode ? 'Looking for your YardRover...' : 'Scanning network...' }}</h3>
        <p>{{ isConsumerMode ? 'This will take a few seconds' : 'Discovering devices via mDNS' }}</p>
      </div>

      <!-- Devices Found -->
      <div v-else-if="discoveredDevices.length > 0" class="found-devices">
        <div class="success-icon">✓</div>
        <h3>Found {{ discoveredDevices.length }} Device{{ discoveredDevices.length === 1 ? '' : 's' }}!</h3>
        <p>{{ isConsumerMode ? 'Choose your device to connect' : 'Select a device to continue' }}</p>

        <div class="devices-list">
          <button
            v-for="device in discoveredDevices"
            :key="device.id"
            class="device-card discovered"
            @click="connectToDiscovered(device)"
          >
            <div class="device-icon-large">{{ getDeviceIcon(device) }}</div>
            <div class="device-details">
              <div class="device-name">{{ device.name }}</div>
              <div class="device-address">{{ device.ip }}:{{ device.port }}</div>
            </div>
            <span class="device-arrow">→</span>
          </button>
        </div>

        <div class="discovery-actions">
          <button class="btn btn-outline btn-sm" @click="startDiscovery">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Scan Again
          </button>
          <button class="btn btn-text btn-sm" @click="currentView = 'manual'">
            Connect manually instead
          </button>
        </div>
      </div>

      <!-- No Devices Found -->
      <div v-else class="no-devices">
        <div class="warning-icon">⚠️</div>
        <h3>{{ isConsumerMode ? 'No Devices Found' : 'Discovery Complete - No Devices' }}</h3>
        <p>{{ isConsumerMode ? 'We couldn\'t find any YardRover devices' : 'No devices were discovered on the network' }}</p>

        <div class="troubleshooting">
          <h4>{{ isConsumerMode ? 'Try These Steps:' : 'Troubleshooting:' }}</h4>
          <ol>
            <li>{{ isConsumerMode ? 'Make sure your YardRover is powered on' : 'Verify device is powered on' }}</li>
            <li>{{ isConsumerMode ? 'Check that you\'re on the same WiFi network' : 'Ensure same network as device' }}</li>
            <li>{{ isConsumerMode ? 'Move closer to your device' : 'Check network signal strength' }}</li>
          </ol>
        </div>

        <div class="discovery-actions">
          <button class="btn btn-primary" @click="startDiscovery">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Try Again
          </button>
          <button class="btn btn-outline" @click="currentView = 'manual'">
            Connect Manually
          </button>
        </div>
      </div>
    </div>

    <!-- Manual Connection View -->
    <div v-if="currentView === 'manual'" class="manual-view">
      <div class="manual-icon">🔧</div>
      <h3>{{ isConsumerMode ? 'Enter Device Address' : 'Manual Connection' }}</h3>
      <p>{{ isConsumerMode ? 'Find this on your device\'s screen or in the manual' : 'Enter the IP address or hostname of your device' }}</p>

      <div class="manual-form">
        <div class="input-group">
          <input
            v-model="manualAddress"
            type="text"
            :placeholder="isConsumerMode ? '192.168.1.100' : '192.168.1.100 or yardrover.local'"
            @keyup.enter="connectManually"
          />
          <button
            class="btn btn-primary"
            :disabled="!manualAddress.trim()"
            @click="connectManually"
          >
            Connect
          </button>
        </div>
      </div>

      <button class="btn btn-text" @click="currentView = 'recent'">
        ← {{ isConsumerMode ? 'Back' : 'Back to device list' }}
      </button>
    </div>

    <!-- Connecting View -->
    <div v-if="currentView === 'connecting'" class="connecting-view">
      <div class="connecting-animation">
        <svg viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="31.4 31.4">
            <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
          </circle>
        </svg>
      </div>
      <h3>{{ isConsumerMode ? 'Connecting...' : 'Establishing Connection...' }}</h3>
      <p>{{ isConsumerMode ? 'This will just take a moment' : 'Please wait' }}</p>
    </div>

    <!-- Connected View -->
    <div v-if="currentView === 'connected'" class="connected-view">
      <div class="success-icon celebration">✓</div>
      <h3>{{ isConsumerMode ? 'You\'re Connected! 🎉' : 'Connection Established' }}</h3>
      <p>{{ isConsumerMode ? 'Moving on...' : 'Proceeding to next step' }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.unified-connection-flow {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: var(--spacing-xl);

  @include mobile {
    padding: var(--spacing-md);
  }
}

.flow-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);

  h2 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }

  .description {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
  }
}

// Error Banner
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(239, 68, 68, 0.1);
  border: 2px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: #991b1b;
  margin-bottom: var(--spacing-lg);

  .error-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .btn-close {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 24px;
    color: #991b1b;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      opacity: 0.7;
    }
  }
}

// Quick Reconnect
.quick-reconnect {
  margin-bottom: var(--spacing-2xl);
}

.reconnect-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-md);

  .card-icon {
    font-size: 48px;
    flex-shrink: 0;
  }

  .card-content {
    flex: 1;

    h3 {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 var(--spacing-sm);
    }
  }

  .device-info {
    strong {
      display: block;
      font-size: var(--font-size-base);
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
    }

    .last-seen {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
  }
}

.divider {
  position: relative;
  text-align: center;
  margin: var(--spacing-xl) 0;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--border-color);
  }

  span {
    position: relative;
    padding: 0 var(--spacing-md);
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
}

// Recent Devices
.recent-devices-section {
  margin-bottom: var(--spacing-2xl);

  h3 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }
}

.devices-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.device-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    border-color: $primary;
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .device-icon,
  .device-icon-large {
    font-size: 32px;
    flex-shrink: 0;
  }

  .device-details {
    flex: 1;
  }

  .device-name {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .device-meta,
  .device-address {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .device-arrow {
    font-size: 24px;
    color: var(--text-light);
    transition: transform 0.2s;
  }

  &:hover .device-arrow {
    transform: translateX(4px);
  }
}

// Action Buttons
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

// Discovery View
.discovery-view,
.connecting-view,
.connected-view,
.manual-view,
.no-devices {
  text-align: center;
  padding: var(--spacing-2xl) 0;

  h3 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    margin: var(--spacing-lg) 0 var(--spacing-sm);
  }

  > p {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin: 0 0 var(--spacing-xl);
  }
}

// Scanning Animation
.scanning-animation {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto;

  .radar-wave {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 3px solid $primary;
    border-radius: 50%;
    animation: radar-pulse 2s ease-out infinite;

    &:nth-child(2) {
      animation-delay: 0.6s;
    }

    &:nth-child(3) {
      animation-delay: 1.2s;
    }
  }

  .radar-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 48px;
    z-index: 1;
  }
}

@keyframes radar-pulse {
  0% {
    transform: scale(0.5);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

// Success/Warning Icons
.success-icon,
.warning-icon,
.manual-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  background: var(--bg-secondary);
  margin: 0 auto;
}

.success-icon {
  background: $positive;
  color: white;

  &.celebration {
    animation: celebrate 0.6s ease-out;
  }
}

@keyframes celebrate {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.warning-icon {
  background: rgba(251, 191, 36, 0.2);
}

.manual-icon {
  font-size: 40px;
}

// Connecting Animation
.connecting-animation {
  svg {
    width: 80px;
    height: 80px;
    color: $primary;
  }
}

// Troubleshooting
.troubleshooting {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  text-align: left;

  h4 {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }

  ol {
    margin: 0;
    padding-left: var(--spacing-xl);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.8;

    li {
      margin-bottom: var(--spacing-xs);
    }
  }
}

// Discovery Actions
.discovery-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: center;
}

// Manual Form
.manual-form {
  margin-bottom: var(--spacing-xl);
}

.input-group {
  display: flex;
  gap: var(--spacing-sm);

  input {
    flex: 1;
    padding: var(--spacing-md);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    background: var(--bg-primary);
    color: var(--text-primary);

    &:focus {
      outline: none;
      border-color: $primary;
    }
  }
}

// Responsive
@include mobile {
  .reconnect-card {
    flex-direction: column;
    text-align: center;
  }

  .device-card {
    padding: var(--spacing-md);

    .device-icon,
    .device-icon-large {
      font-size: 28px;
    }
  }

  .input-group {
    flex-direction: column;

    .btn {
      width: 100%;
    }
  }
}
</style>
