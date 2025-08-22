<template>
  <div class="mission-monitor q-pa-md">
    <div class="text-subtitle1 q-mb-md">Mission Monitor</div>
    
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Current Status</div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <div class="monitor-item">
              <div class="text-caption text-grey-7">Mode</div>
              <div>{{ vehicleState.mode || 'Unknown' }}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="monitor-item">
              <div class="text-caption text-grey-7">Armed</div>
              <div :class="vehicleState.armed ? 'text-positive' : 'text-grey'">
                {{ vehicleState.armed ? 'Armed' : 'Disarmed' }}
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Telemetry</div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <div class="monitor-item">
              <div class="text-caption text-grey-7">Speed</div>
              <div>{{ vehicleState.groundSpeed.toFixed(1) }} m/s</div>
            </div>
          </div>
          <div class="col-6">
            <div class="monitor-item">
              <div class="text-caption text-grey-7">Altitude</div>
              <div>{{ vehicleState.altitude.toFixed(1) }} m</div>
            </div>
          </div>
          <div class="col-6">
            <div class="monitor-item">
              <div class="text-caption text-grey-7">Battery</div>
              <div>{{ vehicleState.battery.percentage }}%</div>
            </div>
          </div>
          <div class="col-6">
            <div class="monitor-item">
              <div class="text-caption text-grey-7">GPS Sats</div>
              <div>{{ vehicleState.gps.satellites }}</div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMAVLinkStore } from '../../stores/mavlink'

const mavlinkStore = useMAVLinkStore()

const vehicleState = computed(() => mavlinkStore.vehicleState)
</script>

<style lang="scss" scoped>
.mission-monitor {
  height: 100%;
  overflow-y: auto;
}

.monitor-item {
  text-align: center;
  padding: 8px;
  background: var(--q-color-grey-1);
  border-radius: 4px;
  
  .body--dark & {
    background: var(--q-color-grey-9);
  }
}
</style>