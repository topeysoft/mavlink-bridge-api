<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue?: boolean
  indeterminate?: boolean
  disabled?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  indeterminate: false,
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isChecked = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <label class="checkbox" :class="{ 'checkbox--disabled': disabled }">
    <input
      type="checkbox"
      class="checkbox__input"
      :checked="modelValue"
      :indeterminate="indeterminate"
      :disabled="disabled"
      :id="id"
      @change="handleChange"
    />
    <span class="checkbox__box" :class="{ 'checkbox__box--indeterminate': indeterminate }">
      <svg
        v-if="modelValue && !indeterminate"
        class="checkbox__check"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <svg
        v-if="indeterminate"
        class="checkbox__minus"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
    <span v-if="$slots.default" class="checkbox__label">
      <slot />
    </span>
  </label>
</template>

<style scoped lang="scss">
.checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  user-select: none;

  &--disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.checkbox__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.checkbox__box {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-sm, 4px);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox__input:checked + .checkbox__box,
.checkbox__box--indeterminate {
  background: var(--primary);
  border-color: var(--primary);
}

.checkbox__input:focus-visible + .checkbox__box {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.checkbox:hover:not(.checkbox--disabled) .checkbox__box {
  border-color: var(--primary);
}

.checkbox__check,
.checkbox__minus {
  width: 14px;
  height: 14px;
  color: white;
}

.checkbox__label {
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.checkbox--disabled .checkbox__label {
  color: var(--text-tertiary);
}
</style>
