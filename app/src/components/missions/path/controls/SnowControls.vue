<script setup lang="ts">
/**
 * SnowControls - Winter operations settings
 *
 * Clearing depth presets, salt application toggle, and multi-pass option.
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

// Depth presets
const depthPresets = [
  { value: 2, label: '2cm', consumerLabel: 'Light Dusting', icon: '❄️' },
  { value: 5, label: '5cm', consumerLabel: 'Normal Snow', icon: '🌨️' },
  { value: 10, label: '10cm', consumerLabel: 'Heavy Snow', icon: '☃️' },
  { value: 15, label: '15cm+', consumerLabel: 'Big Storm', icon: '🌨️' }
]

// Current values
const currentDepth = computed(() => props.modelValue.clearing_height ?? 5)
const saltEnabled = computed(() => props.modelValue.salt_application ?? false)
const multiPassEnabled = computed(() => props.modelValue.multi_pass ?? false)

function update(changes: Partial<TypeSpecificSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function selectDepth(depth: number) {
  if (props.disabled) return
  update({ clearing_height: depth })
}

function toggleSalt() {
  if (props.disabled) return
  update({ salt_application: !saltEnabled.value })
}

function toggleMultiPass() {
  if (props.disabled) return
  update({ multi_pass: !multiPassEnabled.value })
}
</script>

<template>
  <div class="snow-controls" :class="{ 'consumer-mode': isConsumerMode, disabled }">
    <h4 class="controls-title">
      {{ isConsumerMode ? 'Snow Settings' : 'Clearing Configuration' }}
    </h4>

    <!-- Depth selection -->
    <div class="section">
      <label class="section-label">
        {{ isConsumerMode ? 'How much snow?' : 'Expected Depth' }}
      </label>
      <div class="depth-buttons">
        <button
          v-for="preset in depthPresets"
          :key="preset.value"
          class="depth-btn"
          :class="{ selected: currentDepth === preset.value }"
          :disabled="disabled"
          @click="selectDepth(preset.value)"
        >
          <span v-if="isConsumerMode" class="depth-icon">{{ preset.icon }}</span>
          <span class="depth-label">
            {{ isConsumerMode ? preset.consumerLabel : preset.label }}
          </span>
        </button>
      </div>
    </div>

    <!-- Salt application toggle -->
    <div class="section">
      <label class="toggle-label">
        <input
          type="checkbox"
          class="toggle-input"
          :checked="saltEnabled"
          :disabled="disabled"
          @change="toggleSalt"
        />
        <span class="toggle-switch"></span>
        <span class="toggle-text">
          {{ isConsumerMode ? 'Add salt for ice prevention' : 'Salt Application' }}
        </span>
      </label>
      <p v-if="isConsumerMode" class="section-hint">
        Helps prevent ice from forming after clearing
      </p>
    </div>

    <!-- Multi-pass (power user only) -->
    <div v-if="!isConsumerMode" class="section">
      <label class="toggle-label">
        <input
          type="checkbox"
          class="toggle-input"
          :checked="multiPassEnabled"
          :disabled="disabled"
          @change="toggleMultiPass"
        />
        <span class="toggle-switch"></span>
        <span class="toggle-text">Multi-Pass (for heavy accumulation)</span>
      </label>
      <p class="section-hint">
        Make multiple passes for deeper snow
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.snow-controls {
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
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.section-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.depth-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.depth-btn {
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
    border-color: var(--secondary);
    background: rgba(var(--secondary-rgb), 0.05);
  }

  &.selected {
    border-color: var(--secondary);
    background: rgba(var(--secondary-rgb), 0.1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.consumer-mode .depth-btn {
  padding: var(--spacing-lg);
}

.depth-icon {
  font-size: 24px;
}

.consumer-mode .depth-icon {
  font-size: 32px;
}

.depth-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}

.consumer-mode .depth-label {
  font-size: var(--font-size-base);
}

// Toggle switch styles
.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.toggle-input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  transition: background 0.2s ease;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
}

.toggle-input:checked + .toggle-switch {
  background: var(--secondary);

  &::after {
    transform: translateX(20px);
  }
}

.toggle-input:disabled + .toggle-switch {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-text {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}
</style>
