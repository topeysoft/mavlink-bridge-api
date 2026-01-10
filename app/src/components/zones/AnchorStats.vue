<script setup lang="ts">
import { computed } from 'vue'
import { useUnitsStore } from '@/stores/units'
import type { ShapeType } from '@/types/recording'

interface Props {
  anchorCount: number
  area: number  // square meters
  perimeter: number  // meters
  shapeType?: ShapeType
}

const props = defineProps<Props>()
const unitsStore = useUnitsStore()

const formattedArea = computed(() => {
  return unitsStore.formatArea(props.area)
})

const formattedPerimeter = computed(() => {
  return unitsStore.formatDistance(props.perimeter)
})

const shapeLabel = computed(() => {
  if (!props.shapeType) return null

  const labels: Record<ShapeType, { text: string; emoji: string }> = {
    rectangle: { text: 'Rectangle', emoji: '⬛' },
    l_shape: { text: 'L-Shape', emoji: '📐' },
    triangle: { text: 'Triangle', emoji: '🔺' },
    custom: { text: 'Custom Shape', emoji: '🔷' }
  }

  return labels[props.shapeType]
})
</script>

<template>
  <div class="anchor-stats">
    <div class="stat">
      <div class="stat-label">Anchors</div>
      <div class="stat-value">{{ anchorCount }}</div>
    </div>

    <div v-if="shapeType" class="stat shape-stat">
      <div class="stat-label">Shape</div>
      <div class="stat-value">
        {{ shapeLabel?.emoji }} {{ shapeLabel?.text }}
      </div>
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

.anchor-stats {
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

.shape-stat {
  .stat-value {
    color: var(--primary-green);
  }
}
</style>
