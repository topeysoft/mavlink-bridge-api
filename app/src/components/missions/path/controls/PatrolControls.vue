<script setup lang="ts">
/**
 * PatrolControls - Security/patrol mission settings
 *
 * Recording toggle, motion detection, and dwell time at waypoints.
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

// Current values
const recordingEnabled = computed(() => props.modelValue.recording ?? false)
const motionDetectionEnabled = computed(() => props.modelValue.motion_detection ?? false)
const dwellTime = computed(() => props.modelValue.dwell_time ?? 0)

function update(changes: Partial<TypeSpecificSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function toggleRecording() {
  if (props.disabled) return
  update({ recording: !recordingEnabled.value })
}

function toggleMotionDetection() {
  if (props.disabled) return
  update({ motion_detection: !motionDetectionEnabled.value })
}

function handleDwellTimeSlider(event: Event) {
  const target = event.target as HTMLInputElement
  update({ dwell_time: Number(target.value) })
}
</script>

<template>
  <div class="patrol-controls" :class="{ 'consumer-mode': isConsumerMode, disabled }">
    <h4 class="controls-title">
      {{ isConsumerMode ? 'Patrol Options' : 'Patrol Configuration' }}
    </h4>

    <!-- Recording toggle -->
    <div class="section">
      <label class="toggle-label">
        <input
          type="checkbox"
          class="toggle-input"
          :checked="recordingEnabled"
          :disabled="disabled"
          @change="toggleRecording"
        />
        <span class="toggle-switch"></span>
        <div class="toggle-content">
          <span class="toggle-text">
            {{ isConsumerMode ? 'Record video while patrolling' : 'Enable Recording' }}
          </span>
          <span v-if="isConsumerMode" class="toggle-hint">
            Save footage for later review
          </span>
        </div>
      </label>
    </div>

    <!-- Motion detection toggle -->
    <div class="section">
      <label class="toggle-label">
        <input
          type="checkbox"
          class="toggle-input"
          :checked="motionDetectionEnabled"
          :disabled="disabled"
          @change="toggleMotionDetection"
        />
        <span class="toggle-switch"></span>
        <div class="toggle-content">
          <span class="toggle-text">
            {{ isConsumerMode ? 'Watch for movement' : 'Motion Detection' }}
          </span>
          <span v-if="isConsumerMode" class="toggle-hint">
            Get alerts when something moves
          </span>
        </div>
      </label>
    </div>

    <!-- Dwell time (power user only) -->
    <div v-if="!isConsumerMode" class="section">
      <label class="section-label">
        Dwell Time at Waypoints
        <span class="label-value">{{ dwellTime }}s</span>
      </label>
      <input
        type="range"
        class="slider"
        min="0"
        max="60"
        step="5"
        :value="dwellTime"
        :disabled="disabled"
        @input="handleDwellTimeSlider"
      />
      <div class="slider-labels">
        <span>0s (No stop)</span>
        <span>60s (Long observation)</span>
      </div>
      <p class="section-hint">
        Time spent stationary at each waypoint
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.patrol-controls {
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

// Toggle switch styles
.toggle-label {
  display: flex;
  align-items: flex-start;
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
  margin-top: 2px;

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
  background: #3498db;

  &::after {
    transform: translateX(20px);
  }
}

.toggle-input:disabled + .toggle-switch {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-text {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-hint {
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
