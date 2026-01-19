<script setup lang="ts">
/**
 * MowingControls - Lawn care mission settings
 *
 * Height presets, precise height slider (power user), and edge mode selection.
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

// Height presets
const heightPresets = [
  { value: 3, label: '3cm', consumerLabel: 'Short', description: 'Golf course look', icon: '📐' },
  { value: 5, label: '5cm', consumerLabel: 'Medium', description: 'Recommended height', icon: '✅' },
  { value: 7, label: '7cm', consumerLabel: 'Tall', description: 'Drought tolerant', icon: '🌾' }
]

// Edge mode options (power user only)
const edgeModeOptions = [
  { value: 'normal', label: 'Normal', description: 'Standard edge handling' },
  { value: 'precise', label: 'Precise', description: 'Extra care near edges' },
  { value: 'skip', label: 'Skip', description: 'Avoid edges entirely' }
] as const

// Current values
const currentHeight = computed(() => props.modelValue.mowing_height ?? 5)
const currentEdgeMode = computed(() => props.modelValue.edge_mode ?? 'normal')

function update(changes: Partial<TypeSpecificSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function selectHeight(height: number) {
  if (props.disabled) return
  update({ mowing_height: height })
}

function handleHeightSlider(event: Event) {
  const target = event.target as HTMLInputElement
  update({ mowing_height: Number(target.value) })
}

function selectEdgeMode(mode: 'normal' | 'precise' | 'skip') {
  if (props.disabled) return
  update({ edge_mode: mode })
}
</script>

<template>
  <div class="mowing-controls" :class="{ 'consumer-mode': isConsumerMode, disabled }">
    <h4 class="controls-title">
      {{ isConsumerMode ? 'Grass Height' : 'Mowing Settings' }}
    </h4>

    <!-- Height presets (both modes) -->
    <div class="section">
      <label class="section-label">
        {{ isConsumerMode ? 'How tall?' : 'Cut Height' }}
      </label>
      <div class="preset-buttons">
        <button
          v-for="preset in heightPresets"
          :key="preset.value"
          class="preset-btn"
          :class="{ selected: currentHeight === preset.value }"
          :disabled="disabled"
          :title="preset.description"
          @click="selectHeight(preset.value)"
        >
          <span v-if="isConsumerMode" class="preset-icon">{{ preset.icon }}</span>
          <span class="preset-label">
            {{ isConsumerMode ? preset.consumerLabel : preset.label }}
          </span>
        </button>
      </div>
    </div>

    <!-- Precise height slider (power user only) -->
    <div v-if="!isConsumerMode" class="section">
      <label class="section-label">
        Precise Height
        <span class="label-value">{{ currentHeight }}cm</span>
      </label>
      <input
        type="range"
        class="slider"
        min="1"
        max="15"
        step="0.5"
        :value="currentHeight"
        :disabled="disabled"
        @input="handleHeightSlider"
      />
      <div class="slider-labels">
        <span>1cm (Very short)</span>
        <span>15cm (Very tall)</span>
      </div>
    </div>

    <!-- Edge mode (power user only) -->
    <div v-if="!isConsumerMode" class="section">
      <label class="section-label">Edge Handling</label>
      <div class="edge-buttons">
        <button
          v-for="opt in edgeModeOptions"
          :key="opt.value"
          class="edge-btn"
          :class="{ selected: currentEdgeMode === opt.value }"
          :disabled="disabled"
          :title="opt.description"
          @click="selectEdgeMode(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mowing-controls {
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

.preset-buttons {
  display: flex;
  gap: var(--spacing-sm);
}

.preset-btn {
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
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.05);
  }

  &.selected {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.consumer-mode .preset-btn {
  padding: var(--spacing-lg);
}

.preset-icon {
  font-size: 24px;
}

.consumer-mode .preset-icon {
  font-size: 32px;
}

.preset-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.consumer-mode .preset-label {
  font-size: var(--font-size-base);
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
    background: var(--primary);
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
    background: var(--primary);
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

.edge-buttons {
  display: flex;
  gap: var(--spacing-xs);
}

.edge-btn {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--text-primary);
  }

  &.selected {
    border-color: var(--primary);
    background: var(--primary);
    color: white;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}
</style>
