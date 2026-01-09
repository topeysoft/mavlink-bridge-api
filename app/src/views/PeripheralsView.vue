<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import { usePeripheralsStore } from '@/stores/peripherals'
import { useFeaturesStore } from '@/stores/features'
import { useDialog } from '@/composables/useDialog'
import type { Peripheral } from '@/types'
import { PeripheralState, PeripheralHealth } from '../../../../client/dist/index'

const peripheralsStore = usePeripheralsStore()
const featuresStore = useFeaturesStore()
const dialog = useDialog()

const breadcrumbItems = [
  { label: 'Dashboard', to: '/' },
  { label: featuresStore.userMode === 'consumer' ? 'Tools' : 'Peripherals' }
]

// Group peripherals by category
const peripheralCategories = computed(() => {
  const categories: Record<string, { label: string; peripherals: Peripheral[] }> = {
    mowing: { label: 'Mowing & Lawn Care', peripherals: [] },
    winter: { label: 'Snow & Winter', peripherals: [] },
    application: { label: 'Application & Spraying', peripherals: [] },
    collection: { label: 'Collection & Cleaning', peripherals: [] },
    monitoring: { label: 'Monitoring & Sensors', peripherals: [] },
    utility: { label: 'Utility', peripherals: [] },
    builtin: { label: 'Built-in Features', peripherals: [] },
    other: { label: 'Other', peripherals: [] }
  }

  for (const peripheral of peripheralsStore.peripherals) {
    const type = peripheral.metadata.type

    if (['mower', 'grass_collector', 'mulcher', 'edger', 'aerator', 'seeder'].includes(type)) {
      categories.mowing.peripherals.push(peripheral)
    } else if (['snow_blower', 'snow_plow', 'salt_spreader'].includes(type)) {
      categories.winter.peripherals.push(peripheral)
    } else if (['sprayer', 'fertilizer_spreader'].includes(type)) {
      categories.application.peripherals.push(peripheral)
    } else if (['vacuum', 'leaf_blower', 'debris_collector'].includes(type)) {
      categories.collection.peripherals.push(peripheral)
    } else if (['camera', 'environmental_sensor', 'soil_sensor', 'lidar'].includes(type)) {
      categories.monitoring.peripherals.push(peripheral)
    } else if (['power_module', 'lighting', 'trailer_hitch'].includes(type)) {
      categories.utility.peripherals.push(peripheral)
    } else if (type.startsWith('builtin_')) {
      categories.builtin.peripherals.push(peripheral)
    } else {
      categories.other.peripherals.push(peripheral)
    }
  }

  // Filter out empty categories
  return Object.entries(categories)
    .filter(([_, cat]) => cat.peripherals.length > 0)
    .map(([key, cat]) => ({ key, ...cat }))
})

// Helper functions
function getPeripheralIcon(type: string): string {
  const icons: Record<string, string> = {
    mower: 'grass',
    grass_collector: 'inventory_2',
    mulcher: 'eco',
    edger: 'border_style',
    aerator: 'air',
    seeder: 'agriculture',
    snow_blower: 'ac_unit',
    snow_plow: 'diamond',
    salt_spreader: 'grain',
    sprayer: 'water_drop',
    fertilizer_spreader: 'yard',
    vacuum: 'cleaning_services',
    leaf_blower: 'air',
    debris_collector: 'delete_sweep',
    camera: 'camera_alt',
    environmental_sensor: 'sensors',
    soil_sensor: 'network_check',
    lidar: 'radar',
    power_module: 'power',
    lighting: 'light_mode',
    trailer_hitch: 'attach_file',
    builtin_gps: 'gps_fixed',
    builtin_imu: 'explore',
    builtin_battery: 'battery_full',
    custom: 'extension'
  }
  return icons[type] || 'extension'
}

