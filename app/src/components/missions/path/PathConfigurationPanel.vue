<script setup lang="ts">
/**
 * PathConfigurationPanel - Pattern selection and configuration controls
 *
 * Provides controls for configuring mission path patterns.
 * Adapts UI based on consumer vs power user mode.
 */

import { computed } from 'vue'
import { useFeaturesStore } from '@/stores/features'
import type { PathConfiguration, PatternType, EdgeMode } from '@/composables/useMissionPathGeneration'
import type { MissionTypeConfig } from '@/config/missionTypeConfig'

interface Props {
  modelValue: PathConfiguration
  disabled?: boolean
  /** Optional mission type config for filtering patterns */
  missionTypeConfig?: MissionTypeConfig
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  missionTypeConfig: undefined
})

const emit = defineEmits<{
  'update:modelValue': [config: PathConfiguration]
}>()

const featuresStore = useFeaturesStore()
const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Pattern options with icons and descriptions
const patternOptions: Array<{
  value: PatternType
  label: string
  consumerLabel: string
  icon: string
  description: string
}> = [
  {
    value: 'stripe',
    label: 'Stripe',
    consumerLabel: 'Back & Forth',
    icon: '≡',
    description: 'Parallel lines pattern'
  },
  {
    value: 'spiral',
    label: 'Spiral',
    consumerLabel: 'Spiral',
    icon: '◎',
    description: 'Spiral from outside in'
  },
  {
    value: 'checkerboard',
    label: 'Checkerboard',
    consumerLabel: 'Checkerboard',
    icon: '▦',
    description: 'Alternating square pattern'
  },
  {
    value: 'perimeter',
    label: 'Perimeter',
    consumerLabel: 'Border Only',
    icon: '□',
    description: 'Follow boundary only'
  }
]

const edgeModeOptions: Array<{
  value: EdgeMode
  label: string
  description: string
}> = [
  { value: 'trim', label: 'Trim', description: 'Trim edges precisely' },
  { value: 'skip', label: 'Skip', description: 'Skip edge areas' },
  { value: 'overlap', label: 'Overlap', description: 'Overlap into edges' }
]

// ============================================================================
// Computed
// ============================================================================

// Filter patterns based on mission type config
const availablePatterns = computed(() => {
  if (!props.missionTypeConfig) {
    return patternOptions
  }
  return patternOptions.filter(opt =>
    props.missionTypeConfig!.allowedPatterns.includes(opt.value)
  )
})

const selectedPattern = computed(() => props.modelValue.pattern)
const overlapPercent = computed(() => props.modelValue.overlapPercent)
const heading = computed(() => props.modelValue.heading)
const edgeMode = computed(() => props.modelValue.edgeMode)
const equipmentWidth = computed(() => props.modelValue.equipmentWidth ?? 0.5)
const perimeterFirst = computed(() => props.modelValue.perimeterFirst ?? true)

const showHeadingControl = computed(() => {
  return !isConsumerMode.value && selectedPattern.value === 'stripe'
})

const showEdgeModeControl = computed(() => !isConsumerMode.value)
const showEquipmentWidthControl = computed(() => !isConsumerMode.value)
// Show perimeter-first for stripe pattern when supported by mission type
const showPerimeterFirstControl = computed(() => {
  if (selectedPattern.value !== 'stripe') return false
  // If mission type config is provided, check if it supports perimeter-first
  if (props.missionTypeConfig) {
    return props.missionTypeConfig.supportsPerimeterFirst
  }
  return true // Default to showing for stripe pattern
})

const title = computed(() =>
  isConsumerMode.value ? 'Mowing Style' : 'Pattern Configuration'
)

// ============================================================================
// Methods
// ============================================================================

function updateConfig(updates: Partial<PathConfiguration>) {
  emit('update:modelValue', { ...props.modelValue, ...updates })
}

function selectPattern(pattern: PatternType) {
  if (props.disabled) return
  updateConfig({ pattern })
}

function handleOverlapChange(event: Event) {
  const target = event.target as HTMLInputElement
  updateConfig({ overlapPercent: Number(target.value) })
}

function handleHeadingChange(event: Event) {
  const target = event.target as HTMLInputElement
  updateConfig({ heading: Number(target.value) })
}

function selectEdgeMode(mode: EdgeMode) {
  if (props.disabled) return
  updateConfig({ edgeMode: mode })
}

function handleEquipmentWidthChange(event: Event) {
  const target = event.target as HTMLInputElement
  updateConfig({ equipmentWidth: Number(target.value) })
}

function togglePerimeterFirst() {
  if (props.disabled) return
  updateConfig({ perimeterFirst: !perimeterFirst.value })
}

function getPatternLabel(option: typeof patternOptions[0]): string {
  return isConsumerMode.value ? option.consumerLabel : option.label
}
</script>

