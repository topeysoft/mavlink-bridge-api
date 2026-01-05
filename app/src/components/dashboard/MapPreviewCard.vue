<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'

const coveragePercentage = ref(68)
const showLayers = ref(true)

const toggleLayers = () => {
  showLayers.value = !showLayers.value
}

const refreshMap = () => {
  console.log('Refreshing map...')
}
</script>

<template>
  <Card title="Coverage Map">
    <template #header>
      <div class="map-header">
        <div>
          <div class="card-title">Coverage Map</div>
          <div class="card-subtitle">Real-time coverage visualization</div>
        </div>
        <div class="map-controls">
          <button class="map-btn" :class="{ active: showLayers }" @click="toggleLayers" title="Toggle layers">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </button>
          <button class="map-btn" @click="refreshMap" title="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </div>
    </template>

    <div class="map-preview">
      <svg viewBox="0 0 400 300" class="coverage-map">
        <!-- Background -->
        <rect x="0" y="0" width="400" height="300" fill="var(--bg-secondary)" />

        <!-- Property boundary -->
        <path d="M 50 50 L 350 50 L 350 250 L 50 250 Z"
              fill="none"
              stroke="var(--border-color)"
              stroke-width="2"
              stroke-dasharray="5,5" />

        <!-- Covered areas -->
        <rect v-if="showLayers" x="60" y="60" width="280" height="80"
              fill="var(--primary-green)"
              opacity="0.3"
              rx="4" />
        <rect v-if="showLayers" x="60" y="150" width="280" height="90"
              fill="var(--primary-green)"
              opacity="0.2"
              rx="4" />

        <!-- Current position -->
        <circle cx="200" cy="110" r="8"
                fill="var(--status-info)"
                stroke="white"
                stroke-width="2">
          <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>

      <div class="map-stats">
        <div class="stat">
          <span class="stat-label">Coverage</span>
          <span class="stat-value">{{ coveragePercentage }}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Area</span>
          <span class="stat-value">2.4 acres</span>
        </div>
        <div class="stat">
          <span class="stat-label">Zones</span>
          <span class="stat-value">3/5</span>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.map-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: var(--spacing-lg);

  .card-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .card-subtitle {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
}

.map-controls {
  display: flex;
  gap: var(--spacing-xs);
}

.map-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: var(--spacing-xs);
  border-radius: var(--border-radius);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: var(--text-secondary);

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-green);
    color: white;
    border-color: var(--primary-green);
  }
}

.map-preview {
  .coverage-map {
    width: 100%;
    height: auto;
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-md);
  }
}

.map-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);
}

.stat {
  text-align: center;

  .stat-label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .stat-value {
    display: block;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }
}
</style>
