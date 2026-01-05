<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'

const router = useRouter()
const connectionStore = useConnectionStore()

// Computed
const savedDevices = computed(() => {
  // Sort by favorites first, then by last connected
  return [...connectionStore.savedDevices].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1
    if (!a.favorite && b.favorite) return 1

    const aTime = a.lastConnected ? new Date(a.lastConnected).getTime() : 0
    const bTime = b.lastConnected ? new Date(b.lastConnected).getTime() : 0
    return bTime - aTime
  })
})

// Actions
async function handleConnect(deviceUrl: string, deviceName: string) {
  const success = await connectionStore.connect(deviceUrl, deviceName)

  if (success) {
    router.push({ name: 'dashboard' })
  }
}

function toggleFavorite(deviceId: string) {
  connectionStore.toggleFavorite(deviceId)
}

function removeDevice(deviceId: string) {
  if (confirm('Are you sure you want to remove this device from your saved devices?')) {
    connectionStore.removeSavedDevice(deviceId)
  }
}

function formatLastConnected(timestamp: string | undefined): string {
  if (!timestamp) return 'Never'

  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return date.toLocaleDateString()
}
</script>

<template>
  <div class="saved-devices-list">
    <div class="section-header">
      <h2>Saved Devices</h2>
      <p class="subtitle">Quick access to your previously connected devices</p>
    </div>

    <div class="devices-grid">
      <div
        v-for="device in savedDevices"
        :key="device.id"
        class="saved-device-card"
      >
        <div class="device-header">
          <div class="device-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
            </svg>
          </div>
          <button
            class="favorite-btn"
            :class="{ active: device.favorite }"
            @click="toggleFavorite(device.id)"
            title="Toggle favorite"
          >
            <svg viewBox="0 0 24 24" :fill="device.favorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>

        <div class="device-content">
          <h3 class="device-name">{{ device.name }}</h3>
          <p class="device-url">{{ device.url }}</p>
          <p class="device-last-connected">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            {{ formatLastConnected(device.lastConnected) }}
          </p>
        </div>

        <div class="device-actions">
          <button
            class="btn btn-primary"
            :disabled="connectionStore.isConnecting"
            @click="handleConnect(device.url, device.name)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
            Connect
          </button>
          <button
            class="btn-icon btn-danger"
            @click="removeDevice(device.id)"
            title="Remove device"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.saved-devices-list {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: var(--spacing-xl);
}

.section-header {
  margin-bottom: var(--spacing-xl);

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

.devices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.saved-device-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-green);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.device-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primary-green);
  color: white;
  border-radius: var(--radius-md);

  svg {
    width: 20px;
    height: 20px;
  }
}

.favorite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-light);
  cursor: pointer;
  padding: var(--spacing-xs);
  transition: color 0.2s;

  &:hover {
    color: var(--status-warning);
  }

  &.active {
    color: var(--status-warning);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.device-content {
  margin-bottom: var(--spacing-lg);
}

.device-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.device-url {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-family: monospace;
  margin-bottom: var(--spacing-sm);
}

.device-last-connected {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--text-light);

  svg {
    width: 14px;
    height: 14px;
  }
}

.device-actions {
  display: flex;
  gap: var(--spacing-sm);

  .btn {
    flex: 1;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm);
    background: none;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--status-danger);
      border-color: var(--status-danger);
      color: white;
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }
}

@media (max-width: 768px) {
  .devices-grid {
    grid-template-columns: 1fr;
  }
}
</style>
