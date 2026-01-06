<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import Card from '@/components/common/Card.vue'
import { useCompassStore } from '@/stores/compass'

const compassStore = useCompassStore()

// Subscriptions
let compassUnsub: (() => void) | undefined

// Computed attitude values
const attitude = computed(() => {
  // Get attitude data from compass store (which receives ATTITUDE messages)
  const attitudeData = compassStore.attitudeData

  if (!attitudeData) {
    return {
      pitch: 0,
      roll: 0,
      heading: Math.round(compassStore.heading)
    }
  }

  // Convert radians to degrees
  return {
    pitch: (attitudeData.pitch * 180 / Math.PI),
    roll: (attitudeData.roll * 180 / Math.PI),
    heading: Math.round(compassStore.heading)
  }
})

// Computed transform for horizon based on pitch and roll
const horizonTransform = computed(() => {
  const pitch = attitude.value.pitch
  const roll = attitude.value.roll

  // Translate Y based on pitch (positive pitch = nose up = horizon moves down)
  const translateY = pitch * 2 // Scale factor for visual effect

  return `translate(0, ${translateY}) rotate(${roll})`
})

onMounted(() => {
  compassUnsub = compassStore.setupSubscription()
})

onUnmounted(() => {
  if (compassUnsub) compassUnsub()
})
</script>

<template>
  <Card title="Attitude Indicator">
    <div class="attitude-container">
      <div class="attitude-display">
        <svg viewBox="-100 -100 200 200" class="attitude-svg">
          <!-- Animated horizon group -->
          <g :transform="horizonTransform">
            <!-- Sky -->
            <rect x="-100" y="-200" width="200" height="200" fill="#4299e1" />
            <!-- Ground -->
            <rect x="-100" y="0" width="200" height="200" fill="#805ad5" />
            <!-- Horizon line -->
            <line x1="-150" y1="0" x2="150" y2="0" stroke="white" stroke-width="2" />
            <!-- Pitch ladder marks -->
            <line x1="-30" y1="-20" x2="30" y2="-20" stroke="white" stroke-width="1" opacity="0.7" />
            <line x1="-30" y1="-40" x2="30" y2="-40" stroke="white" stroke-width="1" opacity="0.7" />
            <line x1="-30" y1="20" x2="30" y2="20" stroke="white" stroke-width="1" opacity="0.7" />
            <line x1="-30" y1="40" x2="30" y2="40" stroke="white" stroke-width="1" opacity="0.7" />
          </g>

          <!-- Center marker (fixed) -->
          <g>
            <line x1="-30" y1="0" x2="-10" y2="0" stroke="yellow" stroke-width="3" />
            <line x1="10" y1="0" x2="30" y2="0" stroke="yellow" stroke-width="3" />
            <circle cx="0" cy="0" r="3" fill="yellow" />
          </g>
        </svg>
      </div>

      <div class="attitude-values">
        <div class="attitude-value">
          <span class="label">Pitch:</span>
          <span class="value">{{ attitude.pitch.toFixed(1) }}°</span>
        </div>
        <div class="attitude-value">
          <span class="label">Roll:</span>
          <span class="value">{{ attitude.roll.toFixed(1) }}°</span>
        </div>
        <div class="attitude-value">
          <span class="label">Heading:</span>
          <span class="value">{{ attitude.heading }}°</span>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.attitude-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.attitude-display {
  position: relative;
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
  aspect-ratio: 1;
  background: var(--bg-tertiary);
  border-radius: 50%;
  overflow: hidden;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2);
}

.attitude-svg {
  width: 100%;
  height: 100%;

  g {
    transition: transform 0.3s ease-out;
  }
}

.attitude-values {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.attitude-value {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);

  .label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--text-primary);
  }
}
</style>
