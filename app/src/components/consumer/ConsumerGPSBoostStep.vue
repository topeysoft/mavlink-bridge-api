<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRTCMStore } from '@/stores/rtcm'
import { useConnectionStore } from '@/stores/connection'
import Button from '@/components/common/Button.vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'complete': []
  'skip': []
}>()

const rtcmStore = useRTCMStore()
const connectionStore = useConnectionStore()

const isScanning = ref(false)
const isConnecting = ref(false)
const discoveredBoosters = ref<Array<{ host: string; port: number; name: string }>>([])
const selectedBooster = ref<{ host: string; port: number; name: string } | null>(null)
const manualIP = ref('')
const manualPort = ref(5015)
const showManualSetup = ref(false)

const hasGPSBoost = computed(() => rtcmStore.isConnected)
const scanComplete = computed(() => !isScanning.value && discoveredBoosters.value.length > 0)

const accuracyComparison = [
  { type: 'Standard GPS', accuracy: '2-5 meters', emoji: '📍', description: 'Good for general navigation' },
  { type: 'GPS Boost', accuracy: '2 centimeters', emoji: '🎯', description: 'Perfect for precision tasks' }
]

async function scanForBoosters() {
  isScanning.value = true
  discoveredBoosters.value = []

  try {
    if (!connectionStore.isConnected) {
      console.warn('Not connected to device')
      return
    }

    const client = connectionStore.getClient()
    const rtcmServers = await client.mdns.discoverRTCMServers()

    discoveredBoosters.value = rtcmServers.map(server => ({
      host: server.ip,
      port: server.port,
      name: server.friendlyName || server.hostname
    }))
  } catch (error) {
    console.error('Failed to scan for GPS boosters:', error)
  } finally {
    isScanning.value = false
  }
}

function selectBooster(booster: { host: string; port: number; name: string }) {
  selectedBooster.value = booster
}

async function connectToBooster() {
  if (!selectedBooster.value && !showManualSetup.value) return

  isConnecting.value = true

  try {
    const config = showManualSetup.value
      ? { host: manualIP.value, port: manualPort.value }
      : { host: selectedBooster.value!.host, port: selectedBooster.value!.port }

    await rtcmStore.startRTCM(config)

    // Wait a moment to verify connection
    await new Promise(resolve => setTimeout(resolve, 2000))

    if (rtcmStore.isConnected) {
      emit('complete')
    } else {
      console.error('Failed to connect to GPS booster')
    }
  } catch (error) {
    console.error('Error connecting to GPS booster:', error)
  } finally {
    isConnecting.value = false
  }
}

function skipGPSBoost() {
  emit('skip')
}

function toggleManualSetup() {
  showManualSetup.value = !showManualSetup.value
  selectedBooster.value = null
}

onMounted(() => {
  // Check if already connected
  if (rtcmStore.isConnected) {
    emit('complete')
  }
})
</script>

<template>
  <div class="gps-boost-step">
    <!-- Header -->
    <div class="step-header">
      <div class="step-emoji">🛰️</div>
      <h2 class="step-title">GPS Boost</h2>
      <p class="step-description">
        Get pinpoint accuracy for your YardRover with GPS Boost technology
      </p>
    </div>

    <!-- Already Connected -->
    <div v-if="hasGPSBoost" class="success-message">
      <div class="success-icon">✓</div>
      <h3>GPS Boost is Active!</h3>
      <p>Your YardRover is connected and ready for precision work.</p>
      <Button variant="primary" size="lg" @click="emit('complete')">
        Continue
      </Button>
    </div>

    <!-- Setup Flow -->
    <div v-else class="setup-flow">
      <!-- Accuracy Comparison -->
      <div class="accuracy-comparison">
        <h3 class="comparison-title">Why use GPS Boost?</h3>
        <div class="comparison-grid">
          <div
            v-for="item in accuracyComparison"
            :key="item.type"
            class="comparison-card"
            :class="{ highlighted: item.type === 'GPS Boost' }"
          >
            <div class="comparison-emoji">{{ item.emoji }}</div>
            <h4 class="comparison-type">{{ item.type }}</h4>
            <div class="comparison-accuracy">{{ item.accuracy }}</div>
            <p class="comparison-description">{{ item.description }}</p>
          </div>
        </div>
      </div>

      <!-- Scanning Section -->
      <div class="scan-section">
        <h3 class="section-title">Find Your GPS Booster</h3>
        <p class="section-description">
          We'll automatically find GPS boosters near you
        </p>

        <Button
          v-if="!scanComplete && !isScanning"
          variant="primary"
          size="lg"
          @click="scanForBoosters"
        >
          <span class="button-icon">🔍</span>
          Scan for GPS Boosters
        </Button>

        <!-- Scanning State -->
        <div v-if="isScanning" class="scanning-state">
          <div class="spinner"></div>
          <p>Scanning for GPS boosters...</p>
        </div>

        <!-- Discovered Boosters -->
        <div v-if="scanComplete" class="boosters-list">
          <div
            v-for="booster in discoveredBoosters"
            :key="`${booster.host}:${booster.port}`"
            class="booster-card"
            :class="{ selected: selectedBooster === booster }"
            @click="selectBooster(booster)"
          >
            <div class="booster-icon">🛰️</div>
            <div class="booster-info">
              <div class="booster-name">{{ booster.name }}</div>
              <div class="booster-address">{{ booster.host }}:{{ booster.port }}</div>
            </div>
            <div v-if="selectedBooster === booster" class="selected-indicator">✓</div>
          </div>

          <Button
            variant="primary"
            size="lg"
            :disabled="!selectedBooster || isConnecting"
            @click="connectToBooster"
          >
            {{ isConnecting ? 'Connecting...' : 'Connect to GPS Booster' }}
          </Button>
        </div>

        <!-- No Boosters Found -->
        <div v-if="!isScanning && discoveredBoosters.length === 0 && !scanComplete" class="no-boosters">
          <p>No GPS boosters found automatically.</p>
          <Button variant="outline" @click="toggleManualSetup">
            Enter Address Manually
          </Button>
        </div>
      </div>

      <!-- Manual Setup -->
      <div v-if="showManualSetup" class="manual-setup">
        <h3 class="section-title">Manual GPS Booster Setup</h3>
        <p class="section-description">
          Enter your GPS booster's address
        </p>

        <div class="manual-form">
          <div class="form-group">
            <label for="booster-ip">IP Address</label>
            <input
              id="booster-ip"
              v-model="manualIP"
              type="text"
              placeholder="192.168.1.100"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="booster-port">Port</label>
            <input
              id="booster-port"
              v-model.number="manualPort"
              type="number"
              placeholder="5015"
              class="form-input"
            />
          </div>

          <Button
            variant="primary"
            :disabled="!manualIP || isConnecting"
            @click="connectToBooster"
          >
            {{ isConnecting ? 'Connecting...' : 'Connect' }}
          </Button>

          <Button variant="text" @click="toggleManualSetup">
            Back to Automatic Setup
          </Button>
        </div>
      </div>

      <!-- Info Box -->
      <div class="info-box">
        <span class="info-icon">💡</span>
        <span>
          GPS Boost is optional. You can set it up later in Settings if you prefer to skip for now.
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="step-actions">
      <Button variant="text" @click="skipGPSBoost">
        Skip GPS Boost
      </Button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.gps-boost-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg);
  min-height: 500px;
}

