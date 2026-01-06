<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import Card from '@/components/common/Card.vue'
import { useGpsStore } from '@/stores/gps'
import { useCompassStore } from '@/stores/compass'

const gpsStore = useGpsStore()
const compassStore = useCompassStore()

// Subscriptions
let compassUnsub: (() => void) | undefined

// Computed position values from real data
const position = computed(() => ({
  latitude: gpsStore.gpsInfo.latitude || 0,
  longitude: gpsStore.gpsInfo.longitude || 0,
  altitude: gpsStore.gpsInfo.altitude || 0,
  speed: gpsStore.gpsInfo.speed || 0,
  heading: Math.round(compassStore.heading),
  distanceToHome: 0 // TODO: Calculate from home position
}))

onMounted(() => {
  compassUnsub = compassStore.setupSubscription()
})

onUnmounted(() => {
  if (compassUnsub) compassUnsub()
})
</script>

<template>
  <Card title="Position & Navigation">
    <div class="position-grid">
      <div class="position-item">
        <div class="position-label">Latitude</div>
        <div class="position-value">{{ position.latitude.toFixed(6) }}°</div>
      </div>
      <div class="position-item">
        <div class="position-label">Longitude</div>
        <div class="position-value">{{ position.longitude.toFixed(6) }}°</div>
      </div>
      <div class="position-item">
        <div class="position-label">Altitude</div>
        <div class="position-value">{{ position.altitude }} m</div>
      </div>
      <div class="position-item">
        <div class="position-label">Speed</div>
        <div class="position-value">{{ position.speed.toFixed(1) }} m/s</div>
      </div>
      <div class="position-item">
        <div class="position-label">Heading</div>
        <div class="position-value">{{ position.heading }}°</div>
      </div>
      <div class="position-item">
        <div class="position-label">Distance to Home</div>
        <div class="position-value">{{ position.distanceToHome.toFixed(1) }} m</div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.position-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-lg);
}

.position-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
}

.position-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.position-value {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
}
</style>
