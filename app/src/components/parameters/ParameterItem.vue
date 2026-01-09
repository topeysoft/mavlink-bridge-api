<script setup lang="ts">
import { ref, computed } from 'vue'
import { useParametersStore } from '@/stores/parameters'
import type { Parameter } from '@/types/parameter'
import { ParameterType } from '@/types/parameter'
import Modal from '@/components/common/Modal.vue'

const props = defineProps<{
  parameter: Parameter
}>()

const parametersStore = useParametersStore()
const showInfoDialog = ref(false)

const showSlider = computed(() => {
  return (
    props.parameter.min !== undefined &&
    props.parameter.max !== undefined &&
    !props.parameter.readOnly &&
    props.parameter.max - props.parameter.min <= 1000 // Don't show slider for very large ranges
  )
})

const formatRange = computed(() => {
  const parts: string[] = []
  if (props.parameter.min !== undefined) {
    parts.push(`${props.parameter.min}`)
  } else {
    parts.push('-∞')
  }
  parts.push('to')
  if (props.parameter.max !== undefined) {
    parts.push(`${props.parameter.max}`)
  } else {
    parts.push('∞')
  }
  if (props.parameter.units) {
    parts.push(props.parameter.units)
  }
  return parts.join(' ')
})

const getDefaultStep = computed(() => {
  // Determine default step based on parameter type
  switch (props.parameter.type) {
    case ParameterType.FLOAT:
    case ParameterType.DOUBLE:
      return 0.1
    case ParameterType.INT8:
    case ParameterType.INT16:
    case ParameterType.INT32:
    case ParameterType.UINT8:
    case ParameterType.UINT16:
    case ParameterType.UINT32:
      return 1
    default:
      return 1
  }
})

function handleValueChange(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value

  if (value === null || value === '') return

  const numValue = parseFloat(value)

  if (isNaN(numValue)) return

  // Round to step if increment is defined
  let finalValue = numValue
  if (props.parameter.increment) {
    finalValue = Math.round(numValue / props.parameter.increment) * props.parameter.increment
  }

  // Enforce min/max
  if (props.parameter.min !== undefined) {
    finalValue = Math.max(finalValue, props.parameter.min)
  }
  if (props.parameter.max !== undefined) {
    finalValue = Math.min(finalValue, props.parameter.max)
  }

  parametersStore.updateParameter(props.parameter.name, finalValue)
}

function handleSliderChange(event: Event) {
  const target = event.target as HTMLInputElement
  parametersStore.updateParameter(props.parameter.name, parseFloat(target.value))
}

function handleReset() {
  parametersStore.resetParameter(props.parameter.name)
}
</script>

