<template>
  <q-card flat bordered class="performance-chart">
    <q-card-section class="performance-chart__header">
      <div class="row items-center justify-between">
        <div>
          <h3 class="performance-chart__title">Performance Metrics</h3>
          <p class="performance-chart__subtitle">System efficiency over time</p>
        </div>

        <div class="performance-chart__controls">
          <q-btn-toggle
            v-model="selectedMetric"
            toggle-color="primary"
            :options="metricOptions"
            dense
            class="performance-chart__metric-toggle"
          />

          <q-btn-toggle
            v-model="selectedPeriod"
            toggle-color="primary"
            :options="periodOptions"
            dense
            class="performance-chart__period-toggle q-ml-sm"
            @update:model-value="$emit('period-change', $event)"
          />
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <!-- Chart Container -->
    <q-card-section class="performance-chart__content">
      <div v-if="!data || data.length === 0" class="performance-chart__empty">
        <q-icon name="analytics" size="48px" class="text-grey-4" />
        <div class="text-grey-6 q-mt-md">
          {{ loading ? 'Loading chart data...' : 'No performance data available' }}
        </div>
      </div>

      <div v-else class="performance-chart__chart-container">
        <!-- Chart placeholder - would integrate with Chart.js or similar -->
        <div class="performance-chart__chart">
          <canvas ref="chartCanvas" class="performance-chart__canvas" />
        </div>

        <!-- Chart Legend -->
        <div class="performance-chart__legend">
          <div
            v-for="series in chartSeries"
            :key="series.id"
            class="performance-chart__legend-item"
          >
            <div
              class="performance-chart__legend-color"
              :style="{ backgroundColor: series.color }"
            />
            <span class="performance-chart__legend-label">
              {{ series.label }}
            </span>
            <span class="performance-chart__legend-value">
              {{ formatValue(series.currentValue, series.unit) }}
            </span>
          </div>
        </div>
      </div>
    </q-card-section>

    <!-- Stats Summary -->
    <q-separator v-if="data && data.length > 0" />
    <q-card-section v-if="data && data.length > 0" class="performance-chart__stats">
      <div class="performance-stats">
        <div class="performance-stat">
          <div class="performance-stat__label">Average</div>
          <div class="performance-stat__value">
            {{ formatValue(averageValue, currentMetricUnit) }}
          </div>
          <div class="performance-stat__trend">
            <q-icon :name="averageTrend.icon" :color="averageTrend.color" size="16px" />
            <span class="performance-stat__trend-text">
              {{ averageTrend.text }}
            </span>
          </div>
        </div>

        <div class="performance-stat">
          <div class="performance-stat__label">Peak</div>
          <div class="performance-stat__value">
            {{ formatValue(peakValue, currentMetricUnit) }}
          </div>
          <div class="performance-stat__time">
            {{ formatTime(peakTime) }}
          </div>
        </div>

        <div class="performance-stat">
          <div class="performance-stat__label">Current</div>
          <div class="performance-stat__value">
            {{ formatValue(currentValue, currentMetricUnit) }}
          </div>
          <div class="performance-stat__status">
            <q-chip :color="currentStatus.color" text-color="white" size="sm" dense>
              {{ currentStatus.text }}
            </q-chip>
          </div>
        </div>
      </div>
    </q-card-section>

    <!-- Loading overlay -->
    <q-inner-loading :showing="loading" color="primary" />
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

// Types
interface DataPoint {
  timestamp: string
  value: number
  metadata?: Record<string, any>
}

interface ChartSeries {
  id: string
  label: string
  color: string
  unit: string
  currentValue: number
}

interface Props {
  data?: DataPoint[]
  period: '1h' | '24h' | '7d' | '30d'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  loading: false
})

// Emits
defineEmits<{
  'period-change': [period: '1h' | '24h' | '7d' | '30d']
  'metric-change': [metric: string]
}>()

// Local state
const chartCanvas = ref<HTMLCanvasElement | null>(null)
const selectedMetric = ref('efficiency')
const selectedPeriod = ref(props.period)

// Chart options
const metricOptions = [
  { label: 'Efficiency', value: 'efficiency' },
  { label: 'Uptime', value: 'uptime' },
  { label: 'Tasks/Hour', value: 'throughput' },
  { label: 'Energy', value: 'energy' }
]

const periodOptions = [
  { label: '1H', value: '1h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' }
]

// Computed properties
const chartSeries = computed((): ChartSeries[] => {
  switch (selectedMetric.value) {
    case 'efficiency':
      return [
        { id: 'efficiency', label: 'Efficiency', color: '#1976d2', unit: '%', currentValue: 87.5 }
      ]
    case 'uptime':
      return [{ id: 'uptime', label: 'Uptime', color: '#388e3c', unit: '%', currentValue: 96.2 }]
    case 'throughput':
      return [
        {
          id: 'throughput',
          label: 'Tasks/Hour',
          color: '#f57c00',
          unit: 'tasks',
          currentValue: 12.3
        }
      ]
    case 'energy':
      return [
        { id: 'energy', label: 'Energy Usage', color: '#7b1fa2', unit: 'kWh', currentValue: 2.8 }
      ]
    default:
      return []
  }
})

const currentMetricUnit = computed(() => {
  const series = chartSeries.value[0]
  return series ? series.unit : ''
})

const averageValue = computed(() => {
  if (!props.data || props.data.length === 0) return 0

  const sum = props.data.reduce((acc, point) => acc + point.value, 0)
  return sum / props.data.length
})

