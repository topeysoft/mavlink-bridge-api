<script setup lang="ts">
interface Props {
  modelValue: string
  label?: string
  placeholder?: string
  rows?: number
  error?: string
  disabled?: boolean
  required?: boolean
}

withDefaults(defineProps<Props>(), {
  rows: 4,
  disabled: false,
  required: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="form-group">
    <label v-if="label" class="form-label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :rows="rows"
      class="form-textarea"
      :class="{ 'has-error': error }"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
    <div v-if="error" class="form-error">{{ error }}</div>
  </div>
</template>

<style scoped lang="scss">
.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);

  .required {
    color: var(--status-error);
  }
}

.form-textarea {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-family: inherit;
  resize: vertical;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary-green);
    box-shadow: 0 0 0 3px var(--primary-green-light);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.has-error {
    border-color: var(--status-error);
  }
}

.form-error {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--status-error);
}
</style>
