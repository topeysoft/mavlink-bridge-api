<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md'
})

const emit = defineEmits<Emits>()

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <label class="toggle-switch" :class="[`toggle-switch--${size}`]">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="handleChange"
    />
    <span class="toggle-slider"></span>
  </label>
</template>

<style scoped lang="scss">
.toggle-switch {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  cursor: pointer;

  &--sm {
    width: 36px;
    height: 20px;
  }

  &--md {
    width: 44px;
    height: 24px;
  }

  &--lg {
    width: 52px;
    height: 28px;
  }

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .toggle-slider {
      background: var(--primary-green);

      &::before {
        transform: translateX(var(--toggle-offset));
      }
    }

    &:focus-visible + .toggle-slider {
      box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.2);
    }

    &:disabled + .toggle-slider {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--border-color);
  border-radius: var(--radius-full);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &::before {
    content: '';
    position: absolute;
    background: white;
    border-radius: 50%;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  // Small size
  .toggle-switch--sm & {
    &::before {
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      --toggle-offset: 16px;
    }
  }

  // Medium size
  .toggle-switch--md & {
    &::before {
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      --toggle-offset: 20px;
    }
  }

  // Large size
  .toggle-switch--lg & {
    &::before {
      height: 22px;
      width: 22px;
      left: 3px;
      bottom: 3px;
      --toggle-offset: 24px;
    }
  }
}
</style>
