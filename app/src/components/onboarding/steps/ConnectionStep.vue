<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import type { MAVLinkBridgeDevice } from '../../../../../client/dist/index'
import type { UserType } from '@/stores/onboarding'

interface Props {
  userType: UserType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'complete': []
}>()

const connectionStore = useConnectionStore()

const currentState = ref<'scanning' | 'found' | 'connecting' | 'connected' | 'not-found'>('scanning')
const selectedDevice = ref<MAVLinkBridgeDevice | null>(null)
const showManualSetup = ref(false)
const manualAddress = ref('')
const connectionError = ref<string | null>(null)

const isConsumerMode = computed(() => props.userType === 'consumer')
const isScanning = computed(() => connectionStore.isDiscovering)
const devices = computed(() => connectionStore.discoveredDevices)
const hasDevices = computed(() => devices.value.length > 0)

// Auto-scan on mount
onMounted(async () => {
  await scanForDevices()
})

async function scanForDevices() {
  currentState.value = 'scanning'
  connectionError.value = null

  try {
    await connectionStore.discoverLocalDevices()

    if (hasDevices.value) {
      currentState.value = 'found'
    } else {
      currentState.value = 'not-found'
    }
  } catch (error) {
    console.error('Discovery failed:', error)
    currentState.value = 'not-found'
    connectionError.value = 'Failed to scan for devices. Please check your network connection.'
  }
}

async function connectToDevice(device: MAVLinkBridgeDevice) {
  selectedDevice.value = device
  currentState.value = 'connecting'
  connectionError.value = null

  const port = device.port
  const deviceUrl = port === 80 ? `http://${device.ip}` : `http://${device.ip}:${port}`
  const success = await connectionStore.connect(deviceUrl, device.name)

  if (success) {
    currentState.value = 'connected'
    setTimeout(() => {
      emit('complete')
    }, 1500)
  } else {
    currentState.value = 'found'
    selectedDevice.value = null
    connectionError.value = 'Failed to connect to device. Please try again.'
  }
}

async function connectManually() {
  if (!manualAddress.value.trim()) return

  currentState.value = 'connecting'
  connectionError.value = null

  const url = manualAddress.value.startsWith('http')
    ? manualAddress.value
    : `http://${manualAddress.value}`

  const success = await connectionStore.connect(url)

  if (success) {
    currentState.value = 'connected'
    setTimeout(() => {
      emit('complete')
    }, 1500)
  } else {
    currentState.value = 'not-found'
    connectionError.value = 'Failed to connect to the specified address. Please verify and try again.'
  }
}

function getDeviceIcon(device: MAVLinkBridgeDevice): string {
  if (device.network.ap.enabled) return '📡'
  if (device.isProvisioned) return '✅'
  return '🔌'
}

function getDeviceStatus(device: MAVLinkBridgeDevice): { label: string; class: string } {
  if (device.network.ap.enabled) return { label: 'Setup Mode', class: 'setup' }
  if (device.isProvisioned) return { label: 'Ready', class: 'ready' }
  return { label: device.ip, class: '' }
}
</script>