function getStateColor(state: PeripheralState): string {
  const colors: Record<PeripheralState, string> = {
    disconnected: 'var(--text-tertiary)',
    connected: 'var(--status-info)',
    initializing: 'var(--status-warning)',
    ready: 'var(--status-success)',
    active: 'var(--primary-green)',
    error: 'var(--status-error)',
    disabled: 'var(--text-tertiary)'
  }
  return colors[state]
}

function getHealthColor(health: PeripheralHealth): string {
  const colors: Record<PeripheralHealth, string> = {
    healthy: 'var(--status-success)',
    warning: 'var(--status-warning)',
    error: 'var(--status-error)',
    unknown: 'var(--text-tertiary)'
  }
  return colors[health]
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

function formatLastSeen(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return date.toLocaleDateString()
}

async function togglePeripheral(peripheral: Peripheral) {
  if (peripheral.status.enabled) {
    const confirmed = await dialog.confirm(
      `Disable ${peripheral.metadata.name}?`,
      'Confirm',
      { variant: 'warning' }
    )
    if (confirmed) {
      await peripheralsStore.disablePeripheral(peripheral.metadata.peripheral_id)
    }
  } else {
    // Check compatibility before enabling
    const success = await peripheralsStore.enablePeripheral(peripheral.metadata.peripheral_id)
    if (!success && peripheralsStore.error) {
      await dialog.alert(peripheralsStore.error, 'Cannot Enable', { variant: 'danger' })
    }
  }
}

async function removePeripheral(peripheral: Peripheral) {
  const confirmed = await dialog.confirm(
    `Remove ${peripheral.metadata.name}? This will unregister the peripheral from the system.`,
    'Confirm Remove',
    { variant: 'danger', icon: '⚠️' }
  )

  if (confirmed) {
    await peripheralsStore.unregisterPeripheral(peripheral.metadata.peripheral_id)
  }
}

onMounted(async () => {
  await peripheralsStore.fetchPeripherals()
  peripheralsStore.setupWebSocketListeners()
})

onUnmounted(() => {
  // WebSocket cleanup handled by store
})
</script>

<template>
  <div class="peripherals-view">
    <Breadcrumb :items="breadcrumbItems" />

    <header class="page-header">
      <div class="header-content">
        <div>
          <h1>{{ featuresStore.userMode === 'consumer' ? 'Tools & Equipment' : 'Peripherals' }}</h1>
          <p class="subtitle">
            {{ featuresStore.userMode === 'consumer'
              ? 'Manage your connected tools and equipment'
              : 'Manage peripheral devices and attachments' }}
          </p>
        </div>

        <div class="stats-summary" v-if="peripheralsStore.stats">
          <div class="stat">
            <span class="value">{{ peripheralsStore.stats.connected_peripherals }}</span>
            <span class="label">Connected</span>
          </div>
          <div class="stat">
            <span class="value">{{ peripheralsStore.stats.enabled_peripherals }}</span>
            <span class="label">Enabled</span>
          </div>
          <div class="stat">
            <span class="value">{{ peripheralsStore.stats.active_peripherals }}</span>
            <span class="label">Active</span>
          </div>
        </div>
      </div>

      <!-- Compatibility Warning -->
      <div v-if="peripheralsStore.hasCompatibilityIssues" class="compatibility-warning">
        <span class="material-icons">warning</span>
        <div class="warning-content">
          <strong>Compatibility Issues Detected</strong>
          <ul>
            <li v-for="(conflict, index) in peripheralsStore.compatibility?.conflicts" :key="index">
              {{ conflict.reason }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Power Warning -->
      <div v-if="peripheralsStore.compatibility?.warnings.length" class="power-warning">
        <span class="material-icons">battery_alert</span>
        <div>
          <div v-for="(warning, index) in peripheralsStore.compatibility?.warnings" :key="index">
            {{ warning }}
          </div>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="peripheralsStore.loading" class="loading-state">
      <span class="material-icons spin">refresh</span>
      <p>Loading peripherals...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="peripheralsStore.peripherals.length === 0" class="empty-state">
      <span class="material-icons">extension_off</span>
      <h3>No Peripherals Detected</h3>
      <p>
        {{ featuresStore.userMode === 'consumer'
          ? 'Connect tools and equipment to your YardRover to see them here.'
          : 'No peripheral devices detected. They will appear automatically when connected.' }}
      </p>
    </div>

    <!-- Peripherals by Category -->
    <div v-else class="peripherals-content">
      <section v-for="category in peripheralCategories" :key="category.key" class="category-section">
        <h2 class="category-title">{{ category.label }}</h2>

        <div class="peripherals-grid">
          <div
            v-for="peripheral in category.peripherals"
            :key="peripheral.metadata.peripheral_id"
            class="peripheral-card"
            :class="{
              enabled: peripheral.status.enabled,
              active: peripheral.status.active,
              error: peripheral.status.state === 'error' || peripheral.status.health === 'error'
            }"
          >
            <!-- Header -->
            <div class="peripheral-header">
              <span class="material-icons icon" :style="{ color: peripheral.status.enabled ? 'var(--primary-green)' : 'var(--text-tertiary)' }">
                {{ getPeripheralIcon(peripheral.metadata.type) }}
              </span>

              <div class="badges">
                <span class="badge state" :style="{ backgroundColor: getStateColor(peripheral.status.state) }">
                  {{ peripheral.status.state }}
                </span>
                <span class="badge health" :style="{ backgroundColor: getHealthColor(peripheral.status.health) }">
                  {{ peripheral.status.health }}
                </span>
              </div>
            </div>

            <!-- Name and Type -->
            <h3>{{ peripheral.metadata.name }}</h3>
            <p class="type">{{ peripheral.metadata.manufacturer }} {{ peripheral.metadata.model }}</p>

            <!-- Status Messages -->
            <div v-if="peripheral.status.error_message" class="status-message error">
              <span class="material-icons">error</span>
              {{ peripheral.status.error_message }}
            </div>
            <div v-if="peripheral.status.warning_message" class="status-message warning">
              <span class="material-icons">warning</span>
              {{ peripheral.status.warning_message }}
            </div>

            <!-- Stats -->
            <div class="stats">
              <div class="stat-row">
                <span class="label">Firmware:</span>
                <span class="value">{{ peripheral.metadata.firmware_version }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Operation Hours:</span>
                <span class="value">{{ peripheral.status.operation_hours.toFixed(1) }}h</span>
              </div>
              <div class="stat-row">
                <span class="label">Uptime:</span>
                <span class="value">{{ formatUptime(peripheral.status.uptime_seconds) }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Last Seen:</span>
                <span class="value">{{ formatLastSeen(peripheral.status.last_seen) }}</span>
              </div>
              <div v-if="peripheral.metadata.capabilities.power_required > 0" class="stat-row">
                <span class="label">Power:</span>
                <span class="value">{{ peripheral.metadata.capabilities.power_required }}W</span>
              </div>
            </div>

            <!-- Telemetry (if active) -->
            <div v-if="peripheral.telemetry && peripheral.status.active" class="telemetry">
              <h4>Live Data</h4>
              <div class="telemetry-data">
                <div v-for="(value, key) in peripheral.telemetry.data" :key="key" class="telemetry-item">
                  <span class="key">{{ key }}:</span>
                  <span class="value">{{ value }}</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="actions">
              <button
                @click="togglePeripheral(peripheral)"
                class="btn"
                :class="peripheral.status.enabled ? 'btn-secondary' : 'btn-primary'"
                :disabled="peripheral.status.state === 'disconnected'"
              >
                {{ peripheral.status.enabled ? 'Disable' : 'Enable' }}
              </button>

              <button
                @click="removePeripheral(peripheral)"
                class="btn btn-danger btn-icon"
                :title="featuresStore.userMode === 'consumer' ? 'Remove' : 'Unregister'"
              >
                <span class="material-icons">delete</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.peripherals-view {
  padding: var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--spacing-xl);

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-lg);
  }

  h1 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .subtitle {
    color: var(--text-secondary);
  }

  .stats-summary {
    display: flex;
    gap: var(--spacing-xl);

    .stat {
      text-align: center;

      .value {
        display: block;
        font-size: var(--font-size-2xl);
        font-weight: 700;
        color: var(--primary-green);
      }

      .label {
        display: block;
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        margin-top: var(--spacing-xs);
      }
    }
  }
}

