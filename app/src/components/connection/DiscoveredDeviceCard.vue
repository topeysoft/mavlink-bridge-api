<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useAuthStore } from '@/stores/auth'
import AuthStatusBadge from './AuthStatusBadge.vue'
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client'

const props = defineProps<{
  device: MAVLinkBridgeDevice
}>()

const router = useRouter()
const connectionStore = useConnectionStore()
const authStore = useAuthStore()

// Auth status checking
const isCheckingAuth = ref(false)
const authStatus = ref<'needs_setup' | 'needs_login' | 'authenticated' | 'unknown'>('unknown')

// Computed
const deviceUrl = computed(() => {
  const port = props.device.port
  // Only include port in URL if it's not the default HTTP port (80)
  return port === 80 ? `http://${props.device.ip}` : `http://${props.device.ip}:${port}`
})
const isConnecting = computed(() => connectionStore.isConnecting)
const isCurrentDevice = computed(() => connectionStore.currentDeviceUrl === deviceUrl.value)

// Signal quality based on RSSI
const signalQuality = computed(() => {
  const rssi = props.device.network.wifi.rssi
  if (!rssi || !props.device.isProvisioned) return null

  if (rssi >= -50) return { label: 'Excellent', color: 'var(--status-success)', strength: 4 }
  if (rssi >= -60) return { label: 'Good', color: 'var(--status-success)', strength: 3 }
  if (rssi >= -70) return { label: 'Fair', color: 'var(--status-warning)', strength: 2 }
  return { label: 'Poor', color: 'var(--status-danger)', strength: 1 }
})

// Status badge
const statusBadge = computed(() => {
  if (props.device.network.ap.enabled) {
    return { label: 'AP Mode', color: 'var(--status-warning)' }
  }
  if (props.device.isProvisioned) {
    return { label: 'Connected', color: 'var(--status-success)' }
  }
  return { label: 'Not Provisioned', color: 'var(--text-light)' }
})

// CTA button text and action
const ctaButton = computed(() => {
  if (isCurrentDevice.value) {
    return { text: 'Connected', icon: 'check', disabled: true }
  }

  switch (authStatus.value) {
    case 'needs_setup':
      return { text: 'Setup Device', icon: 'settings', disabled: false }
    case 'needs_login':
      return { text: 'Login', icon: 'login', disabled: false }
    case 'authenticated':
      return { text: 'Connect', icon: 'arrow', disabled: false }
    default:
      return { text: 'Connect', icon: 'arrow', disabled: false }
  }
})

// Actions
async function checkAuthStatus() {
  isCheckingAuth.value = true
  try {
    authStatus.value = await connectionStore.checkDeviceAuthStatus(deviceUrl.value)
  } catch (error) {
    console.error('Failed to check auth status:', error)
    authStatus.value = 'unknown'
  } finally {
    isCheckingAuth.value = false
  }
}

async function handleConnect() {
  const success = await connectionStore.connect(deviceUrl.value, props.device.name)

  if (success) {
    // Check auth status after connection and route accordingly
    if (authStatus.value === 'needs_setup') {
      router.push({ name: 'setup' })
    } else if (authStatus.value === 'needs_login') {
      router.push({ name: 'login', query: { redirect: '/' } })
    } else {
      // If authenticated or unknown, go to dashboard
      router.push({ name: 'dashboard' })
    }
  }
}

// Check auth status on mount
onMounted(() => {
  checkAuthStatus()
})
</script>

<template>
  <div class="discovered-device-card" :class="{ current: isCurrentDevice }">
    <div class="device-info">
      <div class="device-main">
        <div class="device-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
          </svg>
        </div>
        <div class="device-details">
          <div class="device-name">{{ device.name }}</div>
          <div class="device-meta">
            <span class="device-ip">{{ device.ip }}</span>
            <span class="device-separator">•</span>
            <span class="device-mac">{{ device.id.slice(-8) }}</span>
          </div>
        </div>
      </div>

      <div class="device-badges">
        <!-- Auth Status Badge -->
        <AuthStatusBadge :status="authStatus" :checking="isCheckingAuth" />

        <!-- Status Badge -->
        <div class="status-badge" :style="{ backgroundColor: statusBadge.color }">
          {{ statusBadge.label }}
        </div>

        <!-- Signal Strength -->
        <div v-if="signalQuality" class="signal-indicator" :style="{ color: signalQuality.color }">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path v-if="signalQuality.strength >= 1" d="M12 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            <path v-if="signalQuality.strength >= 2" d="M7 14c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1s1-.45 1-1v-4c0-.55-.45-1-1-1zm10 0c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1s1-.45 1-1v-4c0-.55-.45-1-1-1z"/>
            <path v-if="signalQuality.strength >= 3" d="M2 10c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1s1-.45 1-1v-8c0-.55-.45-1-1-1zm20 0c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1s1-.45 1-1v-8c0-.55-.45-1-1-1z"/>
          </svg>
          <span class="signal-label">{{ signalQuality.label }}</span>
        </div>
      </div>
    </div>

    <div class="device-actions">
      <button
        class="btn btn-primary"
        :disabled="isConnecting || ctaButton.disabled"
        @click="handleConnect"
      >
        <!-- Icon based on CTA type -->
        <svg v-if="ctaButton.icon === 'check'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <svg v-else-if="ctaButton.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
        </svg>
        <svg v-else-if="ctaButton.icon === 'login'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
        </svg>
        {{ ctaButton.text }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.discovered-device-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: all 0.2s;
  gap: var(--spacing-lg);

  &:hover {
    border-color: var(--primary-green);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.current {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.05);
  }
}

.device-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.device-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.device-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--primary-green);
  color: white;
  border-radius: var(--radius-md);
  flex-shrink: 0;

  svg {
    width: 24px;
    height: 24px;
  }
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
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);

  .device-separator {
    opacity: 0.5;
  }

  .device-mac {
    font-family: monospace;
    font-size: var(--font-size-xs);
    opacity: 0.7;
  }
}

.device-badges {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.signal-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);

  svg {
    width: 20px;
    height: 20px;
  }

  .signal-label {
    font-weight: 500;
  }
}

.device-actions {
  flex-shrink: 0;

  .btn {
    min-width: 120px;
  }
}

@media (max-width: 768px) {
  .discovered-device-card {
    flex-direction: column;
    align-items: stretch;
  }

  .device-info {
    width: 100%;
  }

  .device-actions {
    width: 100%;

    .btn {
      width: 100%;
    }
  }
}
</style>