<template>
  <div class="connection-step">
    <div class="step-container">
      <!-- Header -->
      <div class="step-header">
        <h2>{{ isConsumerMode ? 'Let\'s Connect Your YardRover' : 'Connect to Device' }}</h2>
        <p class="step-description">
          {{ isConsumerMode
            ? 'We\'ll search for your YardRover on the network'
            : 'Discovering YardRover devices on your local network'
          }}
        </p>
      </div>

      <!-- Scanning State -->
      <div v-if="currentState === 'scanning'" class="state-content scanning">
        <div class="scanning-animation">
          <div class="radar-container">
            <div class="radar-wave"></div>
            <div class="radar-wave"></div>
            <div class="radar-wave"></div>
            <div class="radar-center">🚜</div>
          </div>
        </div>
        <h3>{{ isConsumerMode ? 'Looking for your YardRover...' : 'Scanning network...' }}</h3>
        <p>{{ isConsumerMode ? 'Make sure your YardRover is turned on and nearby' : 'Searching for devices via mDNS discovery' }}</p>

        <div v-if="isConsumerMode" class="helpful-tip">
          <span class="tip-icon">💡</span>
          <span>Your device should have a green light when ready</span>
        </div>
      </div>

      <!-- Found Devices -->
      <div v-if="currentState === 'found'" class="state-content found">
        <div class="success-icon">✓</div>
        <h3>Found {{ devices.length }} Device{{ devices.length === 1 ? '' : 's' }}!</h3>
        <p>{{ isConsumerMode ? 'Choose your device to connect' : 'Select a device to continue' }}</p>

        <div class="devices-list">
          <button
            v-for="device in devices"
            :key="device.id"
            class="device-card"
            @click="connectToDevice(device)"
          >
            <div class="device-icon">{{ getDeviceIcon(device) }}</div>
            <div class="device-details">
              <div class="device-name">{{ device.name }}</div>
              <div class="device-meta">
                <span :class="['device-status', getDeviceStatus(device).class]">
                  {{ getDeviceStatus(device).label }}
                </span>
                <span class="device-address">{{ device.ip }}:{{ device.port }}</span>
              </div>
            </div>
            <div class="device-arrow">→</div>
          </button>
        </div>

        <div class="state-actions">
          <button class="btn btn-outline btn-sm" @click="scanForDevices">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Scan Again
          </button>
          <button class="btn btn-text btn-sm" @click="showManualSetup = !showManualSetup">
            Can't find your device?
          </button>
        </div>

        <!-- Manual Setup Expansion -->
        <Transition name="expand">
          <div v-if="showManualSetup" class="manual-setup">
            <h4>Manual Connection</h4>
            <p class="help-text">Enter your device's IP address or hostname</p>
            <div class="input-group">
              <input
                v-model="manualAddress"
                type="text"
                placeholder="192.168.1.100 or yardrover.local"
                @keyup.enter="connectManually"
              />
              <button class="btn btn-primary" @click="connectManually">
                Connect
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Not Found -->
      <div v-if="currentState === 'not-found'" class="state-content not-found">
        <div class="warning-icon">⚠️</div>
        <h3>{{ isConsumerMode ? 'We Couldn\'t Find Your YardRover' : 'No Devices Found' }}</h3>
        <p>{{ isConsumerMode ? 'Let\'s try a few things to get you connected' : 'Unable to discover devices on the network' }}</p>

        <div class="troubleshooting">
          <div class="troubleshooting-item">
            <div class="item-number">1</div>
            <div class="item-content">
              <h4>{{ isConsumerMode ? 'Check the Power' : 'Power Check' }}</h4>
              <p>{{ isConsumerMode ? 'Make sure your YardRover is turned on and has battery' : 'Verify device is powered on' }}</p>
            </div>
          </div>
          <div class="troubleshooting-item">
            <div class="item-number">2</div>
            <div class="item-content">
              <h4>{{ isConsumerMode ? 'Check Your WiFi' : 'Network Connection' }}</h4>
              <p>{{ isConsumerMode ? 'Your phone/tablet should be on the same WiFi network as your YardRover' : 'Ensure device and client are on same network' }}</p>
            </div>
          </div>
          <div class="troubleshooting-item">
            <div class="item-number">3</div>
            <div class="item-content">
              <h4>{{ isConsumerMode ? 'Move Closer' : 'Check Signal' }}</h4>
              <p>{{ isConsumerMode ? 'Try getting within 10-15 feet of your YardRover' : 'Improve signal strength or reduce distance' }}</p>
            </div>
          </div>
        </div>

        <div v-if="connectionError" class="error-message">
          <span class="error-icon">⚠️</span>
          {{ connectionError }}
        </div>

        <div class="state-actions">
          <button class="btn btn-primary" @click="scanForDevices">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Try Again
          </button>
          <button class="btn btn-outline" @click="showManualSetup = true">
            Connect Manually
          </button>
        </div>

        <!-- Manual Setup -->
        <div v-if="showManualSetup" class="manual-setup">
          <h4>Manual Connection</h4>
          <p class="help-text">Enter your device's IP address</p>
          <div class="input-group">
            <input
              v-model="manualAddress"
              type="text"
              placeholder="192.168.1.100"
              @keyup.enter="connectManually"
            />
            <button class="btn btn-primary" @click="connectManually">
              Connect
            </button>
          </div>
        </div>
      </div>

      <!-- Connecting -->
      <div v-if="currentState === 'connecting'" class="state-content connecting">
        <div class="connecting-animation">
          <svg viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="31.4 31.4">
              <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
        <h3>{{ isConsumerMode ? `Connecting to ${selectedDevice?.name || 'YardRover'}...` : 'Establishing connection...' }}</h3>
        <p>{{ isConsumerMode ? 'This will just take a moment' : 'Please wait' }}</p>
      </div>

      <!-- Connected -->
      <div v-if="currentState === 'connected'" class="state-content connected">
        <div class="success-icon celebration">✓</div>
        <h3>{{ isConsumerMode ? 'You\'re Connected! 🎉' : 'Connection Established' }}</h3>
        <p>{{ isConsumerMode ? 'Moving on to the next step...' : 'Proceeding to authentication' }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.connection-step {
  padding: var(--spacing-2xl);
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.step-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.step-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);

  h2 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }

  .step-description {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin: 0;
  }
}

