<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'

interface TelemetryMetric {
  label: string
  value: number
  max: number
  unit: string
  color: string
}

const metrics = ref<TelemetryMetric[]>([
  { label: 'CPU Usage', value: 45, max: 100, unit: '%', color: 'var(--status-info)' },
  { label: 'Memory', value: 1240, max: 2048, unit: 'MB', color: 'var(--status-success)' },
  { label: 'Temperature', value: 52, max: 85, unit: '°C', color: 'var(--status-warning)' }
])

// Auto-refresh telemetry data
const { formattedLastUpdated, autoRefreshEnabled, refresh } = useAutoRefresh({
  interval: 5000,
  onRefresh: async () => {
    // Simulate fetching new telemetry data
    metrics.value = metrics.value.map(m => ({
      ...m,
      value: Math.max(0, Math.min(m.max, m.value + (Math.random() - 0.5) * 10))
    }))
  }
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
