<script setup lang="ts">
interface Option {
  value: string | number;
  label: string;
}

interface Props {
  modelValue: string | number;
  label?: string;
  options: Option[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
  required: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();
</script>

<template>
  <div class="">
    <label v-if="label" class="form-label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    <select
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      class="form-select"
      :class="{ 'has-error': error }"
      @change="
        emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
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

.form-select {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  transition: all 0.2s;
  cursor: pointer;

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
