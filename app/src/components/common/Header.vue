<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useFeaturesStore } from '@/stores/features'
import { useConnectionStore } from '@/stores/connection'
import { useBatteryStore } from '@/stores/battery'
import { useAuthStore } from '@/stores/auth'
import { useSidebar } from '@/composables/useSidebar'
import { useDialog } from '@/composables/useDialog'
import { getIcon } from '@/utils/iconMap'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const featuresStore = useFeaturesStore()
const connectionStore = useConnectionStore()
const batteryStore = useBatteryStore()
const authStore = useAuthStore()
const { toggleSidebar, isMobile } = useSidebar()
const { confirm } = useDialog()
const toast = inject<any>('toast')

const showEmergencyConfirm = ref(false)
const isDisconnecting = ref(false)

// Session expiry time remaining
const sessionTimeRemaining = computed(() => {
  if (!authStore.isAuthenticated || !authStore.timeUntilExpiry) return null

  const totalSeconds = Math.floor(authStore.timeUntilExpiry / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  // Only show if less than 1 hour remaining
  if (totalSeconds > 3600) return null

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
})

// Determine session expiry color based on time remaining
const sessionExpiryColor = computed(() => {
  if (!authStore.timeUntilExpiry) return 'var(--text-secondary)'

  const minutesRemaining = Math.floor(authStore.timeUntilExpiry / 1000 / 60)

  if (minutesRemaining <= 5) return 'var(--status-danger)'
  if (minutesRemaining <= 15) return 'var(--status-warning)'
  return 'var(--status-success)'
})

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
    peripherals: featuresStore.userMode === 'consumer' ? 'Tools' : 'Peripherals',
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
  if (isDisconnecting.value) {
    return {
      label: 'Disconnecting...',
      color: 'var(--status-warning)',
      icon: 'connecting'
    }
  }
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

// Dynamic tooltip based on connection state
const connectionTooltip = computed(() => {
  if (isDisconnecting.value) {
    return 'Disconnecting...'
  }
  if (connectionStore.isConnecting) {
    return 'Connecting...'
  }
  if (connectionStore.isConnected) {
    return `Click to disconnect from ${connectionStore.currentDeviceName || 'device'}`
  }
  return 'Click to connect to a device'
})

/**
 * Handle connection status click - disconnect if connected, navigate to connect if not
 */
async function handleConnectionClick() {
  // Do nothing while connecting or disconnecting
  if (connectionStore.isConnecting || isDisconnecting.value) {
    return
  }

  if (connectionStore.isConnected) {
    // Show confirmation dialog before disconnecting
    const deviceName = connectionStore.currentDeviceName || 'device'
    const confirmed = await confirm(
      `This will disconnect from your YardRover device. Any active operations will be stopped and you'll need to reconnect to continue.`,
      `Disconnect from ${deviceName}?`,
      {
        confirmText: 'Disconnect',
        cancelText: 'Cancel',
        variant: 'warning',
        icon: '⚠️'
      }
    )

    if (confirmed) {
      await handleDisconnect()
    }
  } else {
    // Navigate to connect page if not connected
    router.push({ name: 'connect' })
  }
}

/**
 * Disconnect from current device
 */
async function handleDisconnect() {
  const deviceName = connectionStore.currentDeviceName || 'device'
  isDisconnecting.value = true

  try {
    await connectionStore.disconnect()

    // Show success notification
    toast?.value?.addToast({
      message: `Disconnected from ${deviceName}`,
      type: 'success',
      duration: 3000,
      dismissible: true
    })
  } catch (error) {
    // Show error notification
    console.error('Failed to disconnect:', error)
    toast?.value?.addToast({
      message: `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error',
      duration: 5000,
      dismissible: true
    })
  } finally {
    isDisconnecting.value = false
  }
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
        <component :is="getIcon('menu')" :size="24" :stroke-width="2" />
      </button>
      <h1 class="page-title">{{ pageTitle }}</h1>
    </div>

    <div class="header-right">
      <!-- Session Expiry Indicator (only shown when < 1 hour remaining) -->
      <div
        v-if="sessionTimeRemaining"
        class="session-expiry"
        :class="{ warning: authStore.willExpireSoon }"
        :title="`Session expires in ${sessionTimeRemaining}`"
      >
        <component :is="getIcon('clock')" :size="18" :stroke-width="2" :color="sessionExpiryColor" />
        <span :style="{ color: sessionExpiryColor }">{{ sessionTimeRemaining }}</span>
      </div>

      <!-- Connection Status Indicator -->
      <div
        class="connection-status"
        :class="{
          connected: connectionStore.isConnected,
          connecting: connectionStore.isConnecting || isDisconnecting,
          clickable: !connectionStore.isConnecting && !isDisconnecting
        }"
        @click="handleConnectionClick"
        :title="connectionTooltip"
      >
        <component
          v-if="connectionStatus.icon === 'connected'"
          :is="getIcon('wifi-connected')"
          :size="20"
          :stroke-width="2"
          :color="connectionStatus.color"
        />
        <component
          v-else-if="connectionStatus.icon === 'connecting'"
          :is="getIcon('refresh')"
          :size="20"
          :stroke-width="2"
          :color="connectionStatus.color"
          class="spinner"
        />
        <component
          v-else
          :is="getIcon('wifi-off')"
          :size="20"
          :stroke-width="2"
          :color="connectionStatus.color"
        />
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
        class="header-btn emergency-stop"
        @click="handleEmergencyStop"
        aria-label="Emergency stop"
        title="Emergency stop - Immediately halt all operations"
      >
        <component :is="getIcon('stop')" :size="20" :stroke-width="2" fill="currentColor" />
        <span>E-STOP</span>
      </button>

      <div
        class="battery-indicator"
        :class="`battery-${batteryLevel > 60 ? 'good' : batteryLevel > 30 ? 'warning' : 'critical'}`"
        :style="{ borderColor: batteryColor }"
        title="Battery level with estimated runtime (click to view details)"
        @click="navigateToBattery"
      >
        <component :is="getIcon('battery')" :size="24" :stroke-width="2" :color="batteryColor" />
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
  border: 2px solid;
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

.session-expiry {
  @include flex-center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  border: 1px solid var(--border-color);
  transition: all 0.2s;

  svg {
    width: 18px;
    height: 18px;
  }

  span {
    white-space: nowrap;
  }

  &.warning {
    animation: session-pulse 2s ease-in-out infinite;
  }
}

@keyframes session-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.connection-status {
  @include flex-center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  transition: all 0.2s;
  font-size: var(--font-size-sm);
  font-weight: 600;
  border: 1px solid var(--border-color);
  cursor: default;

  svg {
    width: 20px;
    height: 20px;
  }

  .connection-label {
    white-space: nowrap;
  }

  &.clickable {
    cursor: pointer;

    &:hover {
      background: var(--bg-tertiary);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &:active {
      transform: translateY(0);
    }
  }

  &.connected {
    border-color: var(--status-success);

    &.clickable:hover {
      border-color: var(--status-warning);
    }
  }

  &.connecting {
    border-color: var(--status-warning);
    cursor: wait;

    .spinner {
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
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
