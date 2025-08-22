<template>
  <q-card class="vehicle-status-card">
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-h6">Vehicle Status</div>
        </div>
        <div class="col-auto">
          <q-chip
            :color="statusColor"
            text-color="white"
            :icon="statusIcon"
          >
            {{ statusText }}
          </q-chip>
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <!-- Armed Status -->
        <div class="col-6 col-sm-4">
          <div class="status-item">
            <q-icon
              :name="isArmed ? 'mdi-shield-check' : 'mdi-shield-off'"
              :color="isArmed ? 'negative' : 'positive'"
              size="24px"
            />
            <div class="q-ml-sm">
              <div class="text-caption text-grey-7">Armed</div>
              <div class="text-subtitle2">{{ isArmed ? 'Yes' : 'No' }}</div>
            </div>
          </div>
        </div>

        <!-- Flight Mode -->
        <div class="col-6 col-sm-4">
          <div class="status-item">
            <q-icon name="mdi-airplane" color="primary" size="24px" />
            <div class="q-ml-sm">
              <div class="text-caption text-grey-7">Mode</div>
              <div class="text-subtitle2">{{ flightMode }}</div>
            </div>
          </div>
        </div>

        <!-- GPS Status -->
        <div class="col-6 col-sm-4">
          <div class="status-item">
            <q-icon
              name="mdi-satellite-variant"
              :color="gpsColor"
              size="24px"
            />
            <div class="q-ml-sm">
              <div class="text-caption text-grey-7">GPS</div>
              <div class="text-subtitle2">{{ gpsStatus }}</div>
            </div>
          </div>
        </div>

        <!-- Battery -->
        <div class="col-6 col-sm-4">
          <div class="status-item">
            <q-icon
              :name="batteryIcon"
              :color="batteryColor"
              size="24px"
            />
            <div class="q-ml-sm">
              <div class="text-caption text-grey-7">Battery</div>
              <div class="text-subtitle2">{{ batteryLevel }}%</div>
            </div>
          </div>
        </div>

        <!-- Altitude -->
        <div class="col-6 col-sm-4">
          <div class="status-item">
            <q-icon name="mdi-altimeter" color="info" size="24px" />
            <div class="q-ml-sm">
              <div class="text-caption text-grey-7">Altitude</div>
              <div class="text-subtitle2">{{ altitude.toFixed(1) }}m</div>
            </div>
          </div>
        </div>

        <!-- Speed -->
        <div class="col-6 col-sm-4">
          <div class="status-item">
            <q-icon name="mdi-speedometer" color="accent" size="24px" />
            <div class="q-ml-sm">
              <div class="text-caption text-grey-7">Speed</div>
              <div class="text-subtitle2">{{ groundSpeed.toFixed(1) }}m/s</div>
            </div>
          </div>
        </div>
      </div>

      <q-separator class="q-my-md" />

      <!-- System Messages -->
      <div v-if="systemMessages.length > 0">
        <div class="text-subtitle2 q-mb-sm">System Messages</div>
        <q-scroll-area style="height: 100px">
          <div
            v-for="(msg, index) in systemMessages"
            :key="index"
            class="text-caption"
            :class="`text-${msg.severity}`"
          >
            {{ msg.text }}
          </div>
        </q-scroll-area>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMAVLinkStore } from '../../stores/mavlink'

const mavlinkStore = useMAVLinkStore()

const isArmed = computed(() => mavlinkStore.vehicleState.armed)
const flightMode = computed(() => mavlinkStore.vehicleState.mode || 'Unknown')
const batteryLevel = computed(() => mavlinkStore.vehicleState.battery?.percentage || 0)
const altitude = computed(() => mavlinkStore.vehicleState.altitude || 0)
const groundSpeed = computed(() => mavlinkStore.vehicleState.groundSpeed || 0)
const gpsStatus = computed(() => {
  const satellites = mavlinkStore.vehicleState.gps?.satellites || 0
  const fix = mavlinkStore.vehicleState.gps?.fixType || 0
  
  if (fix >= 3) return `3D Fix (${satellites} sats)`
  if (fix === 2) return `2D Fix (${satellites} sats)`
  if (satellites > 0) return `No Fix (${satellites} sats)`
  return 'No GPS'
})

const systemMessages = computed(() => mavlinkStore.systemMessages.slice(-5))

const statusColor = computed(() => {
  if (!mavlinkStore.isConnected) return 'grey'
  if (isArmed.value) return 'negative'
  return 'positive'
})

const statusIcon = computed(() => {
  if (!mavlinkStore.isConnected) return 'mdi-link-off'
  if (isArmed.value) return 'mdi-alert'
  return 'mdi-check-circle'
})

const statusText = computed(() => {
  if (!mavlinkStore.isConnected) return 'Disconnected'
  if (isArmed.value) return 'Armed'
  return 'Ready'
})

const batteryIcon = computed(() => {
  const level = batteryLevel.value
  if (level > 80) return 'mdi-battery'
  if (level > 60) return 'mdi-battery-80'
  if (level > 40) return 'mdi-battery-60'
  if (level > 20) return 'mdi-battery-40'
  if (level > 10) return 'mdi-battery-20'
  return 'mdi-battery-alert'
})

const batteryColor = computed(() => {
  const level = batteryLevel.value
  if (level > 40) return 'positive'
  if (level > 20) return 'warning'
  return 'negative'
})

const gpsColor = computed(() => {
  const fix = mavlinkStore.vehicleState.gps?.fixType || 0
  if (fix >= 3) return 'positive'
  if (fix === 2) return 'warning'
  return 'negative'
})
</script>

<style lang="scss" scoped>
.vehicle-status-card {
  height: 100%;
}

.status-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  background: $grey-1;
  
  .body--dark & {
    background: $grey-9;
  }
}
</style>