<template>
  <div class="path-configuration-panel" :class="{ 'consumer-mode': isConsumerMode, disabled }">
    <h4 class="panel-title">{{ title }}</h4>

    <!-- Pattern Selection -->
    <div class="section">
      <label class="section-label">
        {{ isConsumerMode ? 'Choose a style' : 'Pattern Type' }}
      </label>
      <div class="pattern-grid" :class="{ 'single-column': availablePatterns.length === 1 }">
        <button
          v-for="option in availablePatterns"
          :key="option.value"
          class="pattern-option"
          :class="{ selected: selectedPattern === option.value }"
          :disabled="disabled"
          @click="selectPattern(option.value)"
        >
          <span class="pattern-icon">{{ option.icon }}</span>
          <span class="pattern-label">{{ getPatternLabel(option) }}</span>
        </button>
      </div>
    </div>

    <!-- Perimeter First Toggle -->
    <div v-if="showPerimeterFirstControl" class="section">
      <label class="toggle-label">
        <input
          type="checkbox"
          class="toggle-input"
          :checked="perimeterFirst"
          :disabled="disabled"
          @change="togglePerimeterFirst"
        />
        <span class="toggle-switch"></span>
        <span class="toggle-text">
          {{ isConsumerMode ? 'Edge first' : 'Perimeter first' }}
        </span>
      </label>
      <p class="section-hint">
        {{ isConsumerMode
          ? 'Mow around the edges before filling in'
          : 'Make a boundary pass before interior stripes'
        }}
      </p>
    </div>

    <!-- Overlap/Spacing Control -->
    <div v-if="!isConsumerMode" class="section">
      <label class="section-label">
        Overlap
        <span class="label-value">{{ overlapPercent }}%</span>
      </label>
      <input
        type="range"
        class="slider"
        min="0"
        max="50"
        step="5"
        :value="overlapPercent"
        :disabled="disabled"
        @input="handleOverlapChange"
      />
      <div class="slider-labels">
        <span>Less overlap</span>
        <span>More overlap</span>
      </div>
    </div>

    <!-- Heading Control (Stripe pattern only) -->
    <div v-if="showHeadingControl" class="section">
      <label class="section-label">
        Direction
        <span class="label-value">{{ heading }}°</span>
      </label>
      <div class="heading-control">
        <div class="compass">
          <div class="compass-arrow" :style="{ transform: `rotate(${heading}deg)` }">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L8 10h8L12 2z" />
            </svg>
          </div>
          <span class="compass-label north">N</span>
          <span class="compass-label east">E</span>
          <span class="compass-label south">S</span>
          <span class="compass-label west">W</span>
        </div>
        <input
          type="range"
          class="slider"
          min="0"
          max="359"
          step="15"
          :value="heading"
          :disabled="disabled"
          @input="handleHeadingChange"
        />
      </div>
    </div>

    <!-- Edge Mode Control -->
    <div v-if="showEdgeModeControl" class="section">
      <label class="section-label">Edge Handling</label>
      <div class="edge-mode-buttons">
        <button
          v-for="option in edgeModeOptions"
          :key="option.value"
          class="edge-mode-option"
          :class="{ selected: edgeMode === option.value }"
          :disabled="disabled"
          :title="option.description"
          @click="selectEdgeMode(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- Equipment Width Control -->
    <div v-if="showEquipmentWidthControl" class="section">
      <label class="section-label">
        Equipment Width
        <span class="label-value">{{ equipmentWidth.toFixed(1) }}m</span>
      </label>
      <input
        type="range"
        class="slider"
        min="0.2"
        max="2.0"
        step="0.1"
        :value="equipmentWidth"
        :disabled="disabled"
        @input="handleEquipmentWidthChange"
      />
      <div class="slider-labels">
        <span>Narrow (20cm)</span>
        <span>Wide (2m)</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.path-configuration-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.panel-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.consumer-mode .panel-title {
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

.pattern-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);

  &.single-column {
    grid-template-columns: 1fr;
    max-width: 200px;
  }
}

.consumer-mode .pattern-grid {
  gap: var(--spacing-md);
}

.pattern-option {
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

.consumer-mode .pattern-option {
  padding: var(--spacing-lg);
}

.pattern-icon {
  font-size: 24px;
  color: var(--text-primary);
}

.consumer-mode .pattern-icon {
  font-size: 32px;
}

.pattern-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.consumer-mode .pattern-label {
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

.heading-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.compass {
  position: relative;
  width: 60px;
  height: 60px;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.compass-arrow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform-origin: center center;
  margin-left: -10px;
  margin-top: -10px;
  color: var(--primary);
  transition: transform 0.2s ease;

  svg {
    width: 100%;
    height: 100%;
  }
}

.compass-label {
  position: absolute;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);

  &.north {
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
  }

  &.south {
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
  }

  &.east {
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
  }

  &.west {
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
  }
}

.edge-mode-buttons {
  display: flex;
  gap: var(--spacing-xs);
}

.edge-mode-option {
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
  background: var(--primary);

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

.section-hint {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
</style>
