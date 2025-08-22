<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Real-time Telemetry</div>

      <div class="row q-col-gutter-md">
        <!-- Position Data -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">Position</div>
              <div class="telemetry-grid">
                <div class="telemetry-item">
                  <span class="label">Latitude:</span>
                  <span class="value">{{ position.lat.toFixed(7) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Longitude:</span>
                  <span class="value">{{ position.lng.toFixed(7) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Altitude (Rel):</span>
                  <span class="value">{{ position.alt.toFixed(1) }}m</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Altitude (MSL):</span>
                  <span class="value">{{ position.altMSL.toFixed(1) }}m</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Attitude Data -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">Attitude</div>
              <div class="telemetry-grid">
                <div class="telemetry-item">
                  <span class="label">Roll:</span>
                  <span class="value">{{ attitude.roll.toFixed(1) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Pitch:</span>
                  <span class="value">{{ attitude.pitch.toFixed(1) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Yaw:</span>
                  <span class="value">{{ attitude.yaw.toFixed(1) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Heading:</span>
                  <span class="value">{{ heading.toFixed(1) }}°</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Velocity Data -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">Velocity</div>
              <div class="telemetry-grid">
                <div class="telemetry-item">
                  <span class="label">Ground Speed:</span>
                  <span class="value">{{ velocity.ground.toFixed(1) }}m/s</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Air Speed:</span>
                  <span class="value">{{ velocity.air.toFixed(1) }}m/s</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Climb Rate:</span>
                  <span class="value">{{ velocity.climb.toFixed(1) }}m/s</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Throttle:</span>
                  <span class="value">{{ throttle }}%</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- System Data -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">System</div>
              <div class="telemetry-grid">
                <div class="telemetry-item">
                  <span class="label">Battery Voltage:</span>
                  <span class="value">{{ battery.voltage.toFixed(2) }}V</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">Battery Current:</span>
                  <span class="value">{{ battery.current.toFixed(1) }}A</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">GPS Satellites:</span>
                  <span class="value">{{ gps.satellites }}</span>
                </div>
                <div class="telemetry-item">
                  <span class="label">GPS HDOP:</span>
                  <span class="value">{{ gps.hdop.toFixed(2) }}</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <q-separator class="q-my-md" />

      <!-- Connection Status -->
      <div class="row items-center justify-between">
        <div class="col">
          <div class="text-subtitle2">Connection Status</div>
          <div class="text-caption text-grey-7">
            Last update: {{ lastUpdateTime }}
          </div>
        </div>
        <div class="col-auto">
          <q-chip
            :color="connectionColor"
            text-color="white"
            :icon="connectionIcon"
          >
            {{ connectionStatus }}
          </q-chip>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMAVLinkStore } from '../../stores/mavlink'

const mavlinkStore = useMAVLinkStore()

const position = computed(() => ({
  lat: mavlinkStore.vehicleState.position?.lat || 0,
  lng: mavlinkStore.vehicleState.position?.lng || 0,
  alt: mavlinkStore.vehicleState.altitude || 0,
  altMSL: mavlinkStore.vehicleState.altitudeMSL || 0
}))

const attitude = computed(() => ({
  roll: mavlinkStore.vehicleState.attitude?.roll || 0,
  pitch: mavlinkStore.vehicleState.attitude?.pitch || 0,
  yaw: mavlinkStore.vehicleState.attitude?.yaw || 0
}))

const heading = computed(() => mavlinkStore.vehicleState.heading || 0)

const velocity = computed(() => ({
  ground: mavlinkStore.vehicleState.groundSpeed || 0,
  air: mavlinkStore.vehicleState.airSpeed || 0,
  climb: mavlinkStore.vehicleState.climbRate || 0
}))

const throttle = computed(() => mavlinkStore.vehicleState.throttle || 0)

const battery = computed(() => ({
  voltage: mavlinkStore.vehicleState.battery?.voltage || 0,
  current: mavlinkStore.vehicleState.battery?.current || 0
}))

const gps = computed(() => ({
  satellites: mavlinkStore.vehicleState.gps?.satellites || 0,
  hdop: mavlinkStore.vehicleState.gps?.hdop || 0
}))

const lastUpdateTime = computed(() => {
  const time = mavlinkStore.lastTelemetryUpdate
  return time ? new Date(time).toLocaleTimeString() : 'Never'
})

const connectionColor = computed(() => {
  if (!mavlinkStore.isConnected) return 'negative'
  const timeSinceUpdate = Date.now() - (mavlinkStore.lastTelemetryUpdate || 0)
  if (timeSinceUpdate > 5000) return 'warning'
  return 'positive'
})

const connectionIcon = computed(() => {
  if (!mavlinkStore.isConnected) return 'mdi-link-off'
  const timeSinceUpdate = Date.now() - (mavlinkStore.lastTelemetryUpdate || 0)
  if (timeSinceUpdate > 5000) return 'mdi-link-variant'
  return 'mdi-link'
})

const connectionStatus = computed(() => {
  if (!mavlinkStore.isConnected) return 'Disconnected'
  const timeSinceUpdate = Date.now() - (mavlinkStore.lastTelemetryUpdate || 0)
  if (timeSinceUpdate > 5000) return 'Stale Data'
  return 'Connected'
})
</script>

<style lang="scss" scoped>
.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.telemetry-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: $grey-1;
  border-radius: 4px;
  
  .body--dark & {
    background: $grey-9;
  }
  
  .label {
    font-size: 0.875rem;
    color: $grey-7;
    font-weight: 500;
  }
  
  .value {
    font-size: 0.875rem;
    font-weight: 600;
    font-family: 'Courier New', monospace;
  }
}
</style>