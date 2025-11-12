<template>
  <div class="task-analytics">
    <!-- Header -->
    <div class="task-analytics__header">
      <div class="task-analytics__title">
        <h3>Task Analytics</h3>
        <div class="text-caption text-grey-6">Performance insights and task statistics</div>
      </div>

      <div class="task-analytics__actions">
        <q-btn color="primary" icon="refresh" label="Refresh" outline @click="$emit('refresh')" />

        <q-btn
          color="secondary"
          icon="download"
          label="Export"
          outline
          @click="$emit('export-data')"
        />
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="task-analytics__metrics">
      <div class="row q-gutter-md">
        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-analytics__metric-card">
            <q-card-section>
              <div class="task-analytics__metric">
                <div class="task-analytics__metric-icon">
                  <q-icon name="check_circle" color="positive" size="32px" />
                </div>
                <div class="task-analytics__metric-content">
                  <div class="task-analytics__metric-value">
                    {{ analyticsData.completionRate }}%
                  </div>
                  <div class="task-analytics__metric-label">Completion Rate</div>
                  <div class="task-analytics__metric-trend positive">
                    <q-icon name="trending_up" size="16px" />
                    +2.3% from last week
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-analytics__metric-card">
            <q-card-section>
              <div class="task-analytics__metric">
                <div class="task-analytics__metric-icon">
                  <q-icon name="schedule" color="primary" size="32px" />
                </div>
                <div class="task-analytics__metric-content">
                  <div class="task-analytics__metric-value">
                    {{ analyticsData.averageDuration }}min
                  </div>
                  <div class="task-analytics__metric-label">Avg Duration</div>
                  <div class="task-analytics__metric-trend neutral">
                    <q-icon name="trending_flat" size="16px" />
                    -0.5% from last week
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-analytics__metric-card">
            <q-card-section>
              <div class="task-analytics__metric">
                <div class="task-analytics__metric-icon">
                  <q-icon name="speed" color="info" size="32px" />
                </div>
                <div class="task-analytics__metric-content">
                  <div class="task-analytics__metric-value">
                    {{ analyticsData.performanceMetrics.efficiency }}%
                  </div>
                  <div class="task-analytics__metric-label">Efficiency</div>
                  <div class="task-analytics__metric-trend positive">
                    <q-icon name="trending_up" size="16px" />
                    +5.2% from last week
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="task-analytics__metric-card">
            <q-card-section>
              <div class="task-analytics__metric">
                <div class="task-analytics__metric-icon">
                  <q-icon name="verified" color="warning" size="32px" />
                </div>
                <div class="task-analytics__metric-content">
                  <div class="task-analytics__metric-value">
                    {{ analyticsData.performanceMetrics.reliability }}%
                  </div>
                  <div class="task-analytics__metric-label">Reliability</div>
                  <div class="task-analytics__metric-trend positive">
                    <q-icon name="trending_up" size="16px" />
                    +1.8% from last week
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="task-analytics__charts">
      <div class="row q-gutter-md">
        <!-- Efficiency Trend Chart -->
        <div class="col-12 col-lg-8">
          <q-card>
            <q-card-section>
              <div class="task-analytics__chart-header">
                <div class="text-h6">Efficiency Trend</div>
                <div class="text-caption text-grey-6">Task completion efficiency over time</div>
              </div>

              <div class="task-analytics__chart-container">
                <canvas ref="efficiencyChart" class="task-analytics__chart"></canvas>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Task Distribution -->
        <div class="col-12 col-lg-4">
          <q-card>
            <q-card-section>
              <div class="task-analytics__chart-header">
                <div class="text-h6">Task Distribution</div>
                <div class="text-caption text-grey-6">Tasks by type</div>
              </div>

              <div class="task-analytics__distribution">
                <div
                  v-for="(count, type) in analyticsData.tasksByType"
                  :key="type"
                  class="task-analytics__distribution-item"
                >
                  <div class="task-analytics__distribution-info">
                    <q-icon
                      :name="getTaskTypeIcon(type)"
                      :color="getTaskTypeColor(type)"
                      size="20px"
                    />
                    <span class="task-analytics__distribution-label">
                      {{ formatTaskType(type) }}
                    </span>
                  </div>
                  <div class="task-analytics__distribution-value">
                    {{ count }}
                  </div>
                </div>

                <div class="task-analytics__distribution-chart">
                  <canvas ref="distributionChart" class="task-analytics__doughnut-chart"></canvas>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Performance Breakdown -->
    <div class="task-analytics__performance">
      <q-card>
        <q-card-section>
          <div class="text-h6 q-mb-md">Performance Breakdown</div>

          <div class="row q-gutter-lg">
            <div class="col-12 col-md-6">
              <div class="task-analytics__performance-section">
                <div class="text-subtitle2 q-mb-sm">Task Success Rates</div>

                <div class="task-analytics__performance-list">
                  <div class="task-analytics__performance-item">
                    <div class="task-analytics__performance-label">
                      <q-icon name="grass" color="green-6" />
                      Mowing Tasks
                    </div>
                    <div class="task-analytics__performance-bar">
                      <q-linear-progress :value="0.96" color="positive" size="8px" />
                      <span class="task-analytics__performance-percentage">96%</span>
                    </div>
                  </div>

                  <div class="task-analytics__performance-item">
                    <div class="task-analytics__performance-label">
                      <q-icon name="content_cut" color="orange-6" />
                      Trimming Tasks
                    </div>
                    <div class="task-analytics__performance-bar">
                      <q-linear-progress :value="0.92" color="warning" size="8px" />
                      <span class="task-analytics__performance-percentage">92%</span>
                    </div>
                  </div>

                  <div class="task-analytics__performance-item">
                    <div class="task-analytics__performance-label">
                      <q-icon name="build" color="blue-6" />
                      Maintenance Tasks
                    </div>
                    <div class="task-analytics__performance-bar">
                      <q-linear-progress :value="0.98" color="info" size="8px" />
                      <span class="task-analytics__performance-percentage">98%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-12 col-md-6">
              <div class="task-analytics__performance-section">
                <div class="text-subtitle2 q-mb-sm">Average Completion Times</div>

                <div class="task-analytics__time-stats">
                  <div class="task-analytics__time-stat">
                    <div class="task-analytics__time-value">38min</div>
                    <div class="task-analytics__time-label">Mowing</div>
                  </div>

                  <div class="task-analytics__time-stat">
                    <div class="task-analytics__time-value">22min</div>
                    <div class="task-analytics__time-label">Trimming</div>
                  </div>

                  <div class="task-analytics__time-stat">
                    <div class="task-analytics__time-value">15min</div>
                    <div class="task-analytics__time-label">Maintenance</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Recent Activity -->
    <div class="task-analytics__activity">
      <q-card>
        <q-card-section>
          <div class="text-h6 q-mb-md">Recent Task Activity</div>

          <q-timeline color="primary">
            <q-timeline-entry
              v-for="activity in recentActivity"
              :key="activity.id"
              :title="activity.title"
              :subtitle="activity.subtitle"
              :icon="activity.icon"
              :color="activity.color"
            >
              <div class="text-body2">
                {{ activity.description }}
              </div>
              <div class="text-caption text-grey-6 q-mt-sm">
                {{ formatRelativeTime(activity.timestamp) }}
              </div>
            </q-timeline-entry>
          </q-timeline>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

