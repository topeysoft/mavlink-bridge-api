<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client'

const props = defineProps<{
  device: MAVLinkBridgeDevice
}>()

const router = useRouter()
const connectionStore = useConnectionStore()

// Computed
const deviceUrl = computed(() => `http://${props.device.ip}`)
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

// Actions
async function handleConnect() {
  const success = await connectionStore.connect(deviceUrl.value, props.device.name)

  if (success) {
    // Navigate to dashboard after successful connection
    router.push({ name: 'dashboard' })
  }
}
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
        :disabled="isConnecting || isCurrentDevice"
        @click="handleConnect"
      >
        <svg v-if="isCurrentDevice" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
        </svg>
        {{ isCurrentDevice ? 'Connected' : 'Connect' }}
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
