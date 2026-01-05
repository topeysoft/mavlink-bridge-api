<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Card from '@/components/common/Card.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { useImuStore } from '@/stores/imu'
import { useCompassStore } from '@/stores/compass'

interface TelemetryMetric {
  label: string
  value: number
  max: number
  unit: string
  color: string
}

const imuStore = useImuStore()
const compassStore = useCompassStore()

// Subscriptions
let imuUnsub: (() => void) | undefined
let compassUnsub: (() => void) | undefined

const metrics = computed<TelemetryMetric[]>(() => {
  const vibrationPercent = Math.round(imuStore.vibrationLevel * 100)
  const vibrationColor = vibrationPercent > 70 ? 'var(--status-danger)' :
                         vibrationPercent > 40 ? 'var(--status-warning)' :
                         'var(--status-success)'

  const tiltColor = imuStore.tiltAngle > 45 ? 'var(--status-danger)' :
                   imuStore.tiltAngle > 30 ? 'var(--status-warning)' :
                   'var(--status-success)'

  return [
    {
      label: 'Vibration',
      value: vibrationPercent,
      max: 100,
      unit: '%',
      color: vibrationColor
    },
    {
      label: 'Tilt Angle',
      value: Math.round(imuStore.tiltAngle),
      max: 90,
      unit: '°',
      color: tiltColor
    },
    {
      label: 'Heading',
      value: Math.round(compassStore.heading),
      max: 360,
      unit: '°',
      color: 'var(--status-info)'
    }
  ]
})

// Auto-refresh telemetry data
const { formattedLastUpdated, autoRefreshEnabled } = useAutoRefresh({
  interval: 5000,
  onRefresh: async () => {
    // Data is updated automatically via WebSocket subscriptions
  }
})

onMounted(() => {
  // Setup subscriptions
  imuUnsub = imuStore.setupSubscription()
  compassUnsub = compassStore.setupSubscription()
})

onUnmounted(() => {
  // Cleanup subscriptions
  if (imuUnsub) imuUnsub()
  if (compassUnsub) compassUnsub()
})
</script>

<template>
  <Card
    title="System Telemetry"
    :last-updated="formattedLastUpdated"
    :auto-refresh="autoRefreshEnabled"
  >
    <div class="telemetry-metrics">
      <div v-for="metric in metrics" :key="metric.label" class="metric">
        <ProgressBar
          :value="metric.value"
          :max="metric.max"
          :label="metric.label"
          :color="metric.color"
        />
        <div class="metric-value">
          {{ metric.value }} {{ metric.unit }} / {{ metric.max }} {{ metric.unit }}
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.telemetry-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.metric {
  .metric-value {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-top: var(--spacing-xs);
  }
}
</style>