// Props
interface AnalyticsData {
  completionRate: number
  averageDuration: number
  efficiencyTrend: number[]
  tasksByType: Record<string, number>
  performanceMetrics: Record<string, number>
}

const props = defineProps<{
  analyticsData: AnalyticsData
}>()

// Emits
const emit = defineEmits<{
  'export-data': []
  refresh: []
}>()

// Refs
const efficiencyChart = ref<HTMLCanvasElement>()
const distributionChart = ref<HTMLCanvasElement>()

// Mock recent activity data
const recentActivity = ref([
  {
    id: '1',
    title: 'Front Lawn Mowing Completed',
    subtitle: 'Machine: Mower-01',
    description: 'Successfully completed mowing task in 42 minutes with 98% coverage',
    icon: 'check_circle',
    color: 'positive',
    timestamp: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
  },
  {
    id: '2',
    title: 'Edge Trimming Started',
    subtitle: 'Machine: Trimmer-02',
    description: 'Automated trimming task started on perimeter zones',
    icon: 'play_circle',
    color: 'primary',
    timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  },
  {
    id: '3',
    title: 'Maintenance Check Failed',
    subtitle: 'Machine: Mower-03',
    description: 'Blade cleaning task failed - requires manual intervention',
    icon: 'error',
    color: 'negative',
    timestamp: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
  },
  {
    id: '4',
    title: 'Weekly Schedule Triggered',
    subtitle: 'Template: Standard Mowing',
    description: 'Automated weekly mowing schedule created 3 new tasks',
    icon: 'schedule',
    color: 'info',
    timestamp: new Date(Date.now() - 10800000).toISOString() // 3 hours ago
  }
])

// Methods
const getTaskTypeIcon = (type: string) => {
  switch (type) {
    case 'mowing':
      return 'grass'
    case 'trimming':
      return 'content_cut'
    case 'maintenance':
      return 'build'
    default:
      return 'assignment'
  }
}

const getTaskTypeColor = (type: string) => {
  switch (type) {
    case 'mowing':
      return 'green-6'
    case 'trimming':
      return 'orange-6'
    case 'maintenance':
      return 'blue-6'
    default:
      return 'grey-6'
  }
}

const formatTaskType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const formatRelativeTime = (timestamp: string) => {
  const now = new Date()
  const time = new Date(timestamp)
  const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) {
    return 'just now'
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60)
    return `${hours}h ago`
  } else {
    const days = Math.floor(diffInMinutes / 1440)
    return `${days}d ago`
  }
}

const initializeCharts = async () => {
  await nextTick()

  // Initialize efficiency trend chart
  if (efficiencyChart.value) {
    const ctx = efficiencyChart.value.getContext('2d')
    if (ctx) {
      // Placeholder for Chart.js implementation
      // Chart will be implemented when Chart.js is available
      drawPlaceholderChart(ctx, 'line')
    }
  }

  // Initialize distribution chart
  if (distributionChart.value) {
    const ctx = distributionChart.value.getContext('2d')
    if (ctx) {
      // Placeholder for Chart.js implementation
      drawPlaceholderChart(ctx, 'doughnut')
    }
  }
}

