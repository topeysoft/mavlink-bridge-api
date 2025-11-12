<template>
  <q-card class="widget system-health-widget full-height">
    <q-card-section class="widget-header">
      <div class="text-h6">System Health</div>
      <q-space />
      <q-chip
        :color="healthColor"
        text-color="white"
        size="sm"
        :label="healthStore.overallHealth"
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
      <div class="health-metrics">
        <!-- CPU Usage -->
        <div class="metric-item">
          <div class="metric-header">
            <q-icon name="memory" color="primary" />
            <span class="metric-label">CPU Usage</span>
            <span class="metric-value">{{ healthStore.cpu.usage }}%</span>
          </div>
          <q-linear-progress
            :value="healthStore.cpu.usage / 100"
            :color="cpuColor"
            size="8px"
            class="q-mt-xs"
          />
        </div>
        
        <!-- Memory Usage -->
        <div class="metric-item">
          <div class="metric-header">
            <q-icon name="storage" color="secondary" />
            <span class="metric-label">Memory</span>
            <span class="metric-value">{{ healthStore.memoryUsagePercentage }}%</span>
          </div>
          <q-linear-progress
            :value="healthStore.memoryUsagePercentage / 100"
            :color="memoryColor"
            size="8px"
            class="q-mt-xs"
          />
          <div class="metric-detail">
            {{ formatBytes(healthStore.memory.used) }} / {{ formatBytes(healthStore.memory.total) }}
          </div>
        </div>
        
        <!-- Temperature -->
        <div class="metric-item">
          <div class="metric-header">
            <q-icon name="device_thermostat" :color="temperatureColor" />
            <span class="metric-label">Temperature</span>
            <span class="metric-value">{{ healthStore.cpu.temperature }}°C</span>
          </div>
          <q-linear-progress
            :value="healthStore.cpu.temperature / 85"
            :color="temperatureColor"
            size="8px"
            class="q-mt-xs"
          />
        </div>
        
        <!-- WiFi Signal -->
        <div class="metric-item">
          <div class="metric-header">
            <q-icon name="wifi" :color="wifiColor" />
            <span class="metric-label">WiFi Signal</span>
            <span class="metric-value">{{ healthStore.network.wifi.quality }}%</span>
          </div>
          <q-linear-progress
            :value="healthStore.network.wifi.quality / 100"
            :color="wifiColor"
            size="8px"
            class="q-mt-xs"
          />
          <div class="metric-detail">RSSI: {{ healthStore.network.wifi.rssi }} dBm</div>
        </div>
        
        <!-- Uptime -->
        <div class="metric-item uptime-item">
          <div class="metric-header">
            <q-icon name="schedule" color="accent" />
            <span class="metric-label">Uptime</span>
            <span class="metric-value">{{ healthStore.uptimeFormatted }}</span>
          </div>
        </div>
      </div>
      
      <!-- Component Status -->
      <div class="components-status q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Components</div>
        <div class="components-grid">
          <div
            v-for="component in healthStore.components"
            :key="component.name"
            class="component-item"
          >
            <q-icon
              :name="getComponentIcon(component.name)"
              :color="getComponentColor(component.status)"
              size="16px"
            />
            <span class="component-name">{{ component.name }}</span>
            <q-chip
              dense
              size="xs"
              :color="getComponentColor(component.status)"
              text-color="white"
              :label="component.status"
            />
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useHealthStore } from '@/stores/health';

const props = defineProps<{
  widgetId: string;
}>();

defineEmits<{
  remove: [widgetId: string];
}>();

const editMode = inject('dashboardEditMode', false);
const healthStore = useHealthStore();

// Computed colors based on metrics
const healthColor = computed(() => {
  switch (healthStore.overallHealth) {
    case 'excellent': return 'positive';
    case 'good': return 'positive';
    case 'fair': return 'warning';
    case 'poor': return 'negative';
    default: return 'grey';
  }
});

const cpuColor = computed(() => {
  if (healthStore.cpu.usage < 50) return 'positive';
  if (healthStore.cpu.usage < 80) return 'warning';
  return 'negative';
});

const memoryColor = computed(() => {
  if (healthStore.memoryUsagePercentage < 60) return 'positive';
  if (healthStore.memoryUsagePercentage < 85) return 'warning';
  return 'negative';
});

const temperatureColor = computed(() => {
  switch (healthStore.temperatureStatus) {
    case 'normal': return 'positive';
    case 'warm': return 'warning';
    case 'hot': return 'negative';
    default: return 'grey';
  }
});

const wifiColor = computed(() => {
  if (healthStore.network.wifi.quality > 70) return 'positive';
  if (healthStore.network.wifi.quality > 40) return 'warning';
  return 'negative';
});

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getComponentIcon(name: string): string {
  const iconMap: Record<string, string> = {
    'WiFi': 'wifi',
    'MAVLink': 'link',
    'RTCM': 'gps_fixed',
    'Storage': 'storage',
    'Camera': 'camera_alt',
    'Sensors': 'sensors'
  };
  return iconMap[name] || 'check_circle';
}

function getComponentColor(status: string): string {
  switch (status) {
    case 'healthy': return 'positive';
    case 'warning': return 'warning';
    case 'error': return 'negative';
    default: return 'grey';
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.system-health-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  padding: 12px 16px;
  background-color: rgba($primary, 0.05);
  display: flex;
  align-items: center;
}

.widget-content {
  flex: 1;
  overflow-y: auto;
}

.health-metrics {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metric-item {
  padding: 12px;
  background-color: $surface-variant;
  border-radius: $radius-md;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.metric-label {
  flex: 1;
  font-weight: 500;
}

.metric-value {
  font-weight: bold;
  color: $text-primary;
}

.metric-detail {
  font-size: 0.75rem;
  color: $text-secondary;
  margin-top: 4px;
}

.uptime-item {
  .metric-header {
    margin-bottom: 0;
  }
}

.components-status {
  .text-subtitle2 {
    color: $text-primary;
    font-weight: 500;
  }
}

.components-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.component-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: rgba($surface, 0.5);
  border-radius: $radius-sm;
}

.component-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
}
</style>