<script setup lang="ts">
/**
 * WateringControls - Irrigation mission settings
 *
 * Flow rate and duration per zone settings.
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

// Flow rate presets
const flowPresets = [
  { value: 2, label: 'Light', consumerLabel: 'Light Watering', description: 'Gentle misting', icon: '💧' },
  { value: 5, label: 'Normal', consumerLabel: 'Normal (Recommended)', description: 'Standard watering', icon: '🚿' },
  { value: 10, label: 'Deep', consumerLabel: 'Deep Soak', description: 'Heavy watering', icon: '🌊' }
]

// Current values
const currentFlowRate = computed(() => props.modelValue.flow_rate ?? 5)
const currentDuration = computed(() => props.modelValue.duration_per_zone ?? 10)

function update(changes: Partial<TypeSpecificSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function selectFlowRate(rate: number) {
  if (props.disabled) return
  update({ flow_rate: rate })
}

function handleFlowSlider(event: Event) {
  const target = event.target as HTMLInputElement
  update({ flow_rate: Number(target.value) })
}

function handleDurationSlider(event: Event) {
  const target = event.target as HTMLInputElement
  update({ duration_per_zone: Number(target.value) })
}

// Check if current rate matches a preset
function isFlowSelected(presetValue: number): boolean {
  return currentFlowRate.value === presetValue
}
</script>

<template>
  <div class="watering-controls" :class="{ 'consumer-mode': isConsumerMode, disabled }">
    <h4 class="controls-title">
      {{ isConsumerMode ? 'Watering Settings' : 'Irrigation Configuration' }}
    </h4>

    <!-- Flow rate presets -->
    <div class="section">
      <label class="section-label">
        {{ isConsumerMode ? 'How much water?' : 'Flow Rate' }}
      </label>
      <div class="flow-buttons">
        <button
          v-for="preset in flowPresets"
          :key="preset.value"
          class="flow-btn"
          :class="{ selected: isFlowSelected(preset.value) }"
          :disabled="disabled"
          :title="preset.description"
          @click="selectFlowRate(preset.value)"
        >
          <span v-if="isConsumerMode" class="flow-icon">{{ preset.icon }}</span>
          <span class="flow-label">
            {{ isConsumerMode ? preset.consumerLabel : preset.label }}
          </span>
          <span v-if="!isConsumerMode" class="flow-value">
            {{ preset.value }} L/min
          </span>
        </button>
      </div>
    </div>

    <!-- Precise flow rate (power user only) -->
    <div v-if="!isConsumerMode" class="section">
      <label class="section-label">
        Precise Flow Rate
        <span class="label-value">{{ currentFlowRate }} L/min</span>
      </label>
      <input
        type="range"
        class="slider"
        min="1"
        max="20"
        step="1"
        :value="currentFlowRate"
        :disabled="disabled"
        @input="handleFlowSlider"
      />
      <div class="slider-labels">
        <span>1 L/min (Mist)</span>
        <span>20 L/min (Flood)</span>
      </div>
    </div>

    <!-- Duration per zone (power user only) -->
    <div v-if="!isConsumerMode" class="section">
      <label class="section-label">
        Duration per Zone
        <span class="label-value">{{ currentDuration }} min</span>
      </label>
      <input
        type="range"
        class="slider"
        min="1"
        max="60"
        step="1"
        :value="currentDuration"
        :disabled="disabled"
        @input="handleDurationSlider"
      />
      <div class="slider-labels">
        <span>1 min (Quick)</span>
        <span>60 min (Extended)</span>
      </div>
      <p class="section-hint">
        Total water: ~{{ (currentFlowRate * currentDuration).toFixed(0) }} liters per zone
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.watering-controls {
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

.section-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.flow-buttons {
  display: flex;
  gap: var(--spacing-sm);
}

.flow-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: #3498db;
    background: rgba(52, 152, 219, 0.05);
  }

  &.selected {
    border-color: #3498db;
    background: rgba(52, 152, 219, 0.1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.consumer-mode .flow-btn {
  padding: var(--spacing-lg);
}

.flow-icon {
  font-size: 24px;
}

.consumer-mode .flow-icon {
  font-size: 32px;
}

.flow-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}

.consumer-mode .flow-label {
  font-size: var(--font-size-base);
}

.flow-value {
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
    background: #3498db;
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
    background: #3498db;
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
