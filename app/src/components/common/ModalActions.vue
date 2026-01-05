<template>
  <div class="modal-actions" :class="alignClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  align?: 'left' | 'center' | 'right' | 'space-between'
}

const props = withDefaults(defineProps<Props>(), {
  align: 'right'
})

const alignClass = computed(() => {
  return {
    'align-left': props.align === 'left',
    'align-center': props.align === 'center',
    'align-right': props.align === 'right',
    'align-space-between': props.align === 'space-between'
  }
})
</script>

<style scoped lang="scss">
.modal-actions {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-xl);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;

  &.align-left {
    justify-content: flex-start;
  }

  &.align-center {
    justify-content: center;
  }

  &.align-right {
    justify-content: flex-end;
  }

  &.align-space-between {
    justify-content: space-between;
  }
}
</style>
