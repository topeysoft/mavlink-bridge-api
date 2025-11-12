<template>
  <q-card class="widget telemetry-widget full-height">
    <q-card-section class="widget-header">
      <div class="text-h6">Live Telemetry</div>
      <q-space />
      <q-btn-toggle
        v-model="selectedChart"
        toggle-color="primary"
        :options="chartOptions"
        dense
        size="sm"
        class="chart-selector"
      />
      <q-btn
        v-if="editMode"
        flat
        round
        dense
        icon="close"
        size="sm"
        @click="$emit('remove', widgetId)"
      />
    </q-card-section>

    <q-separator />

    <q-card-section class="widget-content">
      <div class="chart-container">
        <!-- Battery Chart -->
        <div v-show="selectedChart === 'battery'" class="chart-wrapper">
          <Line
            :data="batteryChartData"
            :options="chartOptions"
            :height="200"
          />
        </div>

        <!-- Speed Chart -->
        <div v-show="selectedChart === 'speed'" class="chart-wrapper">
          <Line :data="speedChartData" :options="chartOptions" :height="200" />
        </div>

        <!-- Altitude Chart -->
        <div v-show="selectedChart === 'altitude'" class="chart-wrapper">
          <Line
            :data="altitudeChartData"
            :options="chartOptions"
            :height="200"
          />
        </div>

        <!-- Signal Chart -->
        <div v-show="selectedChart === 'signal'" class="chart-wrapper">
          <Line :data="signalChartData" :options="chartOptions" :height="200" />
        </div>
      </div>

      <!-- Real-time Values -->
      <div class="telemetry-values q-mt-md">
        <div class="value-item">
          <span class="value-label">Battery:</span>
          <span class="value-data"
            >{{ telemetryStore.battery.voltage.toFixed(1) }}V</span
          >
        </div>
        <div class="value-item">
          <span class="value-label">Speed:</span>
          <span class="value-data"
            >{{ telemetryStore.velocity.ground.toFixed(1) }} m/s</span
          >
        </div>
        <div class="value-item">
          <span class="value-label">Altitude:</span>
          <span class="value-data"
            >{{ telemetryStore.position.relative_alt.toFixed(1) }}m</span
          >
        </div>
        <div class="value-item">
          <span class="value-label">Signal:</span>
          <span class="value-data"
            >{{ healthStore.network.wifi.rssi }} dBm</span
          >
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useTelemetryStore } from '@/stores/telemetry';
import { useHealthStore } from '@/stores/health';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const props = defineProps<{
  widgetId: string;
}>();

defineEmits<{
  remove: [widgetId: string];
}>();

const editMode = inject('dashboardEditMode', false);
const telemetryStore = useTelemetryStore();
const healthStore = useHealthStore();

// Chart selection
const selectedChart = ref('battery');
const chartOptions = [
  { label: 'Battery', value: 'battery' },
  { label: 'Speed', value: 'speed' },
  { label: 'Altitude', value: 'altitude' },
  { label: 'Signal', value: 'signal' },
];

// Historical data storage (last 50 points)
const batteryHistory = ref<number[]>([]);
const speedHistory = ref<number[]>([]);
const altitudeHistory = ref<number[]>([]);
const signalHistory = ref<number[]>([]);
const timeLabels = ref<string[]>([]);

const maxDataPoints = 50;
let updateInterval: NodeJS.Timeout | null = null;

// Chart data
const batteryChartData = computed(() => ({
  labels: timeLabels.value,
  datasets: [
    {
      label: 'Battery Voltage (V)',
      data: batteryHistory.value,
      borderColor: '#2C5F2D',
      backgroundColor: 'rgba(44, 95, 45, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
}));

const speedChartData = computed(() => ({
  labels: timeLabels.value,
  datasets: [
    {
      label: 'Ground Speed (m/s)',
      data: speedHistory.value,
      borderColor: '#87CEEB',
      backgroundColor: 'rgba(135, 206, 235, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
}));

const altitudeChartData = computed(() => ({
  labels: timeLabels.value,
  datasets: [
    {
      label: 'Relative Altitude (m)',
      data: altitudeHistory.value,
      borderColor: '#FF7F7F',
      backgroundColor: 'rgba(255, 127, 127, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
}));

const signalChartData = computed(() => ({
  // labels: timeLabels.value,
  datasets: [
    // {
    //   label: 'WiFi Signal (dBm)',
    //   data: signalHistory.value,
    //   borderColor: '#9370DB',
    //   backgroundColor: 'rgba(147, 112, 219, 0.1)',
    //   fill: true,
    //   tension: 0.4,
    // },
  ],
}));

const chartOptionsConfig = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
    },
  },
  scales: {
    x: {
      display: false,
    },
    y: {
      beginAtZero: false,
      grid: {
        color: 'rgba(0, 0, 0, 0.1)',
      },
    },
  },
  elements: {
    point: {
      radius: 2,
      hoverRadius: 4,
    },
  },
  animation: {
    duration: 500,
  },
};

// Data collection
function updateTelemetryHistory() {
  const now = new Date();
  const timeLabel =
    now.getHours().toString().padStart(2, '0') +
    ':' +
    now.getMinutes().toString().padStart(2, '0') +
    ':' +
    now.getSeconds().toString().padStart(2, '0');

  // Add new data points
  batteryHistory.value.push(telemetryStore.battery.voltage);
  speedHistory.value.push(telemetryStore.velocity.ground);
  altitudeHistory.value.push(telemetryStore.position.relative_alt);
  signalHistory.value.push(healthStore.network.wifi.rssi);
  timeLabels.value.push(timeLabel);

  // Limit data points
  if (batteryHistory.value.length > maxDataPoints) {
    batteryHistory.value.shift();
    speedHistory.value.shift();
    altitudeHistory.value.shift();
    signalHistory.value.shift();
    timeLabels.value.shift();
  }
}

// Lifecycle
onMounted(() => {
  // Start collecting data every 2 seconds
  updateInterval = setInterval(updateTelemetryHistory, 2000);

  // Initialize with current data
  updateTelemetryHistory();
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.telemetry-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  padding: 12px 16px;
  background-color: rgba($primary, 0.05);
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-selector {
  :deep(.q-btn-toggle__btn) {
    font-size: 0.75rem;
    padding: 4px 8px;
  }
}

.widget-content {
  flex: 1;
  overflow: hidden;
}

.chart-container {
  height: 200px;
  position: relative;
}

.chart-wrapper {
  height: 100%;
  width: 100%;
}

.telemetry-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
  padding: 12px;
  background-color: rgba($surface, 0.3);
  border-radius: $radius-sm;
}

.value-item {
  text-align: center;
  padding: 4px;
}

.value-label {
  display: block;
  font-size: 0.75rem;
  color: $text-secondary;
  margin-bottom: 2px;
}

.value-data {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: $text-primary;
}
</style>