const drawPlaceholderChart = (ctx: CanvasRenderingContext2D, type: string) => {
  const canvas = ctx.canvas
  const width = canvas.width
  const height = canvas.height

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Set styles
  ctx.fillStyle = '#e0e0e0'
  ctx.strokeStyle = '#9e9e9e'
  ctx.lineWidth = 2
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (type === 'line') {
    // Draw line chart placeholder
    const points = props.analyticsData.efficiencyTrend.length
    const stepX = width / (points - 1)
    const maxValue = Math.max(...props.analyticsData.efficiencyTrend)
    const minValue = Math.min(...props.analyticsData.efficiencyTrend)
    const range = maxValue - minValue

    ctx.beginPath()
    props.analyticsData.efficiencyTrend.forEach((value, index) => {
      const x = index * stepX
      const y = height - ((value - minValue) / range) * height

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()
  } else if (type === 'doughnut') {
    // Draw doughnut chart placeholder
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 3
    const innerRadius = radius * 0.6

    const total = Object.values(props.analyticsData.tasksByType).reduce(
      (sum, count) => sum + count,
      0
    )
    let currentAngle = 0

    const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0']
    let colorIndex = 0

    Object.entries(props.analyticsData.tasksByType).forEach(([type, count]) => {
      const sliceAngle = (count / total) * 2 * Math.PI

      ctx.fillStyle = colors[colorIndex % colors.length]
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true)
      ctx.closePath()
      ctx.fill()

      currentAngle += sliceAngle
      colorIndex++
    })
  }

  // Add placeholder text
  ctx.fillStyle = '#666'
  ctx.fillText('Chart placeholder', width / 2, height / 2)
}

// Lifecycle
onMounted(() => {
  initializeCharts()
})
</script>

<style lang="scss" scoped>
.task-analytics {
  min-height: 400px;
}

.task-analytics__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: white;
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-dark);
    border-bottom-color: var(--q-grey-8);
  }
}

.task-analytics__title {
  h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--q-dark);

    .body--dark & {
      color: var(--q-dark-page-text);
    }
  }
}

.task-analytics__actions {
  display: flex;
  gap: 8px;
}

.task-analytics__metrics {
  padding: 24px;
  background: var(--q-grey-1);

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.task-analytics__metric-card {
  height: 100%;
}

.task-analytics__metric {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.task-analytics__metric-icon {
  flex-shrink: 0;
}

.task-analytics__metric-content {
  flex: 1;
}

.task-analytics__metric-value {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.task-analytics__metric-label {
  font-size: 0.875rem;
  color: var(--q-grey-6);
  margin-top: 4px;
}

.task-analytics__metric-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  margin-top: 8px;

  &.positive {
    color: var(--q-positive);
  }

  &.negative {
    color: var(--q-negative);
  }

  &.neutral {
    color: var(--q-grey-6);
  }
}

.task-analytics__charts {
  padding: 24px;
}

.task-analytics__chart-header {
  margin-bottom: 16px;
}

.task-analytics__chart-container {
  height: 300px;
  position: relative;
}

.task-analytics__chart {
  width: 100%;
  height: 100%;
}

.task-analytics__distribution {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-analytics__distribution-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.task-analytics__distribution-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-analytics__distribution-label {
  font-weight: 500;
}

.task-analytics__distribution-value {
  font-weight: 600;
  color: var(--q-primary);
}

.task-analytics__distribution-chart {
  height: 200px;
  margin-top: 16px;
}

.task-analytics__doughnut-chart {
  width: 100%;
  height: 100%;
}

.task-analytics__performance {
  padding: 24px;
}

.task-analytics__performance-section {
  height: 100%;
}

.task-analytics__performance-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-analytics__performance-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-analytics__performance-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.task-analytics__performance-bar {
  display: flex;
  align-items: center;
  gap: 12px;

  .q-linear-progress {
    flex: 1;
  }
}

.task-analytics__performance-percentage {
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.task-analytics__time-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 16px;
}

.task-analytics__time-stat {
  text-align: center;
  padding: 16px;
  background: var(--q-grey-1);
  border-radius: 8px;

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.task-analytics__time-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--q-primary);
}

.task-analytics__time-label {
  font-size: 0.875rem;
  color: var(--q-grey-6);
  margin-top: 4px;
}

.task-analytics__activity {
  padding: 24px;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .task-analytics__header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .task-analytics__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .task-analytics__metric {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
  }
}

@media (max-width: 599px) {
  .task-analytics__header,
  .task-analytics__metrics,
  .task-analytics__charts,
  .task-analytics__performance,
  .task-analytics__activity {
    padding: 16px;
  }

  .task-analytics__metric-value {
    font-size: 1.5rem;
  }

  .task-analytics__chart-container {
    height: 250px;
  }

  .task-analytics__time-stats {
    grid-template-columns: 1fr;
  }
}
</style>
