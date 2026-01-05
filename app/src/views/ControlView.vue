<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVehicleStore } from '@/stores/vehicle'
import VehicleControlPanel from '@/components/control/VehicleControlPanel.vue'
import FlightModeSelector from '@/components/control/FlightModeSelector.vue'
import Card from '@/components/common/Card.vue'
import type { FlightMode } from '@/stores/vehicle'

const vehicleStore = useVehicleStore()

const commandHistory = computed(() => vehicleStore.commandHistory.slice().reverse())
const isPending = computed(() => vehicleStore.isPendingCommand)

// Simulate telemetry updates
let telemetryInterval: number | null = null

onMounted(() => {
  // Simulate periodic telemetry updates
  telemetryInterval = window.setInterval(() => {
    // Simulate GPS data
    vehicleStore.updateVehicleState({
      gpsLock: true,
      satellites: 12,
      latitude: 40.7128 + (Math.random() - 0.5) * 0.001,
      longitude: -74.006 + (Math.random() - 0.5) * 0.001,
      altitude: 15 + (Math.random() - 0.5) * 2,
      batteryVoltage: 16.8 - Math.random() * 0.5,
      batteryPercent: 87 - Math.floor(Math.random() * 5),
      heading: (vehicleStore.vehicleState.heading + Math.random() * 5) % 360,
      speed: Math.random() * 2,
    })
  }, 2000)
})

onUnmounted(() => {
  if (telemetryInterval) {
    clearInterval(telemetryInterval)
  }
})

async function handleModeChange(mode: FlightMode) {
  const success = await vehicleStore.setMode(mode)
  if (!success) {
    alert('Failed to change flight mode. Check command history for details.')
  }
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString()
}

function clearHistory() {
  if (confirm('Clear all command history?')) {
    vehicleStore.clearCommandHistory()
  }
}
</script>

<template>
  <div class="control-view">
    <div class="view-header">
      <div class="header-content">
        <h1 class="view-title">Machine Control</h1>
        <p class="view-description">Direct control and flight mode management for YardRover</p>
      </div>
    </div>

    <div class="control-grid">
      <!-- Left Column: Vehicle Status & Quick Actions -->
      <div class="control-column">
        <VehicleControlPanel />
      </div>

      <!-- Right Column: Flight Mode & Command History -->
      <div class="control-column">
        <!-- Flight Mode Selector -->
        <Card>
          <template #header>
            <div class="section-header">
              <div>
                <div class="card-title">Flight Mode</div>
                <div class="card-subtitle">Select vehicle operating mode</div>
              </div>
            </div>
          </template>

          <FlightModeSelector
            :current-mode="vehicleStore.vehicleState.mode"
            :disabled="isPending"
            @change="handleModeChange"
          />
        </Card>

        <!-- Command History -->
        <Card>
          <template #header>
            <div class="section-header">
              <div>
                <div class="card-title">Command History</div>
                <div class="card-subtitle">Recent MAVLink commands</div>
              </div>
              <button class="clear-button" @click="clearHistory" :disabled="commandHistory.length === 0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Clear
              </button>
            </div>
          </template>

          <div class="command-history">
            <div v-if="commandHistory.length === 0" class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M2 12h20"></path>
              </svg>
              <p>No commands sent yet</p>
            </div>

            <div v-else class="command-list">
              <div
                v-for="(cmd, index) in commandHistory"
                :key="index"
                class="command-item"
                :class="{ success: cmd.success, error: !cmd.success }"
              >
                <div class="command-status">
                  <svg v-if="cmd.success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </div>
                <div class="command-content">
                  <div class="command-text">{{ cmd.command }}</div>
                  <div class="command-time">{{ formatTimestamp(cmd.timestamp) }}</div>
                  <div v-if="cmd.error" class="command-error">{{ cmd.error }}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.control-view {
  padding: var(--spacing-xl);
  max-width: 1600px;
  margin: 0 auto;
}

.view-header {
  margin-bottom: var(--spacing-xl);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.view-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

.view-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: var(--spacing-xl);
  align-items: start;
}

.control-column {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.section-header {
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

.clear-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: var(--bg-tertiary);
    border-color: var(--primary-green);
    color: var(--text-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.command-history {
  max-height: 500px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  color: var(--text-secondary);

  svg {
    width: 48px;
    height: 48px;
    margin-bottom: var(--spacing-md);
    opacity: 0.3;
  }

  p {
    font-size: var(--font-size-sm);
  }
}

.command-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.command-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--border-color);
  transition: all 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }

  &.success {
    border-left-color: var(--status-success);

    .command-status {
      color: var(--status-success);
    }
  }

  &.error {
    border-left-color: var(--status-error);

    .command-status {
      color: var(--status-error);
    }
  }
}

.command-status {
  svg {
    width: 20px;
    height: 20px;
  }
}

.command-content {
  flex: 1;
  min-width: 0;
}

.command-text {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.command-time {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  font-family: 'Monaco', 'Courier New', monospace;
}

.command-error {
  font-size: var(--font-size-xs);
  color: var(--status-error);
  margin-top: var(--spacing-xs);
}

@media (max-width: 1200px) {
  .control-grid {
    grid-template-columns: 1fr;
  }
}
</style>
