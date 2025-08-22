<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">
        <q-icon name="mdi-chart-line" class="q-mr-sm" />
        Statistics
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section v-if="!isActive">
      <div class="text-center q-py-lg text-grey-6">
        <q-icon name="mdi-chart-box-outline" size="64px" color="grey-4" />
        <div class="q-mt-md">No active RTCM connection</div>
      </div>
    </q-card-section>

    <q-card-section v-else>
      <div class="row q-col-gutter-md">
        <!-- Message Statistics -->
        <div class="col-12 col-md-6 col-lg-3">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-caption text-grey-7">Messages Received</div>
              <div class="text-h4 text-primary">
                {{ formattedStatistics?.messagesReceived.toLocaleString() || '0' }}
              </div>
              <div class="text-caption text-grey-6 q-mt-xs">
                <q-icon name="mdi-arrow-down" size="xs" />
                {{ formattedStatistics?.formattedDataRate || '0 B/s' }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-caption text-grey-7">Messages Sent</div>
              <div class="text-h4 text-info">
                {{ formattedStatistics?.messagesSent?.toLocaleString() || '0' }}
              </div>
              <div class="text-caption text-grey-6 q-mt-xs">
                <q-icon name="mdi-arrow-up" size="xs" />
                {{ formatBytes(formattedStatistics?.bytesSent || 0) }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-caption text-grey-7">CRC Errors</div>
              <div class="text-h4" :class="errorCountClass">
                {{ formattedStatistics?.crcErrors || 0 }}
              </div>
              <div class="text-caption text-grey-6 q-mt-xs">
                Error rate: {{ errorRate }}%
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-caption text-grey-7">Connection Time</div>
              <div class="text-h4 text-positive">
                {{ formattedStatistics?.formattedUptime || '0s' }}
              </div>
              <div class="text-caption text-grey-6 q-mt-xs">
                Quality: 
                <q-chip 
                  :color="qualityColor" 
                  text-color="white" 
                  size="sm"
                  dense
                >
                  {{ connectionQuality }}
                </q-chip>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Data Volume Chart -->
        <div class="col-12 col-lg-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Data Volume</div>
              <canvas ref="dataVolumeChart" height="200"></canvas>
            </q-card-section>
          </q-card>
        </div>

        <!-- Message Types Distribution -->
        <div class="col-12 col-lg-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Message Types</div>
              <div v-if="messageTypesArray.length === 0" class="text-center q-py-lg text-grey-6">
                No messages received yet
              </div>
              <q-list v-else dense separator>
                <q-item v-for="msgType in messageTypesArray" :key="msgType.type">
                  <q-item-section>
                    <q-item-label>
                      RTCM {{ msgType.type }}
                      <q-tooltip>{{ getMessageDescription(msgType.type) }}</q-tooltip>
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption>
                      {{ msgType.count.toLocaleString() }} ({{ msgType.percentage }}%)
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRTCM } from '../../composables/useRTCM'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const { 
  isActive, 
  formattedStatistics, 
  connectionQuality 
} = useRTCM()

const dataVolumeChart = ref<HTMLCanvasElement>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chartInstance: any = null

const errorRate = computed(() => {
  const stats = formattedStatistics.value
  if (!stats || stats.messagesReceived === 0) return '0.00'
  return ((stats.crcErrors / stats.messagesReceived) * 100).toFixed(2)
})

const errorCountClass = computed(() => {
  const rate = parseFloat(errorRate.value)
  if (rate > 5) return 'text-negative'
  if (rate > 1) return 'text-warning'
  return 'text-positive'
})

const qualityColor = computed(() => {
  switch (connectionQuality.value) {
    case 'good': return 'positive'
    case 'fair': return 'warning'
    case 'poor': return 'negative'
    case 'no-data': return 'grey'
    default: return 'grey'
  }
})

const messageTypesArray = computed(() => {
  const types = formattedStatistics.value?.messageTypes || {}
  const total = Object.values(types).reduce((sum, count) => sum + count, 0)
  
  return Object.entries(types)
    .map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10 message types
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getMessageDescription(type: string): string {
  const descriptions: Record<string, string> = {
    '1001': 'L1-only GPS RTK observables',
    '1002': 'Extended L1-only GPS RTK observables',
    '1003': 'L1/L2 GPS RTK observables',
    '1004': 'Extended L1/L2 GPS RTK observables',
    '1005': 'Stationary RTK reference station ARP',
    '1006': 'Stationary RTK reference station ARP with height',
    '1007': 'Antenna descriptor',
    '1008': 'Antenna descriptor & serial number',
    '1009': 'L1-only GLONASS RTK observables',
    '1010': 'Extended L1-only GLONASS RTK observables',
    '1011': 'L1/L2 GLONASS RTK observables',
    '1012': 'Extended L1/L2 GLONASS RTK observables',
    '1019': 'GPS ephemerides',
    '1020': 'GLONASS ephemerides',
    '1033': 'Receiver and antenna descriptors',
    '1074': 'GPS MSM4',
    '1077': 'GPS MSM7',
    '1084': 'GLONASS MSM4',
    '1087': 'GLONASS MSM7',
    '1094': 'Galileo MSM4',
    '1097': 'Galileo MSM7',
    '1124': 'BeiDou MSM4',
    '1127': 'BeiDou MSM7',
    '1230': 'GLONASS code-phase biases',
    '4072': 'Reference station PVT (u-blox proprietary)'
  }
  
  return descriptions[type] || 'Unknown message type'
}

function initializeChart() {
  if (!dataVolumeChart.value) return

  const ctx = dataVolumeChart.value.getContext('2d')
  if (!ctx) return

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Received (KB/s)',
          data: [],
          borderColor: 'rgb(33, 150, 243)',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4
        },
        {
          label: 'Sent (KB/s)',
          data: [],
          borderColor: 'rgb(76, 175, 80)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'KB/s'
          }
        }
      }
    }
  })
}

function updateChart() {
  if (!chartInstance || !formattedStatistics.value) return

  const dataRate = (formattedStatistics.value.dataRate || 0) / 1024 // Convert to KB/s
  const timestamp = new Date().toLocaleTimeString()

  // Add new data point
  chartInstance.data.labels?.push(timestamp)
  chartInstance.data.datasets[0].data.push(dataRate)
  chartInstance.data.datasets[1].data.push(0) // TODO: Calculate send rate

  // Keep only last 20 data points
  if (chartInstance.data.labels && chartInstance.data.labels.length > 20) {
    chartInstance.data.labels.shift()
    chartInstance.data.datasets.forEach((dataset: { data: unknown[] }) => {
      if (Array.isArray(dataset.data)) {
        dataset.data.shift()
      }
    })
  }

  chartInstance.update('none')
}

let updateInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  initializeChart()
  
  // Update chart every second when active
  updateInterval = setInterval(() => {
    if (isActive.value) {
      updateChart()
    }
  }, 1000)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
  if (chartInstance) {
    chartInstance.destroy()
  }
})

// Reinitialize chart when becoming active
watch(isActive, (active) => {
  if (active && chartInstance) {
    // Clear old data when reconnecting
    chartInstance.data.labels = []
    chartInstance.data.datasets.forEach((dataset: { data: unknown[] }) => {
      dataset.data = []
    })
    chartInstance.update('none')
  }
})
</script>