.state-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;

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
    max-width: 500px;
  }
}

// Scanning State
.scanning-animation {
  margin-bottom: var(--spacing-lg);
}

.radar-container {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

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

.radar-center {
  font-size: 48px;
  z-index: 1;
}

.helpful-tip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(251, 191, 36, 0.1);
  border: 2px solid rgba(251, 191, 36, 0.3);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 500;

  .tip-icon {
    font-size: 20px;
  }
}

// Success/Warning Icons
.success-icon,
.warning-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  background: var(--bg-secondary);
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

// Devices List
.devices-list {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
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
}

.device-icon {
  font-size: 40px;
  flex-shrink: 0;
}

.device-details {
  flex: 1;
}

.device-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.device-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.device-status {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 600;

  &.ready {
    background: rgba(44, 95, 45, 0.2);
    color: $primary;
  }

  &.setup {
    background: rgba(251, 191, 36, 0.2);
    color: #92400e;
  }
}

.device-arrow {
  font-size: 24px;
  color: var(--text-light);
  transition: transform 0.2s;
}

.device-card:hover .device-arrow {
  transform: translateX(4px);
}

// Troubleshooting
.troubleshooting {
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  text-align: left;
}

.troubleshooting-item {
  display: flex;
  gap: var(--spacing-md);

  .item-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: $primary;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
  }

  .item-content {
    flex: 1;

    h4 {
      font-size: var(--font-size-base);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 var(--spacing-xs);
    }

    p {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin: 0;
    }
  }
}

// Manual Setup
.manual-setup {
  width: 100%;
  max-width: 500px;
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  margin-top: var(--spacing-lg);
  text-align: left;

  h4 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-xs);
  }

  .help-text {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: 0 0 var(--spacing-md);
  }
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

// Actions
.state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  justify-content: center;
}

// Connecting Animation
.connecting-animation {
  svg {
    width: 80px;
    height: 80px;
    color: $primary;
  }
}

// Error Message
.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(239, 68, 68, 0.1);
  border: 2px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: #991b1b;
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);

  .error-icon {
    font-size: 20px;
  }
}

// Transitions
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

// Responsive
@include mobile {
  .connection-step {
    padding: var(--spacing-lg);
  }

  .devices-list {
    gap: var(--spacing-sm);
  }

  .device-card {
    padding: var(--spacing-md);
  }

  .device-icon {
    font-size: 32px;
  }
}
</style>
