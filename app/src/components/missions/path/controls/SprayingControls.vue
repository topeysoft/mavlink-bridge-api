<script setup lang="ts">
/**
 * SprayingControls - Fertilization/treatment settings
 *
 * Application rate presets and precise rate slider for power users.
 */

import { computed } from 'vue'
import { useFeaturesStore } from '@/stores/features'
import type { TypeSpecificSettings } from './index'

interface Props {
  modelValue: TypeSpecificSettings
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [settings: TypeSpecificSettings]
}>()

const featuresStore = useFeaturesStore()
const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Rate presets
const ratePresets = [
  { value: 0.02, label: 'Light', consumerLabel: 'Light Application', description: 'Maintenance dose' },
  { value: 0.05, label: 'Normal', consumerLabel: 'Normal (Recommended)', description: 'Standard application' },
  { value: 0.08, label: 'Heavy', consumerLabel: 'Heavy Application', description: 'Problem areas' }
]

// Current values
const currentRate = computed(() => props.modelValue.spray_rate ?? 0.05)

function update(changes: Partial<TypeSpecificSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function selectRate(rate: number) {
  if (props.disabled) return
  update({ spray_rate: rate })
}

function handleRateSlider(event: Event) {
  const target = event.target as HTMLInputElement
  update({ spray_rate: Number(target.value) })
}

// Check if current rate matches a preset
function isRateSelected(presetValue: number): boolean {
  return Math.abs(currentRate.value - presetValue) < 0.005
}
</script>

<template>
  <div class="spraying-controls" :class="{ 'consumer-mode': isConsumerMode, disabled }">
    <h4 class="controls-title">
      {{ isConsumerMode ? 'Application Settings' : 'Spray Configuration' }}
    </h4>

    <!-- Rate presets -->
    <div class="section">
      <label class="section-label">
        {{ isConsumerMode ? 'How much to apply?' : 'Application Rate' }}
      </label>
      <div class="rate-buttons">
        <button
          v-for="preset in ratePresets"
          :key="preset.value"
          class="rate-btn"
          :class="{ selected: isRateSelected(preset.value) }"
          :disabled="disabled"
          :title="preset.description"
          @click="selectRate(preset.value)"
        >
          <span class="rate-label">
            {{ isConsumerMode ? preset.consumerLabel : preset.label }}
          </span>
          <span v-if="!isConsumerMode" class="rate-value">
            {{ preset.value }} L/m²
          </span>
        </button>
      </div>
    </div>

    <!-- Precise rate slider (power user only) -->
    <div v-if="!isConsumerMode" class="section">
      <label class="section-label">
        Precise Rate
        <span class="label-value">{{ currentRate.toFixed(3) }} L/m²</span>
      </label>
      <input
        type="range"
        class="slider"
        min="0.01"
        max="0.15"
        step="0.005"
        :value="currentRate"
        :disabled="disabled"
        @input="handleRateSlider"
      />
      <div class="slider-labels">
        <span>0.01 L/m² (Very light)</span>
        <span>0.15 L/m² (Very heavy)</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.spraying-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.controls-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.consumer-mode .controls-title {
  font-size: var(--font-size-lg);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.label-value {
  font-weight: 600;
  color: var(--text-primary);
}

.rate-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.rate-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--accent);
    background: rgba(var(--accent-rgb), 0.05);
  }

  &.selected {
    border-color: var(--accent);
    background: rgba(var(--accent-rgb), 0.1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.consumer-mode .rate-btn {
  padding: var(--spacing-lg);
  justify-content: center;
}

.rate-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.consumer-mode .rate-label {
  font-size: var(--font-size-base);
}

.rate-value {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.slider {
  width: 100%;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  appearance: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    transition: transform 0.15s ease;

    &:hover {
      transform: scale(1.1);
    }
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
</style>
