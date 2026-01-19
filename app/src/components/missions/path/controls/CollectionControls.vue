<script setup lang="ts">
/**
 * CollectionControls - Cleanup mission settings
 *
 * Collection mode selection for debris and leaf cleanup.
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

// Collection mode options
const modeOptions = [
  {
    value: 'vacuum',
    label: 'Vacuum',
    consumerLabel: 'Vacuum Up',
    description: 'Suck up debris into collector',
    icon: '🌀'
  },
  {
    value: 'blow',
    label: 'Blow',
    consumerLabel: 'Blow Away',
    description: 'Blow debris to designated area',
    icon: '💨'
  },
  {
    value: 'rake',
    label: 'Rake',
    consumerLabel: 'Rake & Gather',
    description: 'Rake debris into piles',
    icon: '🧹'
  }
] as const

// Current values
const currentMode = computed(() => props.modelValue.collection_mode ?? 'vacuum')
const collectionEnabled = computed(() => props.modelValue.collection_enabled ?? true)

function update(changes: Partial<TypeSpecificSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function selectMode(mode: 'vacuum' | 'blow' | 'rake') {
  if (props.disabled) return
  update({ collection_mode: mode })
}

function toggleCollection() {
  if (props.disabled) return
  update({ collection_enabled: !collectionEnabled.value })
}
</script>

<template>
  <div class="collection-controls" :class="{ 'consumer-mode': isConsumerMode, disabled }">
    <h4 class="controls-title">
      {{ isConsumerMode ? 'Cleanup Method' : 'Collection Settings' }}
    </h4>

    <!-- Collection enabled toggle (power user) -->
    <div v-if="!isConsumerMode" class="section">
      <label class="toggle-label">
        <input
          type="checkbox"
          class="toggle-input"
          :checked="collectionEnabled"
          :disabled="disabled"
          @change="toggleCollection"
        />
        <span class="toggle-switch"></span>
        <span class="toggle-text">Enable Collection</span>
      </label>
    </div>

    <!-- Collection mode selection -->
    <div class="section">
      <label class="section-label">
        {{ isConsumerMode ? 'How should we clean?' : 'Collection Mode' }}
      </label>
      <div class="mode-buttons">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          class="mode-btn"
          :class="{ selected: currentMode === option.value }"
          :disabled="disabled"
          :title="option.description"
          @click="selectMode(option.value)"
        >
          <span v-if="isConsumerMode" class="mode-icon">{{ option.icon }}</span>
          <span class="mode-label">
            {{ isConsumerMode ? option.consumerLabel : option.label }}
          </span>
          <span v-if="!isConsumerMode" class="mode-description">
            {{ option.description }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.collection-controls {
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

.mode-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.mode-btn {
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
    border-color: #8D6E63;
    background: rgba(141, 110, 99, 0.05);
  }

  &.selected {
    border-color: #8D6E63;
    background: rgba(141, 110, 99, 0.1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.consumer-mode .mode-btn {
  flex-direction: row;
  justify-content: flex-start;
  padding: var(--spacing-lg);
  gap: var(--spacing-md);
}

.mode-icon {
  font-size: 28px;
}

.mode-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.consumer-mode .mode-label {
  font-size: var(--font-size-base);
}

.mode-description {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
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
  background: #8D6E63;

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
