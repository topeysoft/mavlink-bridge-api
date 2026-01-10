<template>
  <div class="mowing-settings">
    <h4 class="settings-title">Mowing Settings</h4>

    <div class="form-group">
      <label for="mowing-height">Mowing Height</label>
      <div class="input-with-unit">
        <input
          id="mowing-height"
          v-model.number="localSettings.mowing_height"
          type="number"
          min="1"
          max="15"
          step="0.5"
          class="form-input"
        />
        <span class="unit">cm</span>
      </div>
      <span class="help-text">Height to cut grass (1-15 cm)</span>
    </div>

    <div class="form-group">
      <label for="pattern">Mowing Pattern</label>
      <select
        id="pattern"
        v-model="localSettings.pattern"
        class="form-select"
      >
        <option value="stripe">Stripe</option>
        <option value="spiral">Spiral</option>
        <option value="random">Random</option>
        <option value="checkerboard">Checkerboard</option>
      </select>
      <span class="help-text">Path pattern for mowing</span>
    </div>

    <div class="form-group">
      <label for="edge-mode">Edge Mode</label>
      <select
        id="edge-mode"
        v-model="localSettings.edge_mode"
        class="form-select"
      >
        <option value="trim">Trim Edges</option>
        <option value="skip">Skip Edges</option>
        <option value="overlap">Overlap Edges</option>
      </select>
      <span class="help-text">How to handle zone edges</span>
    </div>

    <div class="form-group">
      <label for="overlap">Path Overlap</label>
      <div class="input-with-unit">
        <input
          id="overlap"
          v-model.number="localSettings.overlap"
          type="number"
          min="0"
          max="50"
          step="5"
          class="form-input"
        />
        <span class="unit">%</span>
      </div>
      <span class="help-text">Overlap between mowing paths (0-50%)</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface MowingSettings {
  mowing_height?: number
  pattern?: 'stripe' | 'spiral' | 'random' | 'checkerboard'
  edge_mode?: 'trim' | 'skip' | 'overlap'
  overlap?: number
}

interface Props {
  modelValue: MowingSettings
}

interface Emits {
  (e: 'update:modelValue', value: MowingSettings): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localSettings = ref<MowingSettings>({
  mowing_height: props.modelValue.mowing_height ?? 3.5,
  pattern: props.modelValue.pattern ?? 'stripe',
  edge_mode: props.modelValue.edge_mode ?? 'trim',
  overlap: props.modelValue.overlap ?? 10
})

watch(
  localSettings,
  (newValue) => {
    emit('update:modelValue', newValue)
  },
  { deep: true }
)

watch(
  () => props.modelValue,
  (newValue) => {
    localSettings.value = {
      mowing_height: newValue.mowing_height ?? 3.5,
      pattern: newValue.pattern ?? 'stripe',
      edge_mode: newValue.edge_mode ?? 'trim',
      overlap: newValue.overlap ?? 10
    }
  },
  { deep: true }
)
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.mowing-settings {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input,
.form-select {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: white;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px rgba($primary, 0.1);
  }
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .form-input {
    flex: 1;
  }

  .unit {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
}

.help-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
</style>
