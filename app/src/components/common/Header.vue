<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useFeaturesStore } from '@/stores/features'
import { useConnectionStore } from '@/stores/connection'
import { useBatteryStore } from '@/stores/battery'
import { useSidebar } from '@/composables/useSidebar'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const featuresStore = useFeaturesStore()
const connectionStore = useConnectionStore()
const batteryStore = useBatteryStore()
const { toggleSidebar, isMobile } = useSidebar()

const showEmergencyConfirm = ref(false)

// Battery level from live data
const batteryLevel = computed(() => Math.round(batteryStore.batteryInfo.percent))

// Battery estimated runtime
const batteryTime = computed(() => {
  const runtime = batteryStore.stats.estimatedRuntime
  if (!runtime) return 'N/A'
  const hours = Math.floor(runtime / 60)
  const mins = Math.floor(runtime % 60)
  return hours > 0 ? `~${hours}h ${mins}m` : `~${mins}m`
})

// Dynamic battery color based on level
const batteryColor = computed(() => {
  if (batteryLevel.value > 60) return 'var(--status-success)'
  if (batteryLevel.value > 30) return 'var(--status-warning)'
  return 'var(--status-danger)'
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    connect: 'Connect Device',
    dashboard: 'Dashboard',
    attachments: 'Attachments',
    zones: 'Coverage Zones',
    missions: 'Missions',
    monitoring: 'Live Monitoring',
    schedule: 'Schedule & Calendar',
    settings: 'Settings'
  }
  return titles[route.name as string] || 'YardRover'
})

// Connection status
const connectionStatus = computed(() => {
  if (connectionStore.isConnected) {
    return {
      label: connectionStore.currentDeviceName || 'Connected',
      color: 'var(--status-success)',
      icon: 'connected'
    }
  }
  if (connectionStore.isConnecting) {
    return {
      label: 'Connecting...',
      color: 'var(--status-warning)',
      icon: 'connecting'
    }
  }
  // Show persisted device name even when not connected (for clarity)
  if (connectionStore.currentDeviceName) {
    return {
      label: connectionStore.currentDeviceName,
      color: 'var(--text-light)',
      icon: 'disconnected'
    }
  }
  return {
    label: 'Not Connected',
    color: 'var(--text-light)',
    icon: 'disconnected'
  }
})

function navigateToConnect() {
  router.push({ name: 'connect' })
}

function handleEmergencyStop() {
  showEmergencyConfirm.value = true
}

function confirmEmergencyStop() {
  console.log('EMERGENCY STOP ACTIVATED')
  // TODO: Implement actual emergency stop via MAVLink
  showEmergencyConfirm.value = false
}

function navigateToBattery() {
  router.push({ name: 'battery' })
}

function navigateToSettings() {
  router.push({ name: 'settings' })
}

const modeColor = computed(() => {
  switch (featuresStore.userMode) {
    case 'consumer':
      return '#10b981'
    case 'power-user':
      return '#f59e0b'
    case 'developer':
      return '#ef4444'
    default:
      return '#6b7280'
  }
})

const modeLabel = computed(() => {
  switch (featuresStore.userMode) {
    case 'consumer':
      return 'Consumer'
    case 'power-user':
      return 'Power User'
    case 'developer':
      return 'Developer'
    default:
      return 'Unknown'
  }
})
</script>

