<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client'

const router = useRouter()
const connectionStore = useConnectionStore()

const currentStep = ref<'scanning' | 'found' | 'connecting' | 'connected' | 'not-found'>('scanning')
const selectedDevice = ref<MAVLinkBridgeDevice | null>(null)
const showManualSetup = ref(false)
const manualAddress = ref('')

// Computed
const isScanning = computed(() => connectionStore.isDiscovering)
const devices = computed(() => connectionStore.discoveredDevices)
const hasDevices = computed(() => devices.value.length > 0)

// Auto-scan on mount
onMounted(async () => {
  await scanForDevices()
})

// Actions
async function scanForDevices() {
  currentStep.value = 'scanning'
  await connectionStore.discoverLocalDevices()

  if (hasDevices.value) {
    currentStep.value = 'found'
  } else {
    currentStep.value = 'not-found'
  }
}

async function connectToDevice(device: MAVLinkBridgeDevice) {
  selectedDevice.value = device
  currentStep.value = 'connecting'

  // Include port in URL (unless it's the default HTTP port 80)
  const port = device.port
  const deviceUrl = port === 80 ? `http://${device.ip}` : `http://${device.ip}:${port}`
  const success = await connectionStore.connect(deviceUrl, device.name)

  if (success) {
    currentStep.value = 'connected'
    // Navigate to dashboard after short delay
    setTimeout(() => {
      router.push({ name: 'dashboard' })
    }, 1500)
  } else {
    currentStep.value = 'found'
    selectedDevice.value = null
  }
}

async function connectManually() {
  if (!manualAddress.value.trim()) return

  currentStep.value = 'connecting'
  const url = manualAddress.value.startsWith('http')
    ? manualAddress.value
    : `http://${manualAddress.value}`

  const success = await connectionStore.connect(url)

  if (success) {
    currentStep.value = 'connected'
    setTimeout(() => {
      router.push({ name: 'dashboard' })
    }, 1500)
  } else {
    currentStep.value = 'not-found'
  }
}

function getDeviceIcon(device: MAVLinkBridgeDevice): string {
  if (device.network.ap.enabled) return '📡'
  if (device.isProvisioned) return '✅'
  return '🔌'
}
</script>

<template>
  <div class="consumer-connection-view">
    <!-- Header -->
    <div class="connection-header">
      <h1>Let's Connect Your YardRover</h1>
      <p class="subtitle">We'll help you get set up in just a few steps</p>
    </div>

    <!-- Scanning State -->
    <div v-if="currentStep === 'scanning'" class="step-card scanning">
      <div class="step-icon">
        <div class="scanning-radar">
          <div class="radar-wave"></div>
          <div class="radar-wave"></div>
          <div class="radar-wave"></div>
        </div>
      </div>
      <h2>Looking for your YardRover...</h2>
      <p>Make sure your YardRover is turned on and nearby</p>
      <div class="scanning-tips">
        <div class="tip">
          <span class="tip-icon">💡</span>
          <span>Your device should have a green light when ready</span>
        </div>
      </div>
    </div>

    <!-- Found Devices -->
    <div v-if="currentStep === 'found'" class="step-card found">
      <div class="step-icon success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <h2>Found {{ devices.length }} YardRover{{ devices.length === 1 ? '' : 's' }}!</h2>
      <p>Choose your device to connect</p>

      <div class="devices-list">
        <button
          v-for="device in devices"
          :key="device.id"
          class="device-button"
          @click="connectToDevice(device)"
        >
          <div class="device-icon-large">{{ getDeviceIcon(device) }}</div>
          <div class="device-info">
            <div class="device-name">{{ device.name }}</div>
            <div class="device-status">
              <span v-if="device.network.ap.enabled" class="status-badge setup">Setup Mode</span>
              <span v-else-if="device.isProvisioned" class="status-badge ready">Ready</span>
              <span v-else class="status-badge">{{ device.ip }}</span>
            </div>
          </div>
          <div class="device-arrow">→</div>
        </button>
      </div>

      <div class="action-footer">
        <button class="btn-link" @click="scanForDevices">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Scan Again
        </button>
        <button class="btn-link" @click="showManualSetup = !showManualSetup">
          Can't find your device?
        </button>
      </div>

      <!-- Manual Setup -->
      <div v-if="showManualSetup" class="manual-setup">
        <h3>Enter Your Device's Address</h3>
        <p class="help-text">You can find this in your YardRover's screen or manual</p>
        <div class="input-group">
          <input
            v-model="manualAddress"
            type="text"
            placeholder="Example: 192.168.1.100"
            @keyup.enter="connectManually"
          />
          <button class="btn-primary" @click="connectManually">Connect</button>
        </div>
      </div>
    </div>

    <!-- Not Found -->
    <div v-if="currentStep === 'not-found'" class="step-card not-found">
      <div class="step-icon warning">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>
      <h2>We Couldn't Find Your YardRover</h2>
      <p>Let's try a few things to get you connected</p>

      <div class="troubleshooting">
        <div class="troubleshooting-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>Check the Power</h4>
            <p>Make sure your YardRover is turned on and has battery</p>
          </div>
        </div>
        <div class="troubleshooting-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>Check Your WiFi</h4>
            <p>Your phone/tablet should be on the same WiFi network as your YardRover</p>
          </div>
        </div>
        <div class="troubleshooting-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>Move Closer</h4>
            <p>Try getting within 10-15 feet of your YardRover</p>
          </div>
        </div>
      </div>

      <div class="action-footer">
        <button class="btn-primary btn-large" @click="scanForDevices">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Try Again
        </button>
        <button class="btn-link" @click="showManualSetup = true; currentStep = 'found'">
          I know my device's address
        </button>
      </div>
    </div>

    <!-- Connecting -->
    <div v-if="currentStep === 'connecting'" class="step-card connecting">
      <div class="step-icon">
        <div class="connecting-spinner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
              <animate attributeName="stroke-dashoffset" values="32;0" dur="1.5s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
      </div>
      <h2>Connecting to {{ selectedDevice?.name || 'YardRover' }}...</h2>
      <p>This will just take a moment</p>
    </div>

    <!-- Connected -->
    <div v-if="currentStep === 'connected'" class="step-card connected">
      <div class="step-icon success celebration">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
      <h2>You're All Set! 🎉</h2>
      <p>Taking you to your dashboard...</p>
    </div>

    <!-- Saved Devices Quick Access -->
    <div v-if="connectionStore.savedDevices.length > 0 && currentStep === 'found'" class="saved-devices-section">
      <h3>Previous Devices</h3>
      <div class="saved-devices-list">
        <button
          v-for="device in connectionStore.savedDevices.slice(0, 3)"
          :key="device.id"
          class="saved-device-button"
          @click="connectManually"
        >
          <span class="saved-device-name">{{ device.name }}</span>
          <span class="saved-device-time">Last used {{ new Date(device.lastConnected || '').toLocaleDateString() }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.consumer-connection-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.connection-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
  max-width: 600px;

  h1 {
    font-size: var(--font-size-3xl);
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: var(--spacing-md);
  }

  .subtitle {
    font-size: var(--font-size-lg);
    color: var(--text-secondary);
  }
}

