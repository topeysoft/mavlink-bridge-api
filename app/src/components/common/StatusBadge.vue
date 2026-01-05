<script setup lang="ts">
interface Props {
  status: 'success' | 'warning' | 'error' | 'info' | 'pending'
  label?: string
  dot?: boolean
}

withDefaults(defineProps<Props>(), {
  dot: false
})
</script>

<template>
  <span class="status-badge" :class="`status-${status}`">
    <span v-if="dot" class="status-dot"></span>
    <slot>{{ label }}</slot>
  </span>
</template>

<style scoped lang="scss">
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius);
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-success {
  background: rgba(72, 187, 120, 0.1);
  color: var(--status-success);
}

.status-warning {
  background: rgba(237, 137, 54, 0.1);
  color: var(--status-warning);
}

.status-error {
  background: rgba(245, 101, 101, 0.1);
  color: var(--status-error);
}

.status-info {
  background: rgba(66, 153, 225, 0.1);
  color: var(--status-info);
}

.status-pending {
  background: rgba(160, 174, 192, 0.1);
  color: var(--text-secondary);
}
</style>