.compatibility-warning,
.power-warning {
  @include card;
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  margin-top: var(--spacing-md);

  .material-icons {
    font-size: 24px;
  }

  ul {
    margin: var(--spacing-xs) 0 0 var(--spacing-lg);
    padding: 0;
  }

  li {
    margin-bottom: var(--spacing-xs);
  }
}

.compatibility-warning {
  background: rgba(255, 193, 7, 0.1);
  border-left: 4px solid var(--status-warning);

  .material-icons {
    color: var(--status-warning);
  }
}

.power-warning {
  background: rgba(255, 152, 0, 0.1);
  border-left: 4px solid var(--status-warning);

  .material-icons {
    color: var(--status-warning);
  }
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  color: var(--text-secondary);

  .material-icons {
    font-size: 64px;
    margin-bottom: var(--spacing-lg);
    opacity: 0.5;

    &.spin {
      animation: spin 1s linear infinite;
    }
  }

  h3 {
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-md);
    color: var(--text-primary);
  }
}

.category-section {
  margin-bottom: var(--spacing-2xl);

  .category-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-sm);
    border-bottom: 2px solid var(--border-color);
  }
}

.peripherals-grid {
  @include auto-grid(320px);
}

.peripheral-card {
  @include card;
  transition: all 0.2s;
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.enabled {
    border: 2px solid var(--primary-green);
  }

  &.active {
    background: linear-gradient(135deg, rgba(44, 95, 45, 0.05) 0%, transparent 100%);
  }

  &.error {
    border-left: 4px solid var(--status-error);
  }

  h3 {
    font-size: var(--font-size-lg);
    margin-bottom: var(--spacing-xs);
    color: var(--text-primary);
  }

  .type {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-md);
  }
}