.step-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  max-width: 600px;
  width: 100%;
  text-align: center;

  h2 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: var(--spacing-xl) 0 var(--spacing-md);
  }

  > p {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xl);
  }
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  margin: 0 auto;
  border-radius: 50%;
  background: var(--bg-secondary);

  &.success {
    background: var(--status-success);

    svg {
      color: white;
      width: 50px;
      height: 50px;
    }
  }

  &.warning {
    background: var(--status-warning);

    svg {
      color: white;
      width: 50px;
      height: 50px;
    }
  }

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

// Scanning animation
.scanning-radar {
  position: relative;
  width: 60px;
  height: 60px;

  .radar-wave {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 3px solid var(--primary-green);
    border-radius: 50%;
    animation: radar-pulse 2s ease-out infinite;

    &:nth-child(2) {
      animation-delay: 0.6s;
    }

    &:nth-child(3) {
      animation-delay: 1.2s;
    }
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

.scanning-tips {
  margin-top: var(--spacing-xl);

  .tip {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: #fef3c7;
    border-radius: var(--radius-md);
    text-align: left;

    .tip-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    span:last-child {
      color: #92400e;
      font-weight: 500;
    }
  }
}

.devices-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.device-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.3s;
  text-align: left;

  &:hover {
    border-color: var(--primary-green);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .device-icon-large {
    font-size: 48px;
    flex-shrink: 0;
  }

  .device-info {
    flex: 1;
  }

  .device-name {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .device-status {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 600;

    &.ready {
      background: #d1fae5;
      color: #065f46;
    }

    &.setup {
      background: #fef3c7;
      color: #92400e;
    }
  }

  .device-arrow {
    font-size: 24px;
    color: var(--text-light);
    transition: transform 0.3s;
  }

  &:hover .device-arrow {
    transform: translateX(4px);
  }
}

.action-footer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}

.btn-link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: none;
  border: none;
  color: var(--primary-green);
  font-weight: 600;
  cursor: pointer;
  padding: var(--spacing-sm);
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.manual-setup {
  margin-top: var(--spacing-xl);
  padding: var(--spacing-xl);
  background: #f0f9ff;
  border-radius: var(--radius-lg);

  h3 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--spacing-sm);
  }

  .help-text {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
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

      &:focus {
        outline: none;
        border-color: var(--primary-green);
      }
    }
  }
}

.troubleshooting {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  margin: var(--spacing-xl) 0;
  text-align: left;
}

.troubleshooting-step {
  display: flex;
  gap: var(--spacing-md);

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--primary-green);
    color: white;
    border-radius: 50%;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-content {
    flex: 1;

    h4 {
      font-size: var(--font-size-base);
      font-weight: 600;
      margin-bottom: var(--spacing-xs);
    }

    p {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin: 0;
    }
  }
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-xl);
  background: var(--primary-green);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--primary-green-light);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(44, 95, 45, 0.3);
  }

  svg {
    width: 20px;
    height: 20px;
  }

  &.btn-large {
    padding: var(--spacing-lg) var(--spacing-2xl);
    font-size: var(--font-size-lg);
  }
}

.connecting-spinner {
  svg {
    width: 60px;
    height: 60px;
    color: var(--primary-green);
  }
}

.saved-devices-section {
  margin-top: var(--spacing-2xl);
  width: 100%;
  max-width: 600px;

  h3 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    text-align: left;
  }
}

.saved-devices-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.saved-device-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    border-color: var(--primary-green);
    transform: translateX(4px);
  }

  .saved-device-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .saved-device-time {
    font-size: var(--font-size-sm);
    color: var(--text-light);
  }
}

@media (max-width: 768px) {
  .consumer-connection-view {
    padding: var(--spacing-lg);
  }

  .connection-header h1 {
    font-size: var(--font-size-2xl);
  }

  .step-card {
    padding: var(--spacing-xl);
  }
}
</style>