<template>
  <div class="parameter-item" :class="{ modified: parameter.modified }">
    <div class="param-info">
      <div class="param-header">
        <div class="param-name">
          {{ parameter.displayName }}
          <span v-if="parameter.modified" class="badge modified-badge">Modified</span>
          <span v-if="parameter.rebootRequired" class="badge reboot-badge">Reboot Required</span>
          <span v-if="parameter.readOnly" class="badge readonly-badge">Read Only</span>
        </div>
        <div class="param-actions">
          <button
            v-if="parameter.modified"
            class="btn-icon"
            @click="handleReset"
            :title="`Reset to default (${parameter.defaultValue})`"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button class="btn-icon" @click="showInfoDialog = true" title="Parameter info">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" fill="none" stroke="white" stroke-width="2" />
            </svg>
          </button>
        </div>
      </div>
      <div class="param-description">{{ parameter.description }}</div>
      <div class="param-meta">
        <span class="param-id">{{ parameter.name }}</span>
        <span v-if="parameter.units" class="param-units">{{ parameter.units }}</span>
        <span v-if="parameter.min !== undefined || parameter.max !== undefined" class="param-range">
          Range: {{ formatRange }}
        </span>
      </div>
    </div>

    <div class="param-editor">
      <div class="editor-controls">
        <div class="input-wrapper">
          <input
            :value="parameter.value"
            type="number"
            class="param-input"
            :readonly="parameter.readOnly"
            :min="parameter.min"
            :max="parameter.max"
            :step="parameter.increment || getDefaultStep"
            @input="handleValueChange"
          />
          <span v-if="parameter.units" class="input-units">{{ parameter.units }}</span>
        </div>

        <input
          v-if="showSlider"
          :value="parameter.value"
          type="range"
          class="param-slider"
          :min="parameter.min!"
          :max="parameter.max!"
          :step="parameter.increment || getDefaultStep"
          :disabled="parameter.readOnly"
          @input="handleSliderChange"
        />
      </div>
    </div>

    <!-- Parameter Info Dialog -->
    <Modal v-model="showInfoDialog" :title="parameter.displayName" size="sm">
      <div class="param-id-caption">{{ parameter.name }}</div>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Description:</span>
          <span class="info-value">{{ parameter.description }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Type:</span>
          <span class="info-value">{{ parameter.type }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Current Value:</span>
          <span class="info-value">
            {{ parameter.value }}{{ parameter.units ? ' ' + parameter.units : '' }}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Default Value:</span>
          <span class="info-value">
            {{ parameter.defaultValue }}{{ parameter.units ? ' ' + parameter.units : '' }}
          </span>
        </div>
        <div v-if="parameter.min !== undefined" class="info-row">
          <span class="info-label">Minimum:</span>
          <span class="info-value">{{ parameter.min }}</span>
        </div>
        <div v-if="parameter.max !== undefined" class="info-row">
          <span class="info-label">Maximum:</span>
          <span class="info-value">{{ parameter.max }}</span>
        </div>
        <div v-if="parameter.increment" class="info-row">
          <span class="info-label">Increment:</span>
          <span class="info-value">{{ parameter.increment }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Group:</span>
          <span class="info-value">{{ parameter.group }}</span>
        </div>
        <div v-if="parameter.rebootRequired" class="info-row">
          <span class="info-label">Reboot:</span>
          <span class="info-value" style="color: var(--status-danger)">
            Required after change
          </span>
        </div>
        <div v-if="parameter.readOnly" class="info-row">
          <span class="info-label">Access:</span>
          <span class="info-value" style="color: var(--text-tertiary)">Read Only</span>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-secondary" @click="showInfoDialog = false">Close</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
@use 'sass:color';
.parameter-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &.modified {
    background: lighten(#f59e0b, 45%);
    border-left: 3px solid var(--status-warning);
  }

  &:hover {
    background: var(--bg-secondary);
  }

  .param-info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);

    .param-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--spacing-md);

      .param-name {
        font-weight: 500;
        color: var(--text-primary);
        font-size: var(--font-size-base);
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }

      .param-actions {
        display: flex;
        gap: var(--spacing-xs);
      }
    }

    .param-description {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      line-height: 1.5;
    }

    .param-meta {
      display: flex;
      gap: var(--spacing-md);
      font-size: var(--font-size-xs);
      color: var(--text-tertiary);

      .param-id {
        font-family: monospace;
        font-weight: 500;
        background: var(--bg-secondary);
        padding: 2px 6px;
        border-radius: 4px;
      }

      .param-units,
      .param-range {
        color: var(--text-secondary);
      }
    }
  }

  .param-editor {
    min-width: 250px;
    display: flex;
    align-items: center;

    .editor-controls {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;

        .param-input {
          width: 100%;
          padding-right: 50px;
        }

        .input-units {
          position: absolute;
          right: var(--spacing-md);
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
          pointer-events: none;
        }
      }

      .param-slider {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: var(--bg-secondary);
        outline: none;
        -webkit-appearance: none;

        &::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--primary-green);
          cursor: pointer;

          &:hover {
            background: color.adjust(#2c5f2d, $lightness: -10%);
          }
        }

        &::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--primary-green);
          cursor: pointer;
          border: none;

          &:hover {
            background: color.adjust(#2c5f2d, $lightness: -10%);
          }
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.modified-badge {
    background: var(--status-warning);
    color: white;
  }

  &.reboot-badge {
    background: var(--status-danger);
    color: white;
  }

  &.readonly-badge {
    background: var(--text-tertiary);
    color: white;
  }
}

.btn-icon {
  background: none;
  border: none;
  padding: var(--spacing-xs);
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius);
  transition: all 0.2s;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
}

.param-id-caption {
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--spacing-lg);
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  .info-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: var(--spacing-md);

    .info-label {
      font-weight: 500;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .info-value {
      color: var(--text-primary);
      font-size: var(--font-size-sm);
    }
  }
}
</style>