<template>
  <header class="top-header">
    <div class="header-left">
      <!-- Mobile menu button -->
      <button
        v-if="isMobile"
        class="mobile-menu-btn"
        @click="toggleSidebar"
        aria-label="Toggle navigation menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <h1 class="page-title">{{ pageTitle }}</h1>
    </div>

    <div class="header-right">
      <!-- Connection Status Indicator -->
      <div
        class="connection-status"
        :class="{ connected: connectionStore.isConnected, connecting: connectionStore.isConnecting }"
        @click="navigateToConnect"
        :title="`${connectionStatus.label} - Click to manage connection`"
      >
        <svg v-if="connectionStatus.icon === 'connected'" viewBox="0 0 24 24" fill="currentColor" :style="{ color: connectionStatus.color }">
          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
        </svg>
        <svg v-else-if="connectionStatus.icon === 'connecting'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
            <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
          </circle>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :style="{ color: connectionStatus.color }">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55m-7 8.45l3-3c-.59-.59-1.27-1.06-2-1.38M5 12.55a10.94 10.94 0 0 1 5.17-2.39m3.66 0a10.94 10.94 0 0 1 5.17 2.39M1.42 9a16 16 0 0 1 21.16 0"></path>
        </svg>
        <span class="connection-label" :style="{ color: connectionStatus.color }">{{ connectionStatus.label }}</span>
      </div>

      <!-- User Mode Indicator -->
      <div
        class="mode-indicator"
        :style="{ borderColor: modeColor }"
        @click="navigateToSettings"
        :title="`${modeLabel} Mode - Click to change in settings`"
      >
        <div class="mode-dot" :style="{ backgroundColor: modeColor }"></div>
        <span class="mode-label">{{ modeLabel }}</span>
      </div>

      <button
        class="header-btn theme-toggle"
        @click="themeStore.toggleTheme"
        :title="`Switch to ${themeStore.theme === 'light' ? 'dark' : 'light'} mode`"
        :aria-label="`Switch to ${themeStore.theme === 'light' ? 'dark' : 'light'} mode`"
      >
        <svg v-if="themeStore.theme === 'light'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>

      <button
        class="header-btn emergency-stop"
        @click="handleEmergencyStop"
        aria-label="Emergency stop"
        title="Emergency stop - Immediately halt all operations"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10"></circle>
          <rect x="9" y="9" width="6" height="6" fill="white"></rect>
        </svg>
        <span>E-STOP</span>
      </button>

      <div
        class="battery-indicator"
        :class="`battery-${batteryLevel > 60 ? 'good' : batteryLevel > 30 ? 'warning' : 'critical'}`"
        title="Battery level with estimated runtime (click to view details)"
        @click="navigateToBattery"
      >
        <svg viewBox="0 0 24 24" fill="none" :stroke="batteryColor" stroke-width="2">
          <rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect>
          <rect x="3" y="8" width="14" height="8" :fill="batteryColor" :opacity="batteryLevel / 100"></rect>
          <line x1="23" y1="13" x2="23" y2="11"></line>
        </svg>
        <span class="battery-level" :style="{ color: batteryColor }">{{ batteryLevel }}%</span>
        <span class="battery-time">({{ batteryTime }})</span>
      </div>
    </div>

    <!-- Emergency Stop Confirmation Modal -->
    <Modal
      v-model="showEmergencyConfirm"
      title="⚠️ Emergency Stop"
      variant="danger"
      size="sm"
      :close-on-backdrop="false"
    >
      <p style="margin-bottom: var(--spacing-md); color: var(--text-primary);">
        This will immediately halt all operations and disable the motors.
      </p>
      <p style="margin: 0; color: var(--text-primary); font-weight: 600;">
        Are you sure you want to proceed?
      </p>

      <template #footer>
        <Button variant="outline" @click="showEmergencyConfirm = false">
          Cancel
        </Button>
        <Button variant="danger" @click="confirmEmergencyStop">
          Confirm E-Stop
        </Button>
      </template>
    </Modal>
  </header>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.top-header {
  @include flex-between;
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  @include flex-center;
  gap: var(--spacing-md);
}

.page-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-right {
  @include flex-center;
  gap: var(--spacing-md);
}

.header-btn {
  @include flex-center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  font-size: var(--font-size-sm);
  font-weight: 600;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: var(--bg-secondary);
    transform: translateY(-1px);
  }
}

.theme-toggle {
  width: 40px;
  height: 40px;
  padding: var(--spacing-sm);
}

.emergency-stop {
  background: var(--status-danger);
  color: white;
  border-color: var(--status-danger);

  &:hover {
    background: #c82333;
    border-color: #bd2130;
  }
}

.battery-indicator {
  @include flex-center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    background: var(--bg-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }

  svg {
    width: 24px;
    height: 24px;
    transition: all 0.3s ease;
  }

  .battery-level {
    font-weight: 700;
    transition: color 0.3s ease;
  }

  .battery-time {
    color: var(--text-secondary);
  }

  // Add pulsing animation for critical battery
  &.battery-critical {
    animation: battery-pulse 2s ease-in-out infinite;
  }
}

@keyframes battery-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.mobile-menu-btn {
  @include flex-center;
  padding: var(--spacing-sm);
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s;
  margin-right: var(--spacing-md);

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    background: var(--bg-secondary);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-green);
    outline-offset: 2px;
  }
}

.mode-indicator {
  @include flex-center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border: 2px solid;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s;
  font-size: var(--font-size-sm);
  font-weight: 600;

  &:hover {
    background: var(--bg-tertiary);
    transform: translateY(-1px);
  }

  .mode-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: mode-pulse 2s ease-in-out infinite;
  }

  .mode-label {
    color: var(--text-primary);
  }
}

@keyframes mode-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.connection-status {
  @include flex-center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  font-size: var(--font-size-sm);
  font-weight: 600;
  border: 1px solid var(--border-color);

  &:hover {
    background: var(--bg-tertiary);
    transform: translateY(-1px);
  }

  svg {
    width: 20px;
    height: 20px;
  }

  .connection-label {
    white-space: nowrap;
  }

  &.connected {
    border-color: var(--status-success);
  }

  &.connecting {
    border-color: var(--status-warning);

    .spinner {
      animation: spin 1s linear infinite;
    }
  }
}

@include mobile {
  .top-header {
    padding: var(--spacing-md) var(--spacing-lg);
  }

  .page-title {
    font-size: var(--font-size-lg);
  }

  .battery-time {
    display: none;
  }

  .header-btn span {
    display: none;
  }

  .emergency-stop {
    padding: var(--spacing-sm);
  }

  .mode-label {
    display: none;
  }

  .mode-indicator {
    padding: var(--spacing-sm);
  }

  .connection-label {
    display: none;
  }

  .connection-status {
    padding: var(--spacing-sm);
  }
}
</style>
