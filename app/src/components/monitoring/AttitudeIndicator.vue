<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'

const attitude = ref({
  pitch: -2,
  roll: 0.5,
  heading: 45
})
</script>

<template>
  <Card title="Attitude Indicator">
    <div class="attitude-container">
      <div class="attitude-display">
        <svg viewBox="-100 -100 200 200" class="attitude-svg">
          <!-- Sky -->
          <rect x="-100" y="-100" width="200" height="100" :fill="'#4299e1'" />
          <!-- Ground -->
          <rect x="-100" y="0" width="200" height="100" :fill="'#805ad5'" />
          <!-- Horizon line -->
          <line x1="-100" y1="0" x2="100" y2="0" stroke="white" stroke-width="2" />

          <!-- Center marker -->
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
