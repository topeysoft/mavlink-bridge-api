<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  modelValue: string
  label?: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
  customValidation?: (value: string) => string | null
  validateOnBlur?: boolean
  validateOnInput?: boolean
  disabled?: boolean
  helperText?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  validateOnBlur: true,
  validateOnInput: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const touched = ref(false)
const showError = ref(false)

// Validation logic
const errorMessage = computed(() => {
  const value = props.modelValue

  // Required validation
  if (props.required && !value) {
    return `${props.label || 'This field'} is required`
  }

  // Min length validation
  if (props.minLength && value.length > 0 && value.length < props.minLength) {
    return `Must be at least ${props.minLength} characters`
  }

  // Max length validation
  if (props.maxLength && value.length > props.maxLength) {
    return `Must be no more than ${props.maxLength} characters`
  }

  // Pattern validation
  if (props.pattern && value.length > 0) {
    const regex = new RegExp(props.pattern)
    if (!regex.test(value)) {
      return 'Invalid format'
    }
  }

  // Email validation
  if (props.type === 'email' && value.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return 'Invalid email address'
    }
  }

  // URL validation
  if (props.type === 'url' && value.length > 0) {
    try {
      new URL(value)
    } catch {
      return 'Invalid URL'
    }
  }

  // Custom validation
  if (props.customValidation) {
    return props.customValidation(value)
  }

  return null
})

const isValid = computed(() => !errorMessage.value)
const displayError = computed(() => touched.value && showError.value && errorMessage.value)

// Update parent value
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)

  if (props.validateOnInput) {
    showError.value = true
  }
}

const handleBlur = () => {
  touched.value = true
  if (props.validateOnBlur) {
    showError.value = true
  }
}

// Watch for external validation triggers
watch(() => props.modelValue, () => {
  if (touched.value && props.validateOnInput) {
    showError.value = true
  }
})
</script>

<template>
  <div class="validated-input" :class="{ 'has-error': displayError, 'is-valid': touched && isValid }">
    <label v-if="label" class="input-label">
      {{ label }}
      <span v-if="required" class="required-indicator">*</span>
    </label>

    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxLength"
      class="input-field"
      @input="handleInput"
      @blur="handleBlur"
    />

    <div v-if="displayError" class="error-message">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      {{ displayError }}
    </div>

    <div v-else-if="helperText" class="helper-text">
      {{ helperText }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.validated-input {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);

  .required-indicator {
    color: var(--status-danger);
  }
}

.input-field {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary-green);
    box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--bg-secondary);
  }

  &::placeholder {
    color: var(--text-tertiary);
  }
}

.has-error {
  .input-field {
    border-color: var(--status-danger);

    &:focus {
      box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
    }
  }
}

.is-valid {
  .input-field {
    border-color: var(--status-success);
  }
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--status-danger);
  font-size: var(--font-size-sm);

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}

.helper-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
</style>
