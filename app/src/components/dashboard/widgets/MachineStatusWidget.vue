<template>
  <q-card class="widget machine-status-widget full-height">
    <q-card-section class="widget-header">
      <div class="text-h6">Machine Status</div>
      <q-space />
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
      <div class="status-grid">
        <!-- Battery Status -->
        <div class="status-item">
          <q-icon name="battery_charging_full" size="32px" :color="batteryColor" />
          <div class="status-info">
            <div class="status-value">{{ batteryLevel }}%</div>
            <div class="status-label">Battery</div>
            <q-linear-progress
              :value="batteryLevel / 100"
              :color="batteryColor"
              size="4px"
              class="q-mt-xs"
            />
          </div>
        </div>
        
        <!-- GPS Status -->
        <div class="status-item">
          <q-icon name="gps_fixed" size="32px" :color="gpsColor" />
          <div class="status-info">
            <div class="status-value">{{ gpsStatus }}</div>
            <div class="status-label">GPS ({{ numSatellites }} sats)</div>
            <div class="status-detail">{{ gpsAccuracy }}m accuracy</div>
          </div>
        </div>
        
        <!-- Mode Status -->
        <div class="status-item">
          <q-icon name="flight" size="32px" color="primary" />
          <div class="status-info">
            <div class="status-value">{{ flightMode }}</div>
            <div class="status-label">Mode</div>
            <q-chip
              dense
              :color="armedStatus ? 'positive' : 'grey-5'"
              text-color="white"
              size="sm"
            >
              {{ armedStatus ? 'ARMED' : 'DISARMED' }}
            </q-chip>
          </div>
        </div>
        
        <!-- Speed Status -->
        <div class="status-item">
          <q-icon name="speed" size="32px" color="secondary" />
          <div class="status-info">
            <div class="status-value">{{ groundSpeed.toFixed(1) }} m/s</div>
            <div class="status-label">Speed</div>
            <div class="status-detail">Heading: {{ heading }}°</div>
          </div>
        </div>
      </div>
      
      <!-- Position Map Mini -->
      <div class="position-map q-mt-md">
        <div class="map-placeholder">
          <q-icon name="place" size="24px" color="negative" />
          <div class="text-caption">
            {{ latitude.toFixed(6) }}, {{ longitude.toFixed(6) }}
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useTelemetryStore } from '@/stores/telemetry';

const props = defineProps<{
  widgetId: string;
}>();

defineEmits<{
  remove: [widgetId: string];
}>();

const editMode = inject('dashboardEditMode', false);
const telemetryStore = useTelemetryStore();

// Computed values from telemetry
const batteryLevel = computed(() => telemetryStore.battery.level);
const batteryColor = computed(() => {
  if (batteryLevel.value > 60) return 'positive';
  if (batteryLevel.value > 30) return 'warning';
  return 'negative';
});

const gpsStatus = computed(() => {
  if (telemetryStore.gps.fix === 3) return '3D Fix';
  if (telemetryStore.gps.fix === 2) return '2D Fix';
  return 'No Fix';
});

const gpsColor = computed(() => {
  return telemetryStore.gps.fix >= 2 ? 'positive' : 'negative';
});

const numSatellites = computed(() => telemetryStore.gps.satellites);
const gpsAccuracy = computed(() => telemetryStore.gps.hdop.toFixed(1));

const flightMode = computed(() => telemetryStore.flightMode);
const armedStatus = computed(() => telemetryStore.armed);

const groundSpeed = computed(() => telemetryStore.velocity.ground);
const heading = computed(() => Math.round(telemetryStore.attitude.yaw * 180 / Math.PI));

const latitude = computed(() => telemetryStore.position.lat);
const longitude = computed(() => telemetryStore.position.lon);
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.machine-status-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  padding: 12px 16px;
  background-color: rgba($primary, 0.05);
}

.widget-content {
  flex: 1;
  overflow-y: auto;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background-color: $surface-variant;
  border-radius: $radius-md;
}

.status-info {
  flex: 1;
}

.status-value {
  font-size: 1.25rem;
  font-weight: 500;
  color: $text-primary;
}

.status-label {
  font-size: 0.875rem;
  color: $text-secondary;
  margin-top: 2px;
}

.status-detail {
  font-size: 0.75rem;
  color: $text-secondary;
  margin-top: 4px;
}

.position-map {
  height: 120px;
  background-color: $surface-variant;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .map-placeholder {
    text-align: center;
    color: $text-secondary;
  }
}
</style>