<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import DiscoveredDeviceCard from './DiscoveredDeviceCard.vue'

const connectionStore = useConnectionStore()

const manualUrl = ref('')
const showManualInput = ref(false)
const manualUrlError = ref('')

// Computed
const isScanning = computed(() => connectionStore.isDiscovering)
const hasDiscoveredDevices = computed(() => connectionStore.discoveredDevices.length > 0)
const discoveryError = computed(() => connectionStore.connectionError)

// Validate URL format
function validateUrl(url: string): boolean {
  if (!url.trim()) {
    manualUrlError.value = 'URL is required'
    return false
  }

  try {
    const fullUrl = url.startsWith('http') ? url : `http://${url}`
    new URL(fullUrl)
    manualUrlError.value = ''
    return true
  } catch {
    manualUrlError.value = 'Invalid URL format'
    return false
  }
}

// Actions
async function startDiscovery() {
  manualUrlError.value = ''
  await connectionStore.discoverLocalDevices()
}

async function connectManually() {
  if (!validateUrl(manualUrl.value)) {
    return
  }

  const fullUrl = manualUrl.value.startsWith('http')
    ? manualUrl.value
    : `http://${manualUrl.value}`

  const success = await connectionStore.connect(fullUrl)

  if (success) {
    manualUrl.value = ''
    showManualInput.value = false
  }
}

function toggleManualInput() {
  showManualInput.value = !showManualInput.value
  manualUrlError.value = ''
  if (!showManualInput.value) {
    manualUrl.value = ''
  }
}
</script>

<template>
  <div class="device-discovery-card">
    <div class="card-header">
      <div class="header-content">
        <h2>Discover Devices</h2>
        <p class="subtitle">Scan your local network for YardRover devices</p>
      </div>
      <button
        class="btn btn-primary"
        :disabled="isScanning || connectionStore.isConnecting"
        @click="startDiscovery"
      >
        <svg v-if="isScanning" class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2" stroke-dasharray="32" stroke-dashoffset="32">
            <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
          </circle>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        {{ isScanning ? 'Scanning...' : 'Scan Network' }}
      </button>
    </div>

    <!-- Discovery Error -->
    <div v-if="discoveryError && !isScanning" class="error-banner">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <span>{{ discoveryError }}</span>
    </div>

    <!-- Discovered Devices -->
    <div v-if="hasDiscoveredDevices" class="discovered-devices">
      <h3>Found {{ connectionStore.discoveredDevices.length }} device{{ connectionStore.discoveredDevices.length === 1 ? '' : 's' }}</h3>
      <div class="devices-list">
        <DiscoveredDeviceCard
          v-for="device in connectionStore.discoveredDevices"
          :key="device.id"
          :device="device"
        />
      </div>
    </div>

    <!-- No Devices Found -->
    <div v-else-if="!isScanning && !discoveryError" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6m0 4h.01"/>
      </svg>
      <p>No devices found on your network</p>
      <p class="hint">Make sure your YardRover is powered on and connected to the same network</p>
    </div>

    <!-- Manual Connection -->
    <div class="manual-connection">
      <button
        class="btn-link"
        @click="toggleManualInput"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14m7-7H5"/>
        </svg>
        {{ showManualInput ? 'Hide' : 'Connect manually by IP address' }}
      </button>

      <div v-if="showManualInput" class="manual-input-form">
        <div class="input-group">
          <input
            v-model="manualUrl"
            type="text"
            placeholder="192.168.1.100 or yardrover.local"
            :class="{ error: manualUrlError }"
            @keyup.enter="connectManually"
          />
          <button
            class="btn btn-primary"
            :disabled="!manualUrl.trim() || connectionStore.isConnecting"
            @click="connectManually"
          >
            {{ connectionStore.isConnecting ? 'Connecting...' : 'Connect' }}
          </button>
        </div>
        <p v-if="manualUrlError" class="input-error">{{ manualUrlError }}</p>
        <p class="input-hint">Enter IP address (e.g., 192.168.1.100) or hostname (e.g., yardrover.local)</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.device-discovery-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: var(--spacing-xl);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-lg);

  .header-content {
    flex: 1;

    h2 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
    }

    .subtitle {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
  }

  .btn {
    flex-shrink: 0;
  }
}

.spinner {
  width: 18px;
  height: 18px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid var(--status-danger);
  border-radius: var(--radius-md);
  color: var(--status-danger);
  margin-bottom: var(--spacing-lg);

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  span {
    font-size: var(--font-size-sm);
  }
}

.discovered-devices {
  margin-bottom: var(--spacing-xl);

  h3 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-md);
  }

  .devices-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-lg);
  color: var(--text-secondary);

  svg {
    width: 48px;
    height: 48px;
    margin: 0 auto var(--spacing-lg);
    opacity: 0.5;
  }

  p {
    font-size: var(--font-size-base);
    margin-bottom: var(--spacing-xs);
  }

  .hint {
    font-size: var(--font-size-sm);
    color: var(--text-light);
  }
}

.manual-connection {
  border-top: 1px solid var(--border-color);
  padding-top: var(--spacing-lg);

  .btn-link {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: none;
    border: none;
    color: var(--primary-green);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    padding: var(--spacing-sm);
    margin: 0;
    transition: color 0.2s;

    &:hover {
      color: var(--primary-green-light);
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }

  .manual-input-form {
    margin-top: var(--spacing-md);
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);

    .input-group {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-sm);

      input {
        flex: 1;
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: var(--font-size-base);
        transition: border-color 0.2s;

        &:focus {
          outline: none;
          border-color: var(--primary-green);
        }

        &.error {
          border-color: var(--status-danger);
        }
      }

      .btn {
        flex-shrink: 0;
      }
    }

    .input-error {
      font-size: var(--font-size-sm);
      color: var(--status-danger);
      margin-bottom: var(--spacing-xs);
    }

    .input-hint {
      font-size: var(--font-size-sm);
      color: var(--text-light);
    }
  }
}
</style>
