<script setup lang="ts">
import { useUnitsStore } from '@/stores/units'
import Card from '@/components/common/Card.vue'
import Collapsible from '@/components/common/Collapsible.vue'

const unitsStore = useUnitsStore()

const handleSystemChange = (system: 'metric' | 'imperial') => {
  unitsStore.setSystem(system)
}
</script>

<template>
  <Card title="Units & Measurements" subtitle="Choose your preferred unit system">
    <div class="units-settings">
      <div class="system-options">
        <button
          class="system-option"
          :class="{ active: unitsStore.isMetric }"
          @click="handleSystemChange('metric')"
        >
          <div class="option-header">
            <div class="option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div class="option-title">Metric</div>
            <div v-if="unitsStore.isMetric" class="option-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
          <div class="option-description">
            <div class="unit-examples">
              <span class="unit-badge">Hectares</span>
              <span class="unit-badge">Meters</span>
              <span class="unit-badge">km/h</span>
              <span class="unit-badge">°C</span>
            </div>
          </div>
        </button>

        <button
          class="system-option"
          :class="{ active: unitsStore.isImperial }"
          @click="handleSystemChange('imperial')"
        >
          <div class="option-header">
            <div class="option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </div>
            <div class="option-title">Imperial</div>
            <div v-if="unitsStore.isImperial" class="option-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
          <div class="option-description">
            <div class="unit-examples">
              <span class="unit-badge">Acres</span>
              <span class="unit-badge">Feet</span>
              <span class="unit-badge">mph</span>
              <span class="unit-badge">°F</span>
            </div>
          </div>
        </button>
      </div>

      <Collapsible title="Conversion Examples" variant="default">
        <div class="preview-grid">
          <div class="preview-item">
            <span class="preview-label">Area</span>
            <span class="preview-value">{{ unitsStore.formatArea(10000) }}</span>
            <span class="preview-original">= 10,000 m²</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">Distance</span>
            <span class="preview-value">{{ unitsStore.formatDistance(100) }}</span>
            <span class="preview-original">= 100 m</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">Speed</span>
            <span class="preview-value">{{ unitsStore.formatSpeed(2) }}</span>
            <span class="preview-original">= 2 m/s</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">Temperature</span>
            <span class="preview-value">{{ unitsStore.formatTemperature(25) }}</span>
            <span class="preview-original">= 25°C</span>
          </div>
        </div>
      </Collapsible>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.units-settings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.system-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.system-option {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    border-color: var(--primary-green);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  &.active {
    background: var(--primary-green);
    border-color: var(--primary-green);
    color: white;

    .option-icon,
    .option-title {
      color: white;
    }

    .unit-badge {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border-color: rgba(255, 255, 255, 0.3);
    }
  }
}

.option-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius);
  background: var(--bg-primary);
  color: var(--primary-green);

  svg {
    width: 24px;
    height: 24px;
  }
}

.option-title {
  flex: 1;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.option-check {
  display: flex;
  align-items: center;
  color: white;

  svg {
    width: 20px;
    height: 20px;
  }
}

.option-description {
  padding-left: 56px;
}

.unit-examples {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.unit-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.preview-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-transform: uppercase;
  color: var(--text-tertiary);
  letter-spacing: 0.5px;
}

.preview-value {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--primary-green);
}

.preview-original {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}
</style>
