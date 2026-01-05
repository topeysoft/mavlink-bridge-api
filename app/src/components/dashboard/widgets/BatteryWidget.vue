<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBatteryStore } from '@/stores/battery'
import { useConnectionStore } from '@/stores/connection'
import Card from '@/components/common/Card.vue'

const router = useRouter()
const batteryStore = useBatteryStore()
const connectionStore = useConnectionStore()

// Battery visual indicator
const batteryColor = computed(() => {
  const percent = batteryStore.batteryInfo.percent
  if (percent > 60) return '#10b981' // green
  if (percent > 30) return '#f59e0b' // amber
  if (percent > 15) return '#ef4444' // red
  return '#991b1b' // dark red
})

const batteryIcon = computed(() => {
  const percent = batteryStore.batteryInfo.percent
  if (percent > 90) return '🔋'
  if (percent > 60) return '🔋'
  if (percent > 30) return '🪫'
  if (percent > 10) return '🪫'
  return '⚠️'
})

const statusText = computed(() => {
  if (!connectionStore.isConnected) return 'No data'
  const status = batteryStore.batteryInfo.status
  if (status === 'charging') return 'Charging'
  if (status === 'discharging') return 'Discharging'
  if (status === 'full') return 'Full'
  return 'Idle'
})

const temperatureColor = computed(() => {
  const temp = batteryStore.batteryInfo.temperature
  if (temp < 30) return '#3b82f6' // blue (cool)
  if (temp < 40) return '#10b981' // green (normal)
  if (temp < 50) return '#f59e0b' // amber (warm)
  return '#ef4444' // red (hot)
})

const hasAlerts = computed(() => batteryStore.unacknowledgedAlerts.length > 0)

function goToBatteryPage() {
  router.push({ name: 'battery' })
}
</script>

<template>
  <Card class="battery-widget" @click="goToBatteryPage" role="button" tabindex="0">
    <div class="widget-header">
      <h3>Battery Status</h3>
      <div v-if="hasAlerts" class="alert-badge">
        {{ batteryStore.unacknowledgedAlerts.length }}
      </div>
    </div>

    <div class="battery-display">
      <div class="battery-icon">{{ batteryIcon }}</div>
      <div class="battery-percent" :style="{ color: batteryColor }">
        {{ batteryStore.batteryInfo.percent.toFixed(0) }}%
      </div>
    </div>

    <div class="battery-details">
      <div class="detail-row">
        <span class="label">Voltage:</span>
        <span class="value">{{ batteryStore.batteryInfo.voltage.toFixed(1) }}V</span>
      </div>
      <div class="detail-row">
        <span class="label">Current:</span>
        <span class="value">{{ batteryStore.batteryInfo.current.toFixed(2) }}A</span>
      </div>
      <div class="detail-row">
        <span class="label">Temperature:</span>
        <span class="value" :style="{ color: temperatureColor }">
          {{ batteryStore.batteryInfo.temperature.toFixed(1) }}°C
        </span>
      </div>
      <div class="detail-row">
        <span class="label">Status:</span>
        <span class="value status-text">{{ statusText }}</span>
      </div>
    </div>

    <!-- Critical warnings -->
    <div v-if="batteryStore.isCriticalBattery" class="widget-warning critical">
      ⚠️ Critical Battery Level
    </div>
    <div v-else-if="batteryStore.isLowBattery" class="widget-warning low">
      ⚠️ Low Battery
    </div>
    <div v-else-if="batteryStore.isCriticalTemperature" class="widget-warning critical">
      🌡️ Critical Temperature
    </div>
    <div v-else-if="batteryStore.isHighTemperature" class="widget-warning low">
      🌡️ High Temperature
    </div>

    <div class="widget-footer">
      Click for details →
    </div>
  </Card>
</template>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.battery-widget {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:focus-visible {
    outline: 3px solid var(--primary-green);
    outline-offset: 2px;
  }
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1rem 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color);

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.alert-badge {
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.battery-display {
  padding: 1.5rem 1rem;
  text-align: center;
  background: linear-gradient(to bottom, transparent, var(--bg-secondary));
}

.battery-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.battery-percent {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
}

.battery-details {
  padding: 0 1rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;

  .label {
    color: var(--text-secondary);
  }

  .value {
    color: var(--text-primary);
    font-weight: 500;
  }

  .status-text {
    text-transform: capitalize;
  }
}

.widget-warning {
  margin: 0 1rem 0.75rem 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.813rem;
  font-weight: 600;
  text-align: center;

  &.critical {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  &.low {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
}

.widget-footer {
  padding: 0.75rem 1rem;
  text-align: center;
  font-size: 0.813rem;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 0 0 8px 8px;
}
</style>
