<script setup lang="ts">
interface RadioOption {
  value: string
  label: string
  description?: string
  icon?: string
}

interface Props {
  modelValue: string
  options: RadioOption[]
  name?: string
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleChange(value: string) {
  if (!props.disabled) {
    emit('update:modelValue', value)
  }
}
</script>

<template>
  <div class="radio-group">
    <label
      v-for="option in options"
      :key="option.value"
      class="radio-option"
      :class="{ 'radio-option--active': modelValue === option.value }"
    >
      <input
        type="radio"
        :name="name"
        :value="option.value"
        :checked="modelValue === option.value"
        :disabled="disabled"
        @change="handleChange(option.value)"
      />
      <div class="radio-content">
        <span v-if="option.icon" class="radio-icon">{{ option.icon }}</span>
        <div class="radio-text">
          <div class="radio-label">{{ option.label }}</div>
          <div v-if="option.description" class="radio-desc">{{ option.description }}</div>
        </div>
      </div>
    </label>
  </div>
</template>

<style scoped lang="scss">
.radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.radio-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;

  &--active {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.08);
    box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.1);
  }

  &:hover:not(:has(input:disabled)) {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.05);
  }

  &:has(input:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }

}

.radio-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.radio-icon {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
}

.radio-text {
  flex: 1;
}

.radio-label {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.radio-desc {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.4;
}
</style>