.peripheral-header {
  @include flex-between;
  margin-bottom: var(--spacing-md);

  .icon {
    font-size: 32px;
  }

  .badges {
    display: flex;
    gap: var(--spacing-xs);
  }

  .badge {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 12px;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: white;
    text-transform: capitalize;
  }
}

.status-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);

  .material-icons {
    font-size: 18px;
  }

  &.error {
    background: rgba(220, 53, 69, 0.1);
    color: var(--status-error);
  }

  &.warning {
    background: rgba(255, 193, 7, 0.1);
    color: var(--status-warning);
  }
}

.stats {
  margin-bottom: var(--spacing-lg);

  .stat-row {
    @include flex-between;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--border-color);
    font-size: var(--font-size-sm);

    .label {
      color: var(--text-secondary);
    }

    .value {
      font-weight: 600;
      color: var(--text-primary);
    }
  }
}

.telemetry {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: rgba(44, 95, 45, 0.05);
  border-radius: 4px;

  h4 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
  }

  .telemetry-data {
    display: grid;
    gap: var(--spacing-xs);
  }

  .telemetry-item {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-xs);

    .key {
      color: var(--text-secondary);
      text-transform: capitalize;
    }

    .value {
      font-weight: 600;
      color: var(--primary-green);
    }
  }
}

.actions {
  display: flex;
  gap: var(--spacing-sm);

  .btn {
    flex: 1;
  }

  .btn-icon {
    flex: 0;
    padding: var(--spacing-sm);
    min-width: auto;

    .material-icons {
      font-size: 20px;
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
</style>