const peakValue = computed(() => {
  if (!props.data || props.data.length === 0) return 0

  return Math.max(...props.data.map(point => point.value))
})

const peakTime = computed(() => {
  if (!props.data || props.data.length === 0) return ''

  const peakPoint = props.data.find(point => point.value === peakValue.value)
  return peakPoint ? peakPoint.timestamp : ''
})

const currentValue = computed(() => {
  if (!props.data || props.data.length === 0) return 0

  const latest = props.data[props.data.length - 1]
  return latest ? latest.value : 0
})

const averageTrend = computed(() => {
  const current = currentValue.value
  const average = averageValue.value
  const diff = ((current - average) / average) * 100

  if (Math.abs(diff) < 2) {
    return { icon: 'trending_flat', color: 'grey', text: 'Stable' }
  } else if (diff > 0) {
    return { icon: 'trending_up', color: 'positive', text: `+${diff.toFixed(1)}%` }
  } else {
    return { icon: 'trending_down', color: 'negative', text: `${diff.toFixed(1)}%` }
  }
})

const currentStatus = computed(() => {
  const value = currentValue.value
  const average = averageValue.value

  if (value > average * 1.1) {
    return { color: 'positive', text: 'Excellent' }
  } else if (value > average * 0.9) {
    return { color: 'info', text: 'Good' }
  } else if (value > average * 0.7) {
    return { color: 'warning', text: 'Fair' }
  } else {
    return { color: 'negative', text: 'Poor' }
  }
})

// Watch for data changes to update chart
watch(
  () => [props.data, selectedMetric.value],
  () => {
    updateChart()
  },
  { deep: true }
)

// Lifecycle
onMounted(() => {
  updateChart()
})

onUnmounted(() => {
  // Cleanup chart instance if using Chart.js
})

// Methods
const formatValue = (value: number, unit: string) => {
  if (unit === '%') {
    return `${value.toFixed(1)}%`
  } else if (unit === 'kWh') {
    return `${value.toFixed(2)} kWh`
  } else if (unit === 'tasks') {
    return `${value.toFixed(1)} tasks`
  } else {
    return value.toFixed(1)
  }
}

const formatTime = (timestamp: string) => {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const updateChart = () => {
  if (!chartCanvas.value || !props.data || props.data.length === 0) {
    return
  }

  // This is where you would integrate with Chart.js or another charting library
  // For now, we'll create a simple mock chart
  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  const { width, height } = chartCanvas.value

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Draw simple line chart
  const padding = 40
  const chartWidth = width - 2 * padding
  const chartHeight = height - 2 * padding

  if (props.data.length > 1) {
    const maxValue = Math.max(...props.data.map(d => d.value))
    const minValue = Math.min(...props.data.map(d => d.value))
    const valueRange = maxValue - minValue || 1

    ctx.strokeStyle = chartSeries.value[0]?.color || '#1976d2'
    ctx.lineWidth = 2
    ctx.beginPath()

    props.data.forEach((point, index) => {
      const x = padding + (index / (props.data!.length - 1)) * chartWidth
      const y = padding + ((maxValue - point.value) / valueRange) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()
  }
}
</script>

<style lang="scss" scoped>
.performance-chart {
  border-radius: 12px;
}

.performance-chart__header {
  padding: 20px 24px 16px;
}

.performance-chart__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.performance-chart__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-7);
  margin: 0;
}

.performance-chart__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.performance-chart__metric-toggle,
.performance-chart__period-toggle {
  :deep(.q-btn) {
    font-size: 0.75rem;
    padding: 4px 8px;
  }
}

.performance-chart__content {
  padding: 24px;
  min-height: 300px;
}

.performance-chart__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  text-align: center;
}

.performance-chart__chart-container {
  height: 100%;
}

.performance-chart__chart {
  height: 250px;
  margin-bottom: 20px;
  position: relative;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.performance-chart__canvas {
  width: 100%;
  height: 100%;
  border-radius: 8px;
}

.performance-chart__legend {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
}

.performance-chart__legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}

.performance-chart__legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.performance-chart__legend-label {
  color: var(--q-grey-7);
}

.performance-chart__legend-value {
  font-weight: 600;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.performance-chart__stats {
  padding: 16px 24px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.performance-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 20px;
}

.performance-stat {
  text-align: center;
}

.performance-stat__label {
  font-size: 0.75rem;
  color: var(--q-grey-6);
  font-weight: 500;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.performance-stat__value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--q-dark);
  margin-bottom: 4px;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.performance-stat__trend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 0.75rem;
}

.performance-stat__trend-text {
  font-weight: 600;
}

.performance-stat__time {
  font-size: 0.7rem;
  color: var(--q-grey-5);
}

.performance-stat__status {
  display: flex;
  justify-content: center;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .performance-chart__header {
    padding: 16px 20px 12px;

    .row {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .performance-chart__controls {
      justify-content: center;
    }
  }

  .performance-chart__content {
    padding: 20px;
  }

  .performance-chart__stats {
    padding: 12px 20px;
  }

  .performance-stats {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 599px) {
  .performance-chart__header {
    padding: 12px 16px;
  }

  .performance-chart__content {
    padding: 16px;
  }

  .performance-chart__chart {
    height: 200px;
  }

  .performance-chart__stats {
    padding: 12px 16px;
  }

  .performance-stats {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .performance-chart__controls {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .performance-chart__legend {
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
}
</style>
