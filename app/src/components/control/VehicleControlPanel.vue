<script setup lang="ts">
import { computed } from 'vue'
import { useVehicleStore } from '@/stores/vehicle'
import { useDialog } from '@/composables/useDialog'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'

const vehicleStore = useVehicleStore()
const dialog = useDialog()

const vehicleState = computed(() => vehicleStore.vehicleState)
const canArm = computed(() => vehicleStore.canArm)
const canDisarm = computed(() => vehicleStore.canDisarm)
const isHealthy = computed(() => vehicleStore.isHealthy)
const isPending = computed(() => vehicleStore.isPendingCommand)

async function handleArm() {
  const confirmed = await dialog.confirm(
    'Are you sure you want to arm the vehicle? The vehicle will be ready to move.',
    '⚠️ ARM VEHICLE',
    { variant: 'warning', icon: '⚠️' }
  )
  if (confirmed) {
    await vehicleStore.arm()
  }
}

async function handleDisarm() {
  const confirmed = await dialog.confirm(
    'Are you sure you want to disarm the vehicle?',
    '⚠️ DISARM VEHICLE',
    { variant: 'warning', icon: '⚠️' }
  )
  if (confirmed) {
    await vehicleStore.disarm()
  }
}

async function handleReturnToLaunch() {
  const confirmed = await dialog.confirm(
    'The vehicle will return to its launch position. Continue?',
    'Return to Launch'
  )
  if (confirmed) {
    await vehicleStore.returnToLaunch()
  }
}

async function handleSetHome() {
  const confirmed = await dialog.confirm(
    'Set the current location as the home position?',
    'Set Home Position'
  )
  if (confirmed) {
    await vehicleStore.setHome()
  }
}

async function handleEmergencyStop() {
  const confirmed = await dialog.confirm(
    'This will immediately stop the vehicle and disarm it. This should only be used in emergencies.\n\nContinue?',
    '🚨 EMERGENCY STOP',
    { variant: 'danger', icon: '🚨', confirmText: 'Emergency Stop' }
  )
  if (confirmed) {
    await vehicleStore.emergencyStop()
  }
}

function formatCoordinate(value: number | null): string {
  if (value === null) return 'N/A'
  return value.toFixed(6)
}

function formatBattery(voltage: number, percent: number): string {
  return `${voltage.toFixed(1)}V (${percent}%)`
}
</script>

