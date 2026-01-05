<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'

interface Position {
  latitude: number
  longitude: number
  altitude: number
  speed: number
  heading: number
  distanceToHome: number
}

const position = ref<Position>({
  latitude: 40.7128,
  longitude: -74.0060,
  altitude: 15,
  speed: 2.3,
  heading: 45,
  distanceToHome: 12.5
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