.step-header {
  text-align: center;
}

.step-emoji {
  font-size: 80px;
  line-height: 1;
  animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes bounce-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.step-title {
  margin: var(--spacing-md) 0 var(--spacing-sm) 0;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

.step-description {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  max-width: 500px;
  margin: 0 auto;
  line-height: 1.6;
}

.success-message {
  text-align: center;
  padding: var(--spacing-2xl);
  background: rgba(44, 95, 45, 0.1);
  border: 2px solid var(--status-success);
  border-radius: var(--radius-lg);

  .success-icon {
    font-size: 64px;
    color: var(--status-success);
    margin-bottom: var(--spacing-md);
  }

  h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--status-success);
    font-size: var(--font-size-xl);
  }

  p {
    margin: 0 0 var(--spacing-xl) 0;
    color: var(--text-secondary);
  }
}

.setup-flow {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.accuracy-comparison {
  .comparison-title {
    text-align: center;
    margin: 0 0 var(--spacing-lg) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .comparison-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .comparison-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    text-align: center;
    transition: all 0.3s ease;

    &.highlighted {
      background: rgba(44, 95, 45, 0.1);
      border-color: var(--primary-green);
    }

    .comparison-emoji {
      font-size: 48px;
      margin-bottom: var(--spacing-md);
    }

    .comparison-type {
      margin: 0 0 var(--spacing-sm) 0;
      font-size: var(--font-size-base);
      font-weight: 700;
      color: var(--text-primary);
    }

    .comparison-accuracy {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--primary-green);
      margin-bottom: var(--spacing-sm);
    }

    .comparison-description {
      margin: 0;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
  }
}

.scan-section {
  text-align: center;

  .section-title {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .section-description {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-secondary);
  }

  .button-icon {
    font-size: 20px;
    margin-right: var(--spacing-sm);
  }
}

.scanning-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top-color: var(--primary-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  p {
    margin: 0;
    color: var(--text-secondary);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.boosters-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.booster-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--primary-green);
  }

  &.selected {
    background: rgba(44, 95, 45, 0.1);
    border-color: var(--primary-green);
  }

  .booster-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .booster-info {
    flex: 1;
    text-align: left;

    .booster-name {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
    }

    .booster-address {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-family: monospace;
    }
  }

  .selected-indicator {
    font-size: 24px;
    color: var(--primary-green);
  }
}

.no-boosters {
  padding: var(--spacing-xl);
  text-align: center;

  p {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-secondary);
  }
}

.manual-setup {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);

  .section-title {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
  }

  .section-description {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-secondary);
    text-align: center;
  }

  .manual-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    max-width: 400px;
    margin: 0 auto;

    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
      text-align: left;

      label {
        font-size: var(--font-size-sm);
        font-weight: 600;
        color: var(--text-primary);
      }

      .form-input {
        padding: var(--spacing-md);
        border: 2px solid var(--border-color);
        border-radius: var(--radius-md);
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: var(--font-size-base);
        transition: border-color 0.2s ease;

        &:focus {
          outline: none;
          border-color: var(--primary-green);
        }
      }
    }
  }
}

.info-box {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 500;
}

.info-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.step-actions {
  display: flex;
  justify-content: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}
</style>