<template>
  <div class="vehicle-control-panel">
    <!-- Vehicle Status -->
    <Card>
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">Vehicle Status</div>
            <div class="card-subtitle">Real-time system information</div>
          </div>
          <div
            class="status-indicator"
            :class="{
              healthy: isHealthy,
              warning: !isHealthy && vehicleState.batteryPercent > 10,
              error: vehicleState.batteryPercent <= 10,
            }"
          >
            {{ isHealthy ? 'Healthy' : 'Warning' }}
          </div>
        </div>
      </template>

      <div class="status-grid">
        <div class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <div class="status-content">
            <div class="status-label">Armed</div>
            <div class="status-value" :class="{ armed: vehicleState.armed }">
              {{ vehicleState.armed ? 'ARMED' : 'DISARMED' }}
            </div>
          </div>
        </div>

        <div class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <div class="status-content">
            <div class="status-label">Mode</div>
            <div class="status-value">{{ vehicleState.mode }}</div>
          </div>
        </div>

        <div class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <div class="status-content">
            <div class="status-label">GPS Lock</div>
            <div class="status-value" :class="{ locked: vehicleState.gpsLock }">
              {{ vehicleState.gpsLock ? 'LOCKED' : 'NO LOCK' }} ({{ vehicleState.satellites }} sats)
            </div>
          </div>
        </div>

        <div class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect>
            <line x1="23" y1="13" x2="19" y2="13"></line>
          </svg>
          <div class="status-content">
            <div class="status-label">Battery</div>
            <div
              class="status-value"
              :class="{
                healthy: vehicleState.batteryPercent > 50,
                warning: vehicleState.batteryPercent <= 50 && vehicleState.batteryPercent > 20,
                error: vehicleState.batteryPercent <= 20,
              }"
            >
              {{ formatBattery(vehicleState.batteryVoltage, vehicleState.batteryPercent) }}
            </div>
          </div>
        </div>

        <div class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          <div class="status-content">
            <div class="status-label">Heading</div>
            <div class="status-value">{{ vehicleState.heading.toFixed(1) }}°</div>
          </div>
        </div>

        <div class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
          <div class="status-content">
            <div class="status-label">Speed</div>
            <div class="status-value">{{ vehicleState.speed.toFixed(1) }} m/s</div>
          </div>
        </div>

        <div class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
          </svg>
          <div class="status-content">
            <div class="status-label">Position</div>
            <div class="status-value position">
              {{ formatCoordinate(vehicleState.latitude) }}, {{ formatCoordinate(vehicleState.longitude) }}
            </div>
          </div>
        </div>

        <div class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <div class="status-content">
            <div class="status-label">Altitude</div>
            <div class="status-value">{{ vehicleState.altitude.toFixed(1) }} m</div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Quick Actions -->
    <Card>
      <template #header>
        <div class="card-title">Quick Actions</div>
      </template>

      <div class="actions-grid">
        <Button
          v-if="!vehicleState.armed"
          variant="success"
          :disabled="!canArm || isPending"
          @click="handleArm"
          class="action-button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <div>
            <div class="action-label">Arm</div>
            <div class="action-subtitle">Enable motors</div>
          </div>
        </Button>

        <Button
          v-else
          variant="warning"
          :disabled="!canDisarm || isPending"
          @click="handleDisarm"
          class="action-button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <div>
            <div class="action-label">Disarm</div>
            <div class="action-subtitle">Disable motors</div>
          </div>
        </Button>

        <Button variant="primary" :disabled="isPending" @click="handleReturnToLaunch" class="action-button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <div>
            <div class="action-label">Return to Launch</div>
            <div class="action-subtitle">Navigate home</div>
          </div>
        </Button>

        <Button variant="outline" :disabled="isPending" @click="handleSetHome" class="action-button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <div>
            <div class="action-label">Set Home</div>
            <div class="action-subtitle">Mark position</div>
          </div>
        </Button>

        <Button variant="danger" :disabled="isPending" @click="handleEmergencyStop" class="action-button emergency">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <div>
            <div class="action-label">EMERGENCY STOP</div>
            <div class="action-subtitle">Halt all operations</div>
          </div>
        </Button>
      </div>
    </Card>
  </div>
</template>

<style scoped lang="scss">
.vehicle-control-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: var(--spacing-lg);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.status-indicator {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 600;

  &.healthy {
    background: rgba(16, 185, 129, 0.1);
    color: var(--status-success);
  }

  &.warning {
    background: rgba(245, 158, 11, 0.1);
    color: var(--status-warning);
  }

  &.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--status-error);
  }
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.status-icon {
  width: 24px;
  height: 24px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.status-content {
  flex: 1;
  min-width: 0;
}

.status-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-value {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);

  &.armed {
    color: var(--status-success);
  }

  &.locked {
    color: var(--status-success);
  }

  &.healthy {
    color: var(--status-success);
  }

  &.warning {
    color: var(--status-warning);
  }

  &.error {
    color: var(--status-error);
  }

  &.position {
    font-size: var(--font-size-sm);
    font-family: 'Monaco', 'Courier New', monospace;
  }
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.action-button {
  height: auto;
  padding: var(--spacing-lg);
  justify-content: flex-start;
  gap: var(--spacing-md);

  svg {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }
}

.action-label {
  font-size: var(--font-size-base);
  font-weight: 600;
  text-align: left;
  margin-bottom: 2px;
}

.action-subtitle {
  font-size: var(--font-size-xs);
  opacity: 0.8;
  text-align: left;
}

.emergency {
  grid-column: 1 / -1;

  .action-label {
    font-size: var(--font-size-lg);
  }
}
</style>
