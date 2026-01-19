<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'medium'
})

const badgeClasses = computed(() => [
  'badge',
  `badge--${props.variant}`,
  `badge--${props.size}`
])
</script>

<template>
  <span :class="badgeClasses">
    <slot />
  </span>
</template>

<style scoped lang="scss">
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border-radius: var(--border-radius-full, 9999px);
  white-space: nowrap;

  // Size variants
  &--small {
    padding: 2px 8px;
    font-size: var(--font-size-xs);
  }

  &--medium {
    padding: 4px 12px;
    font-size: var(--font-size-sm);
  }

  &--large {
    padding: 6px 16px;
    font-size: var(--font-size-base);
  }

  // Color variants
  &--default {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  &--success {
    background: rgba(var(--positive-rgb, 40, 167, 69), 0.15);
    color: var(--positive);
  }

  &--warning {
    background: rgba(var(--warning-rgb, 255, 193, 7), 0.15);
    color: var(--warning-text, #856404);
  }

  &--danger {
    background: rgba(var(--negative-rgb, 220, 53, 69), 0.15);
    color: var(--negative);
  }

  &--info {
    background: rgba(var(--info-rgb, 23, 162, 184), 0.15);
    color: var(--info);
  }

  &--primary {
    background: rgba(var(--primary-rgb, 44, 95, 45), 0.15);
    color: var(--primary);
  }
}
</style>
