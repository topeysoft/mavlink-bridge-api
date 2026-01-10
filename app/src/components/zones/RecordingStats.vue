<script setup lang="ts">
import { computed } from 'vue'
import { useUnitsStore } from '@/stores/units'

interface Props {
  waypointCount: number
  area: number  // square meters
  perimeter: number  // meters
}

const props = defineProps<Props>()
const unitsStore = useUnitsStore()

const formattedArea = computed(() => {
  return unitsStore.formatArea(props.area)
})

const formattedPerimeter = computed(() => {
  return unitsStore.formatDistance(props.perimeter)
})
</script>

<template>
  <div class="recording-stats">
    <div class="stat">
      <div class="stat-label">Points</div>
      <div class="stat-value">{{ waypointCount }}</div>
    </div>

    <div class="stat">
      <div class="stat-label">Area</div>
      <div class="stat-value">{{ area > 0 ? formattedArea : '—' }}</div>
    </div>

    <div class="stat">
      <div class="stat-label">Perimeter</div>
      <div class="stat-value">{{ perimeter > 0 ? formattedPerimeter : '—' }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.recording-stats {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.stat {
  flex: 1;
  text-align: center;

  .stat-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
  }
}
</style>
